import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import type { FileStorage } from '#/server/files/storage'
import { createDb } from '#/server/platform/db.server'
import {
  createCaptureLogger,
  type LogLine,
} from '#/server/platform/logger.server'
import { createR2Storage } from '#/server/platform/storage.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  transactionRepository,
  type TransactionFields,
} from './transaction.repository.server'
import {
  createTransaction,
  deleteTransaction,
  getNewTransactionOptions,
  getTransaction,
  getEntriesSince,
  getTransactions,
  receiptFilename,
  updateTransaction,
  type TransactionDeps,
  type Upload,
} from './transactions.server'

const db = createDb(env.DB)
const r2 = createR2Storage(env.FILES)
// 21 November 2026 at noon in Finland.
const now = new Date(Date.UTC(2026, 10, 21, 10, 0, 0))
let captured: LogLine[][] = []
/** Every line logged since the test started, across deps() calls. */
const logLines = () => captured.flat()
let flat = ''

function deps(
  userId: string,
  storage: FileStorage = r2,
  transactions = transactionRepository(db),
): TransactionDeps {
  const capture = createCaptureLogger()
  captured.push(capture.lines)
  return {
    userId,
    transactions,
    properties: propertyRepository(db),
    ownership: ownershipRepository(db),
    sharing: sharingRepository(db),
    storage,
    log: capture.log,
    now: () => now,
  }
}

const repair: TransactionFields = {
  type: 'expense',
  category: 'annual_repair',
  amount: 14550,
  date: '2026-11-12',
  note: 'Putkimies, keittiön hana',
}

const jpeg = (size = 1000): Upload => {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff, 0xe0])
  return { bytes, filename: 'kuitti_hana.jpg' }
}

const pdf = (size = 300_000): Upload => {
  const bytes = new Uint8Array(size)
  bytes.set(new TextEncoder().encode('%PDF-1.7\n'))
  bytes[size - 1] = 0x0a
  return { bytes, filename: 'kuitti.pdf' }
}

const fileKeys = async () =>
  (await env.FILES.list({ prefix: 'receipts/' })).objects.map((o) => o.key)

const events = () => logLines().map((line) => line.event)

async function created(userId = 'annika', upload: Upload | null = jpeg()) {
  const result = await createTransaction(deps(userId), flat, repair, upload)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.transactionId
}

async function details(id: string, userId = 'annika') {
  const result = await getTransaction(deps(userId), flat, id)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.entry
}

beforeEach(async () => {
  captured = []
  await emptyTables(
    'receipts',
    'transactions',
    'recurring_amounts',
    'financing_treatments',
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
  await addTestUser('matti')
  await env.DB.prepare(
    "UPDATE user SET name = CASE id WHEN 'annika' THEN 'Annika' WHEN 'jussi' THEN 'Jussi' ELSE 'Matti' END",
  ).run()
  flat = (
    await propertyRepository(db).create(
      'annika',
      {
        streetAddress: 'Kuusikuja 3 B 12',
        postcode: '33100',
        city: 'Tampere',
        roomCount: 2,
        floorArea: 485,
      },
      now,
      '2025-03-01',
    )
  ).id
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'owner', ?), (?, 'matti', 'member', ?)",
  )
    .bind(flat, now.getTime(), flat, now.getTime())
    .run()
})

