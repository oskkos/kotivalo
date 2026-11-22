## Why

An owner has no single place to see how a flat is doing: today the flats list opens the edit form, and the tenancy, rent and charges, entries and ownership each sit behind an icon in its header (#33). Rental income is taxed in the year it is received (Income Tax Act §110, CONCEPT.md §4.2, #25), so the app can't assume rent was paid: payments have to be recorded, and the owner needs to see at a glance whether this month's rent has come in and which months are still missing. The year summary (#34) takes its gross rent from these payments.

## What Changes

- **The flat details page** becomes the flat's main page, opened from its card on the flats list. It shows:
  - the address, room count, floor area and the current owners with their shares (opening Ownership and sharing)
  - this month's rent and its status, with the button to record a payment
  - a warning when earlier months of this or last year are not fully paid, opening the rent payments page
  - the tenancy card (moved from the edit page), opening the Tenancy page
  - the rent and charges in effect today and the accumulated capitalised financing charge, opening Rent and charges
  - the latest three entries, opening the Entries page
  - a header with Edit and a menu: Edit flat, End tenancy and Add tenant (owners, when they apply), Rent and charges, Rent payments, Entries, Ownership and sharing
  - A vacant flat shows that it is vacant, since when, and Add tenant instead of the rent card.
- **The edit page keeps only the form.** Its header icons and the tenancy card move to the details page. Saving and closing return to the details page. The Tenancy, Rent and charges, Entries and Ownership and sharing pages return to it too.
- **Rent payments** (new): an owner records that a month's rent was paid: the amount (default: the month's expected rent still missing) and the payment date (default today, not in the future). A month can have several payments. A wrongly recorded payment is deleted and recorded again; payments are not edited. Members see the payments but can't change them.
- **A month's rent status** is computed, never stored, from the flat's rent periods, the tenancy's dates and due day, and the payments:
  - *Due* (before the due date), *Late N days* (after it, nothing paid), *Partly paid* (some paid, the missing amount shown), *Paid* (fully paid, with the last payment's date), and *No rent this month* (the tenancy starts later).
  - The expected rent of a month that a tenancy starts or ends in is the month's rent in proportion to the days the tenancy runs (16 of 30 days of 890 € = 474,67 €). The due date in a tenancy's first month is no earlier than its start.
- **The rent payments page** (new): one year at a time, the months a tenancy runs up to the current one, newest first, each with its status; the rent received in the year by payment date (so December's rent paid in January counts for January's year); and a warning for months not fully paid. Each month opens the month's payments, where owners add and delete them.
- **Payments stay inside their tenancy.** Correcting a tenancy's dates, ending it or removing one that hasn't started is refused when it would leave recorded payments outside the tenancy's months. The owner deletes those payments first.

Not in this change:
- the rent summary and status chips on the flats list (#96)
- the year summary's gross rent and its warning (#34), which will read the payments
- the deposit and the contract attachment on the details page (#93)
- marking several months paid at once (CONCEPT.md §4.2: a new issue if needed)

## Capabilities

### New Capabilities

- `rent-payments`: recording and deleting rent payments (owners only), the monthly rent status with the partial-month rule and the due date, the month's payments page, the rent payments page by year with the received total and the warning for months not fully paid.

### Modified Capabilities

- `properties`: new requirement "The flat details page"; "Listing flats": a card opens the details page; "Editing a flat": the tenancy card leaves the edit page, and saving returns to the details page.
- `tenancies`: "The tenancy page" opens from the tenancy card on the details page; "Correcting a tenancy", "Ending a tenancy" and "Removing a tenancy that hasn't started" refuse a change that would leave payments outside the tenancy.
- `recurring-amounts`: "The rent and charges page" opens from the details page.
- `transactions`: "The entries page" opens from the details page.
- `sharing`: "Listing who has access to a flat" opens the Ownership and sharing page from the details page.

## Impact

- **Tables:** new `rent_payments`: id, tenancy id (cascade with the tenancy), month (`YYYY-MM`, the rent's month), amount (cents, positive), paid on (ISO date), created by, created at. Indexed by tenancy and month. It starts empty. No existing table changes.
- **Code:**
  - `features/rent-payments/`: the repository, the status and expected-rent calculations as pure functions with unit tests, server functions with owner checks and logging (`rent_payment.recorded`, `rent_payment.deleted`), the record dialog, the month page and the rent payments page.
  - `features/properties/`: the details page and its loader, which reads the property, owners, tenancies, rent and charge periods, payments and latest entries in one server function.
  - `features/tenancies/`: the payment check in correcting, ending and removing; a new reason code.
  - Routes: `/properties/$propertyId` (details), `/properties/$propertyId/rent` (payments by year) and `/properties/$propertyId/rent/$tenancyId/$month` (a month's payments). The flats list card, the edit page header and every subpage's back link change.
- **Screens:** the Design canvas row "Asunnon tiedot": *Asunnon tiedot*, *Asunnon tiedot · vapaa*, *Kuukauden vuokran tilat*, *Merkitse vuokra maksetuksi*, *Kuukauden vuokra · maksut* and *Vuokranmaksut*. *Asunnot · vuokran tila* belongs to #96. It replaces the older *Asunnon tiedot* sketch (deposit and contract left for #93, rent not shown as an entry).
- **Messages:** fi, sv and en for the screens and the new reason codes, with the translate skill and the term bank. The bank has rent, tenancy, entry and acquisition cost. *Rent payment* (vuokranmaksu), *due date* (eräpäivä) and *partly paid* may become terms.
- **Docs:** CONCEPT.md: the `rent_payments` row of the data model and the partial-month rule in §4.2; CLAUDE.md: the current state.
