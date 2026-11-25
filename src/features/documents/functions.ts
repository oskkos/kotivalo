// Server functions for documents, called by the documents pages and the
// form. The logic is in documents.server.ts; these check the session, wire
// in the request context and read the form data. Adding takes FormData, so
// the file travels with the document.
import { createServerFn } from '@tanstack/react-start'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import type { Upload } from '#/features/transactions/transactions.server'
import { isReason, type Reason } from '#/lib/reasons'
import { MAX_UPLOAD_BYTES } from '#/server/files/upload'
import { getRequestContext } from '#/server/platform/context.server'
import { documentRepository } from './document.repository.server'
import {
  addDocument as add,
  deleteDocument as remove,
  getDocument as getOne,
  getDocuments as getList,
  updateDocument as update,
  type DocumentDeps,
} from './documents.server'
import {
  addDocumentInput,
  documentRefInput,
  updateDocumentInput,
} from './schemas'
import { propertyRefInput } from '#/features/ownership/schemas'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function documentDeps(): Promise<DocumentDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    documents: documentRepository(context.db),
    properties: propertyRepository(context.db),
    sharing: sharingRepository(context.db),
    tenancies: tenancyRepository(context.db),
    storage: context.storage,
    log: context.log,
    now: () => new Date(),
  }
}

/** The form's text fields and its file. */
interface FormInput {
  fields: Record<string, string>
  file: File | null
}

/** Reads the document form's FormData; anything else is a bug. */
function readForm(data: unknown): FormInput {
  if (!(data instanceof FormData)) {
    throw new Error('Expected form data')
  }
  const fields: Record<string, string> = {}
  let file: File | null = null
  for (const [name, value] of data.entries()) {
    if (name === 'file') {
      if (typeof value !== 'string' && value.size > 0) {
        file = value
      }
    } else if (typeof value === 'string') {
      fields[name] = value
    }
  }
  return { fields, file }
}

/** The first issue's reason code; an issue without one is a bug. */
function firstReason(error: { issues: readonly { message: string }[] }): {
  ok: false
  reason: Reason
} {
  const reason = error.issues[0]?.message
  if (!isReason(reason)) {
    throw new Error('Invalid document input')
  }
  return { ok: false, reason }
}

export const getDocuments = createServerFn({ method: 'GET' })
  .validator(propertyRefInput)
  .handler(async ({ data }) => getList(await documentDeps(), data.propertyId))

export const getDocument = createServerFn({ method: 'GET' })
  .validator(documentRefInput)
  .handler(async ({ data }) =>
    getOne(await documentDeps(), data.propertyId, data.documentId),
  )

export const addDocument = createServerFn({ method: 'POST' })
  .validator(readForm)
  .handler(async ({ data }) => {
    const parsed = addDocumentInput.safeParse(data.fields)
    if (!parsed.success) {
      return firstReason(parsed.error)
    }
    if (!data.file) {
      throw new Error('A document needs a file')
    }
    if (data.file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, reason: 'document_too_large' } as const
    }
    const upload: Upload = {
      bytes: new Uint8Array(await data.file.arrayBuffer()),
      filename: data.file.name,
    }
    const { propertyId, ...fields } = parsed.data
    return add(await documentDeps(), propertyId, fields, upload)
  })

export const updateDocument = createServerFn({ method: 'POST' })
  .validator(updateDocumentInput)
  .handler(async ({ data }) => {
    const { propertyId, documentId, ...fields } = data
    return update(await documentDeps(), propertyId, documentId, fields)
  })

export const deleteDocument = createServerFn({ method: 'POST' })
  .validator(documentRefInput)
  .handler(async ({ data }) =>
    remove(await documentDeps(), data.propertyId, data.documentId),
  )
