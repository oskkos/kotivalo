import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import {
  leaveProperty,
  removeAccess,
  type SharingDeps,
} from '#/features/sharing/sharing.server'
import { createDb } from '#/server/platform/db.server'
import {
  createCaptureLogger,
  type LogLine,
} from '#/server/platform/logger.server'
import { createCaptureSender } from '#/server/platform/mailer.server'
import { consumeLimit } from '#/server/platform/limits.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { ownershipRepository } from './ownership.repository.server'
import {
  changeOwnership,
  correctFirstOwnershipDate,
  getOwnership,
  undoOwnershipChange,
  type OwnershipChange,
  type OwnershipDeps,
} from './ownership.server'

const db = createDb(env.DB)
// 20 November 2026 at noon in Finland.
const now = new Date(Date.UTC(2026, 10, 20, 10, 0, 0))
let logLines: LogLine[] = []
let flat = ''

function deps(userId: string): OwnershipDeps {
  const capture = createCaptureLogger()
  logLines = capture.lines
  return {
    userId,
    ownership: ownershipRepository(db),
    sharing: sharingRepository(db),
    log: capture.log,
    now: () => now,
  }
}

function sharingDeps(userId: string): SharingDeps {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId },
    sharing: sharingRepository(db),
    properties: propertyRepository(db),
    sendEmail: createCaptureSender({ log: false }),
    log: createCaptureLogger().log,
    now: () => now,
    consumeLimit: (key, rule) => consumeLimit(db, key, rule, now),
    locale: 'fi',
    appUrl: 'https://kotivalo.example',
  }
}

const sale = (
  annika: number,
  jussi: number,
  from = '2025-03-01',
): OwnershipChange => ({
  from,
  reason: 'sale',
  split: [
    { userId: 'annika', share: annika },
    { userId: 'jussi', share: jussi },
  ],
  removeAccess: [],
})

const role = async (userId: string) =>
  sharingRepository(db).roleOf(userId, flat)

/** Reads the page's data without replacing the test's log lines. */
const view = async (userId: string) => {
  const lines = logLines
  const result = await getOwnership(deps(userId), flat)
  logLines = lines
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result
}

beforeEach(async () => {
  await emptyTables(
    'rate_limit',
    'ownership_periods',
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  for (const [id, name] of [
    ['annika', 'Annika'],
    ['jussi', 'Jussi'],
    ['toinen', 'Toinen'],
  ] as const) {
    await addTestUser(id)
    await env.DB.prepare('UPDATE user SET name = ? WHERE id = ?')
      .bind(name, id)
      .run()
  }
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
      '2022-06-12',
    )
  ).id
  // Jussi is a member: he accepted an invitation.
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'member', ?)",
  )
    .bind(flat, now.getTime())
    .run()
})

describe("Changing a flat's ownership", () => {
  test('An owner records a sale of half the flat', async () => {
    expect(
      await changeOwnership(deps('annika'), flat, sale(5000, 5000)),
    ).toEqual({ ok: true })

    const { periods } = await view('annika')
    expect(periods.map((p) => [p.validFrom, p.reason, p.shares])).toEqual([
      [
        '2025-03-01',
        'sale',
        expect.arrayContaining([
          { userId: 'annika', share: 5000 },
          { userId: 'jussi', share: 5000 },
        ]),
      ],
      ['2022-06-12', null, [{ userId: 'annika', share: 10000 }]],
    ])
    expect(logLines).toEqual([
      expect.objectContaining({
        level: 'info',
        event: 'ownership.changed',
        propertyId: flat,
        owners: 2,
      }),
    ])
    expect(JSON.stringify(logLines)).not.toMatch(/(?<![\w-])5000(?![\w-])/)
  })

  test("A change on the current period's start corrects its split", async () => {
    expect(
      await changeOwnership(
        deps('annika'),
        flat,
        sale(5000, 5000, '2022-06-12'),
      ),
    ).toEqual({ ok: true })

    const { periods } = await view('annika')
    expect(periods).toEqual([
      {
        validFrom: '2022-06-12',
        validTo: null,
        reason: 'sale',
        shares: expect.arrayContaining([
          { userId: 'annika', share: 5000 },
          { userId: 'jussi', share: 5000 },
        ]) as unknown,
      },
    ])
    expect(await role('jussi')).toBe('owner')
    expect(logLines).toEqual([
      expect.objectContaining({
        event: 'ownership.changed',
        corrected: true,
      }),
    ])
  })

  test('a correction of a later period keeps the earlier ones', async () => {
    await changeOwnership(deps('annika'), flat, sale(5000, 5000))
    await changeOwnership(deps('annika'), flat, sale(6000, 4000))

    const { periods } = await view('annika')
    expect(periods.map((p) => [p.validFrom, p.validTo])).toEqual([
      ['2025-03-01', null],
      ['2022-06-12', '2025-02-28'],
    ])
    expect(periods[0]?.shares).toContainEqual({ userId: 'annika', share: 6000 })
  })

  test("A split that doesn't add up is refused", async () => {
    expect(
      await changeOwnership(deps('annika'), flat, sale(6000, 3000)),
    ).toEqual({ ok: false, reason: 'ownership_shares_total' })
    expect((await view('annika')).periods).toHaveLength(1)
  })

  test('A change dated before the current period is refused', async () => {
    await changeOwnership(deps('annika'), flat, sale(5000, 5000))

    expect(
      await changeOwnership(deps('annika'), flat, sale(10000, 0, '2025-02-01')),
    ).toEqual({ ok: false, reason: 'ownership_date_too_early' })
    expect((await view('annika')).periods).toHaveLength(2)
  })

  test('A change dated in the future is refused', async () => {
    expect(
      await changeOwnership(
        deps('annika'),
        flat,
        sale(5000, 5000, '2026-11-21'),
      ),
    ).toEqual({ ok: false, reason: 'ownership_date_in_future' })
  })

  test('Removing access from a person who no longer owns a share', async () => {
    await changeOwnership(deps('annika'), flat, sale(5000, 5000))

    const result = await changeOwnership(deps('annika'), flat, {
      ...sale(10000, 0, '2026-01-01'),
      removeAccess: ['jussi'],
    })

    expect(result).toEqual({ ok: true })
    expect(await role('jussi')).toBeUndefined()
    const { periods, names } = await view('annika')
    expect(periods[1]?.shares).toContainEqual({ userId: 'jussi', share: 5000 })
    expect(names.jussi).toBe('Jussi')
    // The flat stays in his year summary for the days he owned a share.
    expect(
      (await propertyRepository(db).listFormerlyOwnedForUser('jussi')).map(
        (property) => property.id,
      ),
    ).toEqual([flat])
  })

  test("A member can't change ownership", async () => {
    expect(await changeOwnership(deps('jussi'), flat, sale(0, 10000))).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect((await view('annika')).periods).toHaveLength(1)
  })

  test('a user without access is told the flat was not found', async () => {
    expect(await changeOwnership(deps('toinen'), flat, sale(0, 10000))).toEqual(
      { ok: false, reason: 'property_not_found' },
    )
  })

  test('a split with someone without access is refused', async () => {
    const result = await changeOwnership(deps('annika'), flat, {
      ...sale(5000, 0),
      split: [
        { userId: 'annika', share: 5000 },
        { userId: 'toinen', share: 5000 },
      ],
    })
    expect(result).toEqual({ ok: false, reason: 'ownership_invalid' })
  })
})

