import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EmailError, type EmailMessage } from '#/server/email/email'
import { getRequestContext } from './context.server'
import {
  capturedEmails,
  createCaptureSender,
  createResendSender,
  createSendEmail,
} from './mailer.server'

const message: EmailMessage = {
  to: 'owner@example.com',
  subject: 'Hello',
  text: 'Body',
  html: '<p>Body</p>',
}

function resendResponding(status: number, body: unknown = {}) {
  return vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(Response.json(body, { status })),
  )
}

describe('Resend sender', () => {
  test('posts the message to the Resend API', async () => {
    const fetch = resendResponding(200, { id: 'abc' })
    const send = createResendSender({
      apiKey: 're_test',
      from: 'Kotivalo <noreply@example.com>',
      fetch,
    })

    await send({ ...message, idempotencyKey: 'invite-1' })

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe('https://api.resend.com/emails')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer re_test',
      'Content-Type': 'application/json',
      'User-Agent': 'kotivalo',
      'Idempotency-Key': 'invite-1',
    })
    expect(JSON.parse(init?.body as string)).toEqual({
      from: 'Kotivalo <noreply@example.com>',
      to: ['owner@example.com'],
      subject: 'Hello',
      text: 'Body',
      html: '<p>Body</p>',
    })
  })

  test('sends no Idempotency-Key header without a key', async () => {
    const fetch = resendResponding(200, { id: 'abc' })
    await createResendSender({ apiKey: 'k', from: 'f@example.com', fetch })(
      message,
    )
    expect(fetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
      'Idempotency-Key',
    )
  })

  test.each([
    [429, 'daily_quota_exceeded', 'quota'],
    [429, 'monthly_quota_exceeded', 'quota'],
    [429, 'rate_limit_exceeded', 'rate_limited'],
    [422, 'invalid_parameter', 'rejected'],
    [403, 'validation_error', 'rejected'],
    [401, 'missing_api_key', 'rejected'],
    [500, 'application_error', 'unavailable'],
    [503, 'service_unavailable', 'unavailable'],
  ] as const)('maps %i %s to %s', async (status, name, failure) => {
    const send = createResendSender({
      apiKey: 'k',
      from: 'f@example.com',
      fetch: resendResponding(status, {
        statusCode: status,
        name,
        message: 'x',
      }),
    })
    await expect(send(message)).rejects.toMatchObject({ failure })
  })

  test('maps an error without a JSON body by its status', async () => {
    const fakeFetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response('Bad gateway', { status: 502 })),
    )
    const send = createResendSender({
      apiKey: 'k',
      from: 'f@example.com',
      fetch: fakeFetch,
    })
    await expect(send(message)).rejects.toMatchObject({
      failure: 'unavailable',
    })
  })

  test('reports a network failure as unavailable', async () => {
    const fakeFetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.reject(new TypeError('network down')),
    )
    const send = createResendSender({
      apiKey: 'k',
      from: 'f@example.com',
      fetch: fakeFetch,
    })
    await expect(send(message)).rejects.toMatchObject({
      failure: 'unavailable',
    })
  })

  test('keeps the recipient address out of the error message', async () => {
    const send = createResendSender({
      apiKey: 'k',
      from: 'f@example.com',
      fetch: resendResponding(422, { name: 'invalid_parameter', message: 'x' }),
    })
    const error = await send(message).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EmailError)
    expect((error as EmailError).message).not.toContain('owner@example.com')
  })

  test('does not call Resend with an invalid message', async () => {
    const fetch = resendResponding(200)
    const send = createResendSender({
      apiKey: 'k',
      from: 'f@example.com',
      fetch,
    })
    await expect(send({ ...message, to: 'a, b' })).rejects.toBeInstanceOf(
      EmailError,
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('Capture sender', () => {
  beforeEach(() => {
    capturedEmails.clear()
  })

  test('keeps sent messages for tests', async () => {
    const send = createCaptureSender({ log: false })
    await send(message)
    await send({ ...message, subject: 'Second' })
    expect(capturedEmails.all().map((m) => m.subject)).toEqual([
      'Hello',
      'Second',
    ])
    expect(capturedEmails.last()?.subject).toBe('Second')
  })

  test('validates messages like a real provider', async () => {
    await expect(
      createCaptureSender({ log: false })({ ...message, to: '' }),
    ).rejects.toBeInstanceOf(EmailError)
    expect(capturedEmails.all()).toEqual([])
  })
})

describe('Email transport', () => {
  const env = { EMAIL_FROM: 'Kotivalo <noreply@example.com>' }

  test('uses Resend when configured with a key', () => {
    expect(() =>
      createSendEmail({
        ...env,
        EMAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: 'k',
      }),
    ).not.toThrow()
  })

  test('fails when Resend is chosen without a key', () => {
    expect(() =>
      createSendEmail({ ...env, EMAIL_TRANSPORT: 'resend' }),
    ).toThrow(/RESEND_API_KEY/)
  })

  test('fails on an unknown transport', () => {
    expect(() => createSendEmail({ ...env, EMAIL_TRANSPORT: 'smtp' })).toThrow(
      /Unknown EMAIL_TRANSPORT/,
    )
  })

  test('the request context captures emails in tests', async () => {
    capturedEmails.clear()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    await getRequestContext().sendEmail(message)
    expect(capturedEmails.last()).toEqual(message)
  })
})
