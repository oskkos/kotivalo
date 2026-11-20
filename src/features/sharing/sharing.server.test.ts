import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { EmailError, type SendEmail } from '#/server/email/email'
import { createDb } from '#/server/platform/db.server'
import { consumeLimit } from '#/server/platform/limits.server'
import {
  createCaptureLogger,
  type LogLine,
} from '#/server/platform/logger.server'
import {
  capturedEmails,
  createCaptureSender,
} from '#/server/platform/mailer.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { emailSchema } from '#/features/authentication/schemas'
import { sharingRepository } from './sharing.repository.server'
import {
  cancelInvitation,
  getSharing,
  inviteToProperty,
  type SharingDeps,
} from './sharing.server'

const db = createDb(env.DB)
const sharing = sharingRepository(db)
const now = new Date(Date.UTC(2026, 10, 20, 12, 0, 0))
let logLines: LogLine[] = []

const USERS = {
  anna: { id: 'anna', email: 'anna@example.com', name: 'Annika' },
  jussi: { id: 'jussi', email: 'jussi@example.com', name: 'Jussi' },
  toinen: { id: 'toinen', email: 'toinen@example.com', name: 'Toinen' },
} as const

function deps(
  who: keyof typeof USERS,
  overrides: Partial<SharingDeps> = {},
): SharingDeps {
  const capture = createCaptureLogger()
  logLines = capture.lines
  return {
    user: USERS[who],
    sharing,
    properties: propertyRepository(db),
    sendEmail: createCaptureSender({ log: false }),
    log: capture.log,
    now: () => now,
    consumeLimit: (key, rule) => consumeLimit(db, key, rule, now),
    locale: 'fi',
    appUrl: 'https://kotivalo.example',
    ...overrides,
  }
}

async function addFlat(street = 'Kuusikuja 3 B 12'): Promise<string> {
  const { id } = await propertyRepository(db).create(
    'anna',
    {
      streetAddress: street,
      postcode: '33100',
      city: 'Tampere',
      roomCount: 2,
      floorArea: 485,
    },
    now,
  )
  return id
}

async function invite(who: keyof typeof USERS, flat: string, email: string) {
  return inviteToProperty(deps(who), flat, emailSchema.parse(email))
}

/** Makes Jussi a member of the flat. */
async function shareWithJussi(flat: string) {
  const result = await invite('anna', flat, 'jussi@example.com')
  if (!result.ok) {
    throw new Error(result.reason)
  }
  await sharing.accept('jussi', 'jussi@example.com', result.id, now)
}

const emailsTo = (to: string) => capturedEmails.all().filter((e) => e.to === to)

let flat = ''

beforeEach(async () => {
  capturedEmails.clear()
  await emptyTables(
    'rate_limit',
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  for (const user of Object.values(USERS)) {
    await addTestUser(user.id)
    await env.DB.prepare('UPDATE user SET name = ? WHERE id = ?')
      .bind(user.name, user.id)
      .run()
  }
  flat = await addFlat()
})

describe('Inviting a user to a flat', () => {
  test('Inviting an address sends an invitation', async () => {
    const result = await invite('anna', flat, 'Jussi@Example.com')

    expect(result.ok).toBe(true)
    const email = emailsTo('jussi@example.com').at(0)
    expect(email?.subject).toBe('Annika jakoi sinulle asunnon Kotivalossa')
    expect(email?.text).toContain('https://kotivalo.example')
    const view = await getSharing(deps('anna'), flat)
    expect(view.ok && view.invitations).toEqual([
      expect.objectContaining({ email: 'jussi@example.com' }),
    ])
  })

  test("The invitation email is in the recipient's language", async () => {
    await env.DB.prepare(
      "UPDATE user SET locale = 'sv' WHERE id = 'jussi'",
    ).run()
    await invite('anna', flat, 'jussi@example.com')

    expect(emailsTo('jussi@example.com')[0]?.subject).toBe(
      'Annika har delat en bostad med dig i Kotivalo',
    )
  })

  test("an address without an account gets the inviter's language", async () => {
    await inviteToProperty(
      deps('anna', { locale: 'en' }),
      flat,
      'uusi@example.com',
    )

    expect(emailsTo('uusi@example.com')[0]?.subject).toBe(
      'Annika shared a flat with you in Kotivalo',
    )
  })

  test('A user who already has access is not invited again', async () => {
    await shareWithJussi(flat)
    capturedEmails.clear()

    for (const address of ['anna@example.com', 'jussi@example.com']) {
      expect(await invite('anna', flat, address)).toEqual({
        ok: false,
        reason: 'invitation_already_member',
      })
    }
    expect(capturedEmails.all()).toEqual([])
  })

  test('An address with a pending invitation is not invited twice', async () => {
    await invite('anna', flat, 'jussi@example.com')

    expect(await invite('anna', flat, 'jussi@example.com')).toEqual({
      ok: false,
      reason: 'invitation_already_pending',
    })
    expect(emailsTo('jussi@example.com')).toHaveLength(1)
  })

  test("A member can't invite", async () => {
    await shareWithJussi(flat)
    capturedEmails.clear()

    expect(await invite('jussi', flat, 'liisa@example.com')).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(capturedEmails.all()).toEqual([])
  })

  test('a user without access is told the flat was not found', async () => {
    expect(await invite('toinen', flat, 'liisa@example.com')).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })

  test('a failed send saves no invitation and says why', async () => {
    const failing: SendEmail = () =>
      Promise.reject(new EmailError('quota', 'Daily quota'))
    const result = await inviteToProperty(
      deps('anna', { sendEmail: failing }),
      flat,
      'jussi@example.com',
    )

    expect(result).toEqual({ ok: false, reason: 'invitation_email_quota' })
    expect(await sharing.countPending(flat, now)).toBe(0)
    expect(logLines).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'sharing.invitation_email_failed',
        failure: 'quota',
      }),
    ])
  })

  test('logs the invitation by its ids, without the address', async () => {
    const result = await invite('anna', flat, 'jussi@example.com')

    expect(logLines).toEqual([
      expect.objectContaining({
        level: 'info',
        event: 'sharing.invitation_sent',
        propertyId: flat,
        invitationId: result.ok ? result.id : '',
      }),
    ])
    expect(JSON.stringify(logLines)).not.toContain('jussi@')
  })
})

