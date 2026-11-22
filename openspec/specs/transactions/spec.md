# transactions Specification

## Purpose
A flat's logged income and expenses with an optional receipt (photo or PDF): the category that decides the form 7H row and deductibility, the Entries page opened from the flat details page, details with the receipt full screen, editing and deleting (owners only), receipts served after an access check, a storage quota per user, and the new entry form opened from the bottom bar. Rent and the monthly charges are periods (recurring-amounts), not entries; the year summary (#34) comes later.
## Requirements
### Requirement: Logging an entry
An owner of a flat SHALL be able to log an entry for it: an income or an expense, with an amount, a category of that type, a date and an optional note. The amount SHALL be from 0,01 to 99 999,99 € with at most two decimals, and SHALL be stored as positive cents; the type tells income from expense. The date SHALL NOT be in the future and SHALL NOT be before the start of the flat's first ownership period. The note SHALL be at most 200 characters (`transaction_note_too_long`). The entry SHALL record the user who logged it. Opened from a flat's Entries page, the form SHALL be for that flat and SHALL NOT ask for it. A member SHALL NOT be able to log entries.

#### Scenario: Logging an annual repair
- **WHEN** Annika, owner of `Kuusikuja 3 B 12`, opens New entry on its Entries page and saves an expense of `145,50` in Annual repairs on `12.11.2026` with the note `Putkimies, keittiön hana`
- **THEN** the flat has an expense of 14550 cents in `annual_repair` on `2026-11-12`, logged by Annika, and the Entries page lists it under November 2026

#### Scenario: An invalid amount is refused
- **WHEN** an owner enters `0`, `-5`, `100000` or `12,345` as the amount
- **THEN** it is refused with the reason `transaction_amount_invalid`, and nothing is stored

#### Scenario: A future date is refused
- **WHEN** today is `2026-11-21` and an owner logs an entry on `2026-11-22`
- **THEN** it is refused with the reason `transaction_date_in_future`, and nothing is stored

#### Scenario: A date before the ownership is refused
- **WHEN** the flat's first ownership period starts on `2025-03-01` and an owner logs an entry on `2025-02-28`
- **THEN** it is refused with the reason `transaction_date_before_ownership`, and nothing is stored

#### Scenario: A member can't log an entry
- **WHEN** Jussi, a member of the flat, sends a new entry for it to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing is stored

### Requirement: Entry categories
Each entry SHALL have one category from its type's list (design.md, "Categories"). Each category SHALL tell the form 7H row the entry goes to and whether it is taxable income or a deductible expense, and the form SHALL show this with a short hint for the chosen category. An improvement (perusparannus) SHALL be an expense category whose amount fills no row as such, because it is not deducted all at once: for a flat in a housing company, a tenth a year for 10 years from the year paid, or when the flat is sold. The form and the details SHALL say that it is not deducted all at once. Rent and the monthly maintenance and financing charges SHALL NOT be categories, because they are computed from their periods. A category of the other type SHALL be refused with the reason `transaction_category_invalid`.

#### Scenario: The chosen category shows its tax hint
- **WHEN** an owner chooses Expense and the category Annual repairs in the new entry form
- **THEN** the form shows that it is a deductible expense, with the hint for annual repairs

#### Scenario: An improvement is not deducted all at once
- **WHEN** an owner chooses Expense and the category Improvement in the new entry form
- **THEN** the form shows that it is not deducted all at once, with a hint that a flat in a housing company deducts a tenth a year for 10 years or deducts it when the flat is sold

#### Scenario: Rent is not a category
- **WHEN** an owner chooses Income in the new entry form
- **THEN** no category is rent, and the hint for other income says that rent is computed from the rent amount

#### Scenario: A category of the other type is refused
- **WHEN** an owner sends an income with the category `annual_repair` to the server
- **THEN** it is refused with the reason `transaction_category_invalid`, and nothing is stored

### Requirement: The entries page
Everyone with access to a flat SHALL be able to open its Entries page from the latest entries on the flat's details page ("The flat details page") and from its menu. The page SHALL show one year at a time, the current year first, with a choice of the current year and the years that have entries. For the chosen year it SHALL show the total income and the total expenses of its entries, and the entries grouped by month, newest first, each with its category, date, note, signed amount and whether it has a receipt. The page SHALL say that rent and the monthly charges are computed from their amounts and are not logged. Owners SHALL see a New entry button; members SHALL NOT.

#### Scenario: Opening the entries page from the details page
- **WHEN** Annika, owner of `Kuusikuja 3 B 12`, opens its details page and chooses "Kaikki" next to its latest entries
- **THEN** the Entries page of `Kuusikuja 3 B 12` opens

