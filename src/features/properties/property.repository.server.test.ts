import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import type { PropertyDetails } from './property'
import { propertyRepository } from './property.repository.server'

const db = createDb(env.DB)
const repository = propertyRepository(db)
const now = new Date(Date.UTC(2026, 10, 19, 12, 0, 0))

const kuusikuja: PropertyDetails = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2,
  floorArea: 485,
}

async function accessRows() {
  const { results } = await env.DB.prepare(
    'SELECT property_id, user_id, role FROM property_access',
  ).all()
  return results
}

beforeEach(async () => {
  await emptyTables('property_access', 'properties', 'user')
  await addTestUser('anna')
  await addTestUser('bertta')
})

describe('propertyRepository', () => {
  test('create gives the creator owner access and no one else', async () => {
    const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')

    expect(flat).toMatchObject(kuusikuja)
    expect(flat.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await accessRows()).toEqual([
      { property_id: flat.id, user_id: 'anna', role: 'owner' },
    ])
  })

  test('finds and lists only flats the user has access to', async () => {
    const annas = await repository.create('anna', kuusikuja, now, '2022-06-12')
    const berttas = await repository.create(
      'bertta',
      { ...kuusikuja, streetAddress: 'Rantatie 15 C 21' },
      now,
      '2022-06-12',
    )

    expect(await repository.findForUser('anna', annas.id)).toEqual({
      ...annas,
      archivedAt: null,
    })
    expect(await repository.findForUser('anna', berttas.id)).toBeUndefined()
    expect(await repository.findForUser('anna', 'missing')).toBeUndefined()
    expect(await repository.listForUser('anna')).toEqual([annas])
    expect(await repository.listForUser('bertta')).toEqual([berttas])
  })

  test('update changes a flat the user has access to', async () => {
    const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
    const changed = { ...kuusikuja, floorArea: 490, roomCount: 3 } as const

    expect(await repository.update('anna', flat.id, changed, now)).toBe(true)
    expect(await repository.findForUser('anna', flat.id)).toMatchObject({
      id: flat.id,
      ...changed,
    })
  })

  test('update leaves a flat without access unchanged', async () => {
    const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')

    expect(
      await repository.update(
        'bertta',
        flat.id,
        { ...kuusikuja, floorArea: 10 },
        now,
      ),
    ).toBe(false)
    expect(await repository.findForUser('anna', flat.id)).toMatchObject(flat)
  })

  test('counts the flats the user has access to', async () => {
    await repository.create('anna', kuusikuja, now, '2022-06-12')
    await repository.create('anna', kuusikuja, now, '2022-06-12')
    await repository.create('bertta', kuusikuja, now, '2022-06-12')

    expect(await repository.countForUser('anna')).toBe(2)
    expect(await repository.countForUser('bertta')).toBe(1)
  })

  describe('archiving', () => {
    const later = new Date(Date.UTC(2026, 10, 25, 9, 0, 0))

    async function share(propertyId: string, userId: string) {
      await env.DB.prepare(
        `INSERT INTO property_access (property_id, user_id, role, created_at)
         VALUES (?, ?, 'member', 0)`,
      )
        .bind(propertyId, userId)
        .run()
    }

    test('hides the flat only for the user who archived it', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await share(flat.id, 'bertta')

      expect(await repository.setArchived('anna', flat.id, later)).toBe(
        'changed',
      )

      expect(await repository.listForUser('anna')).toEqual([])
      expect(await repository.listArchivedForUser('anna')).toEqual([
        { ...flat, archivedAt: later },
      ])
      expect(await repository.listForUser('bertta')).toEqual([flat])
      expect(await repository.listArchivedForUser('bertta')).toEqual([])
      expect(await repository.findForUser('anna', flat.id)).toMatchObject({
        archivedAt: later,
      })
    })

    test('restoring brings the flat back', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await repository.setArchived('anna', flat.id, later)

      expect(await repository.setArchived('anna', flat.id, null)).toBe(
        'changed',
      )
      expect(await repository.setArchived('anna', flat.id, null)).toBe(
        'unchanged',
      )

      expect(await repository.listForUser('anna')).toEqual([flat])
      expect(await repository.listArchivedForUser('anna')).toEqual([])
    })

    test('archiving again keeps the first date', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await repository.setArchived('anna', flat.id, later)

      const again = new Date(later.getTime() + 86_400_000)
      expect(await repository.setArchived('anna', flat.id, again)).toBe(
        'unchanged',
      )

      expect(await repository.findForUser('anna', flat.id)).toMatchObject({
        archivedAt: later,
      })
    })

    test("a user can't archive a flat without access", async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')

      expect(await repository.setArchived('bertta', flat.id, later)).toBe(
        'not_found',
      )
      expect(await repository.setArchived('bertta', flat.id, null)).toBe(
        'not_found',
      )
      expect(await repository.listForUser('anna')).toEqual([flat])
    })

    test('an archived flat is still counted', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await repository.setArchived('anna', flat.id, later)

      expect(await repository.countForUser('anna')).toBe(1)
    })
  })

  describe('deleting', () => {
    /** Every table that belongs to a flat, with how its rows are counted. */
    const CHILD_TABLES = {
      property_access: 'property_id',
      property_invitations: 'property_id',
      ownership_periods: 'property_id',
      financing_charges: 'property_id',
      recurring_amounts: 'property_id',
      financing_treatments: 'property_id',
      usage_charges: 'property_id',
      usage_charge_amounts:
        'usage_charge_id IN (SELECT id FROM usage_charges WHERE property_id',
      tenancies: 'property_id',
      tenancy_rents:
        'tenancy_id IN (SELECT id FROM tenancies WHERE property_id',
      tenancy_occupants:
        'tenancy_id IN (SELECT id FROM tenancies WHERE property_id',
      tenant_fees: 'tenancy_id IN (SELECT id FROM tenancies WHERE property_id',
      tenant_fee_amounts:
        'tenant_fee_id IN (SELECT id FROM tenant_fees WHERE tenancy_id IN (SELECT id FROM tenancies WHERE property_id',
      rent_payments:
        'tenancy_id IN (SELECT id FROM tenancies WHERE property_id',
      transactions: 'property_id',
      receipts:
        'transaction_id IN (SELECT id FROM transactions WHERE property_id',
      property_documents: 'property_id',
    } as const

    async function rowsOf(table: keyof typeof CHILD_TABLES, id: string) {
      const where = CHILD_TABLES[table]
      const closing = ')'.repeat(where.split('(').length - 1)
      const { results } = await env.DB.prepare(
        `SELECT 1 FROM ${table} WHERE ${where} = ?${closing}`,
      )
        .bind(id)
        .all()
      return results.length
    }

    async function exec(sql: string, ...values: (string | number | null)[]) {
      await env.DB.prepare(sql)
        .bind(...values)
        .run()
    }

    /** One row in every table that belongs to the flat. */
    async function fill(id: string, userId: string, key: string) {
      await exec(
        `INSERT INTO property_invitations (id, property_id, email, invited_by, created_at, expires_at)
         VALUES (?, ?, 'liisa@example.com', ?, 0, 1)`,
        `inv-${id}`,
        id,
        userId,
      )
      await exec(
        `INSERT INTO financing_charges (id, property_id, name) VALUES (?, ?, 'Putkiremontti')`,
        `fc-${id}`,
        id,
      )
      await exec(
        `INSERT INTO recurring_amounts (id, property_id, kind, amount, valid_from, financing_charge_id)
         VALUES (?, ?, 'maintenance', 21400, '2025-03-01', NULL)`,
        `ra-${id}`,
        id,
      )
      await exec(
        `INSERT INTO financing_treatments (id, property_id, treatment, valid_from)
         VALUES (?, ?, 'capitalised', '2025-03-01')`,
        `ft-${id}`,
        id,
      )
      await exec(
        `INSERT INTO usage_charges (id, property_id, kind, basis) VALUES (?, ?, 'water', 'fixed')`,
        `uc-${id}`,
        id,
      )
      await exec(
        `INSERT INTO usage_charge_amounts (id, usage_charge_id, amount, valid_from)
         VALUES (?, ?, 2200, '2025-03-01')`,
        `uca-${id}`,
        `uc-${id}`,
      )
      await exec(
        `INSERT INTO tenancies (id, property_id, tenant_name, contract_type, contract_made, valid_from, due_day, created_by, created_at, updated_at)
         VALUES (?, ?, 'Aino Koski', 'indefinite', '2025-02-01', '2025-03-01', 5, ?, 0, 0)`,
        `t-${id}`,
        id,
        userId,
      )
      await exec(
        `INSERT INTO tenancy_rents (id, tenancy_id, amount, valid_from) VALUES (?, ?, 89000, '2025-03-01')`,
        `tr-${id}`,
        `t-${id}`,
      )
      await exec(
        `INSERT INTO tenancy_occupants (id, tenancy_id, persons, valid_from) VALUES (?, ?, 2, '2025-03-01')`,
        `to-${id}`,
        `t-${id}`,
      )
      await exec(
        `INSERT INTO tenant_fees (id, tenancy_id, kind, basis) VALUES (?, ?, 'parking', 'fixed')`,
        `tf-${id}`,
        `t-${id}`,
      )
      await exec(
        `INSERT INTO tenant_fee_amounts (id, tenant_fee_id, amount, valid_from) VALUES (?, ?, 1500, '2025-03-01')`,
        `tfa-${id}`,
        `tf-${id}`,
      )
      await exec(
        `INSERT INTO rent_payments (id, tenancy_id, month, amount, paid_on, created_by, created_at)
         VALUES (?, ?, '2025-03', 89000, '2025-03-05', ?, 0)`,
        `rp-${id}`,
        `t-${id}`,
        userId,
      )
      await exec(
        `INSERT INTO transactions (id, property_id, type, category, amount, date, created_by, created_at, updated_at)
         VALUES (?, ?, 'expense', 'repair', 14550, '2026-03-01', ?, 0, 0)`,
        `tx-${id}`,
        id,
        userId,
      )
      await exec(
        `INSERT INTO receipts (id, transaction_id, key, content_type, size, filename, uploaded_by, created_at)
         VALUES (?, ?, ?, 'application/pdf', 9, 'kuitti.pdf', ?, 0)`,
        `rc-${id}`,
        `tx-${id}`,
        key,
        userId,
      )
      await exec(
        `INSERT INTO property_documents (id, property_id, tenancy_id, kind, name, date, key, content_type, size, filename, uploaded_by, created_at, updated_at)
         VALUES (?, ?, ?, 'lease', 'Vuokrasopimus', '2025-03-01', ?, 'application/pdf', 9, 'sopimus.pdf', ?, 0, 0)`,
        `pd-${id}`,
        id,
        `t-${id}`,
        `documents/${key}`,
        userId,
      )
    }

    async function coOwned(annaShare: number) {
      const flat = await repository.create('anna', kuusikuja, now, '2025-03-01')
      await exec(
        `INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'bertta', 'owner', 0)`,
        flat.id,
      )
      await exec(
        `UPDATE ownership_periods SET share = ? WHERE property_id = ?`,
        annaShare,
        flat.id,
      )
      await exec(
        `INSERT INTO ownership_periods (id, property_id, user_id, share, valid_from)
         VALUES ('op-bertta', ?, 'bertta', ?, '2025-03-01')`,
        flat.id,
        10000 - annaShare,
      )
      return flat
    }

    test('the cascade empties every table of the flat and nothing else', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      const other = await repository.create(
        'anna',
        kuusikuja,
        now,
        '2022-06-12',
      )
      await fill(flat.id, 'anna', 'receipts/one')
      await fill(other.id, 'anna', 'receipts/two')
      for (const table of Object.keys(
        CHILD_TABLES,
      ) as (keyof typeof CHILD_TABLES)[]) {
        expect({ table, rows: await rowsOf(table, flat.id) }).not.toEqual({
          table,
          rows: 0,
        })
      }

      expect(await repository.deleteGuarded('anna', flat.id)).toBe(true)

      for (const table of Object.keys(
        CHILD_TABLES,
      ) as (keyof typeof CHILD_TABLES)[]) {
        expect({ table, rows: await rowsOf(table, flat.id) }).toEqual({
          table,
          rows: 0,
        })
        expect({ table, rows: await rowsOf(table, other.id) }).not.toEqual({
          table,
          rows: 0,
        })
      }
      expect(await repository.findForUser('anna', flat.id)).toBeUndefined()
      expect(await repository.findForUser('anna', other.id)).toBeDefined()
    })

    test('lists the receipt and document keys of the flat only', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      const other = await repository.create(
        'anna',
        kuusikuja,
        now,
        '2022-06-12',
      )
      await fill(flat.id, 'anna', 'receipts/one')
      await fill(other.id, 'anna', 'receipts/two')

      expect(await repository.fileKeys(flat.id)).toEqual([
        'receipts/one',
        'documents/receipts/one',
      ])
    })

    test('the guard refuses a flat that has had another owner', async () => {
      const flat = await coOwned(10000)
      await exec(
        `UPDATE ownership_periods SET share = 0 WHERE id = 'op-bertta'`,
      )
      // Bertta once owned half: that period is a former owner's share.
      await exec(
        `INSERT INTO ownership_periods (id, property_id, user_id, share, valid_from, valid_to)
         VALUES ('op-old', ?, 'bertta', 5000, '2024-01-01', '2024-12-31')`,
        flat.id,
      )

      expect(await repository.deleteGuarded('anna', flat.id)).toBe(false)
      expect(await repository.findForUser('anna', flat.id)).toBeDefined()
    })

    test('a 0 % share is only visibility and does not prevent deleting', async () => {
      const flat = await coOwned(10000)

      expect(await repository.deleteGuarded('anna', flat.id)).toBe(true)
    })

    test('the guard refuses a member and a user without access', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await exec(
        `INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'bertta', 'member', 0)`,
        flat.id,
      )

      expect(await repository.deleteGuarded('bertta', flat.id)).toBe(false)
      expect(await repository.deleteGuarded('nobody', flat.id)).toBe(false)
      expect(await repository.findForUser('anna', flat.id)).toBeDefined()
    })

    test('the check names the other owners, past and present', async () => {
      const flat = await coOwned(5000)
      await exec(`UPDATE user SET name = 'Bertta Virtanen' WHERE id = 'bertta'`)

      expect(await repository.deletionCheck('anna', flat.id)).toEqual({
        role: 'owner',
        otherOwners: ['Bertta Virtanen'],
      })
      expect(await repository.deletionCheck('nobody', flat.id)).toEqual({
        role: undefined,
        otherOwners: expect.any(Array) as string[],
      })
    })

    test('the summary of a flat without data', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')

      expect(await repository.deletionSummary(flat.id)).toEqual({
        hasData: false,
        counts: {
          tenancies: 0,
          rentPayments: 0,
          transactions: 0,
          receipts: 0,
          documents: 0,
        },
        members: [],
      })
    })

    test('the summary counts what is removed and names the members', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await fill(flat.id, 'anna', 'receipts/one')
      await exec(`UPDATE user SET name = 'Jussi Virtanen' WHERE id = 'bertta'`)
      await exec(
        `INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'bertta', 'member', 0)`,
        flat.id,
      )

      expect(await repository.deletionSummary(flat.id)).toEqual({
        hasData: true,
        counts: {
          tenancies: 1,
          rentPayments: 1,
          transactions: 1,
          receipts: 1,
          documents: 1,
        },
        members: ['Jussi Virtanen'],
      })
    })

    test.each([
      [
        'a charge',
        `INSERT INTO recurring_amounts (id, property_id, kind, amount, valid_from) VALUES ('x', ?, 'maintenance', 1, '2025-03-01')`,
      ],
      [
        'a financing charge',
        `INSERT INTO financing_charges (id, property_id) VALUES ('x', ?)`,
      ],
      [
        'a treatment',
        `INSERT INTO financing_treatments (id, property_id, treatment, valid_from) VALUES ('x', ?, 'capitalised', '2025-03-01')`,
      ],
      [
        'a usage charge',
        `INSERT INTO usage_charges (id, property_id, kind, basis) VALUES ('x', ?, 'water', 'fixed')`,
      ],
    ])('%s counts as data', async (_name, sql) => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await exec(sql, flat.id)

      expect((await repository.deletionSummary(flat.id)).hasData).toBe(true)
    })
  })
})
