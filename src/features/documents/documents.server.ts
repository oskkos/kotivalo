// A flat's documents: the logic behind the server functions in functions.ts,
// with its dependencies passed in so Workers tests can drive it (openspec:
// documents). A file is checked and stored before the database write and
// deleted again if that write doesn't apply, so a refused or failed save
// leaves no file behind.
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import type { TenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { currentTenancy } from '#/features/tenancies/status'
import type { Upload } from '#/features/transactions/transactions.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { PropertyRole } from '#/server/db/schema'
import { deleteStoredFiles } from '#/server/files/delete'
import { fitsQuota, type StorageUsage } from '#/server/files/quota'
import { uploadFilename, withStoredFile } from '#/server/files/stored'
import { newFileKey, type FileStorage } from '#/server/files/storage'
import { checkUpload, UploadError } from '#/server/files/upload'
import type { Logger } from '#/server/log/log'
import type {
  DocumentDetails,
  DocumentFields,
  DocumentFile,
  DocumentRepository,
  DocumentRow,
} from './document.repository.server'

export interface DocumentDeps {
  /** The signed-in user. */
  userId: string
  documents: DocumentRepository
  properties: PropertyRepository
  sharing: SharingRepository
  tenancies: TenancyRepository
  storage: FileStorage
  log: Logger
  now: () => Date
}

interface Failure<R extends FieldReason | AlertReason = AlertReason> {
  ok: false
  reason: R
}

const notFound = {
  ok: false,
  reason: 'property_not_found',
} as const satisfies Failure
const ownerOnly = {
  ok: false,
  reason: 'sharing_owner_only',
} as const satisfies Failure
const documentNotFound = {
  ok: false,
  reason: 'document_not_found',
} as const satisfies Failure
const tenancyNotFound = {
  ok: false,
  reason: 'tenancy_not_found',
} as const satisfies Failure

async function roleCheck(
  deps: DocumentDeps,
  propertyId: string,
): Promise<typeof notFound | typeof ownerOnly | undefined> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  return role === 'owner' ? undefined : ownerOnly
}

/** The lease's tenancy must be one of the flat's. */
async function tenancyProblem(
  deps: DocumentDeps,
  propertyId: string,
  fields: DocumentFields,
): Promise<typeof tenancyNotFound | undefined> {
  if (fields.kind !== 'lease' || fields.tenancyId === null) {
    return undefined
  }
  const flatsTenancies = await deps.tenancies.forProperty(propertyId)
  return flatsTenancies.some((tenancy) => tenancy.id === fields.tenancyId)
    ? undefined
    : tenancyNotFound
}

function quotaFull(
  deps: DocumentDeps,
  propertyId: string,
): Failure<'storage_quota_full'> {
  deps.log.warn('document.quota_exceeded', { propertyId })
  return { ok: false, reason: 'storage_quota_full' }
}

/**
 * Checks and stores a document's file. Returns its fields, or why it was
 * refused; nothing is stored then.
 */
async function storeFile(
  deps: DocumentDeps,
  propertyId: string,
  upload: Upload,
): Promise<
  { ok: true; file: DocumentFile } | Failure<FieldReason | AlertReason>
> {
  let checked: ReturnType<typeof checkUpload>
  try {
    checked = checkUpload(upload.bytes)
  } catch (error) {
    if (!(error instanceof UploadError)) {
      throw error
    }
    deps.log.warn('document.refused', { propertyId, problem: error.problem })
    return {
      ok: false,
      reason:
        error.problem === 'too_large'
          ? 'document_too_large'
          : 'document_unsupported_type',
    }
  }
  // A first check, so a full quota stores no file; the write checks again.
  const usage = await deps.documents.storageUsage(deps.userId)
  if (!fitsQuota(usage, checked.size)) {
    return quotaFull(deps, propertyId)
  }
  const key = newFileKey('attachments')
  await deps.storage.put(key, upload.bytes, checked.contentType)
  return {
    ok: true,
    file: {
      key,
      contentType: checked.contentType,
      size: checked.size,
      filename: uploadFilename(
        upload.filename,
        checked.contentType,
        'document',
      ),
    },
  }
}

export interface DocumentsView {
  role: PropertyRole
  property: Property
  /** Newest first. */
  documents: DocumentRow[]
  /** Owners only: what their uploads take of the quota. */
  usage: StorageUsage | null
}

export async function getDocuments(
  deps: DocumentDeps,
  propertyId: string,
): Promise<({ ok: true } & DocumentsView) | typeof notFound> {
  const [role, property] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
  ])
  if (!role || !property) {
    return notFound
  }
  const [documents, usage] = await Promise.all([
    deps.documents.listForProperty(propertyId),
    role === 'owner' ? deps.documents.storageUsage(deps.userId) : null,
  ])
  return { ok: true, role, property, documents, usage }
}

