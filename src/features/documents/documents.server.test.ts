import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import type { Upload } from '#/features/transactions/transactions.server'
import type { FileStorage } from '#/server/files/storage'
import { createDb } from '#/server/platform/db.server'
import {
  createCaptureLogger,
  type LogLine,
} from '#/server/platform/logger.server'
import { createR2Storage } from '#/server/platform/storage.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { documentResponse } from './document-response.server'
import {
  documentRepository,
  type DocumentFields,
  type DocumentRepository,
} from './document.repository.server'
import {
  addDocument,
  deleteDocument,
  getDocument,
  getDocuments,
  getNewDocument,
  updateDocument,
  type DocumentDeps,
} from './documents.server'

const db = createDb(env.DB)
const r2 = createR2Storage(env.FILES)
const now = new Date(Date.UTC(2026, 10, 25, 10, 0, 0))
let captured: LogLine[][] = []
const logLines = () => captured.flat()
const events = () => logLines().map((line) => line.event)
let flat = ''
let other = ''

function deps(
  userId: string,
  storage: FileStorage = r2,
  documents: DocumentRepository = documentRepository(db),
): DocumentDeps {
  const capture = createCaptureLogger()
  captured.push(capture.lines)
  return {
    userId,
    documents,
    properties: propertyRepository(db),
    sharing: sharingRepository(db),
    tenancies: tenancyRepository(db),
    storage,
    log: capture.log,
    now: () => now,
  }
}

const statement: DocumentFields = {
  kind: 'financial_statement',
  name: 'Tilinpäätös 2025',
  date: '2026-04-28',
  tenancyId: null,
}

const pdf = (size = 300_000): Upload => {
  const bytes = new Uint8Array(size)
  bytes.set(new TextEncoder().encode('%PDF-1.7\n'))
  bytes[size - 1] = 0x0a
  return { bytes, filename: 'tilinpaatos_2025.pdf' }
}

const fileKeys = async () =>
  (await env.FILES.list({ prefix: 'attachments/' })).objects.map((o) => o.key)

async function exec(sql: string, ...values: (string | number | null)[]) {
  await env.DB.prepare(sql)
    .bind(...values)
    .run()
}

async function added(userId = 'annika', fields = statement) {
  const result = await addDocument(deps(userId), flat, fields, pdf())
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.documentId
}

