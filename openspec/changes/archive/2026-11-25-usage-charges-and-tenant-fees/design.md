## Context

A flat's monthly charges today are the maintenance charge and the named financing charges (`recurring_amounts`, `financing_charges`, `features/recurring-amounts/`), shown on the *Vastikkeet* pages. Each tenancy has its own rent as periods (`tenancy_rents`, `features/tenancies/rent.ts`), and the rent payment calculations (`features/rent-payments/status.ts`: `expectedRent(rentPeriods, tenancy, month)` and everything built on it, fed by `RentsByTenancy`) compute a month's expected rent, status and the flats list summary. Water and similar costs are logged as entries (`water_charge`, `tenant_water_charge`, `other_expense`, `other_income`); nothing knows the monthly amounts or the number of persons.

Decisions agreed on the design canvas (row "Käyttömaksut ja vuokralaisen maksut (#100)"):
1. A vacant flat counts one occupant for per-occupant usage charges, as a fixed rule.
2. Occupants are periods of the tenancy, changed from the first of a month, not corrected in place.
3. Tenant fees are not linked to the usage charges in any way, and are not shown with the charges; the breakdown is on the rent pages.
4. Existing entries are not moved or deleted; adding a water charge or fee warns about them.
5. The financing charges keep their own model.
6. The new tenant form asks for the occupants (default 1) and offers the previous tenancy's fees unchecked.
7. Usage charges are their own section, page and by-month page, apart from the *Vastikkeet* pages.
8. Kinds: water, parking, sauna and other, other with a required description.

## Goals / Non-Goals

**Goals:**
- Usage charges and tenant fees as validity periods with the same rules as the charges and the rent, computed per month, never stored per month.
- The expected rent, the statuses, the payment form's default and the flats list summary include the tenant fees.
- Occupants per tenancy drive per-occupant amounts on both sides.
- Nothing on the *Vastikkeet* pages changes.

**Non-Goals:**
- The year summary (#34), which reads these later; metered water readings and balancing invoices (stay entries); a parking space rented directly from the housing company.
- Splitting a rent payment into rent and fees: a payment stays one amount.
- Changing a usage charge's or a fee's kind or basis after adding it (end it and add another).

## Decisions

### 1. Five new tables, not new kinds in `recurring_amounts`

```
usage_charges
  id           id()
  property_id  → properties.id, on delete cascade
  kind         text enum CHARGE_KINDS ('water', 'parking', 'sauna', 'other')
  basis        text enum CHARGE_BASES ('fixed', 'per_occupant')
  description  text, null unless kind = 'other'
  index (property_id)

usage_charge_amounts
  id               id()
  usage_charge_id  → usage_charges.id, on delete cascade
  amount           cents()        per month, or per occupant per month
  valid_from / valid_to  validity()
  index (usage_charge_id, valid_from)

tenancy_occupants
  id          id()
  tenancy_id  → tenancies.id, on delete cascade
  persons     integer 1–20
  valid_from / valid_to  validity()
  index (tenancy_id, valid_from)

tenant_fees
  id           id()
  tenancy_id   → tenancies.id, on delete cascade
  kind, basis, description   as in usage_charges
  index (tenancy_id)

tenant_fee_amounts
  id             id()
  tenant_fee_id  → tenant_fees.id, on delete cascade
  amount         cents()
  valid_from / valid_to  validity()
  index (tenant_fee_id, valid_from)
```

`CHARGE_KINDS` and `CHARGE_BASES` are shared by both sides in `schema.ts`. Removing a tenancy that hasn't started removes its occupants and fees through the cascades; removing a flat removes everything.

Alternative: a kind `usage_charge` in `recurring_amounts` with a `usage_charge_id`, as the financing charges do. Rejected: "Charges of a month" and the *Vastikkeet* pages iterate that table's kinds, and the owner wants the usage charges kept apart from them; the basis would also be a column only some kinds use. A tenant fee is a tenancy's, with the tenancy's date rules (the first period may start on the tenancy's start day), like `tenancy_rents`.

Alternative: the basis on each amount period, so it could change. Rejected: rare, and every month's calculation would need to handle a basis change in the middle of a charge's history; ending one charge and adding another says the same.

