## Context

The rent is stored today as `recurring_amounts` rows of kind `rent`, one sequence per flat, every period starting on the first of a month. Everything that needs a rent reads that sequence: the Rent and charges page (`features/recurring-amounts/`), the new tenant form and `rentAsked` (`features/tenancies/rent.ts`), the Tenancy page's "Vuokra" row, the flat details page, and the rent payment calculations (`features/rent-payments/status.ts`: `expectedRent(rentPeriods, tenancy, month)` and the summaries built on it, fed by `recurringAmountRepository.rentsFor(propertyIds)` for the flats list). Rent payments are already per tenancy (`rent_payments.tenancy_id`).

Decisions already agreed (issue #102, design canvas row "Vuokra vuokrasuhteella (#102)"):
1. Rent periods belong to the tenancy.
2. The migration drops rent periods outside every tenancy.
3. The new tenant form always requires the rent.
4. Correcting a tenancy's start moves the first rent period's start with it.

Constraint: migrations run before the new code is live (CLAUDE.md), and the rule is to drop data only in a later deploy. Here the old rent rows are deleted in the same migration, by the owner's decision: the previous version doesn't fail without them, it only shows no rent for the minute or two before the new version is live (see Risks).

## Goals / Non-Goals

**Goals:**
- Each tenancy has its own rent periods; nothing reads a flat-level rent any more.
- Expected rent, statuses and summaries give each tenancy of a mid-month tenant change its own rent.
- Owners change and undo the rent on the Tenancy page with the same period rules as the charges.
- The Rent and charges page becomes the charges-only *Vastikkeet* page.

**Non-Goals:**
- Tenant fees (#100), the year summary (#34), deposits (#93).
- Changing how rent payments are recorded.

## Decisions

### 1. A new table `tenancy_rents`, not a column on `recurring_amounts`

```
tenancy_rents
  id          id()
  tenancy_id  text not null → tenancies.id, on delete cascade
  amount      cents() not null
  valid_from / valid_to   validity()
  index (tenancy_id, valid_from)
```

The migration fills it and then deletes the old rows; removing a tenancy removes its rent through the cascade.

Alternative: a nullable `tenancy_id` on `recurring_amounts`. Rejected: the split periods of two tenancies would overlap inside one flat's `rent` sequence, which breaks the previous version's reads during the deploy and every query that assumes one sequence per kind. A rent is also not a flat's amount any more, so it doesn't belong in a table whose rows are keyed by the flat.

The repository is `features/tenancies/tenancy.repository.server.ts`: the rent is part of the tenancy aggregate. It reads a flat's tenancies with their rent periods, and the flats list reads the rent periods of the tenancies it shows (replacing `recurringAmountRepository.rentsFor`). Writes that touch a tenancy and its rent (adding a tenancy with its first rent, correcting the start, removing) go through `atomically(db, [...])` with all statements built first, as today.

### 2. Period rules: the first period starts on the tenancy's start day

The first rent period starts on the tenancy's start day, later periods on the first of a month. A month's rent is the period containing `later(month's first day, tenancy start)`: a new pure function `rentInMonth(periods, tenancy, month)` in `features/tenancies/rent.ts`, used by `expectedRent`. Charges keep `valueInMonth` (first day of the month) unchanged.

Alternative: keep every period on the first of a month (the first one on the start month's first day). Rejected: the history would show a rent "from 1.11." for a tenancy starting 15.11., and two tenancies of a mid-month change would both have a period covering the 1st, which reads as an overlap even though each belongs to its own tenancy.

The latest period has no end (`valid_to` null) even after the tenancy ends; the tenancy's own dates bound it. Ending, cancelling an ending or correcting the end then never rewrites rent rows. The only rent write a tenancy change makes is moving the first period's start (decision 4).

Validation for a new rent (`validateRentDate`, pure, in `rent.ts`), in this order: `amount_date_not_month_start` (not the 1st and not the tenancy's start day), `rent_date_before_tenancy`, `rent_date_after_tenancy` (after `valid_to`), `amount_date_too_early` (before the latest period's start). A date equal to the latest period's start corrects it, as for the charges. The tenancy repository's rent writes follow the pattern of `amountStatements` and `undoLatestAmount` in the recurring-amounts repository (close the open row the day before and add the next, correct in place, delete the latest and reopen the previous; the expected latest start and the owner check inside every statement, so a concurrent write makes the batch a no-op that is reported as `amount_changed`). They are written for the new table rather than shared, because those statements are built on `recurring_amounts` columns.

### 3. The migration in SQL

Migration `0009` creates the table (drizzle-kit) and adds one hand-written `INSERT … SELECT` (as `0008` did): for each pair of a tenancy and a `rent` row of its flat that overlap (`r.valid_from <= coalesce(t.valid_to, '9999-12-31')` and `coalesce(r.valid_to, '9999-12-31') >= t.valid_from`), insert

- `valid_from = max(r.valid_from, t.valid_from)`
- `valid_to = NULL` when the row runs to or past the tenancy's last day (`r.valid_to IS NULL OR (t.valid_to IS NOT NULL AND r.valid_to >= t.valid_to)`), else `r.valid_to`
- a fresh id with `lower(hex(randomblob(16)))`

Rows outside every tenancy produce nothing. A last statement deletes `recurring_amounts` where `kind = 'rent'`, and `rent` leaves `RECURRING_AMOUNT_KINDS` (a TypeScript enum only; the column is plain text, so no table rebuild). ISO dates compare as text, so the SQL is portable apart from the id expression, which `0008` already uses. A Workers test applies the migrations up to `0008`, stores the scenarios' data, applies `0009` and checks the result (like `financing-charges-migration.server.test.ts`).

Between the migration and the new deploy the previous version finds no rent: its pages show the rent as not set, and a rent it writes then is not copied. CI deploys right after migrating, so the window is a minute or two.

### 4. Correcting the start, ending and removing

These checks live in `features/tenancies/` with the existing "Payments stay inside their tenancy" checks, and report their reason the same way:
- **Correcting the start:** with the rent periods ordered, if the new start is on or after the second period's start → `tenancy_start_after_rent_change`. Otherwise, when the first period starts on the old start, or the new start is after the first period's start, the first period's `valid_from` becomes the new start, in the same `atomically` batch as the tenancy update. A first period that starts later than the old start and stays after the new one (a migrated tenancy) is left alone.
- **Ending, and correcting the fixed term's end:** a last day before the latest period's start → `tenancy_has_rent_after_end`.
- **Removing** a tenancy that hasn't started deletes its rent by the foreign key cascade; the payment check still runs first.

### 5. The new tenant form

The rent field is always shown and required (the schema's `rent` loses `.optional()`). The suggestion is the latest rent period of the flat's tenancy that starts last before the entered start date, computed in the browser from what the form's loader already returns (the flat's tenancies with their rent periods), so it updates as the start date changes, as it does today. `rentAsked`, the `rent_changed` outcome and its `tenancy.rent_conflict` log line go away: the new tenancy's rent can't conflict with another write, because nothing else writes to it yet.

### 6. Routes and pages

- `/properties/$propertyId/tenancy/$tenancyId/rent`: the rent change form (canvas "Muuta vuokraa · vuokrasuhteelle"), with the current rent, the difference, the date and its hint. The undo confirmation is a dialog on the Tenancy page, like the cancel-ending dialog, not on the form.
- The Tenancy page gets the rent card (canvas "Vuokrasuhde · vuokra ja muutokset"), and the other tenancies' rows show their latest rent.
- The amounts page keeps `/properties/$propertyId/amounts` but drops the rent; `amounts/$kind` no longer accepts `rent` and shows not found for it. Its title becomes *Vastikkeet*.
- **Title clash:** the charges-by-year page (`/charges`) is titled *Vastikkeet* today (`charges_title`). It becomes *Vastikkeet kuukausittain*, the words of the row that opens it, so the two pages don't share a title. Swedish and English follow the term bank (`vederlag`, `charges`).
- The flat details page: the rent leaves the amounts card, which becomes *Vastikkeet*; the tenancy card shows the rent in effect today (or the first rent of a tenancy that starts later) and an upcoming change (canvas "Asunnon tiedot · vuokra vuokrasuhteella").

### 7. Server functions and logging

New server functions in `features/tenancies/functions.ts`: `setTenancyRent` and `undoTenancyRent`, each checking the session and the owner role (`sharing_owner_only`) and that the tenancy is the flat's (`tenancy_not_found`). They log `tenancy.rent_changed`, `tenancy.rent_corrected` and `tenancy.rent_change_undone` with the property and tenancy ids, never amounts. `setRecurringAmount` and `undoRecurringAmount` refuse the kind `rent` in their input schema.

## Risks / Trade-offs

- **[The previous version sees no rent during the deploy]** → A minute or two of *Vuokraa ei asetettu*, no errors; a rent set on the old page in that window is lost and is set again on the Tenancy page.
- **[No clean rollback]** → After the migration the previous version has no rent at all. A rollback is a fix forward, or a manual copy back from `tenancy_rents` if ever needed.
- **[A migrated tenancy may have no rent for its first months]** → Those months show *Vuokraa ei asetettu* as today, and the owner can date a rent change on the tenancy's start to fill them in.
- **[Many e2e tests set the rent on the Rent and charges page]** → The `setAmount('rent', …)` uses in `e2e/support/amounts.ts` callers move to `addTenant` with a rent, in the same commit that removes the rent from that page, so no commit leaves a broken test.
- **[Requirement renames in recurring-amounts]** → Test describes are renamed in the commit that changes the behaviour; the traceability check doesn't block removed or renamed main-spec scenarios while the change is active.

## Migration Plan

1. Deploy runs `0009`: creates `tenancy_rents`, copies the rents and deletes the old rent rows.
2. The new version goes live and reads only `tenancy_rents`.
3. Rollback: not clean (see Risks); fix forward.

## Open Questions

None. The four agreed decisions are above. The *Vastikkeet kuukausittain* title for the charges-by-year page (decision 6) is a consequence that the proposal review should confirm.
