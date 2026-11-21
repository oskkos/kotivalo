## 1. Tables and repository

- [x] 1.1 Add `transactions` and `receipts` to `src/server/db/schema.ts` as in design.md ("Two tables"): the type and category text enums, `cents()`, `isoDate()`, `instant()`, the cascades, the unique `transaction_id` and the indexes
- [x] 1.2 `pnpm db:generate`; commit the migration
- [x] 1.3 `features/transactions/transaction.repository.server.ts`:
  - `forPropertyYear(propertyId, year)`: the year's entries, newest first, each with whether it has a receipt
  - `years(propertyId)`: the years that have entries
  - `get(transactionId)`: the entry, its flat, its author's name and its receipt
  - `create`, `update` and `delete`, with the receipt row inserted, replaced or removed in the same `atomically` batch
  - `receiptForAccess(receiptId)`: the receipt with its entry's property id
  - `storageUsage(userId)`: bytes and file count over `receipts.uploaded_by`
- [x] 1.4 Workers tests for the repository:
  - newest first within a year
  - other flats and years are left out
  - one receipt per entry
  - deleting an entry deletes its receipt row
  - deleting a flat deletes its entries
  - the usage counts only the user's own uploads

## 2. Categories and rules

- [x] 2.1 `features/transactions/categories.ts`: the categories per type, with their form 7H row and hint message, as in design.md ("Categories map to form 7H rows")
- [x] 2.2 `src/server/files/quota.ts`: `STORAGE_QUOTA` and a pure `checkQuota(usage, incomingBytes)`
- [x] 2.3 `features/transactions/schemas.ts`, shared by the form and the server:
  - the amount: `parseDecimal(text, 2)`, 1–9 999 999 cents, `transaction_amount_invalid`
  - the type and the category: `transaction_category_invalid`
  - the date: `transaction_date_in_future`
  - the note: at most 200 characters, `transaction_note_too_long`
- [x] 2.4 A pure `validateTransactionDate(date, today, firstOwnershipStart)`: `transaction_date_in_future`, `transaction_date_before_ownership`
- [x] 2.5 Unit tests named after the scenarios they cover:
  - "An invalid amount is refused"
  - "A future date is refused"
  - "A date before the ownership is refused"
  - "A category of the other type is refused"
  - the quota boundaries: exactly 1,000 files, exactly 500 MB

- [x] 2.6 Reason codes (here rather than in group 3, because the schemas name them) in `src/lib/reasons.ts`:
  - field reasons: `transaction_amount_invalid`, `transaction_category_invalid`, `transaction_date_in_future`, `transaction_date_before_ownership`, `transaction_note_too_long`, `receipt_unsupported_type`, `receipt_too_large`, `receipt_unreadable`
  - alerts: `storage_quota_full`, `transaction_not_found`

  Write the messages in fi, then sv and en with the translate skill, then run the term-critic on the diff

## 3. Server functions

- [ ] 3.1 `features/transactions/transactions.server.ts`:
  - list (year, years, totals, role)
  - details
  - the new entry options (owned flats)
  - create, update and delete
  - each write checks access (`property_not_found`), the owner role (`sharing_owner_only`) and the date against the first ownership start
  - the receipt is handled in the order of design.md ("The receipt is uploaded with the save"), with the file deleted again if the database write fails, and old files deleted after an edit or delete
- [ ] 3.2 `features/transactions/functions.ts`:
  - `getTransactions`, `getTransaction`, `getNewTransactionOptions`
  - `createTransaction` and `updateTransaction`, POST with `FormData`
  - `deleteTransaction`
  - each with its session check
- [ ] 3.3 Log the events of design.md ("Logging"), ids only
- [ ] 3.4 Workers tests, named after the scenarios:
  - "Logging an annual repair"
  - "A member can't log an entry", "A member can't edit an entry", "A member can't delete an entry"
  - "A file that isn't an image or a PDF is refused" and "A file over 10 MB is refused", each with nothing in storage afterwards
  - "A PDF receipt is stored as it is"
  - "Replacing the receipt deletes the old file" and "Removing the receipt"
  - "Editing a deleted entry is refused"
  - "A co-owner edits an entry"
  - "Deleting an entry with its receipt"
  - the three storage quota scenarios
  - the file is deleted when the database write fails
  - each logged event

## 4. Serving receipts

- [ ] 4.1 Server route `src/routes/api/receipts/$receiptId.ts`: session, `receiptForAccess`, the access check, `storage.get`, `fileResponse()` inline or with `?download=1` as an attachment; 404 for everything else
- [ ] 4.2 Workers tests:
  - "A user without access can't open a receipt"
  - a visitor who is not signed in gets 404
  - a missing file gets 404
  - the download's `Content-Disposition` carries the uploaded name

## 5. The Entries page

- [ ] 5.1 Route `/properties/$propertyId/transactions` with `?year=` and a loader calling `getTransactions`, and a page title
- [ ] 5.2 `TransactionsPage.tsx`, as on the Design canvas ("Kirjaukset", "Kirjaukset · ei kirjauksia"):
  - the year choice
  - the totals
  - the note on rent and charges, linking to the Rent and charges page
  - the month groups with signed amounts and the receipt icon
  - the empty state
  - New entry for owners, linking to `/transactions/new?propertyId=…`
