## 1. Tables and the migration

- [x] 1.1 `schema.ts`: `CHARGE_KINDS`, `CHARGE_BASES` and the tables `usage_charges`, `usage_charge_amounts`, `tenancy_occupants`, `tenant_fees` and `tenant_fee_amounts` (design.md, decision 1; `id()`, `cents()`, `validity()`, cascades and indexes); `pnpm db:generate`, then append the occupants statement from design.md (decision 2) to the generated `0010` file before committing it
- [x] 1.2 Workers test for "Existing tenancies get one occupant": tenancies stored as the previous version did, the migration's statements run from `d1Migrations`, each tenancy with one occupant from its start
- [x] 1.3 `tenancy.repository.server.ts`: `occupantsFor(tenancyIds)` and `feesFor(tenancyIds)` (each fee with its amount periods, oldest first) beside `rentsFor`; Workers tests

## 2. Period rules and the shared period writes

- [ ] 2.1 `tenancies/rent.ts`: `validateTenancyPeriodDate`, `valueInTenancyMonth` (generalising `rentInMonth`, which keeps its name as a wrapper or is replaced at its callers), `firstPeriodMove` and `periodAfterEnd` (generalising `firstRentMove` and `rentAfterEnd`); unit tests named after the scenarios of "Occupants of a tenancy" and the start and end scenarios of "Occupants and fees stay inside their tenancy"
- [ ] 2.2 `tenancies/fees.ts`: `occupantsInMonth` and `feeInMonth`; unit tests named after "Tenant fees are recorded as periods"
- [ ] 2.3 `src/server/db/periods.ts`: the statement builder for the three new period tables (close the open period the day before and add the next, correct the latest, delete the latest and reopen the previous; the expected latest start and a caller-given owner check inside every statement); Workers tests on `tenancy_occupants` and `usage_charge_amounts`, including a concurrent write that applies nothing

## 3. The expected rent with the fees

- [ ] 3.1 `rent-payments/status.ts`: `TenancyAmounts` (rent, occupants, fees) and `expectedRent` returning `{ total, parts } | null`, each part prorated by days (design.md, decision 4); the month, year, not-fully-paid and this-month functions read `total`; unit tests for the new scenarios of "Expected rent of a month", the existing ones unchanged
- [ ] 3.2 `rent-payments.server.ts`, `properties/details.server.ts`, the flats list and `tenancies.server.ts` read the occupants and fees with the rents (`occupantsFor`, `feesFor`); Workers tests of rent payments, the flats list and the details page still passing

## 4. Tenancies keep their occupants and fees

- [ ] 4.1 `schemas.ts` and `TenancyForm.tsx`: the occupants field (1–20, default 1, `occupants_invalid`); adding a tenancy stores its first occupants period from its start day in the tenancy's batch; `addTenant` in `e2e/support/tenancies.ts` keeps working with the default
- [ ] 4.2 `tenancies.server.ts`: correcting the start moves the occupants' and each fee's first period (`firstPeriodMove`) in the same batch or is refused with `tenancy_start_after_change`; ending, ending early and correcting the fixed term's end are refused with `tenancy_has_changes_after_end` after the rent's check (`periodAfterEnd`)
- [ ] 4.3 Reason codes `occupants_invalid`, `tenancy_start_after_change` and `tenancy_has_changes_after_end` in `src/lib/reasons.ts`, fi, sv and en messages with the translate skill
- [ ] 4.4 Workers tests named after the scenarios of "Occupants and fees stay inside their tenancy" (fees inserted directly until group 6) and "The occupants of a new tenancy"; component test of the occupants field

## 5. Changing the occupants

