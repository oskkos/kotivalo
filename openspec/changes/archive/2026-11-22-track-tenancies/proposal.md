## Why

Landlords need to know who lives in each flat, on what contract, and when a tenancy ends (#30). Rent payments (#25, #33) are counted from a tenancy's due day, and the flat's status (let, notice given, vacant) is the first thing an owner looks for. The notice periods changed on 1.10.2026 (CONCEPT.md §4.2, #18), so the app can help with the end date, as long as it follows the rule that applies to each contract.

## What Changes

- **Tenancies per flat.** An owner adds a tenant to a flat: name, phone, email, the contract type (open-ended or fixed-term), the date the contract was made, the start date, the end date for a fixed-term contract, the rent and the due day.
  - A tenancy can start and end on any day. Tenancies of a flat never overlap, and none starts before the flat's first ownership period. Earlier tenancies can be added afterwards to record the history.
  - *Contract made* defaults to the start date and can't be in the future. It decides the landlord's notice period.
  - The rent field shows the flat's rent in effect on the start date (#31). A changed amount is saved as a new rent period, from the first day of the start month.
  - The due day is a day of the month, 1–31. In a shorter month it is the month's last day.
- **The Tenancy page.** Opened from a card at the top of the flat's edit page. It shows the current tenant with their status, call and email links, the contract details and earlier tenancies, newest first. A vacant flat shows a prompt to add a tenant.
- **Ending a tenancy.** An owner records who gave notice (the tenant, the landlord, both by agreement, or another legal ground such as rescission or an estate's notice), the date notice was received and the last rent day.
  - The last rent day defaults to the earliest date the law allows: the notice period runs from the last day of the month notice was given.
  - Tenant's notice: 1 month by law, but the contract may shorten it or count it from mid-month, so any date is allowed.
  - Landlord's notice: the legal minimum is a hard limit, because a term that shortens it is void (§52). Contracts made before 1.10.2026: 6 months once the tenancy has lasted 1 year, otherwise 3. Made on or after 1.10.2026: 4 months once it has lasted 2 years, otherwise 3.
  - By agreement or on another legal ground: any date on or after the notice date.
  - A fixed-term tenancy ends by itself on its end date and usually can't be ended by notice. Earlier it ends by agreement, with a court's permission, or on another legal ground (rescission, an estate's notice and the other cases of §51).
- **Statuses.** *Let* until notice is given, *Notice given* until the last rent day, then *Vacant*. A fixed-term tenancy shows when it ends. Ending can be cancelled during the notice period. A new tenant can be added during the notice period, starting after the previous tenancy ends.
- **Flats list.** Each card shows the tenancy status and the tenant's name. Paid and late come with rent payments (#33).
- **Correcting a tenancy.** Owners edit a tenancy's details directly, with the same checks. A tenancy is a period itself, so its fields have no history of their own.
- **Who can do what.** Everyone with access to the flat sees its tenancies and the tenant's contact details. Only owners add, edit, end and cancel.

Not in this change:
- the deposit and its return, and the contract attachment (#93, after go-live)
- rent payments, paid and late status, and partial-month rent (#33)
- the flat details page (#33), which will take over the tenancy card
- reminders before a fixed-term tenancy ends (#84)

## Capabilities

### New Capabilities

- `tenancies`: tenancies per flat, adding a tenant (with the rent in effect and the contract date), the Tenancy page, ending a tenancy with notice-period rules by contract date and who gave notice, fixed-term tenancies, statuses, cancelling an ending, correcting a tenancy, and who may see and change them.

### Modified Capabilities

- `properties`: "Listing flats" adds the tenancy status and the tenant's name to each card; "Editing a flat" adds the tenancy card at the top of the edit page.

## Impact

- **Tables:** new `tenancies`: id, property id, tenant name, phone, email, contract type (`open_ended`, `fixed_term`), contract made, `valid_from` (start) and `valid_to` (the last day: the fixed term's end or the last rent day once ended; none while an open-ended tenancy runs), the fixed term's end, due day, notice given by (`tenant`, `landlord`, `agreed`, `court`, `other`), notice date, created by, created and updated at. It starts empty. `recurring_amounts` is unchanged; the rent is set through its repository.
- **Code:**
  - `features/tenancies/`:
    - the repository
    - notice periods, statuses and the date rules as pure functions with unit tests
    - server functions with owner checks and logging
    - the Tenancy page, the add and edit form and the end form
  - The edit page gets the tenancy card, and the flats list cards get the status.
- **Screens:** the Design canvas row "Vuokrasuhteet". It replaces the older "Päätä vuokrasuhde" and "Uusi vuokralainen" sketches: no deposit or attachment, the contract date added, and the notice hint following the 2026 law.
- **Messages:** fi, sv and en for the screens and the new reason codes, with the translate skill and the term bank. The bank has tenancy, tenant, landlord, notice and rent. Fixed-term, open-ended, notice period, due day and vacant may become terms.
- **Docs:** CONCEPT.md: the `tenancies` row of the data model; CLAUDE.md: the current state.
