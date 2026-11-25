// The kinds of a flat's document, with their words (openspec: documents).
// The order is the documents page's group order.
import { m } from '#/paraglide/messages.js'
import { DOCUMENT_KINDS, type DocumentKind } from '#/server/db/schema'

export { DOCUMENT_KINDS }

/** A kind's name for one document, e.g. in the form and on details. */
export const kindLabel: Record<DocumentKind, () => string> = {
  lease: () => m.documents_kind_lease(),
  financial_statement: () => m.documents_kind_financial_statement(),
  charge_notice: () => m.documents_kind_charge_notice(),
  minutes: () => m.documents_kind_minutes(),
  other: () => m.documents_kind_other(),
}

/** A kind's name for a group of documents: the heading and the filter. */
export const kindHeading: Record<DocumentKind, () => string> = {
  lease: () => m.documents_heading_lease(),
  financial_statement: () => m.documents_heading_financial_statement(),
  charge_notice: () => m.documents_heading_charge_notice(),
  minutes: () => m.documents_heading_minutes(),
  other: () => m.documents_heading_other(),
}

/** Where a document's file is served; `download` sends it as an attachment. */
export function documentUrl(documentId: string, download = false) {
  const path = `/api/documents/${encodeURIComponent(documentId)}`
  return download ? `${path}?download=1` : path
}

/** The documents grouped by kind in the fixed order, keeping their order. */
export function groupByKind<T extends { kind: DocumentKind }>(
  documents: readonly T[],
): { kind: DocumentKind; documents: T[] }[] {
  return DOCUMENT_KINDS.map((kind) => ({
    kind,
    documents: documents.filter((document) => document.kind === kind),
  })).filter((group) => group.documents.length > 0)
}