### 2. Migration `0010`

drizzle-kit creates the tables; one hand-written statement appended to the generated file gives every existing tenancy one occupant (as `0008` and `0009` did):

```sql
INSERT INTO tenancy_occupants (id, tenancy_id, persons, valid_from, valid_to)
SELECT lower(hex(randomblob(16))), id, 1, valid_from, NULL FROM tenancies;
```

It only adds tables and rows, so the previous version keeps working during the deploy. A Workers test runs the migration's statements on tenancies stored before it (the pattern of `tenancy-rents-migration.server.test.ts`).

### 3. Period rules reuse the existing pure functions

- Usage charge amounts use the charges' rules unchanged: `validateAmountDate` (first of a month, not before the first ownership month, not before the latest start), `valueInMonth`, `currentAndUpcoming` and `isEnded` from `recurring-amounts/periods.ts`.
- Occupants and fee amounts use the tenancy rent's date rules through a new `validateTenancyPeriodDate(from, { tenancy, latestStart })` in `tenancies/rent.ts`, which shares its first three checks with `validateRentDate` (`amount_date_not_month_start`, `rent_date_before_tenancy`, `rent_date_after_tenancy`) and then refuses a date before the latest start (`amount_date_too_early`). Unlike the rent, a date before the first period's start is never a fill (the first fee period may start mid-tenancy on purpose), and only the latest period is corrected in place. A month's value is the period containing the later of the month's first day and the tenancy's start (`rentInMonth`, generalised to `valueInTenancyMonth` for any number type).
- `firstRentMove` and `rentAfterEnd` are generalised to `firstPeriodMove(periods, oldStart, newStart)` and `periodAfterEnd(periods, lastDay)`, and the tenancy writes apply them to the rent, the occupants and each fee: the rent first with its existing reasons, then the occupants and the fees with `tenancy_start_after_change` and `tenancy_has_changes_after_end`. All moves go into the same `atomically` batch as the tenancy's correction.

### 4. Monthly amounts are pure functions

