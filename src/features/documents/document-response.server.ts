// Serves a document's file after checking that the signed-in user has access
// to its flat (openspec: documents, "Viewing and downloading a document").
// Everything else is 404, so the address reveals nothing: no session, no
// document, no access, or a file missing from storage.
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import { fileResponse } from '#/server/files/response'
import type { FileStorage } from '#/server/files/storage'
import type { DocumentRepository } from './document.repository.server'

export interface DocumentResponseDeps {
  /** The signed-in user, if any. */
  userId: string | undefined
  documents: DocumentRepository
  sharing: SharingRepository
  storage: FileStorage
}

const notFound = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  })

export async function documentResponse(
  deps: DocumentResponseDeps,
  documentId: string,
  options: { download: boolean },
): Promise<Response> {
  if (!deps.userId) {
    return notFound()
  }
  const document = await deps.documents.findForAccess(documentId)
  if (!document) {
    return notFound()
  }
  const role = await deps.sharing.roleOf(deps.userId, document.propertyId)
  if (!role) {
    return notFound()
  }
  const file = await deps.storage.get(document.key)
  if (!file) {
    return notFound()
  }
  return fileResponse(file, {
    filename: document.filename,
    download: options.download,
  })
}
