## 1. Tables and repository

- [x] 1.1 Add `recurring_amounts` (id, property id with cascade, kind enum `rent | maintenance_charge | financing_charge`, amount `cents()`, `validity()`) and `financing_treatments` (id, property id with cascade, treatment enum `income_recognised | capitalised`, `validity()`) to `src/server/db/schema.ts`, with indexes on property id, kind and `valid_from`
- [x] 1.2 `pnpm db:generate`; commit the migration
- [x] 1.3 `features/recurring-amounts/recurring-amount.repository.server.ts`:
  - `forProperty(propertyId)`: amount periods per kind and treatment periods, oldest first
  - `setAmount`: correct the latest period on its own start, or close it the day before and insert the new one, with `atomically`
  - `undoLatest`: delete the latest period and reopen the previous one
  - `setTreatment`: like `setAmount`
- [x] 1.4 Workers tests for the repository: periods are closed and reopened, a correction keeps one period, other flats and kinds are untouched, deleting a flat deletes its periods

## 2. Period calculations

- [x] 2.1 `features/recurring-amounts/periods.ts`:
  - `validateAmountDate`: `amount_date_not_month_start`, `amount_date_before_ownership`, `amount_date_too_early`
  - `amountInMonth`, `monthlyAmounts`
  - `currentAndUpcoming`
  - `yearEffect`: difference per month, percentage, the year's total and its number of months
  - `accumulatedCapitalised`
- [x] 2.2 Unit tests named after the scenarios of "Rent and charges are recorded as monthly periods" and "Accumulated capitalised financing charges", plus the boundaries: the month before the first period, a change in January and in December, a treatment change mid-year, months without a treatment

## 3. Server functions

- [ ] 3.1 `schemas.ts`: the amount (`parseDecimal(text, 2)`, 0–9 999 999 cents, `amount_invalid`), the date with the month-start check, the kind and the treatment; unit tests
- [ ] 3.2 Add the reason codes to `src/lib/reasons.ts`: `amount_invalid`, `amount_date_not_month_start`, `amount_date_before_ownership`, `amount_date_too_early` as field reasons, `amount_nothing_to_undo` as an alert. Write their messages in fi, then sv and en with the translate skill
- [ ] 3.3 `recurring-amounts.server.ts`: get (periods, current and upcoming, accumulated capitalised, first ownership start, role), set amount, undo, set treatment. Each write checks access (`property_not_found`), the owner role (`sharing_owner_only`) and the date rules against the periods just read
- [ ] 3.4 `functions.ts`: `getRecurringAmounts`, `setRecurringAmount`, `undoRecurringAmount`, `setFinancingTreatment`, with session checks
- [ ] 3.5 Log `recurring_amount.set` (`propertyId`, `kind`, `corrected`), `recurring_amount.undone` and `financing_treatment.set` at info, ids only
- [ ] 3.6 Workers tests covering:
  - "Setting a rent or charge": first amount, correction, date before ownership, date before the latest change, member refused
  - "Undoing the latest rent or charge change"
  - "The financing charge treatment": member refused
  - each logged event

## 4. The Rent and charges page

- [ ] 4.1 Route `/properties/$propertyId/amounts` with a loader calling `getRecurringAmounts`, and a page title
- [ ] 4.2 `RecurringAmountsPage.tsx`, as on the Design canvas:
  - a card each for the rent, maintenance charge and financing charge, with the amount, its start date or "Ei asetettu", and the upcoming change
  - the treatment row on the financing charge card
  - the accumulated capitalised line when above zero
  - the "Aseta" or "Muuta" buttons for owners only
- [ ] 4.3 Messages in fi, then sv and en with the translate skill
- [ ] 4.4 Component tests for the empty state, the upcoming change, the accumulated line and the member view
- [ ] 4.5 Playwright, by URL: "A flat without amounts", "The current amount and an upcoming change" (amounts set through the server functions), "A member sees the amounts but can't change them"

## 5. Setting and undoing an amount

- [ ] 5.1 Route `/properties/$propertyId/amounts/$kind` (`rent`, `maintenance-charge`, `financing-charge`). Members are sent back to the page
- [ ] 5.2 `AmountForm.tsx`:
  - the first-amount variant
  - the change variant: the current amount, the new one, the difference and the year's effect
  - the date field with its reasons
  - the history, newest first
  - "Peru viimeisin muutos" with a confirmation dialog when there is more than one period
- [ ] 5.3 Messages in fi, then sv and en with the translate skill
- [ ] 5.4 Component tests for the effect line per kind and treatment, the field reasons and the undo dialog
- [ ] 5.5 Playwright for "Setting the first rent of a flat", "Raising the maintenance charge from next year", "The change form shows the effect on the year" and "Undoing a charge increase"

## 6. Financing charge treatment

- [ ] 6.1 Route `/properties/$propertyId/amounts/treatment`. Members are sent back to the page
- [ ] 6.2 `TreatmentForm.tsx`: the two choices with their explanations (`ChoiceField`), the date and the history
- [ ] 6.3 Messages in fi, then sv and en with the translate skill
- [ ] 6.4 Component tests
- [ ] 6.5 Playwright for "Setting the treatment for the first time", "A new treatment keeps the history" and "Only capitalised months count" (shown on the page)

## 7. Opening the page from the edit page

- [ ] 7.1 Add the "Vuokra ja vastikkeet" icon link to the edit page's header, next to Ownership and sharing, with its message in three languages
- [ ] 7.2 Playwright for "Opening the page from the edit page"
- [ ] 7.3 Docs:
  - CLAUDE.md "Current state": rent and charges
  - CONCEPT.md: tick the generating-recurring-entries question (computed on the fly) and the translations question (done in #57); change the data model rows of `recurring_amounts` and `financing_treatments` to `valid_from`, `valid_to`
- [ ] 7.4 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass

## 8. Archive

- [ ] 8.1 `openspec archive track-recurring-amounts`; check that the spec's Purpose is filled in; commit as `docs(openspec): archive track-recurring-amounts`
