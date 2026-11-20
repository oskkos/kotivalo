import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { sharingRepository } from './sharing.repository.server'

const repo = sharingRepository(createDb(env.DB))
const DAY = 24 * 60 * 60 * 1000
const now = new Date(Date.UTC(2026, 10, 20, 12, 0, 0))
const later = (ms: number) => new Date(now.getTime() + ms)

/** A flat owned by `ownerId`, straight into the database. */
async function addFlat(id: string, ownerId: string) {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO properties (id, street_address, postcode, city, room_count, floor_area, created_at, updated_at) VALUES (?, 'Kuusikuja 3 B 12', '33100', 'Tampere', 2, 485, ?, ?)",
    ).bind(id, now.getTime(), now.getTime()),
    env.DB.prepare(
      "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    ).bind(id, ownerId, now.getTime()),
  ])
}

const invite = (email: string, at = now) =>
  repo.invite({
    propertyId: 'flat',
    email,
    invitedBy: 'anna',
    now: at,
    expiresAt: new Date(at.getTime() + 30 * DAY),
  })

const accessRows = async () =>
  (
    await env.DB.prepare(
      'SELECT user_id, role FROM property_access WHERE property_id = ? ORDER BY user_id',
    )
      .bind('flat')
      .all<{ user_id: string; role: string }>()
  ).results

beforeEach(async () => {
  await emptyTables(
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('anna')
  await addTestUser('jussi')
  await addTestUser('toinen')
  await env.DB.prepare(
    "UPDATE user SET name = 'Annika' WHERE id = 'anna'",
  ).run()
  await addFlat('flat', 'anna')
})

describe('Sharing repository', () => {
  test('accept gives member access and deletes the invitation', async () => {
    const { id } = await invite('jussi@example.com')

    expect(await repo.accept('jussi', 'jussi@example.com', id, now)).toBe(
      'flat',
    )
    expect(await accessRows()).toEqual([
      { user_id: 'anna', role: 'owner' },
      { user_id: 'jussi', role: 'member' },
    ])
    expect(await repo.listPending('flat', now)).toEqual([])
  })

  test('accept does nothing for another address', async () => {
    const { id } = await invite('jussi@example.com')

    expect(
      await repo.accept('toinen', 'toinen@example.com', id, now),
    ).toBeUndefined()
    expect(await accessRows()).toEqual([{ user_id: 'anna', role: 'owner' }])
    expect(await repo.listPending('flat', now)).toHaveLength(1)
  })

  test('accept does nothing for an expired invitation', async () => {
    const { id } = await invite('jussi@example.com')
    const expired = later(30 * DAY + 1000)

    expect(
      await repo.accept('jussi', 'jussi@example.com', id, expired),
    ).toBeUndefined()
    expect(await accessRows()).toEqual([{ user_id: 'anna', role: 'owner' }])
  })

  test('invite replaces an expired invitation for the same address', async () => {
    await invite('jussi@example.com')
    const expired = later(31 * DAY)
    const { id } = await invite('jussi@example.com', expired)

    expect(await repo.listPending('flat', expired)).toEqual([
      expect.objectContaining({ id, email: 'jussi@example.com' }),
    ])
  })

  test('the unique key refuses a second pending invitation', async () => {
    await invite('jussi@example.com')
    await expect(invite('jussi@example.com')).rejects.toThrow()
  })

  test('pending invitations and counts leave out expired ones', async () => {
    await invite('jussi@example.com')
    await invite('liisa@example.com', later(-31 * DAY))

    expect(await repo.countPending('flat', now)).toBe(1)
    expect(await repo.isPending('flat', 'jussi@example.com', now)).toBe(true)
    expect(await repo.isPending('flat', 'liisa@example.com', now)).toBe(false)
  })

  test('listForInvitee shows the flat and inviter, not expired ones', async () => {
    const { id } = await invite('jussi@example.com')

    expect(await repo.listForInvitee('jussi@example.com', now)).toEqual([
      {
        id,
        propertyId: 'flat',
        streetAddress: 'Kuusikuja 3 B 12',
        city: 'Tampere',
        inviterName: 'Annika',
        expiresAt: later(30 * DAY),
      },
    ])
    expect(
      await repo.listForInvitee('jussi@example.com', later(30 * DAY)),
    ).toEqual([])
    expect(await repo.listForInvitee('toinen@example.com', now)).toEqual([])
  })

  test('findRecipient tells the account language and access', async () => {
    await env.DB.prepare(
      "UPDATE user SET locale = 'sv' WHERE id = 'jussi'",
    ).run()

    expect(await repo.findRecipient('flat', 'jussi@example.com')).toEqual({
      locale: 'sv',
      hasAccess: false,
    })
    expect(await repo.findRecipient('flat', 'anna@example.com')).toEqual({
      locale: 'fi',
      hasAccess: true,
    })
    expect(await repo.findRecipient('flat', 'uusi@example.com')).toEqual({
      locale: null,
      hasAccess: false,
    })
  })

  test('cancel works only for the owner', async () => {
    const { id } = await invite('jussi@example.com')

    expect(await repo.cancel('toinen', id)).toBeUndefined()
    expect(await repo.countPending('flat', now)).toBe(1)
    expect(await repo.cancel('anna', id)).toBe('flat')
    expect(await repo.countPending('flat', now)).toBe(0)
  })

  test('decline deletes only an invitation for that address', async () => {
    const { id } = await invite('jussi@example.com')

    expect(await repo.decline('toinen@example.com', id)).toBe(false)
    expect(await repo.decline('jussi@example.com', id)).toBe(true)
    expect(await repo.countPending('flat', now)).toBe(0)
  })

  test('removeMember and leave never touch the owner', async () => {
    const { id } = await invite('jussi@example.com')
    await repo.accept('jussi', 'jussi@example.com', id, now)

    // A member can't remove anyone, and the owner's row is never removed.
    expect(await repo.removeMember('jussi', 'flat', 'anna')).toBe(false)
    expect(await repo.removeMember('anna', 'flat', 'anna')).toBe(false)
    expect(await repo.leave('anna', 'flat')).toBe(false)
    expect(await accessRows()).toHaveLength(2)

    expect(await repo.removeMember('anna', 'flat', 'jussi')).toBe(true)
    expect(await accessRows()).toEqual([{ user_id: 'anna', role: 'owner' }])
  })

  test('a member can leave', async () => {
    const { id } = await invite('jussi@example.com')
    await repo.accept('jussi', 'jussi@example.com', id, now)

    expect(await repo.leave('jussi', 'flat')).toBe(true)
    expect(await repo.roleOf('jussi', 'flat')).toBeUndefined()
  })

  test('listPeople puts the owner first, with names and roles', async () => {
    const { id } = await invite('jussi@example.com')
    await repo.accept('jussi', 'jussi@example.com', id, later(DAY))

    expect(await repo.listPeople('flat')).toEqual([
      { userId: 'anna', name: 'Annika', role: 'owner', since: now },
      { userId: 'jussi', name: '', role: 'member', since: later(DAY) },
    ])
    expect(await repo.roleOf('anna', 'flat')).toBe('owner')
    expect(await repo.roleOf('jussi', 'flat')).toBe('member')
  })
})
