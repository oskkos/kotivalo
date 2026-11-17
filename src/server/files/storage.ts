// File storage, independent of the provider (CLAUDE.md, "Cloudflare stays
// inside src/server/platform/"). Receipts and attachments are stored under a
// key the server generates; D1 keeps only the key and metadata (type, size).
// Files are private: they are read only through the Worker, after an access
// check (response.ts builds the response).

export interface StoredFile {
  body: ReadableStream<Uint8Array>
  contentType: string
  size: number
}

export interface FileStorage {
  /** Stores a file, replacing any file with the same key. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
  /** The file, or null when there is none. */
  get(key: string): Promise<StoredFile | null>
  /** Removes a file. Removing a missing key is not an error. */
  delete(key: string): Promise<void>
}

export type FileKind = 'receipts' | 'attachments'

/** A new storage key, e.g. "receipts/2b1c…". Never derived from user input. */
export function newFileKey(kind: FileKind): string {
  return `${kind}/${crypto.randomUUID()}`
}