- `features/tenancies/fees.ts`: `occupantsInMonth(occupants, tenancy, month)` and `feeInMonth(fee, amounts, occupants, tenancy, month)` (the amount, times the occupants for `per_occupant`).
- `features/rent-payments/status.ts`: `expectedRent` takes the tenancy's rent, occupants and fees (`TenancyAmounts`, replacing `RentsByTenancy`'s value type) and returns `{ total, parts } | null`, where `parts` is the rent and each fee in the month, each prorated by days and rounded with the existing rounding, and `total` their sum; `null` when the rent is unknown. `monthStatus`, `rentMonth`, `rentMonths`, `monthsNotFullyPaid` and `rentThisMonth` read `total`, so their behaviour for tenancies without fees is unchanged and their existing tests keep passing.
- `features/usage-charges/months.ts`: `usageChargesOfMonth(charges, tenancies, month)` (per-occupant amounts × the occupants of the tenancy running on the month's first day, or 1), `usageChargesOfYear(…, year, today)` and `usageChargeYears(…, today)`, mirroring `charges.ts` without the treatment and the estimate.
- `features/usage-charges/rows.ts`: the form 7H row per kind (`water` → `maintenance_and_water`, the others → `other_costs`), typed with `SummaryRow` from `transactions/categories.ts`.

### 5. Repositories and writes

- `features/usage-charges/usage-charge.repository.server.ts`: the flat's usage charges with their amount periods; `add` (charge and first period in one batch), `setAmount`, `undoLatest` (removing the charge with its only period). It follows the statement pattern of `recurring-amount.repository.server.ts`: the expected latest start and the owner check inside every statement, so a concurrent write makes the batch a no-op reported as `amount_changed`.
- `features/tenancies/tenancy.repository.server.ts` (the tenancy aggregate): `occupantsFor(tenancyIds)` and `feesFor(tenancyIds)` beside `rentsFor`, and the occupants and fee writes in the same pattern. Adding a tenancy stores its first occupants period and its copied fees in the tenancy's batch.
- The three new period tables share one small statement builder for "close the open period the day before and add the next / correct the latest / delete the latest and reopen the previous" in `src/server/db/periods.ts`, parameterised by the table and its scope column. The existing builders for `recurring_amounts` and `tenancy_rents` stay as they are; moving them onto it is a later clean-up, not part of this change.
- `features/transactions/transaction.repository.server.ts` gets `categoryTotalSince(propertyId, category, from)` → `{ count, total }` for the water entries warning, read by a server function the forms call when the kind or the date changes.

### 6. Pages and routes

- `/properties/$propertyId/usage-charges` (*Käyttömaksut*), `…/usage-charges/new`, `…/usage-charges/$usageChargeId` (new amount or *Päättyy*, history, undo) and `…/usage-charges/months` (*Käyttömaksut kuukausittain*), in `features/usage-charges/`. The add and change forms follow `FinancingChargeForm.tsx` and `AmountForm.tsx`; the kinds are a `ChoiceField`, the description a `TextField` shown for *other*.
- The Tenancy page gets the occupants row with a change dialog (no route, like the undo dialogs) and the fees card; `/properties/$propertyId/tenancy/$tenancyId/fees/new` and `/fees/$feeId` hold the fee forms.
- `TenancyForm.tsx` gets the occupants field and the previous tenancy's fees as checkboxes, with the month's total.
- `RentMonthPage.tsx` shows the breakdown from `parts`; the payment dialog's hint says that the rent and the fees are one payment.
- `FlatDetailsPage.tsx` gets the *Käyttömaksut* section below *Vastikkeet*, read in `getFlatDetails` with the rest; the tenancy card shows "+ maksut" with the fees' sum this month.

### 7. Words and codes

Code names `usageCharge`, `tenantFee`, `occupants`; UI words *käyttömaksu*, *maksu vuokran lisäksi*, *asukas* / *asukasmäärä*, added to the term bank with the translate skill (Swedish and English start as `proposed` until a source is found) and reviewed by the term-critic. Kind labels reuse *vesimaksu* (already a term), *autopaikka*, *sauna*, *muu*.

New reason codes: `description_required`, `occupants_invalid`, `occupants_nothing_to_undo`, `usage_charge_not_found`, `tenant_fee_not_found`, `tenancy_has_changes_after_end`, `tenancy_start_after_change`. Reused: `amount_invalid`, `amount_date_not_month_start`, `amount_date_before_ownership`, `amount_date_too_early`, `amount_nothing_to_undo`, `amount_changed`, `rent_date_before_tenancy`, `rent_date_after_tenancy` (their messages don't name the rent), `sharing_owner_only`, `tenancy_not_found`.

Log events (ids only): `usage_charge.added`, `usage_charge.amount_set`, `usage_charge.amount_corrected`, `usage_charge.change_undone`, `usage_charge.removed`; `tenancy.occupants_changed`, `tenancy.occupants_corrected`, `tenancy.occupants_change_undone`; `tenancy.fee_added`, `tenancy.fee_amount_set`, `tenancy.fee_amount_corrected`, `tenancy.fee_change_undone`, `tenancy.fee_removed`.

## Risks / Trade-offs

- [The form 7H row for parking, sauna and other usage charges is assumed to be 2.5] → The mapping is one data file; it is checked against the 7H instructions with #16 before the year summary (#34) reads it. Water's row 2.2 is already sourced in the term bank.
- [One occupant for existing tenancies may be wrong] → The Tenancy page shows the number, and an owner corrects it by setting it on the tenancy's start. It changes nothing until a per-occupant charge or fee exists.
- [A fee or usage charge dated in the past changes past months] → Intended, like a corrected rent: a fee added from an earlier month makes those months' expected rent higher, so a paid month can become *Partly paid*. The fee form shows the month's total from the chosen date, so the owner sees it before saving.
- [Per-occupant usage charges use the tenancy on the month's first day] → A mid-month tenant change counts the outgoing tenancy's occupants for that month. Housing companies bill by the month, so this matches the invoice more often than a split by days would.
- [Prorating each part separately] → The parts add up exactly to the total shown, at the cost of the total possibly differing by a cent from prorating the sum.
- [Size] → The change touches three capabilities and adds five tables. The tasks keep each group under about 500 lines; the usage charges and the tenant fees could also be split into two changes if the review prefers.
