import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  documentRepository,
  type DocumentFields,
  type DocumentFile,
} from './document.repository.server'

const db = createDb(env.DB)
const repository = documentRepository(db)
const now = new Date(Date.UTC(2026, 10, 25, 12, 0, 0))

const statement: DocumentFields = {
  kind: 'financial_statement',
  name: 'Tilinpäätös 2025',
  date: '2026-04-28',
  tenancyId: null,
}

let n = 0
function file(size = 1000): DocumentFile {
  n += 1
  return {
    key: `attachments/${String(n)}`,
    contentType: 'application/pdf',
    size,
    filename: 'tilinpaatos_2025.pdf',
  }
}

async function exec(sql: string, ...values: (string | number | null)[]) {
  await env.DB.prepare(sql)
    .bind(...values)
    .run()
}

async function addFlat(id: string) {
  await exec(
    `INSERT INTO properties (id, street_address, postcode, city, room_count, floor_area, created_at, updated_at)
     VALUES (?, 'Kuusikuja 3 B 12', '33100', 'Tampere', 2, 485, 0, 0)`,
    id,
  )
}

async function addTenancy(id: string, propertyId: string) {
  await exec(
    `INSERT INTO tenancies (id, property_id, tenant_name, contract_type, contract_made, valid_from, due_day, created_by, created_at, updated_at)
     VALUES (?, ?, 'Aino Koski', 'open_ended', '2025-02-01', '2025-03-01', 5, 'annika', 0, 0)`,
    id,
    propertyId,
  )
}

async function setAccess(propertyId: string, userId: string, role: string) {
  await exec(
    'INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, ?, ?, 0)',
    propertyId,
    userId,
    role,
  )
}

async function documentRows() {
  const { results } = await env.DB.prepare(
    'SELECT id, kind, name, tenancy_id FROM property_documents',
  ).all()
  return results
}

