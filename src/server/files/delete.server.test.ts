import { describe, expect, test } from 'vitest'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { deleteStoredFiles } from './delete'
import type { FileStorage } from './storage'

function storageWith(deleteMany: FileStorage['deleteMany']): FileStorage {
  return {
    put: () => Promise.resolve(),
    get: () => Promise.resolve(null),
    delete: () => Promise.resolve(),
    deleteMany,
  }
}

describe('deleteStoredFiles', () => {
  test('deletes all the keys in one call', async () => {
    const calls: string[][] = []
    const { log, lines } = createCaptureLogger()

    await deleteStoredFiles(
      storageWith((keys) => {
        calls.push([...keys])
        return Promise.resolve()
      }),
      log,
      ['receipts/a', 'receipts/b'],
      'property.file_delete_failed',
    )

    expect(calls).toEqual([['receipts/a', 'receipts/b']])
    expect(lines).toEqual([])
  })

  test('does not call the storage without keys', async () => {
    const { log, lines } = createCaptureLogger()
    await deleteStoredFiles(
      storageWith(() => Promise.reject(new Error('called'))),
      log,
      [],
      'property.file_delete_failed',
    )
    expect(lines).toEqual([])
  })

  test('logs a failure at error with the number of keys, and does not throw', async () => {
    const { log, lines } = createCaptureLogger()

    await deleteStoredFiles(
      storageWith(() => Promise.reject(new Error('R2 is down'))),
      log,
      ['receipts/a', 'receipts/b'],
      'property.file_delete_failed',
    )

    expect(lines).toContainEqual(
      expect.objectContaining({
        level: 'error',
        event: 'property.file_delete_failed',
        count: 2,
      }),
    )
    expect(JSON.stringify(lines)).not.toContain('receipts/a')
  })
})
