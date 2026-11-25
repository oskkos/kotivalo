// FileStorage (src/server/files/storage.ts) on a Cloudflare R2 bucket.
import type { FileStorage } from '#/server/files/storage'

/** R2 removes at most this many keys in one call. */
export const R2_DELETE_LIMIT = 1000

export function createR2Storage(bucket: R2Bucket): FileStorage {
  return {
    async put(key, bytes, contentType) {
      await bucket.put(key, bytes, { httpMetadata: { contentType } })
    },
    async get(key) {
      const object = await bucket.get(key)
      if (!object) {
        return null
      }
      return {
        // Typed as ReadableStream<any> by the Workers types; R2 streams bytes.
        body: object.body as ReadableStream<Uint8Array>,
        contentType:
          object.httpMetadata?.contentType ?? 'application/octet-stream',
        size: object.size,
      }
    },
    async delete(key) {
      await bucket.delete(key)
    },
    async deleteMany(keys) {
      for (let start = 0; start < keys.length; start += R2_DELETE_LIMIT) {
        await bucket.delete(keys.slice(start, start + R2_DELETE_LIMIT))
      }
    },
  }
}
