## 1. A year's charges

- [ ] 1.1 `features/recurring-amounts/charges.ts`: `chargeYears(amounts, today)` and `chargesOfYear(amounts, treatments, year, today)` as in design.md ("A year's charges are one pure function"), on `valueInMonth`
- [ ] 1.2 Unit tests `charges.test.ts` named after every scenario of "Charges of a month"

## 2. Year buttons as a shared component

- [ ] 2.1 Move the rent payments page's year buttons into `components/YearChoice.tsx` (the years, the chosen one, `onYear`; `aria-pressed`, 44 px targets); `RentPaymentsPage.tsx` uses it, with no visible change
- [ ] 2.2 Component test for `YearChoice` (the chosen year pressed, choosing another calls `onYear`); the existing rent payments tests still passing

## 3. The charges page

- [ ] 3.1 Term `charge` (*vastike*) in `i18n/terms.json` with the translate skill, and the term-critic on the diff
- [ ] 3.2 fi, sv and en messages for the page: title, year summary (total, maintenance charge, financing charge per treatment, counted months, estimate), month rows (charges, total, "oli …"), footnote with the link, empty state and "Aseta vastikkeet"; with the translate skill and the term-critic on the diff
- [ ] 3.3 `features/recurring-amounts/ChargesPage.tsx` as in design.md ("Components"), and the route `src/routes/_authed/properties/$propertyId/charges.tsx` loading `getRecurringAmounts` and `getProperty`, with `?year=` and the not-found view; Back to the details page
- [ ] 3.4 Component tests: the summary with one and with two financing treatments, the estimate shown only before December, the change mark, the empty state with and without the button
- [ ] 3.5 Playwright tests in `e2e/charges.spec.ts` for "The charges page" (owner, member, earlier year, no charges, no access), with dates relative to today so they don't age (`addFlat` with `ownedSince`, `setAmount`, `setTreatment`)

## 4. The row on the flat details page

- [ ] 4.1 `FlatDetailsPage.tsx` `Amounts`: the *Vastikkeet kuukausittain* row inside the card with this year's total so far from `chargesOfYear`, opening the charges page; fi, sv and en messages
- [ ] 4.2 Playwright test "This year's charges open the charges page" in the details page spec; the existing details page tests still passing
- [ ] 4.3 CLAUDE.md "Current state": the charges page by year, opened from the details page

## 5. Archive

- [ ] 5.1 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass
- [ ] 5.2 `openspec archive charges-by-month` as the last commit