- [ ] 5.3 The "Kirjaukset" icon link in the edit page's header, next to Rent and charges
- [ ] 5.4 Messages in fi, then sv and en with the translate skill; the term-critic on the diff
- [ ] 5.5 Component tests: month grouping, the totals, the empty state, the member view
- [ ] 5.6 Playwright, with entries created through the server functions in a helper (`e2e/support/transactions.ts`):
  - "Opening the page from the edit page"
  - "Entries are grouped by month, newest first"
  - "Choosing an earlier year"
  - "A flat without entries"
  - "A member sees the entries but can't add them"

## 6. Entry details and the receipt view

- [ ] 6.1 Route `/properties/$propertyId/transactions/$transactionId` with a loader calling `getTransaction`
- [ ] 6.2 `TransactionDetails.tsx`, as on the Design canvas ("Menon tiedot", "Tulon tiedot · ei kuittia", "Kirjauksen tiedot · jäsen"):
  - the amount, the chips, the details rows (flat, date, year summary row, logged by)
  - the receipt preview (an image, or a PDF tile opening the browser's viewer)
  - Download, and Edit for owners
- [ ] 6.3 `ReceiptViewer.tsx`: the full-screen dialog with Close and Download, as on "Kuitti koko näytöllä"
- [ ] 6.4 Messages in fi, then sv and en with the translate skill; the term-critic on the diff
- [ ] 6.5 Component tests: income without a receipt, the member view, "You" versus a name
- [ ] 6.6 Playwright:
  - "The details of an expense"
  - "An entry logged by a co-owner"
  - "A member downloads a receipt"
  - "Opening a receipt full screen"

## 7. The new entry form

- [ ] 7.1 `features/transactions/resize-image.ts` (design.md, "Images are resized in the browser") with component-project tests using a stubbed canvas
- [ ] 7.2 Route `/transactions/new` with `?propertyId=`. Without an owned flat it shows the explanations of "New entry from the bottom bar"
- [ ] 7.3 `TransactionForm.tsx`, as on the Design canvas ("Uusi kirjaus", "· kuitti liitetty", "· tallennetaan", "· virheet"):
  - the type switch and the amount
  - the categories (`ChoiceField`) with the tax hint
  - the date and the note
  - the receipt field: one button, `accept="image/jpeg,image/png,image/webp,application/pdf"`, a preview row with Remove, and progress while saving
  - the field reasons and the alerts
- [ ] 7.4 The flat choice when there is no `?propertyId`: the owned flats in a dialog, the last used one from `localStorage`
- [ ] 7.5 Messages, including the category names and hints, in fi, then sv and en with the translate skill. Add the category and 7H row terms to the term bank, and run the term-critic on the diff
- [ ] 7.6 Component tests:
  - the hint per category
  - "Rent is not a category"
  - the field reasons
  - the quota alert ("Storage quota for receipts")
  - the flat choice
- [ ] 7.7 Playwright:
  - "Logging an annual repair"
  - "The chosen category shows its tax hint"
  - "Rent is not a category"
  - "Logging an expense with a receipt photo", with a 4000 × 3000 JPEG fixture checked for a long edge of at most 2000 px
  - "A PDF receipt is stored as it is", with a fixture
  - "An invalid amount is refused"

## 8. Editing and deleting

- [ ] 8.1 Route `/properties/$propertyId/transactions/$transactionId/edit`. Members are sent back to the details
- [ ] 8.2 The form's edit mode:
  - the current receipt with Remove and Replace
  - "Poista kirjaus" with the confirmation dialog, as on "Muokkaa kirjausta · poista"
- [ ] 8.3 Messages in fi, then sv and en with the translate skill; the term-critic on the diff
- [ ] 8.4 Component tests for the edit mode and the dialog
- [ ] 8.5 Playwright:
  - "Correcting the amount"
  - "Replacing the receipt deletes the old file" (the old receipt address answers 404)
  - "Removing the receipt"
  - "Deleting an entry with its receipt"
  - "Cancelling keeps the entry"

## 9. The bottom bar

- [ ] 9.1 `src/components/BottomNav.tsx` (design.md, "The bottom bar"), rendered on `/` and `/account`
- [ ] 9.2 Remove the account button from the flats list header and the back button from the account page
- [ ] 9.3 Messages in fi, then sv and en with the translate skill; the term-critic on the diff
- [ ] 9.4 Component test for `aria-current`
- [ ] 9.5 Playwright:
  - "Moving between the flats list and the account page"
  - "The bottom bar opens a new entry"
  - "Forms don't show the bottom bar"
  - the modified "Opening the account page from the flats list"
  - "The only owned flat is chosen already"
  - "Choosing among owned flats"
  - "A user without flats is asked to add one"
  - "A member of shared flats only can't add entries"

  Update the existing e2e tests that used the header account button
- [ ] 9.6 Docs:
  - CLAUDE.md "Current state": entries and receipts, and the bottom bar
  - CONCEPT.md: tick the Payee and Deductible question (#23); update the data model rows of `transactions` and `receipts`; under §3, the bottom bar now has Flats · New entry · Account, with Statistics and Taxes to come
- [ ] 9.7 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass

## 10. Archive

- [ ] 10.1 `openspec archive track-transactions`; check that the specs' Purpose sections are filled in; commit as `docs(openspec): archive track-transactions`
