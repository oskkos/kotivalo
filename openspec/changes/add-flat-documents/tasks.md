## 1. One storage quota across receipts and documents

- [x] 1.1 `property_documents` in `src/server/db/schema.ts` as in design.md ("One table"), with `DOCUMENT_KINDS`; `pnpm db:generate` and the committed migration (adds a table only); `pnpm db:migrate:local`
- [x] 1.2 `src/server/db/storage-usage.ts`: `uploadedFiles`, `fitsStorageQuota` and `storageUsage` over receipts and documents; `transaction.repository.server.ts` uses them for the receipt insert and `storageUsage`, and the existing receipt quota tests pass unchanged; `quota.ts` comment updated
- [x] 1.3 Workers tests for the builder: "Documents count towards the receipt quota" (`transactions.server.test.ts`), receipts and documents summed per uploader, a replaced receipt left out, another uploader's files not counted
- [x] 1.4 The flat deletion cascade test (`CHILD_TABLES`, `fill`) gets `property_documents`

## 2. The documents repository

- [x] 2.1 `features/documents/document.repository.server.ts`: guarded `add`, `update` and `remove` (owner role, quota and the lease's tenancy inside the statement, kind other than lease clears the tenancy), `listForProperty`, `latestForProperty`, `countForProperty`, `findForAccess`, `findDetails`
- [x] 2.2 Workers tests: an owner adds, a member's add misses, a tenancy of another flat misses, quota full misses, update clears the tenancy when the kind changes, remove returns the key, removing a tenancy keeps the lease with `tenancy_id` null ("A lease stays when its tenancy is removed"), listing order newest first

## 3. Shared file handling on the server

- [x] 3.1 `src/server/files/stored.ts`: `withStoredFile` and `uploadFilename(name, contentType, fallback)` moved from `transactions.server.ts`, which uses them with its tests passing
- [x] 3.2 Reasons `document_unsupported_type`, `document_too_large`, `document_unreadable` (`FieldReason`) and `document_not_found` (`AlertReason`) in `src/lib/reasons.ts`; `storage_quota_full` reworded for receipts and documents; fi, sv and en messages (translate skill, term-critic on the diff)
- [x] 3.3 Term bank: `attachment` replaced by `document`; CONCEPT.md data model: `property_documents` in place of `attachments`, and the R2 row's text (translate skill, term-critic on the diff)

## 4. Server functions and the file route

- [x] 4.1 `features/documents/schemas.ts` (kind, name up to 100 characters, date, tenancy only for a lease), `documents.server.ts` and `functions.ts`: `getDocuments` (with storage usage for owners), `getDocument` (with the flat's tenancies for owners), `addDocument` (FormData), `updateDocument`, `deleteDocument`, as in design.md ("Adding takes FormData, like an entry"); logs `document.added`, `document.changed`, `document.deleted`, `document.refused` and `document.quota_exceeded` (`warn`), `document.file_delete_failed` (`error`)
- [x] 4.2 `documentResponse` and the route `/api/documents/$documentId` (inline, `?download=1` as an attachment)
- [x] 4.3 Workers tests named after the scenarios: "A member can't add a document", "A file that isn't an image or a PDF is refused", "A file over 10 MB is refused", "A PDF is stored as it is", "Another flat's tenancy is refused", "Receipts and documents count together", "A document over the size is refused", "Another owner's documents don't count", "Editing a deleted document is refused", "A member can't edit a document", "A member can't delete a document", "Changing a lease to another kind removes its tenancy", "A user without access can't open a document's file", a failed file delete logged and still `ok`, a file removed when the insert misses, and the log lines

## 5. Flat deletion and the details page on the server

- [ ] 5.1 `property.repository.server.ts`: `deletionSummary` counts documents and `hasData` includes them; `receiptKeys` becomes `fileKeys` with the document keys; `properties.server.ts` uses it
- [ ] 5.2 `getFlatDetails` returns `documents: { latest, count }`
- [ ] 5.3 Workers tests: "Deleting removes the flat's documents and their files", a flat with only documents has data, the details' latest three documents by date and the count

## 6. Shared file pieces in the browser

- [ ] 6.1 `resize-image.ts` to `src/lib/` with a neutral problem; `ReceiptViewer.tsx` to `components/ImageViewer.tsx`; the entry form's file field to `components/form/FileField.tsx`; the entry form and details use them with their component tests and `e2e/transactions.spec.ts` passing
- [ ] 6.2 Component tests for `FileField` (chosen file's name and size, remove, the reason under it) and `ImageViewer`

## 7. The documents page and the details page section

- [ ] 7.1 fi, sv and en messages for the section, the page, the headings and kinds, the empty state, the member note and the storage use (translate skill, term-critic on the diff)
- [ ] 7.2 Route `documents/index.tsx` and `DocumentsPage.tsx` (groups, filter buttons, empty state, owners' add and usage line, members' note); the *Dokumentit* section on `FlatDetailsPage.tsx` and *Dokumentit* in the menu
- [ ] 7.3 Component tests: grouping and order, filtering, empty, member, the details page section with and without documents
- [ ] 7.4 Playwright tests in `e2e/documents.spec.ts` for "The documents page" and the new scenarios of "The flat details page" (`e2e/flat-details.spec.ts`), with a support helper `addDocument` in `e2e/support/documents.ts`

## 8. Adding, details, editing and deleting in the UI

- [ ] 8.1 fi, sv and en messages for the form, the details page, the delete dialog and the not-found page (translate skill, term-critic on the diff)
- [ ] 8.2 `DocumentForm.tsx` (file with `FileField`, kind with `ChoiceField`, name prefilled from the file, date, tenancy for a lease), routes `documents/new.tsx` and `$documentId/edit.tsx`; `DocumentDetails.tsx` with the preview, `ImageViewer`, Download, Edit and the delete dialog, route `$documentId/index.tsx`; invalidate the router before navigating
- [ ] 8.3 Component tests: the name suggested from the file, a name needed, the tenancy field only for a lease, the quota alert, owner and member details, the delete dialog
- [ ] 8.4 Playwright tests in `e2e/documents.spec.ts` for "Adding a document", "Document files", "A lease's tenancy", "Document details", "Viewing and downloading a document", "Editing a document" and "Deleting a document"; the flat deletion dialog's document count in `e2e/delete-flat.spec.ts`
- [ ] 8.5 `e2e/support/` helpers and CLAUDE.md: "Current state" (documents), the e2e helper list, `storage-usage.ts` next to `periods.ts`

## 9. Review and archive

- [ ] 9.1 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass
- [ ] 9.2 The `pr-review` skill on the PR
- [ ] 9.3 `openspec archive add-flat-documents` as the last commit
