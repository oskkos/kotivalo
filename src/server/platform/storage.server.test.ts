import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'
import { newFileKey } from '#/server/files/storage'
import { getRequestContext } from './context.server'
import { createR2Storage } from './storage.server'

const PDF = new TextEncoder().encode('%PDF-1.7\n')

describe('R2 storage', () => {
  test('stores and reads back a file with its type and size', async () => {
    const storage = createR2Storage(env.FILES)
    const key = newFileKey('receipts')

    await storage.put(key, PDF, 'application/pdf')
    const stored = await storage.get(key)

    expect(stored?.contentType).toBe('application/pdf')
    expect(stored?.size).toBe(PDF.byteLength)
    expect(await new Response(stored?.body).text()).toBe('%PDF-1.7\n')
  })

  test('returns null for a missing file', async () => {
    expect(await createR2Storage(env.FILES).get('receipts/missing')).toBeNull()
  })

  test('deletes a file, and deleting it again is fine', async () => {
    const storage = createR2Storage(env.FILES)
    const key = newFileKey('attachments')
    await storage.put(key, PDF, 'application/pdf')

    await storage.delete(key)
    await storage.delete(key)

    expect(await storage.get(key)).toBeNull()
  })

  test('the request context gives storage on the FILES bucket', async () => {
    const key = newFileKey('receipts')
    await getRequestContext().storage.put(key, PDF, 'application/pdf')
    expect(await env.FILES.head(key)).not.toBeNull()
  })
})
