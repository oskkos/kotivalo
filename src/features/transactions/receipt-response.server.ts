// Serves a receipt file after checking that the signed-in user has access to
// its entry's flat (openspec: transactions, "Viewing and downloading a
// receipt"). Everything else is 404, so the address reveals nothing: no
// session, no receipt, no access, or a file missing from storage.
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import { fileResponse } from '#/server/files/response'
import type { FileStorage } from '#/server/files/storage'
import type { TransactionRepository } from './transaction.repository.server'

export interface ReceiptResponseDeps {
  /** The signed-in user, if any. */
  userId: string | undefined
  transactions: TransactionRepository
  sharing: SharingRepository
  storage: FileStorage
}

const notFound = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  })

export async function receiptResponse(
  deps: ReceiptResponseDeps,
  receiptId: string,
  options: { download: boolean },
): Promise<Response> {
  if (!deps.userId) {
    return notFound()
  }
  const receipt = await deps.transactions.receiptForAccess(receiptId)
  if (!receipt) {
    return notFound()
  }
  const role = await deps.sharing.roleOf(deps.userId, receipt.propertyId)
  if (!role) {
    return notFound()
  }
  const file = await deps.storage.get(receipt.key)
  if (!file) {
    return notFound()
  }
  return fileResponse(file, {
    filename: receipt.filename,
    download: options.download,
  })
}
