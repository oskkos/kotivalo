## 1. Archiving in the schema and the repository

- [x] 1.1 `property_access.archived_at` (`instant()`, nullable) in `src/server/db/schema.ts`; `pnpm db:generate` and the committed migration (adds a column only); `pnpm db:migrate:local`
- [x] 1.2 `property.repository.server.ts`: `listForUser` leaves archived rows out, `listArchivedForUser`, `setArchived(userId, propertyId, at | null)` (keeps the first date when already archived), `findForUser` returns the user's `archivedAt`; `countForUser` unchanged
- [x] 1.3 Workers tests in `property.repository.server.test.ts`: archiving hides the flat only for that user, a co-owner's list unchanged, restoring, the first date kept, another user's flat not found, an archived flat still counted

## 2. Deleting in the repository and storage

- [x] 2.1 `FileStorage.deleteMany(keys)` in `src/server/files/storage.ts`; R2 in `platform/storage.server.ts` in chunks of 1,000 keys; the memory storage used in tests
- [x] 2.2 `deleteStoredFiles(storage, log, keys, event)` in `src/server/files/`, on `deleteMany`, logging a failure at `error` with the count; `transactions.server.ts` uses it in place of its own `deleteFiles`, with its tests still passing
- [x] 2.3 `property.repository.server.ts`: `deletionCheck(userId, propertyId)` (role, other owners past and present with names), `deletionSummary(propertyId)` (`hasData`, counts of tenancies, rent payments, transactions and receipts, member names), `receiptKeys(propertyId)`, and `deleteGuarded(userId, propertyId)` (one `DELETE` with the owner and other-owner conditions, returning whether it deleted)
- [x] 2.4 Workers tests: the cascade empties every child table (listed explicitly: access, invitations, ownership periods, financing charges, recurring amounts, treatments, usage charges and amounts, tenancies, tenancy rents, occupants, tenant fees and amounts, rent payments, transactions, receipts), another flat untouched, the guard refuses with a former owner's share and for a member, the summary's counts and `hasData` for an empty flat; unit or Workers tests for `deleteMany` chunking and `deleteStoredFiles`
- [x] 2.5 CLAUDE.md, "Repositories": a new table referencing `properties` goes into the flat deletion cascade test

## 3. The notice after navigating

- [x] 3.1 `components/NavigationNotice.tsx`: an MUI `Snackbar` with `role="status"` from the router's history state (`HistoryState` typed with `notice?: string`), cleared with a `replace` once shown
- [x] 3.2 Component test: shows the notice from history state, clears it so a second render shows nothing

## 4. Server functions

- [x] 4.1 Reason `property_delete_other_owners` (`AlertReason`) in `src/lib/reasons.ts` with `reason_…` and `reason_…_title` messages in fi, sv and en (translate skill, term-critic on the diff)
- [x] 4.2 `properties.server.ts` and `functions.ts`: `archiveProperty`, `restoreProperty`, `getPropertyDeletion` and `deleteProperty` as in design.md ("Deleting is one guarded statement, then the files"); `listProperties` returns `archived`; `getFlatDetails` returns `archivedAt`; logs `property.archived`, `property.restored`, `property.deleted`, `property.delete_refused` (`warn`) and `property.receipt_delete_failed` (`error`)
- [x] 4.3 Workers tests in `properties.server.test.ts` named after the scenarios: "Another user can't archive a flat", "An archived flat still counts towards the limit", "A member can't delete a flat", "Another user can't delete a flat", "A former owner's share prevents deleting", "Other flats are kept", the receipt files removed from storage, a failed file delete logged and still `ok`, and the log lines
- [x] 4.4 Workers tests at the other callers of `listForUser`: "An archived flat is left out of the summary" (`rent-payments.server.test.ts`) and "An archived flat is not offered" (`transactions.server.test.ts`)

## 5. Archiving in the UI

- [x] 5.1 fi, sv and en messages: *Arkistoi asunto*, *Palauta listalle*, the archive dialog, the band, *Arkistoidut asunnot (n)*, *Arkistoitu D.M.YYYY*, the notice "… arkistoitu" (translate skill, term-critic on the diff)
- [x] 5.2 `FlatDetailsPage.tsx`: the divider and *Arkistoi asunto* / *Palauta listalle* in the menu, `ArchivedBand`; `ArchiveDialog.tsx`; confirming navigates to `/` with the notice
- [x] 5.3 `PropertyList.tsx`: the archived section after the cards and below the first-run explanation, closed at first; `NavigationNotice` on the flats list
- [x] 5.4 Component tests: the band and the menu label for an archived flat, the archived section closed and opened, the first run with only archived flats
- [x] 5.5 Playwright tests in `e2e/archive-flat.spec.ts` for "Archiving a flat", "Archived flats on the flats list" and "Restoring an archived flat", and for the new scenarios of "Listing flats" and "First run without flats" (with `signIn`, `addFlat`, and sharing for the co-owner and member cases)
- [x] 5.6 CLAUDE.md "Current state": archiving a flat per user, the archived section, restoring; CONCEPT.md data model: `property_access.archived_at`

## 6. Deleting in the UI

- [ ] 6.1 fi, sv and en messages: *Poista asunto*, the three dialog states, the losses with counts (`plural`), the members who lose access, the address field, *Poista* / *Poista pysyvästi*, the notice "… poistettu" (translate skill, term-critic on the diff)
- [ ] 6.2 `addressMatches(typed, streetAddress)` (lower case, whitespace collapsed and trimmed) with unit tests
- [ ] 6.3 `DeleteFlatDialog.tsx` loading `getPropertyDeletion`: plain, with losses and the address, or blocked with the alert and *Arkistoi asunto* (opens the archive dialog); *Poista asunto* in the menu for owners; confirming navigates to `/` with the notice; failures with `failureReason(error)`
- [ ] 6.4 Component tests for the three states and the disabled button until the address matches
- [ ] 6.5 Playwright tests in `e2e/delete-flat.spec.ts` for "Deleting a flat" and "Confirming the deletion of a flat" (empty flat, flat with a tenancy, a rent payment and an entry with a receipt, a member losing access, a pending invitation, the co-owned flat blocked, cancelling), and the changed member scenario of "The flat details page" in `e2e/flat-details.spec.ts`
- [ ] 6.6 CLAUDE.md "Current state": deleting a flat, the guard and the receipt files

## 7. Review and archive

- [ ] 7.1 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass
- [ ] 7.2 The `pr-review` skill on the PR
- [ ] 7.3 `openspec archive archive-and-delete-flats` as the last commit
