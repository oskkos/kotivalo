## Why

Landlords need to log the income and expenses that the rent and charge periods don't cover, such as a plumber's bill, the insurance or the tenant's water payments, and keep the receipt with each one (#32). The year summary (#34) builds the form 7H figures from these entries and the periods, so each entry must carry the category that decides its row and whether it is deductible. Today the app has no way to record them. The bottom navigation bar from the original concept also gets its first real use: its middle button opens a new entry.

## What Changes

- **Entries per flat.** An owner logs an income or an expense for a flat: amount, category, date and an optional note.
  - The category list depends on the type. Each category gives the form 7H row and whether the entry is taxable income or a deductible expense, shown as a hint in the form.
  - Rent and the monthly charges are not categories, because they are computed from their periods (#31) and would otherwise be counted twice.
  - The date can't be in the future or before the flat's first ownership period.
- **A receipt with an entry.** An entry can have one receipt, a photo or a PDF.
  - One button opens the phone's camera or files. Images are resized in the browser before upload.
  - The receipt is sent together with the entry when it is saved, so no file is stored for a form that was never saved.
  - The server checks the type from the file's first bytes, stores it in R2 under a generated key, and serves it only after checking access to the flat.
- **The Entries page.** Each flat has an Entries page, opened from a new button in the edit page's header.
  - It lists the year's entries by month, newest first, with the year's total income and expenses and a year choice.
  - It says that rent and the monthly charges come from their amounts and are not logged.
- **Entry details.** The details page shows:
  - the amount, category, deductibility, date, and the year summary row it goes to
  - who logged it
  - the receipt, which opens full screen and can be downloaded
- **Editing and deleting.** An owner can correct any entry of the flat, and remove or replace its receipt. Deleting an entry, after a confirmation, also deletes its receipt file.
- **Who can do what.** Owners add, edit and delete entries, including those of the other owners. Members see the entries and can open and download receipts.
- **Storage quota.** Each user may store up to 500 MB or 1,000 files of receipts (attachments will count too, #30). The quota is checked before a file is stored, so R2 stays within its free tier even if an account is misused. When the quota is full, the user can still save the entry without the receipt.
- **Bottom navigation bar.** The flats list and the account page get a bottom bar: Flats · New entry · Account.
  - The account button leaves the flats list header, and the account page loses its back button.
  - Statistics and Taxes join the bar when they are built (#37, #34).
  - New entry from the bar asks for the flat, among those the user owns. If the user owns no flat, the form explains why instead.
- **#23 decided:** there is no Payee field (the note covers it), and deductibility follows from the category instead of being a flag.

Not in this change:
- monthly recurring entries: rent and charges are periods (#31), and other recurring expenses are rare
- rent payment status (#25), tenancies and their attachments (#30)
- the year summary (#34) and statistics (#37)
- the flat details page (#33), which will show the latest entries
- the former owner's view (CONCEPT.md §6)

## Capabilities

### New Capabilities

- `transactions`: entries (income and expenses) per flat with their categories, the receipt and its upload, viewing and downloading receipts with an access check, the Entries page and the details page, editing and deleting, the storage quota, and the new entry form opened from the bottom bar.
- `navigation`: the bottom navigation bar on the main pages.

### Modified Capabilities

- `account`: "The account page" is opened from the bottom bar instead of a button in the flats list header, and has no back button.

## Impact

- **Tables:**
  - new `transactions`: id, property id, type (`income`, `expense`), category, amount in cents, date, note, created by, created and updated at
  - new `receipts`: id, transaction id (one per entry), storage key, content type, size, file name, uploaded by, created at

  Both start empty.
- **Code:**
  - `features/transactions/`:
    - the repository
    - the categories and the date and quota rules as pure functions with unit tests
    - server functions taking the receipt as form data, with owner checks and logging
    - the Entries page, the form, the details page and the full-screen receipt view
    - browser-side image resizing
  - A server route serves a receipt after the access check, with `fileResponse()`.
  - The storage quota helper in `src/server/files/`.
  - A bottom bar component in `src/components/`, used by the flats list and the account page.
  - The edit page's header gets the Entries button.
- **Screens:** the Design canvas rows "Kirjaukset ja kuitit" and "Alapalkki ja uusi kirjaus". They replace the older "Tulon / menon kirjaus" and "Menon tiedot ja kuitti" sketches:
  - no Payee or recurrence
  - the flat is chosen only when the form is opened from the bottom bar
- **Messages:** fi, sv and en for the screens, the categories and the new reason codes, with the translate skill and the term bank. The term bank's entry, income, expense and receipt terms are still `proposed`, and the categories may add terms.
- **Docs:**
  - CONCEPT.md §6: the Payee and Deductible question is answered, and the data model rows of `transactions` and `receipts` are updated
  - CLAUDE.md: the current state, and the bottom bar
