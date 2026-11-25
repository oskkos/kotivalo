// How much a user may store (receipts and documents together): a limit
// against misuse that keeps R2 within its free tier, not exact accounting.
// The usage comes from the sizes recorded in D1, checked before
// storage.put().

export const STORAGE_QUOTA = { bytes: 500 * 1024 * 1024, files: 1000 } as const

export interface StorageUsage {
  bytes: number
  files: number
}

/** Whether one more file of `incomingBytes` fits in the quota. */
export function fitsQuota(usage: StorageUsage, incomingBytes: number): boolean {
  return (
    usage.files + 1 <= STORAGE_QUOTA.files &&
    usage.bytes + incomingBytes <= STORAGE_QUOTA.bytes
  )
}