- [ ] 5.1 Term bank: *asukas* / *asukasmäärä* (code `occupants`) with the translate skill and the term-critic's review of the diff
- [ ] 5.2 `tenancy.repository.server.ts` occupants writes on the shared builder; `tenancies.server.ts` and `functions.ts`: `setTenancyOccupants` and `undoTenancyOccupants` (session, owner, `tenancy_not_found`, `validateTenancyPeriodDate`, `occupants_invalid`, `occupants_nothing_to_undo`, `amount_changed`); logs `tenancy.occupants_changed`, `tenancy.occupants_corrected`, `tenancy.occupants_change_undone`; reason `occupants_nothing_to_undo` with fi, sv and en; Workers tests named after the server-side scenarios of "Changing the occupants", asserting the log events
- [ ] 5.3 `TenancyPage.tsx`: the occupants row (today's number, the upcoming change, when the latest started) with *Muuta* opening the change dialog and the undo confirmation for owners; component tests
- [ ] 5.4 Playwright tests for "Changing the occupants" (`e2e/support/tenancies.ts`: `setOccupants`)

## 6. Tenant fees on the server

- [ ] 6.1 `tenancy.repository.server.ts` fee writes: `addFee` (fee and first period in one batch), `setFeeAmount`, `undoFeeChange` (removing the fee with its only period), on the shared builder; Workers tests
- [ ] 6.2 `tenancies.server.ts` and `functions.ts`: `addTenantFee`, `setTenantFee`, `undoTenantFee` (session, owner, `tenant_fee_not_found`, `description_required`, `amount_invalid`, `validateTenancyPeriodDate`, `amount_nothing_to_undo`, `amount_changed`); logs `tenancy.fee_added`, `tenancy.fee_amount_set`, `tenancy.fee_amount_corrected`, `tenancy.fee_change_undone`, `tenancy.fee_removed`; reasons `description_required` and `tenant_fee_not_found` with fi, sv and en
- [ ] 6.3 `transaction.repository.server.ts`: `categoryTotalSince(propertyId, category, from)`; server function `entriesSince` for the forms' water warning (session, access); Workers tests
- [ ] 6.4 Workers tests named after the server-side scenarios of "Adding a tenant fee", "Changing a tenant fee" and "Undoing a tenant fee change", asserting the log events; the fee scenarios of group 4's tests switched to `addTenantFee`

## 7. Tenant fees on the Tenancy page

- [ ] 7.1 Term bank: *maksu vuokran lisäksi* (code `tenantFee`), and the kind words *autopaikka* and *sauna* if the bank needs them, with the translate skill and the term-critic's review
- [ ] 7.2 `TenancyPage.tsx`: the fees card (*Maksut vuokran lisäksi*: fees in effect with per-occupant detail, ended fees, none, the month's total, *Lisää maksu* and *Muuta* for owners); component tests
- [ ] 7.3 Routes `/properties/$propertyId/tenancy/$tenancyId/fees/new` and `/fees/$feeId` with `TenantFeeForm.tsx` (kind as `ChoiceField`, *Selite* for *Muu*, basis defaulting by kind, amount, date, the month's total from the date, the water entries warning; the change form with *Uusi summa* / *Päättyy*, history and undo); owners only; component tests
- [ ] 7.4 fi, sv and en messages with the translate skill; `e2e/support/tenancies.ts`: `addFee`; Playwright tests for "Adding a tenant fee", "Changing a tenant fee", "Undoing a tenant fee change" and the new scenarios of "The tenancy page"

## 8. Occupants and fees of a new tenancy

- [ ] 8.1 `tenancies.server.ts`: the new tenant form's data offers the previous tenancy's fees not ended on its last day; adding a tenancy copies the checked fees from its start day in the tenancy's batch
- [ ] 8.2 `TenancyForm.tsx`: the previous fees as unchecked checkboxes with the note that an unchecked fee is included in the rent, and the month's total; messages fi, sv and en; component tests
- [ ] 8.3 Workers and Playwright tests named after "Occupants and fees of a new tenancy"

## 9. The fees on the rent pages

- [ ] 9.1 `RentMonthPage.tsx`: the expected rent's breakdown from `parts` with a link to the Tenancy page; `RecordPaymentDialog.tsx`: the hint that the rent and the fees are one payment; messages fi, sv and en; component tests
- [ ] 9.2 `FlatDetailsPage.tsx`: the tenancy card's occupants and "+ maksut" with the fees' sum this month (the rent card already shows the total); component tests
- [ ] 9.3 Playwright tests for the new scenarios of "The month's rent payments page" and "The rent card includes the tenant fees"

## 10. Usage charges on the server

- [ ] 10.1 `features/usage-charges/months.ts` (`usageChargesOfMonth`, `usageChargesOfYear`, `usageChargeYears`) and `rows.ts`; unit tests named after "Usage charges of a month", "Usage charges are recorded as monthly periods" (the pure scenarios) and "Usage charge rows on form 7H"
- [ ] 10.2 `usage-charge.repository.server.ts`: the flat's usage charges with their periods, `add`, `setAmount`, `undoLatest` on the shared builder; Workers tests
- [ ] 10.3 `usage-charges.server.ts` and `functions.ts`: `listUsageCharges` (page data with today's occupants), `addUsageCharge`, `setUsageCharge`, `undoUsageCharge`, `usageChargesByYear` (session, access, owner, `usage_charge_not_found`, `description_required`, `validateAmountDate`, `amount_nothing_to_undo`, `amount_changed`); logs `usage_charge.added`, `usage_charge.amount_set`, `usage_charge.amount_corrected`, `usage_charge.change_undone`, `usage_charge.removed`; reason `usage_charge_not_found` with fi, sv and en; Workers tests named after the server-side scenarios of "Adding a usage charge", "Changing a usage charge" and "Undoing the latest usage charge change", asserting the log events

## 11. The usage charges page and forms

- [ ] 11.1 Term bank: *käyttömaksu* (code `usageCharge`) with the translate skill and the term-critic's review
- [ ] 11.2 `UsageChargesPage.tsx` and route `/properties/$propertyId/usage-charges`: charges in effect, ended ones, none, the occupants note, buttons for owners; component tests
- [ ] 11.3 `UsageChargeForm.tsx` and routes `…/usage-charges/new` and `…/usage-charges/$usageChargeId`: kind, *Selite* for *Muu*, basis defaulting by kind, amount with today's occupants, date, the 7H row hint and the water entries warning; the change form with *Uusi summa* / *Päättyy*, history and undo; owners only; component tests
- [ ] 11.4 fi, sv and en messages with the translate skill; `e2e/support/usage-charges.ts`: `addUsageCharge`; Playwright tests for "The usage charges page", "Adding a usage charge", "Changing a usage charge", "Undoing the latest usage charge change" and "Water charge entries are warned about"

## 12. Usage charges by month and on the details page

- [ ] 12.1 `UsageChargesByMonthPage.tsx` and route `…/usage-charges/months`: year choice, totals per charge, months with per-occupant detail and change marks, the note and link, none; component tests
- [ ] 12.2 `details.server.ts` and `FlatDetailsPage.tsx`: the *Käyttömaksut* section below *Vastikkeet*, opening the usage charges page, and *Käyttömaksut kuukausittain* with this year's total; component tests
- [ ] 12.3 Playwright tests for "The usage charges by month page" and the new scenarios of "The flat details page"
- [ ] 12.4 CLAUDE.md "Current state" (usage charges, occupants, tenant fees, the expected rent with fees, the new e2e helpers) and `openspec/config.yaml` if it names anything changed

## 13. Archive

- [ ] 13.1 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass
- [ ] 13.2 The Purpose lines of the `tenancies` and `rent-payments` specs updated for the occupants and fees, and the new `usage-charges` spec's Purpose written (archive doesn't write them)
- [ ] 13.3 `openspec archive usage-charges-and-tenant-fees` as the last commit
