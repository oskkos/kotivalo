## 1. Financing charges in the database

- [x] 1.1 `schema.ts`: table `financing_charges` (`id()`, `property_id` with cascade, `name` nullable) and `recurring_amounts.financing_charge_id` (nullable, cascade) with an index `(financing_charge_id, valid_from)`; `pnpm db:generate`, then append the backfill from design.md ("The migration") to the generated `0008` file before committing it
- [x] 1.2 Workers test for "Existing financing charges become unnamed charges": store periods as the previous version did (no charge) and run the migration's backfill statements from `d1Migrations` on them, for both scenarios (the backfill touches only rows without a charge, so it can run again)
- [x] 1.3 `recurring-amount.repository.server.ts`:
  - `forProperty` returns `financingCharges` (id, name, periods; ordered by first start, then name), plus a transitional `amounts.financing_charge`, the first charge's periods
  - period writes and undo take a sequence (`{ kind }` or `{ kind: 'financing_charge', chargeId }`), scoped by charge and its flat
  - `addFinancingCharge` (charge and first period in one batch)
  - `renameFinancingCharge`
  - undoing a charge's only period also deletes the charge
- [x] 1.4 `recurring-amounts.server.ts`, transitional until group 3: a financing amount without a charge id goes to the flat's first charge, or adds an unnamed one when there is none, so the current pages keep working
- [x] 1.5 Repository Workers tests: the scenario "Each financing charge has its own periods"; writes to one charge leave the others alone; another flat's charge id applies nothing; adding stores both rows or neither; undoing the only period removes the charge; existing tests still passing

## 2. Server functions for financing charges

- [x] 2.1 `schemas.ts`: `financingChargeName` (trimmed, 1–60, `financing_charge_name_required` / `financing_charge_name_too_long`), `addFinancingChargeInput`, `renameFinancingChargeInput`, and `chargeId` on `setAmountInput` and `undoAmountInput` (optional for `financing_charge` until group 3, refused for other kinds); unit tests
- [x] 2.2 `recurring-amounts.server.ts`:
  - `addFinancingCharge` and `renameFinancingCharge`, with owner check, name uniqueness ignoring case (`financing_charge_name_taken`) and the date rules for a first amount
  - `financing_charge_not_found` for a charge id not of the flat, in set, undo and rename
  - the view's `financingCharges` and `capitalised` summed over the charges (`accumulatedCapitalised` takes the charges)
- [x] 2.3 `functions.ts`: `addFinancingCharge`, `renameFinancingCharge`; `chargeId` passed through set and undo
- [x] 2.4 Reason codes in `src/lib/reasons.ts`, with fi, sv and en messages written with the translate skill
- [x] 2.5 Logs `financing_charge.added`, `financing_charge.renamed`, `financing_charge.removed`, and `chargeId` on `recurring_amount.set` and `recurring_amount.undone`
- [x] 2.6 Workers tests named after the server-side scenarios of "Adding a financing charge", "Renaming a financing charge", "Setting a rent or charge" ("Another flat's financing charge is not found") and "Undoing the latest rent or charge change" ("Undoing a financing charge's only amount removes it"), and "All financing charges count" in a unit test; asserting the log events

## 3. The financing charges card and adding a charge

- [x] 3.1 Messages for the card and the add form (*Rahoitusvastikkeet*, the sum, none yet, *Lisää rahoitusvastike*, *Nimi* with its hint, the treatment note, "koskee kaikkia"), fi, sv and en with the translate skill and the term-critic on the diff
- [x] 3.2 `RecurringAmountsPage.tsx`: the `FinancingCharges` card as in design.md ("Routes and components"): charges in effect or upcoming, the sum, the add link for owners, the treatment row
- [x] 3.3 `FinancingChargeForm.tsx` (name, amount, date, the treatment note) and the route `/properties/$propertyId/amounts/financing/new` (owners only, like `$kind`)
- [x] 3.4 Route `/properties/$propertyId/amounts/financing/$chargeId` opening `AmountForm` for that charge (set and undo with `chargeId`); `/amounts/$kind` no longer accepts the financing slug; the transitional server fallback from 1.4 is removed and `chargeId` becomes required for financing
- [x] 3.5 `e2e/support/amounts.ts`: `addFinancingCharge(page, name, amount, from)`, and `setAmount` for a named charge; existing e2e tests updated to the new card
- [x] 3.6 Component tests for the card (one unnamed charge, several with the sum, none, member) and the form; Playwright tests for "The rent and charges page" and "Adding a financing charge"

## 4. Renaming and ending a charge

- [x] 4.1 Messages: *Uusi summa* / *Päättyy*, the end date label and hint, *Päättyneet rahoitusvastikkeet*, "Päättyi {date}", the removal confirmation, fi, sv and en with the translate skill and the term-critic on the diff
- [x] 4.2 `periods.ts`: `isEnded(periods, today)` with unit tests
- [x] 4.3 `AmountForm.tsx` for a financing charge: the name field (saved first when changed), the *Uusi summa* / *Päättyy* choice (`ChoiceField`), on an ended charge only the name and the history; the undo confirmation says the charge is removed when it is the only period
- [x] 4.4 `RecurringAmountsPage.tsx`: the ended list below the card
- [x] 4.5 Component tests; Playwright tests for "Renaming a financing charge", "Ending a financing charge" and "Undoing a financing charge's only amount removes it"

## 5. Several charges in the computed views

- [ ] 5.1 `charges.ts`: `ChargePeriods` with the financing charges, a month's charges as a list, the year's lines per charge and treatment, the *started* and *ended* marks, `chargeYears` over all sequences (design.md "The calculations"); `charges.test.ts` updated, with the new scenarios of "Charges of a month"
- [ ] 5.2 `ChargesPage.tsx`: a summary line per charge with its name and treatment, the month rows listing every charge above 0 and the started and ended marks; messages with the translate skill; component tests
- [ ] 5.3 `details.server.ts` and `FlatDetailsPage.tsx`: a row per financing charge in effect today, the treatment once, this year's total over all charges; Workers and component tests
- [ ] 5.4 Remove the transitional `amounts.financing_charge` from the repository and the view
- [ ] 5.5 Playwright tests "A line for each financing charge" (charges page) and "Each financing charge in effect today" (details page); the existing charges and details page tests still passing
- [ ] 5.6 CLAUDE.md "Current state": several named financing charges per flat

## 6. Archive

- [ ] 6.1 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass
- [ ] 6.2 `openspec archive several-capital-charges` as the last commit
