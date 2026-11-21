import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { createDb } from '#/server/platform/db.server'
import { createR2Storage } from '#/server/platform/storage.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { receiptResponse } from './receipt-response.server'
import { transactionRepository } from './transaction.repository.server'

const db = createDb(env.DB)
const storage = createR2Storage(env.FILES)
const now = new Date(Date.UTC(2026, 10, 21, 10, 0, 0))
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
let receiptId = ''

const respond = (
  userId: string | undefined,
  download = false,
  id = receiptId,
) =>
  receiptResponse(
    {
      userId,
      transactions: transactionRepository(db),
      sharing: sharingRepository(db),
      storage,
    },
    id,
    { download },
  )

beforeEach(async () => {
  await emptyTables(
    'receipts',
    'transactions',
    'ownership_periods',
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('matti')
  await addTestUser('outsider')
  const flat = (
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
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'matti', 'member', ?)",
  )
    .bind(flat, now.getTime())
    .run()
  await storage.put('receipts/test', bytes, 'image/jpeg')
  const repo = transactionRepository(db)
  const id = await repo.create(
    'annika',
    flat,
    {
      type: 'expense',
      category: 'annual_repair',
      amount: 14550,
      date: '2026-11-12',
      note: null,
    },
    {
      key: 'receipts/test',
      contentType: 'image/jpeg',
      size: bytes.byteLength,
      filename: 'kuitti_hana.jpg',
    },
    now,
  )
  receiptId = (await repo.get(id ?? ''))?.receipt?.id ?? ''
})

describe('Viewing and downloading a receipt', () => {
  test('A member downloads a receipt', async () => {
    const response = await respond('matti', true)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain(
      'attachment; filename="kuitti_hana.jpg"',
    )
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })

  test("A user without access can't open a receipt", async () => {
    const response = await respond('outsider')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not found')
  })
})

describe('serving receipts', () => {
  test('an owner sees it inline, not cached', async () => {
    const response = await respond('annika')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
    expect(response.headers.get('Content-Disposition')).toMatch(/^inline;/)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  test('a visitor who is not signed in gets 404', async () => {
    expect((await respond(undefined)).status).toBe(404)
  })

  test('an unknown receipt or a missing file gets 404', async () => {
    expect((await respond('annika', false, 'missing')).status).toBe(404)
    await storage.delete('receipts/test')
    expect((await respond('annika')).status).toBe(404)
  })
})
