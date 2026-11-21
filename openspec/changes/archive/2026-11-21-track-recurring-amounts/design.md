## Context

Flats have addresses, owners and access, but no money yet. The rent and the housing company's charges come first, because the year summary (#34), the flat details page (#33) and the entries (#32) all need to know what was due in each month. CONCEPT.md §4.1 requires every amount to be time-bound, and §4.3 makes the financing charge's treatment a period of its own. The data model draft lists `recurring_amounts` and `financing_treatment` with a start date.

Ownership (`features/ownership/`) already solved a similar problem: periods with `validity()` columns, changes from a date, a correction on the current period's start, undoing the latest change, and owner-only writes checked through `sharing.roleOf()`. This change follows that pattern, simplified, because an amount is one number per period, not a split between people.

The Design canvas row "Vuokra ja vastikkeet" shows the screens. The older "Muuta vuokraa / vastiketta" sketch assumed the flat details page, which doesn't exist yet.

## Goals / Non-Goals

**Goals:**
- Rent, maintenance charge and financing charge as monthly periods that are never overwritten.
- The financing charge treatment as periods.
- One set of pure functions that answers "what was the amount in month M" and "how much has been capitalised", for this page now and the year summary later.
- Owners change; everyone with access sees.

**Non-Goals:**
- Rent per tenancy, prorated first and last months, the due day and payment status (#30, #25).
- Income and expense entries (#32). Nothing here writes entries.
- Using the amounts in the year summary (#34), beyond the functions it will call.
- Amounts in the new flat form.
- Undoing a treatment change. A same-date correction covers mistakes; undo can come later if needed.

## Decisions

### Amounts are computed from periods, not generated as entries

The year summary and the accumulated capitalised charges compute each month's amount from the periods when they are needed. No Cron Trigger writes monthly entries. This answers CONCEPT.md's open question on generating recurring entries.

- Correcting an amount afterwards, such as a charge decision entered late, fixes every past month at once. With generated entries, the job would have to find and rewrite them, and entries the user had edited would conflict.
- It follows "the year summary is computed, never stored".
- It needs no scheduled job, no idempotency key and no catch-up after downtime.
- The cost is computing about 12 months × 3 kinds per flat on each request. That is trivial.
- *Alternative: a monthly Cron Trigger that writes `transactions`.* It would make charges appear in the entries list (as the New flat sketch promised), but every correction would become a data migration. If #32 wants charges in the entries list, it can show the computed ones next to logged entries without storing them.

### Periods start on the first of a month

Every period starts on the first day of a month, and a month's amount is the one in effect on its first day.

- Housing company charges and rent are monthly, and changes take effect at the start of a month in practice.
- It makes the month the only unit, so there is no proration and no rounding of part-months.
- Proration belongs to a tenancy that starts or ends mid-month (#30), which will carry its own dates.
- *Alternative: any date, with day-based proration.* More general, but it puts rounding rules into every calculation for a case this change doesn't need.

The date field stays a date (`pp.kk.vvvv`), like the other forms. A date that isn't the first of a month is refused with `amount_date_not_month_start`, whose message says to choose the first day. A month picker would avoid the error, but there is no such component yet. Introducing one for a single field isn't worth it now.

### Two tables

```
recurring_amounts:    id(), property_id → properties (cascade), kind, amount cents(), validity()
financing_treatments: id(), property_id → properties (cascade), treatment, validity()
```

- `kind` is `text` with the enum `rent | maintenance_charge | financing_charge`, and `treatment` is `income_recognised | capitalised`. The enum is a TypeScript constant, like `OWNERSHIP_REASONS`.
- Each table gets an index on (`property_id`, `kind`, `valid_from`) or (`property_id`, `valid_from`).
- `valid_to` is stored, like ownership periods, so "the period containing a date" is a simple range check. It is kept consistent by the repository: when a new period starts, the previous one is closed the day before.
- *Alternative: one table for amounts and treatment.* The treatment isn't an amount, so a shared table would need nullable columns.
- *Alternative: only `valid_from`, as in the CONCEPT.md draft.* This is simpler to write, but it differs from ownership and from `validity()`. The draft becomes `validity()`, and CONCEPT.md's data model table is updated.

### Repository and writes

`recurringAmountRepository(db)` in `features/recurring-amounts/recurring-amount.repository.server.ts` is aggregate-oriented. One read returns everything for a flat: its amount periods per kind and its treatment periods.

Each write is one `atomically(db, [...])` call:
- **Setting an amount:**
  - on the latest period's start: update that period's amount
  - otherwise: close the latest period (`valid_to` = the day before the new start) and insert the new one
- **Undoing the latest change:** delete the latest period and reopen the previous one (`valid_to = null`).
- **Setting the treatment:** the same as setting an amount.

The rules (month start, not before the month the flat's ownership starts in, not before the latest start) are checked in the server layer against the periods just read. The repository doesn't check them. Like ownership, two owners saving the same amount at the same moment is not guarded against beyond that read; D1 has no interactive transactions, and the risk is negligible for a flat.

### Pure functions

The pure functions live in `features/recurring-amounts/periods.ts`. They have no database access and get Vitest unit tests:

- `validateAmountDate(from, { ownershipStart, latestStart })` returns `amount_date_not_month_start`, `amount_date_before_ownership`, `amount_date_too_early`, or nothing.
- `amountInMonth(periods, month)` and `monthlyAmounts(periods, year)` answer what was due in a month, or in each month of a year.
- `currentAndUpcoming(periods, today)` gives what the page shows.
- `yearEffect(currentCents, newCents, from)` returns the difference per month, the percentage and the year's total, for the form.
- `accumulatedCapitalised(financingPeriods, treatmentPeriods, today)` returns cents.

Months are `YYYY-MM` strings. Dates use the helpers in `src/lib/dates.ts` (`dayBefore`, `isoDateInFinland` for today).

### Server functions and access

`features/recurring-amounts/functions.ts`:
- `getRecurringAmounts({ propertyId })`: the periods, the current and upcoming amounts, the accumulated capitalised sum, the first ownership start and the user's role
- `setRecurringAmount({ propertyId, kind, amount, from })`
- `undoRecurringAmount({ propertyId, kind })`
- `setFinancingTreatment({ propertyId, treatment, from })`

Each write checks the session, then `sharing.roleOf()`: no access means `property_not_found`, a member gets `sharing_owner_only`. The first ownership start comes from the ownership repository.

Zod schemas in `schemas.ts` are shared by the forms and the server:
- the amount goes through `parseDecimal(text, 2)` and must be 0–9 999 999 cents (`amount_invalid`)
- the date goes through the existing date parsing; the month-start check runs in both the form and the server

Logging:
- `recurring_amount.set`: `propertyId`, `kind`, `corrected`
- `recurring_amount.undone`: `propertyId`, `kind`
- `financing_treatment.set`: `propertyId`, `corrected`

All are at `info` and carry ids only, never amounts.

### Routes and screens

- `/properties/$propertyId/amounts`: the Rent and charges page.
- `/properties/$propertyId/amounts/$kind` with `rent`, `maintenance-charge`, `financing-charge`: the set or change form. It shows the first-amount variant when nothing is set.
- `/properties/$propertyId/amounts/treatment`: the treatment form.
- The edit page's header gets an icon link "Vuokra ja vastikkeet" next to Ownership and sharing.
- Members who open a form route are sent back to the page. Server functions refuse their writes anyway.

The forms follow the existing patterns:
- TanStack Form, with `TextField` for the amount and the date, and `ChoiceField` for the treatment
- reason codes under the fields
- an `Alert` for `amount_nothing_to_undo`
- the undo confirmation as a dialog, like the ownership undo

The effect line names the target by kind:
- rent: rental income
- maintenance charge: deductible expenses
- financing charge: depends on the treatment in effect at the change's start
  - capitalised: the acquisition cost
  - income-recognised: deductible expenses
  - not set: a neutral "shows in the year summary from the start date"

### Messages

All copy is written in Finnish first, then translated with the translate skill. The terms rent, maintenance charge, financing charge, income-recognised ("recorded as revenue" in English), capitalised ("placed in reserve") and acquisition cost come from the term bank, where they are verified. New reason codes go in `src/lib/reasons.ts` with messages in all three languages.

## Risks / Trade-offs

- **Users enter mid-month dates**, e.g. the day a tenancy started. → The error explains that amounts change from the first of a month. Tenancy dates come with #30.
- **The first-of-month rule may not fit a future need**, such as a mid-month charge change. → The rule lives in `validateAmountDate` and the period functions. Relaxing it later means adding proration there, not changing the data.
- **No amounts for existing flats.** The page starts empty until an owner sets them. → The empty state says what to set. The year summary isn't built yet, so nothing depends on them.
- **Concurrent edits by two owners** could close a period twice. → This is negligible for a few owners per flat; the same trade-off as ownership.
- **Today in Finland:** "current" and "upcoming" depend on the date. → Use `isoDateInFinland(new Date())` on the server, like ownership.

## Migration Plan

- One migration adds both tables. It doesn't touch existing tables, so the previous deploy keeps working.
- No backfill.
- Rollback: the tables are unused by older code and can stay.

## Open Questions

- Should the new flat form ask for the rent and charges? Left out to keep the form short. It is worth revisiting with #30, where rent comes from the tenancy.
- When #30 adds tenancies, is the rent still a property-level amount, or does each tenancy carry its own? This change keeps it on the flat, as in CONCEPT.md's data model draft. #30 decides.
