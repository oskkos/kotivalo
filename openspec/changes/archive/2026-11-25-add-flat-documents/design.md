## Context

Receipts (#32) are the only files today:
- **Storage:** one `receipts` row per entry, the file in R2 under `newFileKey('receipts')`, checked with `checkUpload()`.
- **Saving:** the entry and its receipt are saved together from FormData. The file is stored first and the row is inserted after, with the quota checked again inside the insert (`fitsQuota` in `transaction.repository.server.ts`). If the write misses, `withStoredFile` deletes the stored file.
- **Serving:** files go out through `/api/receipts/$receiptId` after an access check (`receipt-response.server.ts`).
- **Browser:** images are resized there (`features/transactions/resize-image.ts`) and opened full screen with `ReceiptViewer.tsx`.
- **Quota:** 500 MB and 1,000 files per uploader (`STORAGE_QUOTA`), counted from `receipts` only.
- **Flat deletion:** deleting a flat reads `receiptKeys(propertyId)` before the guarded `DELETE`, then calls `deleteStoredFiles()`.

The data model draft in CONCEPT.md has an `attachments` table keyed by `tenancy_id` for #93's contract. The term bank has a `proposed` term `attachment` (*liite*) defined as "a file kept with a tenancy". Neither is built.

The screens are in the Design canvas section *Asunnon dokumentit (#114)*. Decided 25.11.2026:
- one table, with the tenancy optional
- everyone with access sees the documents, and owners change them
- five fixed kinds

## Goals / Non-Goals

**Goals:**
- One table for a flat's files, so #93's lease is a document with a tenancy, not a second file store.
- Reuse the receipt pipeline (checks, quota in the write, file response, resize, viewer) rather than copying it.
- One storage quota per user across receipts and documents.

**Non-Goals:**
- The deposit and the lease on the Tenancy page (#93).
- What a former owner sees (#88).
- Folders, versions, OCR, uploading several files at once, retention rules (#77).
- Replacing a document's file in place.

## Decisions

### One table: `property_documents`

Columns, built with `columns.ts`:

- `id`: `id()`
- `property_id`: `→ properties`, `ON DELETE CASCADE`
- `tenancy_id`: `→ tenancies`, nullable, `ON DELETE SET NULL`
- `kind`: text, one of `DOCUMENT_KINDS`
- `name`: text
- `date`: `isoDate()`
- `key`, `content_type`, `size`, `filename`, `uploaded_by`: as in `receipts`
- `created_at` and `updated_at`: `instant()`

There are two indexes: `(property_id, date)` for the page and `uploaded_by` for the quota.

`ON DELETE SET NULL` keeps a lease when its tenancy is removed. Only a tenancy that hasn't started can be removed, and the paper may still matter. The table goes into the flat deletion cascade test (`CHILD_TABLES` and `fill`). That test covers the tenancy branch too, because deleting a flat removes its tenancies in the same cascade.

The table is named `property_documents`, not `documents` or `attachments`. The prefix says what it hangs off, like `property_access`, and the code name is `document`, after the new term (see Terms).

Alternative: CONCEPT.md's `attachments` keyed by `tenancy_id`, plus a second table for flat documents. Rejected 25.11.2026: two file stores with the same access, quota and deletion rules, and a lease without a tenancy would have nowhere to live.

### Kinds are a fixed list in code

`DOCUMENT_KINDS = ['lease', 'financial_statement', 'charge_notice', 'minutes', 'other'] as const` in `features/documents/kinds.ts`. The order is the page's group order, and each kind has a heading and a label from messages.

The server enforces that a document has a tenancy only when it is a lease. The tenancy must belong to the same flat, checked inside the write, else `tenancy_not_found`. Changing the kind away from `lease` clears `tenancy_id` in the same update.

### Writes are guarded inside the statement, as for receipts

`documentRepository(db)` in `features/documents/document.repository.server.ts`:

- **`add(actorId, fields, now)`:** `INSERT … SELECT` from the actor's `property_access` row with role `owner`. Its `WHERE` also requires that the file fits the quota (below) and that the tenancy, if given, is the flat's. It returns the id or nothing.
- **`update(actorId, documentId, fields, now)`:** `UPDATE … WHERE` the document is in a flat the actor owns and, for a lease, the tenancy is the flat's. It returns whether a row changed.
- **`remove(actorId, documentId)`:** `DELETE … RETURNING key`, guarded the same way.
- **Reads:**
  - `listForProperty(propertyId)`: newest first, grouped in the UI
  - `latestForProperty(propertyId, 3)` and `countForProperty(propertyId)`, for the details page
  - `findForAccess(documentId)`: the file route
  - `findDetails(documentId)`: with the uploader's name and the tenancy's tenant

When a guarded write misses, the server function looks again to give the reason: not found, `sharing_owner_only`, `tenancy_not_found` or `storage_quota_full`. This is the order the entry functions use.

### One quota across receipts and documents

`src/server/db/storage-usage.ts` is a statement builder like `periods.ts`, allowed to import Drizzle. It provides:
- `uploadedFiles(db, userId, except?)`: a `UNION ALL` of `receipts` and `property_documents` rows of the uploader, as `(size)`. It is plain SQL that works in SQLite and PostgreSQL. `except` leaves out the receipt of an entry being replaced, as `fitsQuota` does today.
- `fitsStorageQuota(db, userId, size, except?)`: the `WHERE` condition that the sum plus `size` and the count plus one stay within `STORAGE_QUOTA`.
- `storageUsage(db, userId, except?)`: the read, for the first check and the documents page's usage line.

The receipt insert and `storageUsage` in `transaction.repository.server.ts` switch to these. The existing receipt quota tests then cover the refactor, and new tests add documents to the count. `quota.ts` keeps the limits and `fitsQuota()`, and its comment no longer says "attachments later".

Alternative: two separate quotas of 500 MB. Rejected: the quota protects R2's free tier, which is per account, so it must be one total.

### Adding takes FormData, like an entry

`addDocument` in `features/documents/functions.ts` reads FormData with the file and the fields, validated with a Zod schema in `schemas.ts`. The form uses the same schema for the fields. `documents.server.ts` then works through these steps:
1. Session, flat access, owner role.
2. `checkUpload()`. A failure is `document_unsupported_type` or `document_too_large`, logged as `document.refused` (warn) with the problem.
3. First quota read → `storage_quota_full`, logged as `document.quota_exceeded` (warn).
4. `storage.put(newFileKey('attachments'), …)`.
5. The guarded insert, wrapped in `withStoredFile`, which deletes the file if the insert throws or misses.
6. `document.added` (info) with the property and document ids.

`withStoredFile` and the filename cleaning (`receiptFilename`) move from `transactions.server.ts` to `src/server/files/stored.ts` as `withStoredFile` and `uploadFilename(name, contentType, fallback)`. Both features use them. The file key kind `'attachments'` already exists in `FileKind`, and keys never contain names.

Edit and delete take plain objects. Delete runs `remove` first, then `deleteStoredFiles(storage, log, [key], 'document.file_delete_failed')`, then logs `document.deleted`. Edits log `document.changed`. Logs carry ids only, never names or file names.

### Serving files

`/api/documents/$documentId` is a server route like the receipt route, with a `documentResponse(deps, id, { download })` module. It returns 404 without a session, without the document, without access or without the file, and otherwise `fileResponse()` under the uploaded file name. Access is any role, as for receipts.

### Shared browser pieces move out of `transactions`

These moves have no behaviour change:
- `resize-image.ts` moves to `src/lib/resize-image.ts`. Its error carries a neutral problem (`too_large` or `unreadable`), and each form maps it to its own reason. That gives `receipt_*` for entries and `document_too_large` / `document_unreadable` for documents.
- `ReceiptViewer.tsx` becomes `components/ImageViewer.tsx`, with the title and download label passed in.
- The entry form's file field (one dashed button, the chosen file's name and size, remove, and the reason under it) becomes `components/form/FileField.tsx`. The entry form uses it. The existing component and Playwright tests for receipts guard the move.

`document_unreadable` is in the proposal's list of reasons for the same reason: an image that can't be redrawn in the browser needs its own message, as `receipt_unreadable` has.

### Pages and routes

Under `routes/_authed/properties/$propertyId/documents/`:
- `index.tsx` (the documents page)
- `new.tsx` (add)
- `$documentId/index.tsx` (details)
- `$documentId/edit.tsx`

The details page reads one server function, `getDocument`, which returns the document, the user's role and, for owners, the flat's tenancies for the form. `getDocuments` returns the list, the role and, for owners, the storage usage. After add and edit, the page invalidates the router and navigates, as the other forms do (#113).

The flat details page gets the section from `getFlatDetails`, which adds `documents: { latest, count }`. The menu gets *Dokumentit*.

### Flat deletion counts documents

`deletionSummary` adds `counts.documents`, and `hasData` includes it. `receiptKeys` becomes `fileKeys(propertyId)`, the receipt and document keys of the flat, read before the guarded `DELETE`. The dialog's list gets a plural message for documents.

### Terms

- The `attachment` term is replaced by `document`: *dokumentti* / *dokument* / *document*, code `document`, defined as "a file kept with a flat, such as a lease or a financial statement".
- The kinds are researched with the translate skill:
  - *vuokrasopimus* (Finnish law: *hyresavtal* / lease)
  - *tilinpäätös* (*bokslut* / financial statements)
  - *vastikeilmoitus*: the everyday word may be *vastikelasku* or *maksuilmoitus*; the skill decides
  - *pöytäkirja* (*protokoll* / minutes)
- Statuses stay `proposed` where no source is found. The term critic reviews the diff.

### Migration

The migration only adds a table, so the previous deploy keeps working before the new code is live.

## Risks / Trade-offs

- **[The quota refactor touches receipts]** → The receipt quota tests stay as they are and must pass against the shared builder before documents use it. That is task group 1.
- **[A financial statement PDF over 10 MB]** → It is refused with `document_too_large`, whose message suggests saving a smaller PDF. The limit is shared with receipts and `MAX_REQUEST_BYTES`. Raising it is a separate decision about the Workers request size.
- **[An orphaned file after a failed delete]** → It is logged at `error` (`document.file_delete_failed`), as for receipts. No sweeper, as before.
- **[Members see leases with the tenant's personal data]** → Members already see the tenancy's name, phone and email on the Tenancy page. Retention rules are #77.
- **[The canvas's two file buttons]** → The app keeps the receipt field's single button (proposal). The canvas board is updated with this proposal.
