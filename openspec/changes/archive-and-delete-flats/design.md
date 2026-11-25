## Context

A flat is a `properties` row with `property_access` rows (one per user, `owner` or `member`), ownership periods and everything else hanging off it. Every table that belongs to a flat references `properties` (or a child of it) with `ON DELETE CASCADE`: access, invitations, ownership periods, financing charges, recurring amounts, treatments, usage charges and their amounts, tenancies with their rents, occupants, fees and fee amounts, rent payments, transactions and receipts. Receipt files are in R2 under keys stored in `receipts.key`. Deleting a single entry already deletes its file after the row (`deleteFiles` in `transactions.server.ts`: one `storage.delete` per key, a failure logged as `transaction.receipt_delete_failed`).

The flats list (`listProperties`), this month's rent summary (`listRentThisMonth`) and the new entry options (`getNewTransactionOptions`) all read the user's flats through `propertyRepository(db).listForUser(userId)`. Opening a flat goes through `findForUser`. There is no notice (snackbar) pattern yet.

Design canvas section *Asunnon arkistointi ja poisto (#64)*. Decisions of 25.11.2026: archiving is per user; only a sole owner whose flat never had another owner may delete; a flat with data may be deleted after typing its address.

## Goals / Non-Goals

**Goals:**
- Hide a flat from one user's everyday views without touching anyone else's data or access
- Delete a flat and every row and file that belongs to it, only where nobody else needs it for their taxes
- Keep the flat counting and access rules as they are

**Non-Goals:**
- What a former owner sees (#88), the year summary (#34), deleting an account (#85)
- A sweeper for orphaned receipt files
- Soft delete or an undo for deleting

## Decisions

### Archiving is a column on `property_access`

`property_access.archived_at` (`instant()`, nullable): when this user archived the flat. Archiving is per user, so it belongs on the per-user row, not on `properties`. The migration only adds a nullable column, so the previous deploy keeps working.

Repository (`property.repository.server.ts`):
- `listForUser(userId)` leaves out rows with `archived_at` set. Its three callers then leave archived flats out with no changes of their own: the list, the rent summary and the new entry options. Workers tests at each caller pin this down, so a later caller doesn't drift.
- `listArchivedForUser(userId)`: the archived flats with `archivedAt`.
- `setArchived(userId, propertyId, at: number | null)`: updates the user's own access row, returns whether a row was found (not found otherwise). Archiving an archived flat keeps the first date.
- `findForUser` also returns the user's `archivedAt`, so `getFlatDetails` can show the band without another read.
- `countForUser` still counts every access row, so archived flats count towards the 100-flat limit.

Removing a member or the member leaving deletes the row; a new invitation starts unarchived. That is fine: it is a new access.

Alternative: `properties.archived_at` for everyone, set by owners. Rejected 25.11.2026: one co-owner would hide a flat from the others, and it needs agreement rules.

### Deleting is one guarded statement, then the files

`deleteProperty({ propertyId })` in `properties.server.ts`:
1. Session check. `findForUser` → not found when the user has no access.
2. `deletionCheck(userId, propertyId)` → `sharing_owner_only` for a member, `property_delete_other_owners` with the other owners' names when any ownership period of the flat has another user with a share above 0.
3. Read the flat's receipt keys (`receiptKeys(propertyId)`: receipts joined through transactions).
4. `deleteGuarded(userId, propertyId)`: one `DELETE FROM properties WHERE id = ? AND <the user is an owner> AND NOT EXISTS (<ownership period of another user with share > 0>)`, returning the id. The cascade removes the rest in the same statement, so the rows go all or nothing without `atomically()`. If nothing was deleted (an ownership change or access removal in between), the server function runs the check again and returns its reason.
5. Delete the files (below), then log `property.deleted` with the property id.

D1 enforces foreign keys, and so the cascade, by default, and Miniflare does the same. A Workers repository test deletes a flat with a row in every child table and checks that each is empty, so a missing `ON DELETE CASCADE` in a future table fails a test. That test lists the tables explicitly, and adding a table that references `properties` means adding it there.

The check is repeated inside the `DELETE`, so a concurrent ownership change can't sneak through between steps 2 and 4.

The typed address is checked only in the browser. It guards against a slip of the finger, not an attacker, and the server has the real rule (step 4).

Alternative: explicit deletes per table with `atomically()`. Rejected: longer, and a forgotten table would leave rows behind silently, while the cascade test catches a missing cascade.

### Files are deleted in batches after the rows

`FileStorage` gets `deleteMany(keys)`. R2's binding deletes up to 1,000 keys per call, so the platform adapter splits the keys into chunks of 1,000. A flat's receipts are at most a few thousand (1,000 files per uploader), so this stays within the Workers Free plan's limit of calls to Cloudflare services per request, where one call per file wouldn't. The memory storage used in tests implements it too.

The rows go first: a file without a row is invisible and harmless, while a row without a file shows a broken receipt. If `deleteMany` fails, the server function logs `property.receipt_delete_failed` at `error` (the property id and the number of keys, not the keys' owners) and still answers `ok`, because the flat is gone. The entry deletion's `deleteFiles` moves to `server/files/` as `deleteStoredFiles(storage, log, keys, event)` on `deleteMany`, and both features use it.

Risk accepted: a receipt uploaded between steps 3 and 4 (only the sole owner can upload) is left as an orphan file. Orphan cleanup is out of scope.

### The confirmation reads a deletion summary

`getPropertyDeletion({ propertyId })` (GET) returns:
- `{ ok: true, allowed: true, hasData, counts: { tenancies, rentPayments, transactions, receipts }, members: string[] }`, or
- `{ ok: true, allowed: false, reason, otherOwners: string[] }` for `property_delete_other_owners` (with the names, past and present) or `sharing_owner_only`, or
- not found.

`hasData` is true when the flat has a tenancy, a recurring amount, a financing charge, a treatment, a usage charge or a transaction. Ownership periods and access don't count: every flat has them. Counts and names come from one repository method, `deletionSummary`, which runs a `count` query per table and one query for the members' names. The details page calls it when *Poista asunto* is selected, and the dialog shows a spinner until then. Nothing is loaded for pages that never open the dialog.

### Server functions and reasons

`features/properties/functions.ts`: `archiveProperty`, `restoreProperty`, `getPropertyDeletion`, `deleteProperty`, each validating `{ propertyId }` with the feature's schema and checking the session itself. `listProperties` also returns `archived` (from `listArchivedForUser`). `getFlatDetails` returns `archivedAt`.

`property_delete_other_owners` is a new `AlertReason` in `src/lib/reasons.ts`, with `_title` messages, shown in the dialog. Members never see the menu item, but the server still refuses them with `sharing_owner_only`.

Logs: `property.archived`, `property.restored`, `property.deleted` at `info` with the property id; `property.receipt_delete_failed` at `error`; a refused deletion at `warn` (`property.delete_refused` with the reason).

### UI

- **Details page** (`FlatDetailsPage.tsx`): a divider at the end of the menu, then *Arkistoi asunto* (or *Palauta listalle*) and, for owners, *Poista asunto* in the error colour. When `archivedAt` is set, a band at the top (`ArchivedBand`): *Arkistoitu D.M.YYYY* (`formatDate` of the day in Finland), the explanation and *Palauta listalle*, which calls `restoreProperty` and invalidates the route. No confirmation for restoring.
- **`ArchiveDialog.tsx`**: the confirmation from the canvas (`ArkistoiVahvista`). Confirming calls `archiveProperty` and navigates to `/` with the notice.
- **`DeleteFlatDialog.tsx`**: loads `getPropertyDeletion`, then one of three states: plain (`PoistaTyhja`), with the losses and the address field (`PoistaVahvista`; `normalise(text) === normalise(streetAddress)`, lower case with runs of whitespace collapsed and trimmed, a pure function with unit tests), or blocked (`PoistaEiVoi`, the alert from `reasonText` with the names and *Arkistoi asunto*, which opens the archive dialog). Confirming calls `deleteProperty` and navigates to `/` with the notice. A failure shows `failureReason(error)` in the dialog.
- **Flats list** (`PropertyList.tsx`): after the cards, a section with a heading button *Arkistoidut asunnot (n)* (`aria-expanded`, closed at first) and the archived cards: address, rooms, area, city and *Arkistoitu D.M.YYYY*, without status chips. The same section sits below the first-run explanation when only archived flats remain.
- **Notice after navigating** (`components/NavigationNotice.tsx`): an MUI `Snackbar` with `role="status"` that the root of the flats list renders from the router's history state (`navigate({ to: '/', state: { notice } })`, typed through TanStack Router's `HistoryState`). It clears the state with a `replace` once shown, so a reload doesn't repeat it. The notice text is built by the caller from messages, so the component has no copy of its own. The address in history state stays in the browser, and the URL carries no data.

### Words

*Arkistoi asunto*, *Palauta listalle*, *Arkistoidut asunnot*, *Poista asunto*, *Poista pysyvästi*, the dialogs, the band and the notices in fi, sv and en, with the translate skill. *Arkistoida* is an everyday word, not a domain term, unless the translate skill finds a reason to add it to the term bank. The messages use the bank's terms for *asunto*, *vuokrasuhde*, *vuokranmaksu*, *kirjaus* and *kuitti*.

## Risks / Trade-offs

- [Deleting is permanent and removes tax records] → Only where nobody else ever had a share; the dialog says it can't be undone, suggests archiving and asks for the address. Keeping records for the Tax Administration remains the user's responsibility.
- [Orphan files when R2 fails or a receipt races the delete] → Logged at `error` with the property id; invisible to users; no sweeper yet.
- [Archiving is easy to forget] → The section with the count stays at the end of the list, and the details page shows the band.
- [A future table without `ON DELETE CASCADE`] → The cascade test lists every child table, and the CLAUDE.md note on repositories says to add new ones there.
- [History state survives a reload in some browsers] → The notice clears it with `replace` once shown.
