import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { documentRepository } from '#/features/documents/document.repository.server'
import { depositReturnRepository } from '#/features/deposits/deposit-return.repository.server'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { getTenancies, type TenancyDeps } from './tenancies.server'
import {
  tenancyRepository,
  type TenancyFields,
} from './tenancy.repository.server'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 22, 10, 0, 0))
let flat = ''

const deps = (userId = 'annika'): TenancyDeps => ({
  userId,
  tenancies: tenancyRepository(db),
  depositReturns: depositReturnRepository(db),
  documents: documentRepository(db),
  properties: propertyRepository(db),
  ownership: ownershipRepository(db),
  sharing: sharingRepository(db),
  log: createCaptureLogger().log,
  now: () => now,
})

const tenancy = (name: string, validFrom: string): TenancyFields => ({
  tenantName: name,
  tenantPhone: null,
  tenantEmail: null,
  contractType: 'open_ended',
  contractMade: validFrom,
  validFrom,
  termEnd: null,
  dueDay: 5,
})

async function addLease(tenancyId: string, name: string, date: string) {
  await env.DB.prepare(
    `INSERT INTO property_documents (id, property_id, tenancy_id, kind, name, date, key, content_type, size, filename, uploaded_by, created_at, updated_at)
     VALUES (?, ?, ?, 'lease', ?, ?, ?, 'application/pdf', 9, 'sopimus.pdf', 'annika', 0, 0)`,
  )
    .bind(`doc-${name}`, flat, tenancyId, name, date, `documents/${name}`)
    .run()
}

beforeEach(async () => {
  await emptyTables(
    'property_documents',
    'tenancies',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('jussi')
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
      '2023-01-01',
    )
  ).id
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'member', ?)",
  )
    .bind(flat, now.getTime())
    .run()
})

describe('The lease on the tenancy page', () => {
  test("The current tenancy's lease", async () => {
    const aino =
      (await tenancyRepository(db).create(
        'annika',
        flat,
        tenancy('Aino Koski', '2025-03-01'),
        now,
      )) ?? ''
    await addLease(aino, 'Vuokrasopimus Aino K.', '2025-02-12')
    await addLease(aino, 'Lisäsopimus', '2026-01-10')
    const view = await getTenancies(deps(), flat)
    expect(view.ok && view.leases.map((l) => l.name)).toEqual([
      'Lisäsopimus',
      'Vuokrasopimus Aino K.',
    ])
  })

  test("A lease of another tenancy isn't on the card", async () => {
    const pekka = (await tenancyRepository(db).createWithRent(
      'annika',
      flat,
      tenancy('Pekka Virtanen', '2023-06-01'),
      80000,
      now,
      {
        noticeGivenBy: 'tenant',
        noticeDate: '2025-01-10',
        lastDay: '2025-02-28',
      },
    )) as { outcome: 'created'; id: string }
    await tenancyRepository(db).create(
      'annika',
      flat,
      tenancy('Aino Koski', '2025-03-01'),
      now,
    )
    await addLease(pekka.id, 'Vuokrasopimus Pekka', '2023-05-15')
    const view = await getTenancies(deps(), flat)
    expect(view.ok && view.leases).toEqual([])
  })

  test('A member sees the lease', async () => {
    const aino =
      (await tenancyRepository(db).create(
        'annika',
        flat,
        tenancy('Aino Koski', '2025-03-01'),
        now,
      )) ?? ''
    await addLease(aino, 'Vuokrasopimus Aino K.', '2025-02-12')
    const view = await getTenancies(deps('jussi'), flat)
    expect(view.ok && view.leases).toHaveLength(1)
  })
})
