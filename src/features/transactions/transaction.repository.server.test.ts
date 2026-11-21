import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  transactionRepository,
  type ReceiptFields,
  type TransactionFields,
} from './transaction.repository.server'

const db = createDb(env.DB)
const repo = transactionRepository(db)
const now = new Date(Date.UTC(2026, 10, 21, 12, 0, 0))

let flat = ''
let other = ''

const details = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

const repair: TransactionFields = {
  type: 'expense',
  category: 'annual_repair',
  amount: 14550,
  date: '2026-11-12',
  note: 'Putkimies, keittiön hana',
}

const receipt = (key = 'receipts/a', size = 1000): ReceiptFields => ({
  key,
  contentType: 'image/jpeg',
  size,
  filename: 'kuitti_hana.jpg',
})

const entry = (date: string, amount = 1000): TransactionFields => ({
  ...repair,
  date,
  amount,
})

beforeEach(async () => {
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
  await addTestUser('annika')
  await addTestUser('jussi')
  await addTestUser('matti')
  await env.DB.prepare(
    "UPDATE user SET name = 'Jussi' WHERE id = 'jussi'",
  ).run()
  flat = (
    await propertyRepository(db).create('annika', details, now, '2025-03-01')
  ).id
  other = (
    await propertyRepository(db).create('annika', details, now, '2025-03-01')
  ).id
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'owner', ?), (?, 'matti', 'member', ?)",
  )
    .bind(flat, now.getTime(), flat, now.getTime())
    .run()
})

describe('The transaction repository', () => {
  test('an owner logs an entry with a receipt', async () => {
    const id = await repo.create('annika', flat, repair, receipt(), now)
    expect(id).not.toBeNull()
    const found = await repo.get(id ?? '')
    expect(found).toMatchObject({
      propertyId: flat,
      ...repair,
      createdBy: { id: 'annika' },
      receipt: {
        contentType: 'image/jpeg',
        size: 1000,
        filename: 'kuitti_hana.jpg',
      },
    })
  })

  test('a member logs nothing', async () => {
    expect(await repo.create('matti', flat, repair, receipt(), now)).toBeNull()
    expect(await repo.forPropertyYear(flat, 2026)).toEqual([])
    expect(await repo.storageUsage('matti')).toEqual({ bytes: 0, files: 0 })
  })

  test('the year lists its entries newest first, without other flats or years', async () => {
    await repo.create('annika', flat, entry('2026-10-28'), null, now)
    await repo.create('annika', flat, entry('2026-11-12'), receipt(), now)
    await repo.create('annika', flat, entry('2025-12-09'), null, now)
    await repo.create('annika', other, entry('2026-11-20'), null, now)
    const rows = await repo.forPropertyYear(flat, 2026)
    expect(rows.map((row) => [row.date, row.hasReceipt])).toEqual([
      ['2026-11-12', true],
      ['2026-10-28', false],
    ])
    expect(await repo.years(flat)).toEqual([2026, 2025])
  })

  test('an update keeps, replaces or removes the receipt', async () => {
    const id =
      (await repo.create('annika', flat, repair, receipt('receipts/a'), now)) ??
      ''
    const corrected = { ...repair, amount: 15450 }
    expect(
      await repo.update('jussi', flat, id, corrected, { kind: 'keep' }, now),
    ).toEqual({ applied: true, removedKeys: [] })
    expect(
      await repo.update(
        'annika',
        flat,
        id,
        corrected,
        { kind: 'replace', receipt: receipt('receipts/b', 2000) },
        now,
      ),
    ).toEqual({ applied: true, removedKeys: ['receipts/a'] })
    const replaced = await repo.get(id)
    expect(replaced).toMatchObject({
      amount: 15450,
      createdBy: { id: 'annika' },
      receipt: { size: 2000 },
    })
    expect(
      await repo.update('annika', flat, id, corrected, { kind: 'remove' }, now),
    ).toEqual({ applied: true, removedKeys: ['receipts/b'] })
    expect((await repo.get(id))?.receipt).toBeNull()
  })

  test('a member or another flat updates and deletes nothing', async () => {
    const id = (await repo.create('annika', flat, repair, receipt(), now)) ?? ''
    expect(
      await repo.update('matti', flat, id, repair, { kind: 'remove' }, now),
    ).toEqual({ applied: false, removedKeys: [] })
    expect(await repo.delete('annika', other, id)).toEqual({
      applied: false,
      removedKeys: [],
    })
    expect((await repo.get(id))?.receipt).not.toBeNull()
  })

  test('deleting an entry deletes its receipt row and returns the key', async () => {
    const id =
      (await repo.create('annika', flat, repair, receipt('receipts/a'), now)) ??
      ''
    expect(await repo.delete('jussi', flat, id)).toEqual({
      applied: true,
      removedKeys: ['receipts/a'],
    })
    expect(await repo.get(id)).toBeNull()
    expect(await repo.storageUsage('annika')).toEqual({ bytes: 0, files: 0 })
  })

  test('deleting a flat deletes its entries', async () => {
    const id = (await repo.create('annika', flat, repair, receipt(), now)) ?? ''
    await env.DB.prepare('DELETE FROM properties WHERE id = ?').bind(flat).run()
    expect(await repo.get(id)).toBeNull()
  })

  test('the receipt is found with its flat for an access check', async () => {
    const id = (await repo.create('annika', flat, repair, receipt(), now)) ?? ''
    const receiptId = (await repo.get(id))?.receipt?.id ?? ''
    expect(await repo.receiptForAccess(receiptId)).toMatchObject({
      key: 'receipts/a',
      propertyId: flat,
      transactionId: id,
    })
    expect(await repo.receiptForAccess('missing')).toBeNull()
  })

  test('the storage usage counts only the user’s own uploads', async () => {
    await repo.create('annika', flat, repair, receipt('receipts/a', 1000), now)
    await repo.create('annika', flat, repair, receipt('receipts/b', 2500), now)
    await repo.create('jussi', flat, repair, receipt('receipts/c', 4000), now)
    expect(await repo.storageUsage('annika')).toEqual({ bytes: 3500, files: 2 })
    expect(await repo.storageUsage('jussi')).toEqual({ bytes: 4000, files: 1 })
  })
})
