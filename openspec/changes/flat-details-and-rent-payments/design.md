## Context

A flat now has owners and members (#28, #29), rent and charges as monthly periods (#31), entries (#32) and tenancies with a due day (#30, refined in #95). The flats list opens the edit form, whose header has icons for the entries, the rent and charges and the ownership, and a tenancy card above the form. Nothing records whether rent was paid. #25 decided that payments are recorded per month and that the year summary (#34) takes gross rent from them by payment date (CONCEPT.md §4.2).

The Design canvas row "Asunnon tiedot" has the screens, and the user approved the open points on 22.11.2026: a partial month by days, payments deleted and recorded again instead of edited, owners only, the details page as the flat's main page, and the flats list summary and chips as a separate issue (#96).

## Goals / Non-Goals

**Goals:**
- One page per flat that answers "is everything fine with this flat this month"
- Rent payments recorded with one tap in the common case, several per month when needed
- Monthly statuses and expected rent as pure functions that #34 and #96 reuse
- Payments that never end up outside their tenancy

**Non-Goals:**
- The flats list summary and chips (#96); the year summary (#34)
- Deposits and the contract attachment (#93)
- Bank connections or imports; marking several months at once
- Reminders about late rent

## Decisions

### `rent_payments` belongs to a tenancy and a month

Columns: `id()`, `tenancy_id` (references `tenancies`, `onDelete: 'cascade'`), `month` (text `YYYY-MM`, the rent's month), `amount` (`cents()`, positive), `paid_on` (`isoDate()`), `created_by` (references `user`), `created_at` (`instant()`), and an index on `(tenancy_id, month)`. No `updated_at`: payments are never edited.

- Tied to the tenancy, not the flat, because the status depends on the tenancy's dates and due day, and two tenancies can share a month.
- The month is its own column, separate from `paid_on`: the status reads payments by month, and the year summary by `paid_on` (rent paid in advance or late falls in another month or year).
- `month` is a 7-character ISO month. Comparing it as text orders it correctly in SQLite and PostgreSQL alike, so the "outside the tenancy" check needs no date functions.
- Alternative: rent as entries in `transactions` (category rent). Rejected in #25/#32: the expected amount comes from the rent periods, an entry has no month or tenancy, and the Entries page says rent is not logged.
- Alternative: a stored status per month. Rejected: everything else here is computed from periods, and a stored status would go stale when a rent period or a tenancy's dates change.

`features/rent-payments/rent-payment.repository.server.ts`: `forProperty(propertyId)` (all payments of the flat's tenancies, joined for the recorder's display name), `record(...)` and `remove(...)`. Both writes are single conditional statements: `INSERT … SELECT … WHERE` the user is an owner of the flat and the tenancy belongs to it, and `DELETE … WHERE` the same. Reads of all payments of a flat are small (12 a year per flat), so the pages filter in memory instead of querying by year.

### Expected rent and status are pure functions

`features/rent-payments/status.ts`, with unit tests:

- `expectedRent(rentPeriods, tenancy, month)`: `valueInMonth()` of the rent periods (#31), scaled by the tenancy's days in the month with integer arithmetic, `floor((2 × rent × days + daysInMonth) / (2 × daysInMonth))`, so halves round up without floating point. `undefined` when no rent is in effect.
- `rentDueDate(tenancy, month)`: `dueDate()` from `tenancies/status.ts`, raised to the start date in the first month.
- `monthStatus({ expected, payments, dueDate, today })` → `paid | partly_paid | late | due | rent_not_set`, with the latest payment date, the missing cents or the days late.
- `tenancyMonths(tenancy, from, to)`: the months a tenancy runs in, clipped to a range.
- `monthsNotFullyPaid(tenancies, rentPeriods, payments, today)`: the current and previous year's months up to today that are late or partly paid.

Day counts need `daysBetween(a, b)` and `daysInMonth(month)` in `src/lib/dates.ts`, next to `lastDayOfMonth` and `addMonths`, on ISO strings as before.

The browser computes the statuses from raw data and the server's `today`, as the Tenancy page does with `tenancyStatus()`: the server functions return the tenancies, the rent periods, the payments and `today`, and the components call the pure functions. That keeps one code path for the details page, the month page, the rent payments page and later #96.

### The details page reads through one server function

`getFlatDetails(propertyId)` in `features/properties/` returns the property with its owners, the user's role, the tenancies, the recurring amounts and treatment periods, the payments, the three latest entries and `today`, after one access check. After its one access check it reads through the other features' repositories (ownership, tenancies, recurring amounts, rent payments, and a new `transactionRepository.latest()`), not their `*.server.ts` loaders, because each loader would repeat the access check.

- Alternative: the route loader calling five existing server functions in parallel, as the edit page does today. Rejected: five HTTP round trips on each client-side navigation, five session checks, and five places to handle "not found".

The accumulated capitalised total reuses `accumulatedCapitalised()` from `recurring-amounts/periods.ts`.

### Routes and navigation

- `/properties/$propertyId` (new, `index.tsx`): the details page. The flats list card links here.
- `/properties/$propertyId/edit`: only the form. Its header icons and the tenancy card are removed; saving and closing navigate to the details page.
- `/properties/$propertyId/rent`: the rent payments page, `?year=` as a search param like the Entries page.
- `/properties/$propertyId/rent/$tenancyId/$month`: a month's payments. The month is validated as `YYYY-MM` in the route's params.
- The record form is a dialog (`RecordPaymentDialog`) opened from the details page and the month page, not a route: it is two fields over the page it was opened from (canvas *Merkitse vuokra maksetuksi*).
- The back links of the Tenancy, Rent and charges, Entries and Ownership and sharing pages point to the details page instead of the edit page.

### Payments stay inside their tenancy

`tenancies.server.ts` checks payments before correcting, ending and removing:

- Correcting and ending compute the new month range `[monthOf(valid_from), monthOf(valid_to) or ∞]` and refuse with `tenancy_has_payments_outside` when a payment's month falls outside it.
- Removing a tenancy that hasn't started refuses with `tenancy_has_payments` when it has any payment.
- The tenancy's `UPDATE`/`DELETE` carries the same condition as `NOT EXISTS (SELECT 1 FROM rent_payments WHERE tenancy_id = ? AND (month < ? OR month > ?))`, so a payment recorded at the same moment can't slip outside. The payment's insert in turn requires the month to be inside the tenancy's range as stored.
- Cancelling an ending only widens the range, so it needs no check.

The cascade on `tenancy_id` is for completeness (deleting a flat isn't built yet); the refusal is what protects recorded income.

### Validation and reasons

`features/rent-payments/schemas.ts`: the amount through `parseDecimal(text, 2)` (comma or point) to cents, 1–10 000 000; `paid_on` an ISO date; `month` matching `YYYY-MM`. The server checks `paid_on <= today`, the month inside the tenancy and the owner role. New reason codes: `rent_payment_amount_invalid`, `rent_payment_date_in_future` (field), `rent_payment_month_outside_tenancy`, `tenancy_has_payments_outside`, `tenancy_has_payments` (alerts), with messages in fi, sv and en.

### Logging

`rent_payment.recorded` and `rent_payment.deleted` at `info` with the payment, tenancy and property ids; no amounts or names. Refusals by rule are expected outcomes and not logged above `info`, as with the tenancies.

## Risks / Trade-offs

- [Statuses computed in the browser could differ from a later server-side year summary] → the same pure functions are used by both; #34 imports them.
- [A rent period changed after payments were recorded changes past statuses (e.g. *Paid* becomes *Partly paid*)] → intended: the status reflects the data as it is now, and the payments themselves don't change. The year summary uses payments, not statuses.
- [Reading all payments of a flat grows over the years] → about 12 rows a year per flat; years of history stay well under a few hundred rows. A year filter can be added in the repository without changing callers.
- [Moving the header icons breaks muscle memory and existing e2e tests] → the icons move in the same commit that makes the card open the details page, and the tests are updated there.
- [The days-based partial month may differ from what the contract says] → the expected amount only drives the status; the owner records the amount actually paid, and taxes use payments.

## Migration Plan

- `migrations/0007_rent_payments.sql` adds the table and index. It only adds, so the previous version keeps working while the migration runs before the deploy.
- No data to backfill: past months show *Late* or count as not fully paid until the owner records them, and the warning covers only this and last year.
- Rollback: deploy the previous version; the unused table stays.

## Open Questions

- Whether a co-owner who left (former owner) sees payments of their ownership period: today read access follows `property_access`, so it follows whatever that gives. No change here.
- The Swedish words for *rent payment*, *due date* and *partly paid* need the term bank review (translate skill and term-critic).
