import { describe, expect, test } from 'vitest'
import { clientIp } from './context.server'
import { isCapturing } from './mailer.server'

describe('clientIp', () => {
  const headers = new Headers({
    'cf-connecting-ip': '203.0.113.5',
    'x-test-client-ip': '198.51.100.7',
  })

  test('uses the address Cloudflare sets', () => {
    expect(clientIp(headers, false)).toBe('203.0.113.5')
  })

  test('lets tests choose the address only while capturing email', () => {
    expect(clientIp(headers, true)).toBe('198.51.100.7')
  })

  test('is "unknown" without either header', () => {
    expect(clientIp(new Headers(), true)).toBe('unknown')
  })
})

describe('isCapturing', () => {
  test('is true only for the capture transport', () => {
    expect(isCapturing({ EMAIL_TRANSPORT: 'capture' })).toBe(true)
    expect(isCapturing({ EMAIL_TRANSPORT: 'resend' })).toBe(false)
  })
})