describe('Logging an entry', () => {
  test('Logging an annual repair', async () => {
    const id = await created('annika', null)
    expect(await details(id)).toMatchObject({
      ...repair,
      createdBy: { id: 'annika', name: 'Annika' },
      receipt: null,
    })
    const list = await getTransactions(deps('annika'), flat, undefined)
    expect(list.ok && list.entries.map((entry) => entry.id)).toEqual([id])
    expect(logLines()).toContainEqual(
      expect.objectContaining({
        event: 'transaction.created',
        propertyId: flat,
        transactionId: id,
        type: 'expense',
        category: 'annual_repair',
        hasReceipt: false,
      }),
    )
  })

  test('A future date is refused', async () => {
    expect(
      await createTransaction(
        deps('annika'),
        flat,
        { ...repair, date: '2026-11-22' },
        jpeg(),
      ),
    ).toEqual({ ok: false, reason: 'transaction_date_in_future' })
    expect(await fileKeys()).toEqual([])
  })

  test('A date before the ownership is refused', async () => {
    expect(
      await createTransaction(
        deps('annika'),
        flat,
        { ...repair, date: '2025-02-28' },
        null,
      ),
    ).toEqual({ ok: false, reason: 'transaction_date_before_ownership' })
  })

  test("A member can't log an entry", async () => {
    expect(
      await createTransaction(deps('matti'), flat, repair, jpeg()),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
    expect(await fileKeys()).toEqual([])
  })

  test('a user without access gets property_not_found', async () => {
    await addTestUser('outsider')
    expect(
      await createTransaction(deps('outsider'), flat, repair, null),
    ).toEqual({ ok: false, reason: 'property_not_found' })
  })
})

describe('Attaching a receipt', () => {
  test('Logging an expense with a receipt photo', async () => {
    const id = await created()
    expect((await details(id)).receipt).toMatchObject({
      contentType: 'image/jpeg',
      size: 1000,
      filename: 'kuitti_hana.jpg',
    })
    expect(await fileKeys()).toHaveLength(1)
  })

  test('A PDF receipt is stored as it is', async () => {
    const upload = pdf()
    const id = await created('annika', upload)
    const [key = ''] = await fileKeys()
    const stored = await env.FILES.get(key)
    if (!stored) {
      throw new Error('The receipt was not stored')
    }
    expect(new Uint8Array(await stored.arrayBuffer())).toEqual(upload.bytes)
    expect((await details(id)).receipt?.contentType).toBe('application/pdf')
  })

  test("A file that isn't an image or a PDF is refused", async () => {
    const text = {
      bytes: new TextEncoder().encode('not a receipt'),
      filename: 'kuitti.jpg',
    }
    expect(await createTransaction(deps('annika'), flat, repair, text)).toEqual(
      { ok: false, reason: 'receipt_unsupported_type' },
    )
    expect(await fileKeys()).toEqual([])
    const list = await getTransactions(deps('annika'), flat, 2026)
    expect(list.ok && list.entries).toEqual([])
    expect(logLines()).toContainEqual(
      expect.objectContaining({
        event: 'transaction.receipt_refused',
        problem: 'unsupported_type',
      }),
    )
  })

  test('A file over 10 MB is refused', async () => {
    expect(
      await createTransaction(
        deps('annika'),
        flat,
        repair,
        pdf(11 * 1024 * 1024),
      ),
    ).toEqual({ ok: false, reason: 'receipt_too_large' })
    expect(await fileKeys()).toEqual([])
  })

  test('the file is deleted when the database write fails', async () => {
    const failing = {
      ...transactionRepository(db),
      create: () => Promise.reject(new Error('D1 is down')),
    }
    await expect(
      createTransaction(deps('annika', r2, failing), flat, repair, jpeg()),
    ).rejects.toThrow('D1 is down')
    expect(await fileKeys()).toEqual([])
  })

  test('the stored file name has no control characters and a fallback', () => {
    expect(receiptFilename(' kuitti\u0000.jpg ', 'image/jpeg')).toBe(
      'kuitti.jpg',
    )
    expect(receiptFilename('', 'application/pdf')).toBe('receipt.pdf')
    expect(
      receiptFilename(`${'a'.repeat(150)}.jpg`, 'image/jpeg'),
    ).toHaveLength(100)
  })
})

describe('Storage quota for receipts', () => {
  const recordUploads = async (userId: string, files: number, size: number) => {
    const id = await created(userId, null)
    // One entry has one receipt, so the rows go straight in, in one
    // statement each: only the recorded sizes count, not the files.
    const numbers = `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${String(files)})`
    await env.DB.prepare(
      `${numbers} INSERT INTO transactions (id, property_id, type, category, amount, date, created_by, created_at, updated_at) SELECT ? || '-' || i, property_id, type, category, amount, date, created_by, created_at, updated_at FROM transactions, n WHERE id = ?`,
    )
      .bind(userId, id)
      .run()
    await env.DB.prepare(
      `${numbers} INSERT INTO receipts (id, transaction_id, key, content_type, size, filename, uploaded_by, created_at) SELECT ? || '-r' || i, ? || '-' || i, 'receipts/' || ? || i, 'image/jpeg', ?, 'k.jpg', ?, 0 FROM n`,
    )
      .bind(userId, userId, userId, size, userId)
      .run()
  }

  test('A receipt over the file count is refused', async () => {
    await recordUploads('annika', 1000, 1)
    expect(
      await createTransaction(deps('annika'), flat, repair, jpeg()),
    ).toEqual({ ok: false, reason: 'storage_quota_full' })
    expect(await fileKeys()).toEqual([])
    expect(events()).toContain('transaction.quota_exceeded')
  })

  test('A receipt over the size is refused', async () => {
    await recordUploads('annika', 1, 524_000_000)
    expect(
      await createTransaction(deps('annika'), flat, repair, jpeg(500_000)),
    ).toEqual({ ok: false, reason: 'storage_quota_full' })
  })

  test('the write itself refuses a receipt over the quota', async () => {
    await recordUploads('annika', 999, 1)
    // Both checks before the writes see 999 files; only one write fits.
    const results = await Promise.all([
      createTransaction(deps('annika'), flat, repair, jpeg()),
      createTransaction(deps('annika'), flat, repair, jpeg()),
    ])
    expect(results.map((result) => result.ok).sort()).toEqual([false, true])
    expect(results).toContainEqual({ ok: false, reason: 'storage_quota_full' })
    expect(await fileKeys()).toHaveLength(1)
  })

  test('a replacement over the quota changes nothing', async () => {
    const id = await created()
    await recordUploads('annika', 1, 524_287_000)
    expect(
      await updateTransaction(deps('annika'), flat, id, repair, {
        action: 'replace',
        upload: jpeg(2000),
      }),
    ).toEqual({ ok: false, reason: 'storage_quota_full' })
    expect((await details(id)).receipt?.size).toBe(1000)
    expect(await fileKeys()).toHaveLength(1)
  })

  test('a replacement at the file count is allowed', async () => {
    const id = await created()
    // With the entry's own receipt, the user has the full 1000 files.
    await recordUploads('annika', 999, 1)
    expect(
      await updateTransaction(deps('annika'), flat, id, repair, {
        action: 'replace',
        upload: jpeg(2000),
      }),
    ).toEqual({ ok: true })
    expect((await details(id)).receipt?.size).toBe(2000)
  })

  test("Another owner's files don't count", async () => {
    await recordUploads('jussi', 1000, 1)
    expect(
      (await createTransaction(deps('annika'), flat, repair, jpeg())).ok,
    ).toBe(true)
  })
})

describe('Editing an entry', () => {
  test('Correcting the amount', async () => {
    const id = await created()
    expect(
      await updateTransaction(
        deps('annika'),
        flat,
        id,
        { ...repair, amount: 15450 },
        { action: 'keep' },
      ),
    ).toEqual({ ok: true })
    expect(await details(id)).toMatchObject({ ...repair, amount: 15450 })
    expect(logLines()).toContainEqual(
      expect.objectContaining({
        event: 'transaction.updated',
        receiptChange: 'none',
      }),
    )
  })

  test('A co-owner edits an entry', async () => {
    const id = await created('jussi', null)
    await updateTransaction(
      deps('annika'),
      flat,
      id,
      { ...repair, note: 'Hana ja tiiviste' },
      { action: 'keep' },
    )
    expect(await details(id)).toMatchObject({
      note: 'Hana ja tiiviste',
      createdBy: { id: 'jussi', name: 'Jussi' },
    })
  })

  test('Replacing the receipt deletes the old file', async () => {
    const id = await created()
    const [oldKey] = await fileKeys()
    await updateTransaction(deps('annika'), flat, id, repair, {
      action: 'replace',
      upload: pdf(),
    })
    const keys = await fileKeys()
    expect(keys).toHaveLength(1)
    expect(keys).not.toContain(oldKey)
    expect((await details(id)).receipt?.contentType).toBe('application/pdf')
    expect(logLines()).toContainEqual(
      expect.objectContaining({ receiptChange: 'replaced' }),
    )
  })

  test('Removing the receipt', async () => {
    const id = await created()
    await updateTransaction(deps('annika'), flat, id, repair, {
      action: 'remove',
    })
    expect((await details(id)).receipt).toBeNull()
    expect(await fileKeys()).toEqual([])
  })

  test('Editing a deleted entry is refused', async () => {
    const id = await created('jussi')
    await deleteTransaction(deps('jussi'), flat, id)
    expect(
      await updateTransaction(deps('annika'), flat, id, repair, {
        action: 'replace',
        upload: jpeg(),
      }),
    ).toEqual({ ok: false, reason: 'transaction_not_found' })
    expect(await fileKeys()).toEqual([])
  })

  test("A member can't edit an entry", async () => {
    const id = await created()
    expect(
      await updateTransaction(
        deps('matti'),
        flat,
        id,
        { ...repair, amount: 1 },
        { action: 'remove' },
      ),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
    expect(await details(id)).toMatchObject({ amount: 14550 })
    expect(await fileKeys()).toHaveLength(1)
  })

  test('a failed delete of the old file is logged as an error', async () => {
    const id = await created()
    const broken: FileStorage = {
      ...r2,
      deleteMany: () => Promise.reject(new Error('R2 is down')),
    }
    expect(
      await updateTransaction(deps('annika', broken), flat, id, repair, {
        action: 'remove',
      }),
    ).toEqual({ ok: true })
    expect(logLines()).toContainEqual(
      expect.objectContaining({
        level: 'error',
        event: 'transaction.receipt_delete_failed',
      }),
    )
  })
})

describe('Deleting an entry', () => {
  test('Deleting an entry with its receipt', async () => {
    const id = await created()
    expect(await deleteTransaction(deps('annika'), flat, id)).toEqual({
      ok: true,
    })
    const list = await getTransactions(deps('annika'), flat, 2026)
    expect(list.ok && list.entries).toEqual([])
    expect(await fileKeys()).toEqual([])
    expect(events()).toContain('transaction.deleted')
  })

  test("A member can't delete an entry", async () => {
    const id = await created()
    expect(await deleteTransaction(deps('matti'), flat, id)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await fileKeys()).toHaveLength(1)
  })
})

describe('The entries page', () => {
  test('the year shows its totals and the years with entries', async () => {
    const add = (fields: Partial<TransactionFields>) =>
      createTransaction(deps('annika'), flat, { ...repair, ...fields }, null)
    await add({ amount: 14550, date: '2026-11-12' })
    await add({
      type: 'income',
      category: 'tenant_water_charge',
      amount: 4000,
      date: '2026-11-03',
    })
    await add({ amount: 18600, date: '2026-10-28' })
    await add({ amount: 21000, date: '2025-12-09' })
    const view = await getTransactions(deps('matti'), flat, undefined)
    expect(view).toMatchObject({
      ok: true,
      role: 'member',
      year: 2026,
      years: [2026, 2025],
      totals: { income: 4000, expense: 33150 },
    })
    expect(view.ok && view.entries.map((entry) => entry.date)).toEqual([
      '2026-11-12',
      '2026-11-03',
      '2026-10-28',
    ])
  })

  test('a year without entries left stays in the years', async () => {
    const { ok } = await createTransaction(
      deps('annika'),
      flat,
      { ...repair, date: '2025-05-02' },
      null,
    )
    expect(ok).toBe(true)
    const listed = await getTransactions(deps('annika'), flat, 2025)
    const id = listed.ok ? (listed.entries[0]?.id ?? '') : ''
    expect((await deleteTransaction(deps('annika'), flat, id)).ok).toBe(true)
    expect(await getTransactions(deps('annika'), flat, 2025)).toMatchObject({
      year: 2025,
      years: [2026, 2025],
      entries: [],
    })
  })

  test('a user without access gets property_not_found', async () => {
    await addTestUser('outsider')
    expect(await getTransactions(deps('outsider'), flat, 2026)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})

describe('New entry from the bottom bar', () => {
  test('only owned flats are offered', async () => {
    const options = await getNewTransactionOptions(deps('matti'))
    expect(options).toMatchObject({ owned: [], hasFlats: true })
    const owner = await getNewTransactionOptions(deps('annika'))
    expect(owner.owned.map((flatOption) => flatOption.id)).toEqual([flat])
  })

  test('An archived flat is not offered', async () => {
    await propertyRepository(db).setArchived('annika', flat, new Date())

    const options = await getNewTransactionOptions(deps('annika'))

    expect(options.owned).toEqual([])
  })
})

describe('Water charge entries are warned about', () => {
  test('everyone with access gets the count and the total', async () => {
    await createTransaction(
      deps('annika'),
      flat,
      {
        type: 'income',
        category: 'tenant_water_charge',
        amount: 4400,
        date: '2026-02-05',
        note: null,
      },
      null,
    )
    for (const user of ['annika', 'matti']) {
      expect(
        await getEntriesSince(
          deps(user),
          flat,
          'tenant_water_charge',
          '2026-01-01',
        ),
      ).toEqual({ ok: true, count: 1, total: 4400 })
    }
  })

  test('a stranger gets not found', async () => {
    await addTestUser('outsider')
    expect(
      await getEntriesSince(
        deps('outsider'),
        flat,
        'tenant_water_charge',
        '2026-01-01',
      ),
    ).toEqual({ ok: false, reason: 'property_not_found' })
  })
})