/** Document rows straight in: only the recorded sizes count. */
async function recordDocuments(userId: string, files: number, size: number) {
  await exec(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${String(files)})
     INSERT INTO property_documents (id, property_id, kind, name, date, key, content_type, size, filename, uploaded_by, created_at, updated_at)
     SELECT ? || '-d' || i, ?, 'other', 'Dokumentti', '2026-11-21', 'attachments/' || ? || i, 'application/pdf', ?, 'd.pdf', ?, 0, 0 FROM n`,
    userId,
    flat,
    userId,
    size,
    userId,
  )
}

/** Receipt rows straight in, each with an entry of its own. */
async function recordReceipts(userId: string, files: number, size: number) {
  const numbers = `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${String(files)})`
  await exec(
    `${numbers} INSERT INTO transactions (id, property_id, type, category, amount, date, created_by, created_at, updated_at)
     SELECT ? || '-t' || i, ?, 'expense', 'annual_repair', 100, '2026-11-12', ?, 0, 0 FROM n`,
    userId,
    flat,
    userId,
  )
  await exec(
    `${numbers} INSERT INTO receipts (id, transaction_id, key, content_type, size, filename, uploaded_by, created_at)
     SELECT ? || '-r' || i, ? || '-t' || i, 'receipts/' || ? || i, 'image/jpeg', ?, 'k.jpg', ?, 0 FROM n`,
    userId,
    userId,
    userId,
    size,
    userId,
  )
}

beforeEach(async () => {
  captured = []
  await emptyTables(
    'property_documents',
    'receipts',
    'transactions',
    'tenancy_rents',
    'tenancies',
    'ownership_periods',
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  for (const key of await fileKeys()) {
    await env.FILES.delete(key)
  }
  await addTestUser('annika')
  await addTestUser('jussi')
  await addTestUser('outsider')
  const create = async (address: string) =>
    (
      await propertyRepository(db).create(
        'annika',
        {
          streetAddress: address,
          postcode: '33100',
          city: 'Tampere',
          roomCount: 2,
          floorArea: 485,
        },
        now,
        '2025-03-01',
      )
    ).id
  flat = await create('Kuusikuja 3 B 12')
  other = await create('Koivupolku 7 A 4')
  await exec(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'member', 0)",
    flat,
  )
  await exec(
    `INSERT INTO tenancies (id, property_id, tenant_name, contract_type, contract_made, valid_from, due_day, created_by, created_at, updated_at)
     VALUES ('aino', ?, 'Aino Koski', 'open_ended', '2025-02-01', '2025-03-01', 5, 'annika', 0, 0),
            ('toinen', ?, 'Mikko Lehtinen', 'open_ended', '2025-02-01', '2025-03-01', 5, 'annika', 0, 0)`,
    flat,
    other,
  )
})

describe('Adding a document', () => {
  test('an owner adds a document with its file', async () => {
    const result = await addDocument(deps('annika'), flat, statement, pdf())
    expect(result.ok).toBe(true)
    expect(await fileKeys()).toHaveLength(1)
    expect(events()).toContain('document.added')
  })

  test("A member can't add a document", async () => {
    expect(await addDocument(deps('jussi'), flat, statement, pdf())).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await fileKeys()).toEqual([])
    expect(await documentRepository(db).countForProperty(flat)).toBe(0)
  })

  test('a flat without access is not found', async () => {
    expect(await addDocument(deps('outsider'), flat, statement, pdf())).toEqual(
      { ok: false, reason: 'property_not_found' },
    )
  })

  test('a file is removed when the insert misses', async () => {
    const failing = {
      ...documentRepository(db),
      add: () => Promise.resolve(null),
    } as DocumentRepository
    const result = await addDocument(
      deps('annika', r2, failing),
      flat,
      statement,
      pdf(),
    )
    expect(result.ok).toBe(false)
    expect(await fileKeys()).toEqual([])
  })

  test('a file is removed when the insert throws', async () => {
    const failing = {
      ...documentRepository(db),
      add: () => Promise.reject(new Error('D1 is down')),
    } as DocumentRepository
    await expect(
      addDocument(deps('annika', r2, failing), flat, statement, pdf()),
    ).rejects.toThrow('D1 is down')
    expect(await fileKeys()).toEqual([])
  })
})

describe('Document files', () => {
  test('A PDF is stored as it is', async () => {
    const upload = pdf()
    const id = await added()
    const found = await documentRepository(db).findForAccess(id)
    const stored = await r2.get(found?.key ?? '')
    expect(found?.contentType).toBe('application/pdf')
    expect(stored).not.toBeNull()
    expect(
      new Uint8Array(await new Response(stored?.body).arrayBuffer()),
    ).toEqual(upload.bytes)
  })

  test("A file that isn't an image or a PDF is refused", async () => {
    const text = {
      bytes: new TextEncoder().encode('tämä on tekstiä'),
      filename: 'sopimus.pdf',
    }
    expect(await addDocument(deps('annika'), flat, statement, text)).toEqual({
      ok: false,
      reason: 'document_unsupported_type',
    })
    expect(await fileKeys()).toEqual([])
    expect(await documentRepository(db).countForProperty(flat)).toBe(0)
    expect(events()).toContain('document.refused')
  })

  test('A file over 10 MB is refused', async () => {
    expect(
      await addDocument(deps('annika'), flat, statement, pdf(11 * 1024 * 1024)),
    ).toEqual({ ok: false, reason: 'document_too_large' })
    expect(await fileKeys()).toEqual([])
    expect(await documentRepository(db).countForProperty(flat)).toBe(0)
  })
})

describe("A lease's tenancy", () => {
  test('a lease keeps the flat’s tenancy', async () => {
    const id = await added('annika', {
      ...statement,
      kind: 'lease',
      tenancyId: 'aino',
    })
    const result = await getDocument(deps('annika'), flat, id)
    expect(result).toMatchObject({
      ok: true,
      document: { tenancyId: 'aino', tenantName: 'Aino Koski' },
    })
  })

  test("Another flat's tenancy is refused", async () => {
    expect(
      await addDocument(
        deps('annika'),
        flat,
        { ...statement, kind: 'lease', tenancyId: 'toinen' },
        pdf(),
      ),
    ).toEqual({ ok: false, reason: 'tenancy_not_found' })
    expect(await fileKeys()).toEqual([])
    expect(await documentRepository(db).countForProperty(flat)).toBe(0)
  })

  test('the owner’s options list the current tenancy first', async () => {
    await exec(
      `INSERT INTO tenancies (id, property_id, tenant_name, contract_type, contract_made, valid_from, valid_to, due_day, created_by, created_at, updated_at)
       VALUES ('vanha', ?, 'Vanha Vuokralainen', 'open_ended', '2020-01-01', '2020-02-01', '2021-01-31', 5, 'annika', 0, 0)`,
      flat,
    )
    await exec(
      "UPDATE tenancies SET valid_from = '2021-03-01' WHERE id = 'aino'",
    )
    const id = await added()
    const result = await getDocument(deps('annika'), flat, id)
    expect(result.ok && result.tenancies.map((t) => t.id)).toEqual([
      'aino',
      'vanha',
    ])
    const member = await getDocument(deps('jussi'), flat, id)
    expect(member.ok && member.tenancies).toEqual([])
  })
})

describe('The add form', () => {
  test('gives an owner the tenancies and today, a member nothing', async () => {
    expect(await getNewDocument(deps('annika'), flat)).toMatchObject({
      ok: true,
      today: '2026-11-25',
      tenancies: [{ id: 'aino', tenantName: 'Aino Koski' }],
    })
    expect(await getNewDocument(deps('jussi'), flat)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await getNewDocument(deps('outsider'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})

describe('The documents page', () => {
  test('lists documents for members, with usage for owners only', async () => {
    await added()
    const owner = await getDocuments(deps('annika'), flat)
    expect(owner.ok && owner.documents).toHaveLength(1)
    expect(owner.ok && owner.usage).toEqual({ bytes: 300_000, files: 1 })
    const member = await getDocuments(deps('jussi'), flat)
    expect(member.ok && member.documents).toHaveLength(1)
    expect(member.ok && member.usage).toBeNull()
    expect(await getDocuments(deps('outsider'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})

describe('Document details', () => {
  test('A deleted document is not found', async () => {
    const id = await added()
    await deleteDocument(deps('annika'), flat, id)
    expect(await getDocument(deps('annika'), flat, id)).toEqual({
      ok: false,
      reason: 'document_not_found',
    })
  })

  test('another flat’s document is not found through this flat', async () => {
    const id = await added()
    expect(await getDocument(deps('annika'), other, id)).toEqual({
      ok: false,
      reason: 'document_not_found',
    })
  })
})

describe('Viewing and downloading a document', () => {
  const respond = (userId: string | undefined, id: string, download = false) =>
    documentResponse(
      {
        userId,
        documents: documentRepository(db),
        sharing: sharingRepository(db),
        storage: r2,
      },
      id,
      { download },
    )

  test('A member downloads a document', async () => {
    const id = await added()
    const response = await respond('jussi', id, true)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain(
      'attachment; filename="tilinpaatos_2025.pdf"',
    )
    const inline = await respond('jussi', id)
    expect(inline.headers.get('Content-Disposition')).toContain('inline')
  })

  test("A user without access can't open a document's file", async () => {
    const id = await added()
    for (const userId of ['outsider', undefined]) {
      const response = await respond(userId, id)
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('Not found')
    }
    expect((await respond('annika', 'missing')).status).toBe(404)
  })

  test('a missing file is not found', async () => {
    const id = await added()
    for (const key of await fileKeys()) {
      await env.FILES.delete(key)
    }
    expect((await respond('annika', id)).status).toBe(404)
  })
})

describe('Editing a document', () => {
  test('Renaming a document', async () => {
    const id = await added()
    const before = await documentRepository(db).findForAccess(id)
    expect(
      await updateDocument(deps('annika'), flat, id, {
        ...statement,
        name: 'Tilinpäätös ja toimintakertomus 2025',
      }),
    ).toEqual({ ok: true })
    const after = await documentRepository(db).findDetails(id)
    expect(after?.name).toBe('Tilinpäätös ja toimintakertomus 2025')
    expect(await documentRepository(db).findForAccess(id)).toEqual(before)
    expect(events()).toContain('document.changed')
  })

  test('Changing a lease to another kind removes its tenancy', async () => {
    const id = await added('annika', {
      ...statement,
      kind: 'lease',
      tenancyId: 'aino',
    })
    await updateDocument(deps('annika'), flat, id, {
      ...statement,
      kind: 'other',
      tenancyId: 'aino',
    })
    expect(await documentRepository(db).findDetails(id)).toMatchObject({
      kind: 'other',
      tenancyId: null,
    })
  })

  test('Editing a deleted document is refused', async () => {
    const id = await added()
    await deleteDocument(deps('annika'), flat, id)
    expect(await updateDocument(deps('annika'), flat, id, statement)).toEqual({
      ok: false,
      reason: 'document_not_found',
    })
  })

  test("A member can't edit a document", async () => {
    const id = await added()
    expect(
      await updateDocument(deps('jussi'), flat, id, {
        ...statement,
        name: 'Muutettu',
      }),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
    expect((await documentRepository(db).findDetails(id))?.name).toBe(
      'Tilinpäätös 2025',
    )
  })

  test("another flat's tenancy is refused", async () => {
    const id = await added()
    expect(
      await updateDocument(deps('annika'), flat, id, {
        ...statement,
        kind: 'lease',
        tenancyId: 'toinen',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_not_found' })
  })
})

describe('Deleting a document', () => {
  test('removes the document and its file', async () => {
    const id = await added()
    expect(await deleteDocument(deps('annika'), flat, id)).toEqual({ ok: true })
    expect(await fileKeys()).toEqual([])
    expect(await documentRepository(db).countForProperty(flat)).toBe(0)
    expect(events()).toContain('document.deleted')
  })

  test("A member can't delete a document", async () => {
    const id = await added()
    expect(await deleteDocument(deps('jussi'), flat, id)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await fileKeys()).toHaveLength(1)
    expect(await documentRepository(db).countForProperty(flat)).toBe(1)
  })

  test('deleting a document that is gone is refused', async () => {
    const id = await added()
    await deleteDocument(deps('annika'), flat, id)
    expect(await deleteDocument(deps('annika'), flat, id)).toEqual({
      ok: false,
      reason: 'document_not_found',
    })
  })

  test('a failed file delete is logged and the deletion still succeeds', async () => {
    const id = await added()
    const failing: FileStorage = {
      ...r2,
      deleteMany: () => Promise.reject(new Error('R2 is down')),
    }
    expect(await deleteDocument(deps('annika', failing), flat, id)).toEqual({
      ok: true,
    })
    expect(await documentRepository(db).countForProperty(flat)).toBe(0)
    expect(logLines().find((line) => line.level === 'error')?.event).toBe(
      'document.file_delete_failed',
    )
  })
})

describe('Storage quota for documents', () => {
  test('Receipts and documents count together', async () => {
    await recordReceipts('annika', 600, 1)
    await recordDocuments('annika', 400, 1)
    expect(await addDocument(deps('annika'), flat, statement, pdf())).toEqual({
      ok: false,
      reason: 'storage_quota_full',
    })
    expect(await fileKeys()).toEqual([])
    expect(events()).toContain('document.quota_exceeded')
  })

  test('A document over the size is refused', async () => {
    await recordReceipts('annika', 1, 300_000_000)
    await recordDocuments('annika', 1, 224_000_000)
    expect(
      await addDocument(deps('annika'), flat, statement, pdf(500_000)),
    ).toEqual({ ok: false, reason: 'storage_quota_full' })
  })

  test("Another owner's documents don't count", async () => {
    await exec(
      "UPDATE property_access SET role = 'owner' WHERE user_id = 'jussi'",
    )
    await recordDocuments('jussi', 1000, 1)
    expect((await addDocument(deps('annika'), flat, statement, pdf())).ok).toBe(
      true,
    )
  })

  test('the write itself refuses a document over the quota', async () => {
    await recordDocuments('annika', 999, 1)
    const results = await Promise.all([
      addDocument(deps('annika'), flat, statement, pdf()),
      addDocument(deps('annika'), flat, statement, pdf()),
    ])
    expect(results.map((result) => result.ok).sort()).toEqual([false, true])
    expect(results).toContainEqual({ ok: false, reason: 'storage_quota_full' })
    expect(await fileKeys()).toHaveLength(1)
  })
})