describe('Limiting invitations', () => {
  test('The 11th pending invitation is refused', async () => {
    for (let i = 1; i <= 10; i++) {
      expect(
        (await invite('anna', flat, `kutsuttu${String(i)}@example.com`)).ok,
      ).toBe(true)
    }
    capturedEmails.clear()

    expect(await invite('anna', flat, 'yksitoista@example.com')).toEqual({
      ok: false,
      reason: 'invitation_limit_reached',
    })
    expect(capturedEmails.all()).toEqual([])
    expect(logLines).toEqual([
      expect.objectContaining({
        level: 'warn',
        event: 'sharing.invitation_limit_reached',
        limit: 'property',
      }),
    ])
  })

  test('The 21st invitation in a day is refused', async () => {
    const flats = [
      flat,
      await addFlat('Koivupolku 7 A 4'),
      await addFlat('Rantatie 15 C 21'),
    ]
    for (let i = 0; i < 20; i++) {
      const target = flats[Math.floor(i / 7)] ?? flat
      expect(
        (await invite('anna', target, `k${String(i)}@example.com`)).ok,
      ).toBe(true)
    }
    capturedEmails.clear()

    expect(await invite('anna', flats[2] ?? flat, 'k20@example.com')).toEqual({
      ok: false,
      reason: 'invitation_daily_limit_reached',
    })
    expect(capturedEmails.all()).toEqual([])
  })
})

describe('Cancelling a flat invitation', () => {
  test('the owner cancels a pending invitation', async () => {
    const result = await invite('anna', flat, 'jussi@example.com')
    const id = result.ok ? result.id : ''

    expect(await cancelInvitation(deps('anna'), id)).toEqual({ ok: true })
    expect(await sharing.countPending(flat, now)).toBe(0)
    expect(logLines).toEqual([
      expect.objectContaining({
        event: 'sharing.invitation_cancelled',
        propertyId: flat,
        invitationId: id,
      }),
    ])
  })

  test('nobody else can cancel it', async () => {
    await shareWithJussi(flat)
    const result = await invite('anna', flat, 'liisa@example.com')
    const id = result.ok ? result.id : ''

    for (const who of ['jussi', 'toinen'] as const) {
      expect(await cancelInvitation(deps(who), id)).toEqual({
        ok: false,
        reason: 'invitation_not_found',
      })
    }
    expect(await sharing.countPending(flat, now)).toBe(1)
  })
})

describe('Listing who has access to a flat', () => {
  test('The Sharing page lists people and invitations', async () => {
    await shareWithJussi(flat)
    await invite('anna', flat, 'liisa@example.com')

    const view = await getSharing(deps('jussi'), flat)

    expect(view).toEqual({
      ok: true,
      property: { id: flat, streetAddress: 'Kuusikuja 3 B 12' },
      role: 'member',
      people: [
        expect.objectContaining({
          name: 'Annika',
          role: 'owner',
          isYou: false,
        }),
        expect.objectContaining({ name: 'Jussi', role: 'member', isYou: true }),
      ],
      invitations: [expect.objectContaining({ email: 'liisa@example.com' })],
    })
  })

  test("Another user can't open the Sharing page", async () => {
    expect(await getSharing(deps('toinen'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})