beforeEach(async () => {
  await emptyTables(
    'property_documents',
    'tenancy_rents',
    'tenancies',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('jussi')
  await addFlat('kuusikuja')
  await addFlat('koivupolku')
  await setAccess('kuusikuja', 'annika', 'owner')
  await setAccess('kuusikuja', 'jussi', 'member')
  await setAccess('koivupolku', 'annika', 'owner')
  await addTenancy('aino', 'kuusikuja')
  await addTenancy('other-flat', 'koivupolku')
})

describe('documentRepository', () => {
  test('an owner adds a document', async () => {
    const id = await repository.add(
      'annika',
      'kuusikuja',
      statement,
      file(3400),
      now,
    )
    expect(id).not.toBeNull()
    expect(await repository.findDetails(id ?? '')).toMatchObject({
      kind: 'financial_statement',
      name: 'Tilinpäätös 2025',
      date: '2026-04-28',
      size: 3400,
      tenancyId: null,
      uploadedBy: { id: 'annika', name: '' },
    })
  })

  test("a member's add misses", async () => {
    expect(
      await repository.add('jussi', 'kuusikuja', statement, file(), now),
    ).toBeNull()
    expect(await documentRows()).toEqual([])
  })

  test('an add by someone without access misses', async () => {
    expect(
      await repository.add('jussi', 'koivupolku', statement, file(), now),
    ).toBeNull()
  })

  test('a lease keeps the flat’s tenancy', async () => {
    const id = await repository.add(
      'annika',
      'kuusikuja',
      { ...statement, kind: 'lease', tenancyId: 'aino' },
      file(),
      now,
    )
    expect(await repository.findDetails(id ?? '')).toMatchObject({
      tenancyId: 'aino',
      tenantName: 'Aino Koski',
    })
  })

  test('a tenancy of another flat misses', async () => {
    expect(
      await repository.add(
        'annika',
        'kuusikuja',
        { ...statement, kind: 'lease', tenancyId: 'other-flat' },
        file(),
        now,
      ),
    ).toBeNull()
    expect(await documentRows()).toEqual([])
  })

  test('another kind drops the tenancy', async () => {
    const id = await repository.add(
      'annika',
      'kuusikuja',
      { ...statement, tenancyId: 'aino' },
      file(),
      now,
    )
    expect((await repository.findDetails(id ?? ''))?.tenancyId).toBeNull()
  })

  test('a file that does not fit the quota misses', async () => {
    await exec(
      `INSERT INTO property_documents (id, property_id, kind, name, date, key, content_type, size, filename, uploaded_by, created_at, updated_at)
       VALUES ('big', 'kuusikuja', 'other', 'Iso', '2026-01-01', 'attachments/big', 'application/pdf', 524287000, 'i.pdf', 'annika', 0, 0)`,
    )
    expect(
      await repository.add('annika', 'kuusikuja', statement, file(2000), now),
    ).toBeNull()
    expect(await documentRows()).toHaveLength(1)
  })

  test('update changes the kind, name, date and tenancy', async () => {
    const id =
      (await repository.add('annika', 'kuusikuja', statement, file(), now)) ??
      ''
    expect(
      await repository.update(
        'annika',
        id,
        {
          kind: 'lease',
          name: 'Sopimus',
          date: '2025-03-01',
          tenancyId: 'aino',
        },
        now,
      ),
    ).toBe(true)
    expect(await repository.findDetails(id)).toMatchObject({
      kind: 'lease',
      name: 'Sopimus',
      date: '2025-03-01',
      tenancyId: 'aino',
    })
  })

  test('update clears the tenancy when the kind changes', async () => {
    const id =
      (await repository.add(
        'annika',
        'kuusikuja',
        { ...statement, kind: 'lease', tenancyId: 'aino' },
        file(),
        now,
      )) ?? ''
    await repository.update(
      'annika',
      id,
      { ...statement, kind: 'other', tenancyId: 'aino' },
      now,
    )
    expect((await repository.findDetails(id))?.tenancyId).toBeNull()
  })

  test("a member's update, and an update of another flat's tenancy, miss", async () => {
    const id =
      (await repository.add('annika', 'kuusikuja', statement, file(), now)) ??
      ''
    expect(
      await repository.update('jussi', id, { ...statement, name: 'Uusi' }, now),
    ).toBe(false)
    expect(
      await repository.update(
        'annika',
        id,
        { ...statement, kind: 'lease', tenancyId: 'other-flat' },
        now,
      ),
    ).toBe(false)
    expect(await repository.findDetails(id)).toMatchObject({
      name: 'Tilinpäätös 2025',
    })
    expect(await repository.update('annika', 'missing', statement, now)).toBe(
      false,
    )
  })

  test('remove returns the key of the file', async () => {
    const stored = file()
    const id =
      (await repository.add('annika', 'kuusikuja', statement, stored, now)) ??
      ''
    expect(await repository.remove('jussi', id)).toBeNull()
    expect(await documentRows()).toHaveLength(1)
    expect(await repository.remove('annika', id)).toBe(stored.key)
    expect(await documentRows()).toEqual([])
    expect(await repository.remove('annika', id)).toBeNull()
  })

  describe("A lease's tenancy", () => {
    test('A lease stays when its tenancy is removed', async () => {
      const id =
        (await repository.add(
          'annika',
          'kuusikuja',
          { ...statement, kind: 'lease', tenancyId: 'aino' },
          file(),
          now,
        )) ?? ''
      await exec("DELETE FROM tenancies WHERE id = 'aino'")
      expect(await repository.findDetails(id)).toMatchObject({
        kind: 'lease',
        tenancyId: null,
        tenantName: null,
      })
    })
  })

  test('lists the flat’s documents newest first, with the latest and a count', async () => {
    const add = async (name: string, date: DocumentFields['date']) =>
      repository.add(
        'annika',
        'kuusikuja',
        { ...statement, name, date },
        file(),
        now,
      )
    await add('Vanha', '2025-04-28')
    await add('Uusin', '2026-05-01')
    await add('Keskimmäinen', '2026-01-15')
    await add('Neljäs', '2024-01-01')
    await repository.add('annika', 'koivupolku', statement, file(), now)

    const names = (await repository.listForProperty('kuusikuja')).map(
      (row) => row.name,
    )
    expect(names).toEqual(['Uusin', 'Keskimmäinen', 'Vanha', 'Neljäs'])
    expect(
      (await repository.latestForProperty('kuusikuja', 3)).map(
        (row) => row.name,
      ),
    ).toEqual(['Uusin', 'Keskimmäinen', 'Vanha'])
    expect(await repository.countForProperty('kuusikuja')).toBe(4)
  })

  test('findForAccess gives where the file is', async () => {
    const stored = file()
    const id =
      (await repository.add('annika', 'kuusikuja', statement, stored, now)) ??
      ''
    expect(await repository.findForAccess(id)).toEqual({
      id,
      propertyId: 'kuusikuja',
      key: stored.key,
      contentType: 'application/pdf',
      filename: 'tilinpaatos_2025.pdf',
    })
    expect(await repository.findForAccess('missing')).toBeNull()
  })
})