#### Scenario: Entries are grouped by month, newest first
- **WHEN** today is `2026-11-21` and the flat has an expense of 14550 cents on `2026-11-12`, an income of 4000 cents on `2026-11-03` and an expense of 18600 cents on `2026-10-28`
- **THEN** the page shows 2026, income `+40,00 €` and expenses `−331,50 €`, with November 2026 listing the expense of 12.11. before the income of 3.11., and October 2026 listing the expense of 28.10.

#### Scenario: Choosing an earlier year
- **WHEN** today is `2026-11-21`, the flat has an expense of 21000 cents on `2025-12-09`, and the user chooses 2025
- **THEN** the page shows expenses `−210,00 €` and lists the expense under December 2025

#### Scenario: A flat without entries
- **WHEN** an owner opens the Entries page of a flat with no entries
- **THEN** the page says there are no entries for the current year and shows the New entry button

#### Scenario: A member sees the entries but can't add them
- **WHEN** Jussi, a member of the flat, opens its Entries page
- **THEN** he sees the entries and no New entry button

### Requirement: Entry details
Selecting an entry on the Entries page SHALL open its details: the signed amount, the note, the category, whether it is taxable income or a deductible expense, the flat, the date, the year and the form 7H row it goes to (none for an improvement, which says it is not deducted all at once), who logged it and when ("You" for oneself), and its receipt or that it has none. Owners SHALL see an Edit button; members SHALL NOT.

#### Scenario: The details of an expense
- **WHEN** Annika opens the expense of 14550 cents in `annual_repair` on `2026-11-12` that she logged
- **THEN** the details show `−145,50 €`, Annual repairs, deductible, `12.11.2026`, the year summary row of 2026 for annual repairs, and that she logged it

#### Scenario: An entry logged by a co-owner
- **WHEN** Jussi logged an entry for `Kuusikuja 3 B 12` and Annika, its other owner, opens it
- **THEN** the details show that Jussi logged it

### Requirement: Attaching a receipt
An entry SHALL be able to have one receipt: a JPEG, PNG or WebP image or a PDF, of at most 10 MB. The form SHALL open the device's camera or files from one button. Images SHALL be resized in the browser before upload so that their long edge is at most 2000 px; PDFs SHALL be sent as they are. The receipt SHALL be sent with the entry when it is saved, and the server SHALL check its type from the file's first bytes and store it under a generated key. A file of another type SHALL be refused with the reason `receipt_unsupported_type`, and a file over 10 MB with `receipt_too_large`; nothing SHALL be stored then.

#### Scenario: Logging an expense with a receipt photo
- **WHEN** an owner attaches a 4000 × 3000 JPEG photo to a new expense and saves
- **THEN** the entry has a receipt that is an image with a long edge of at most 2000 px, and the Entries page shows the receipt icon on the entry

#### Scenario: A PDF receipt is stored as it is
- **WHEN** an owner attaches a 300 kB PDF to a new expense and saves
- **THEN** the entry's receipt is that PDF, byte for byte

#### Scenario: A file that isn't an image or a PDF is refused
- **WHEN** an owner sends an entry with a text file renamed `kuitti.jpg` as its receipt to the server
- **THEN** it is refused with the reason `receipt_unsupported_type`, and neither the entry nor a file is stored

#### Scenario: A file over 10 MB is refused
- **WHEN** an owner sends an entry with an 11 MB PDF as its receipt to the server
- **THEN** it is refused with the reason `receipt_too_large`, and neither the entry nor a file is stored

### Requirement: Viewing and downloading a receipt
Everyone with access to a flat SHALL be able to open and download the receipts of its entries. The receipt SHALL be served by the app only after checking that the user has access to the entry's flat, inline for viewing and as an attachment for downloading, under the file name it was uploaded with. An image receipt SHALL open full screen from the details page; a PDF SHALL open in the browser's own viewer. A user without access, or a visitor who is not signed in, SHALL get a not-found response.

#### Scenario: A member downloads a receipt
- **WHEN** Jussi, a member of the flat, selects Download on an entry's receipt `kuitti_hana.jpg`
- **THEN** he gets the file as an attachment named `kuitti_hana.jpg`

#### Scenario: A user without access can't open a receipt
- **WHEN** a signed-in user with no access to the flat requests the address of one of its receipts
- **THEN** the response is 404 and contains no file

#### Scenario: Opening a receipt full screen
- **WHEN** a user selects the receipt image on an entry's details page
- **THEN** the receipt opens full screen, with Close and Download

### Requirement: Editing an entry
An owner SHALL be able to edit any entry of the flat, including those logged by the other owners, with the same rules as logging one, and to remove its receipt or replace it with another. A removed or replaced receipt's file SHALL be deleted from storage. Editing an entry that no longer exists SHALL be refused with the reason `transaction_not_found`. A member SHALL NOT be able to edit.