describe('Roles follow the current shares', () => {
  test('A member who gets a share becomes an owner', async () => {
    await changeOwnership(deps('annika'), flat, sale(5000, 5000))

    expect(await role('jussi')).toBe('owner')
    expect((await view('jussi')).role).toBe('owner')
  })

  test('An owner whose share drops to zero becomes a member', async () => {
    await changeOwnership(deps('annika'), flat, sale(0, 10000))

    expect(await role('annika')).toBe('member')
    expect((await view('annika')).periods).toHaveLength(2)
    expect(
      await changeOwnership(
        deps('annika'),
        flat,
        sale(5000, 5000, '2026-01-01'),
      ),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
  })
})

describe('Undoing the latest ownership change', () => {
  test('Undoing a change restores the previous split', async () => {
    await changeOwnership(deps('annika'), flat, sale(5000, 5000))

    expect(await undoOwnershipChange(deps('annika'), flat)).toEqual({
      ok: true,
    })
    expect((await view('annika')).periods).toEqual([
      {
        validFrom: '2022-06-12',
        validTo: null,
        reason: null,
        shares: [{ userId: 'annika', share: 10000 }],
      },
    ])
    expect(await role('jussi')).toBe('member')
    expect(logLines).toEqual([
      expect.objectContaining({
        event: 'ownership.change_undone',
        propertyId: flat,
      }),
    ])
  })

  test("The only period can't be undone", async () => {
    expect(await undoOwnershipChange(deps('annika'), flat)).toEqual({
      ok: false,
      reason: 'ownership_nothing_to_undo',
    })
  })
})

describe('Correcting the first ownership date', () => {
  test('Correcting the date a flat was bought', async () => {
    expect(
      await correctFirstOwnershipDate(deps('annika'), flat, '2020-01-01'),
    ).toEqual({ ok: true })
    expect((await view('annika')).periods[0]?.validFrom).toBe('2020-01-01')
    expect(logLines).toEqual([
      expect.objectContaining({ event: 'ownership.first_date_corrected' }),
    ])
  })

  test("The first date can't move past the next change", async () => {
    await changeOwnership(deps('annika'), flat, sale(5000, 5000))

    expect(
      await correctFirstOwnershipDate(deps('annika'), flat, '2025-04-01'),
    ).toEqual({ ok: false, reason: 'ownership_date_too_late' })
  })

  test('a member cannot correct it', async () => {
    expect(
      await correctFirstOwnershipDate(deps('jussi'), flat, '2020-01-01'),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
  })
})

describe("Showing a flat's ownership history", () => {
  test('A member sees the history', async () => {
    await changeOwnership(deps('annika'), flat, sale(6000, 4000))
    await changeOwnership(deps('annika'), flat, sale(10000, 0, '2026-01-01'))

    const { role: jussisRole, periods } = await view('jussi')

    expect(jussisRole).toBe('member')
    expect(periods.map((p) => p.validFrom)).toEqual([
      '2026-01-01',
      '2025-03-01',
      '2022-06-12',
    ])
  })
})

describe('Removing access to a flat', () => {
  test("An owner can't remove another owner", async () => {
    await changeOwnership(deps('annika'), flat, sale(5000, 5000))

    expect(await removeAccess(sharingDeps('annika'), flat, 'jussi')).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await role('jussi')).toBe('owner')
  })
})

describe('Leaving a shared flat', () => {
  test('an owner who got a share can no longer leave', async () => {
    await changeOwnership(deps('annika'), flat, sale(5000, 5000))

    expect(await leaveProperty(sharingDeps('jussi'), flat)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
  })
})