/** A tenancy a lease can name. */
export interface TenancyChoice {
  id: string
  tenantName: string
  validFrom: IsoDate
  validTo: IsoDate | null
}

/** The flat's tenancies a lease can name: the current one first. */
async function tenancyChoices(
  deps: DocumentDeps,
  propertyId: string,
  today: IsoDate,
): Promise<TenancyChoice[]> {
  const all = await deps.tenancies.forProperty(propertyId)
  const current = currentTenancy(all, today)
  const ordered = current
    ? [current, ...all.filter((tenancy) => tenancy.id !== current.id)]
    : all
  return ordered.map((tenancy) => ({
    id: tenancy.id,
    tenantName: tenancy.tenantName,
    validFrom: tenancy.validFrom,
    validTo: tenancy.validTo,
  }))
}

export interface NewDocumentView {
  property: Property
  tenancies: TenancyChoice[]
  today: IsoDate
}

/** What the add form needs. Owners only. */
export async function getNewDocument(
  deps: DocumentDeps,
  propertyId: string,
): Promise<
  ({ ok: true } & NewDocumentView) | typeof notFound | typeof ownerOnly
> {
  const [refused, property] = await Promise.all([
    roleCheck(deps, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
  ])
  if (refused) {
    return refused
  }
  if (!property) {
    return notFound
  }
  const today = isoDateInFinland(deps.now())
  return {
    ok: true,
    property,
    tenancies: await tenancyChoices(deps, propertyId, today),
    today,
  }
}

export interface DocumentView {
  role: PropertyRole
  property: Property
  document: DocumentDetails
  /** Whether the signed-in user added it. */
  addedByYou: boolean
  /** Owners only: the current tenancy first, then the others newest first. */
  tenancies: TenancyChoice[]
  today: IsoDate
}

export async function getDocument(
  deps: DocumentDeps,
  propertyId: string,
  documentId: string,
): Promise<
  ({ ok: true } & DocumentView) | typeof notFound | typeof documentNotFound
> {
  const [role, property, document] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    deps.documents.findDetails(documentId),
  ])
  if (!role || !property) {
    return notFound
  }
  if (document?.propertyId !== propertyId) {
    return documentNotFound
  }
  const today = isoDateInFinland(deps.now())
  const tenancies =
    role === 'owner' ? await tenancyChoices(deps, propertyId, today) : []
  return {
    ok: true,
    role,
    property,
    document,
    addedByYou: document.uploadedBy.id === deps.userId,
    tenancies,
    today,
  }
}

export async function addDocument(
  deps: DocumentDeps,
  propertyId: string,
  fields: DocumentFields,
  upload: Upload,
): Promise<
  { ok: true; documentId: string } | Failure<FieldReason | AlertReason>
> {
  const refused =
    (await roleCheck(deps, propertyId)) ??
    (await tenancyProblem(deps, propertyId, fields))
  if (refused) {
    return refused
  }
  const stored = await storeFile(deps, propertyId, upload)
  if (!stored.ok) {
    return stored
  }
  const { file } = stored
  const id = await withStoredFile(
    deps,
    'document.file_delete_failed',
    file.key,
    () => deps.documents.add(deps.userId, propertyId, fields, file, deps.now()),
    (added) => added !== null,
  )
  if (id === null) {
    const again =
      (await roleCheck(deps, propertyId)) ??
      (await tenancyProblem(deps, propertyId, fields))
    return again ?? quotaFull(deps, propertyId)
  }
  deps.log.info('document.added', {
    propertyId,
    documentId: id,
    kind: fields.kind,
  })
  return { ok: true, documentId: id }
}

export async function updateDocument(
  deps: DocumentDeps,
  propertyId: string,
  documentId: string,
  fields: DocumentFields,
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const existing = await deps.documents.findForAccess(documentId)
  if (existing?.propertyId !== propertyId) {
    return documentNotFound
  }
  const problem = await tenancyProblem(deps, propertyId, fields)
  if (problem) {
    return problem
  }
  const applied = await deps.documents.update(
    deps.userId,
    documentId,
    fields,
    deps.now(),
  )
  if (!applied) {
    return (await deps.documents.findForAccess(documentId))
      ? tenancyNotFound
      : documentNotFound
  }
  deps.log.info('document.changed', {
    propertyId,
    documentId,
    kind: fields.kind,
  })
  return { ok: true }
}

export async function deleteDocument(
  deps: DocumentDeps,
  propertyId: string,
  documentId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const existing = await deps.documents.findForAccess(documentId)
  if (existing?.propertyId !== propertyId) {
    return documentNotFound
  }
  const key = await deps.documents.remove(deps.userId, documentId)
  if (key === null) {
    return documentNotFound
  }
  await deleteStoredFiles(
    deps.storage,
    deps.log,
    [key],
    'document.file_delete_failed',
  )
  deps.log.info('document.deleted', { propertyId, documentId })
  return { ok: true }
}