#### Scenario: Correcting the amount
- **WHEN** Annika changes the amount of an expense from `145,50` to `154,50` and saves
- **THEN** the entry's amount is 15450 cents, and the rest of it is unchanged

#### Scenario: A co-owner edits an entry
- **WHEN** Jussi logged an entry for `Kuusikuja 3 B 12` and Annika, its other owner, changes its note
- **THEN** the note is changed, and the entry still shows that Jussi logged it

#### Scenario: Replacing the receipt deletes the old file
- **WHEN** an owner replaces an entry's receipt with another image and saves
- **THEN** the entry has the new receipt, and the old file is no longer in storage

#### Scenario: Removing the receipt
- **WHEN** an owner removes an entry's receipt and saves
- **THEN** the entry has no receipt, and the file is no longer in storage

#### Scenario: Editing a deleted entry is refused
- **WHEN** another owner has deleted an entry, and Annika saves her changes to it
- **THEN** it is refused with the reason `transaction_not_found`

#### Scenario: A member can't edit an entry
- **WHEN** Jussi, a member of the flat, sends a change to one of its entries to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Deleting an entry
An owner SHALL be able to delete an entry of the flat from its edit form, after a confirmation that names the entry and says that it and its receipt are deleted permanently. Deleting SHALL remove the entry and its receipt's file. A member SHALL NOT be able to delete.

#### Scenario: Deleting an entry with its receipt
- **WHEN** an owner deletes an expense that has a receipt and confirms
- **THEN** the entry is no longer on the Entries page, and its receipt file is no longer in storage

#### Scenario: Cancelling keeps the entry
- **WHEN** an owner selects Delete entry and then Cancel in the confirmation
- **THEN** the entry is unchanged

#### Scenario: A member can't delete an entry
- **WHEN** Jussi, a member of the flat, sends deleting one of its entries to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Storage quota for receipts
Each user SHALL be able to store up to 500 MB and up to 1,000 files of receipts in total, counted from the files they uploaded. The quota SHALL be checked before a file is stored, from the sizes recorded in the database. A receipt that would exceed it SHALL be refused with the reason `storage_quota_full`, nothing SHALL be stored, and the user SHALL be able to save the entry without the receipt.

**No Playwright test:** reaching the quota needs 500 MB or 1,000 stored files; Workers tests cover the check with recorded sizes, and a component test shows the message.

#### Scenario: A receipt over the file count is refused
- **WHEN** a user who has uploaded 1,000 receipts sends a new entry with a receipt
- **THEN** it is refused with the reason `storage_quota_full`, and neither the entry nor a file is stored

#### Scenario: A receipt over the size is refused
- **WHEN** a user whose receipts take 524 000 000 bytes sends a new entry with a 500 000-byte receipt
- **THEN** it is refused with the reason `storage_quota_full`

#### Scenario: Another owner's files don't count
- **WHEN** Jussi has uploaded 1,000 receipts for `Kuusikuja 3 B 12` and Annika, who has uploaded none, attaches a receipt to an entry of the same flat
- **THEN** the receipt is stored

### Requirement: New entry from the bottom bar
The new entry form opened from the bottom bar (`/transactions/new`) SHALL ask for the flat, among the flats the user owns. With one such flat it SHALL be chosen already; with several, the flat last used for an entry on this device, or else the first by street address. Flats the user is only a member of SHALL NOT be listed. A user who owns no flat SHALL see an explanation instead of the form: with no flats at all, an "Add flat" action; with only shared flats, that entries are added by the owners.

#### Scenario: The only owned flat is chosen already
- **WHEN** Annika owns only `Koivupolku 7 A 4` and opens New entry from the bottom bar
- **THEN** the form shows `Koivupolku 7 A 4` as the flat

#### Scenario: Choosing among owned flats
- **WHEN** Annika owns `Koivupolku 7 A 4` and `Kuusikuja 3 B 12` and is a member of `Hallilantie 12 B 8`, and she opens the flat choice in the form
- **THEN** it lists `Koivupolku 7 A 4` and `Kuusikuja 3 B 12` and not `Hallilantie 12 B 8`

#### Scenario: A user without flats is asked to add one
- **WHEN** a user with no flats opens New entry from the bottom bar and selects "Add flat"
- **THEN** the new flat form opens

#### Scenario: A member of shared flats only can't add entries
- **WHEN** Jussi is only a member of `Kuusikuja 3 B 12` and opens New entry from the bottom bar
- **THEN** the page says that entries are added by the flat's owners, and shows no form

