## 1. Reads by a list of flats

- [x] 1.1 List reads beside the per-flat ones (design.md, decision 2):
  - `ownership.repository.server.ts`: `rowsFor(propertyIds)`
  - `tenancy.repository.server.ts`: `forProperties(propertyIds)`
  - `rent-payment.repository.server.ts`: `forProperties(propertyIds)`
  - `transaction.repository.server.ts`: `forPropertiesYear(propertyIds, year)`
  - `recurring-amount.repository.server.ts`: `forProperties(propertyIds)`, returning each flat's `RecurringAmounts`
  - `usage-charge.repository.server.ts`: `forProperties(propertyIds)`

  The per-flat reads become wrappers where that removes duplication. An empty id list returns empty without a query.
- [x] 1.2 Workers tests for each list read: two flats' rows kept apart, the order as in the per-flat read, and an empty list.

## 2. The rows of a flat's year

- [x] 2.1 `features/year-summary/summary.ts`:
  - the weighted amounts (amount × the user's basis points on its deciding date, `sharesOn`)
  - parts rounded once, half up
  - rows 2.1–2.5 from rent payments by `paid_on`, entries by `CATEGORIES[…].row`, `chargeMonth` per month with the treatment, and `usageChargesOfMonth` per month with `USAGE_CHARGE_ROWS`
  - the months up to the current one in the current year
  - the Not on form 7H amounts (capitalised, improvements)
  - `included` (share above 0 on some day of the year up to today)
- [x] 2.2 `summaryYears` and `openingYear` (design.md, decision 4) in the same module.
- [x] 2.3 Unit tests named after the scenarios of "Form 7H rows of the own share", "Shares on the cash basis", "The Not on form 7H card", "The year the summary opens on" and "Flats in the year summary", with fixed `today` values.

## 3. Flat details, checks and the copy format

- [x] 3.1 `summary.ts`, the flat details:
  - the housing company fields
  - the tenant (one, several, none) and the tenancy period clamped to the year
  - the share at the end of the user's period in the year
- [x] 3.2 `summary.ts`, the checks:
  - months not fully paid from `rentMonths` (`late`, `partly_paid`) in months the user owned on the first day
  - vacant months with the user's charges above 0
  - missing housing company details
  - financing charge months without a treatment
  - the share change with its date and shares
- [x] 3.3 `features/year-summary/copy.ts`: `amountForCopy(cents)` and `shareForCopy(basisPoints)`.
- [x] 3.4 Unit tests named after the scenarios of "Flat details for form 7H", "Checks in the year summary" and "Amounts and shares in the copy format".

## 4. Form 7H terms

- [x] 4.1 Term bank, with the translate skill: *bruttovuokratulo*, *tuloutettu pääomavastike*, *muut kulut* and *henkilötunnus*.
  - The row names come from form 7H in Finnish and Swedish and from the Tax Administration's English instructions, with their sources in `i18n/sources.json`.
  - Check whether *vuosikorjaus*, *hoitovastike* and *vesimaksu* already match the form's wording.
  - Done: *bruttovuokratulo*, *muut kulut* and *henkilötunnus* added. *Tuloutettu pääomavastike* needs no entry of its own: it is `income_recognised` (*tuloutettu*, verified from row 2.3) with `financing_charge`, whose patterns accept *pääomavastike*. *Vuosikorjaus*, *hoitovastike* and *vesimaksu* already match rows 2.2 and 2.4.
- [x] 4.2 The term-critic's review of the term bank diff, and its findings fixed.

## 5. The year summary on the server

- [x] 5.1 `features/year-summary/year-summary.server.ts`: `loadYearSummary(deps, year?)` and `loadFlatYear(deps, propertyId, year?)`.
  - The access check is the user's flats, archived included (`listForUser`, `listArchivedForUser`).
  - The list reads of group 1, then `flatYear` per flat and the opening year.
  - Each returns the computed view only (design.md, decision 5): the cards with the "Not included" flats, or the form 7H page with not found and no share.
- [x] 5.2 `features/year-summary/functions.ts`: `getYearSummary({ year? })` and `getFlatYear({ propertyId, year? })` with the session check and a Zod `inputValidator` (year 2000–2100, optional).
- [x] 5.3 Workers tests:
  - the server-side scenarios of "The year summary page", "Flats in the year summary" and "The form 7H page of a flat" (archived flat, no share, not found, member)
  - a test that the number of D1 queries for 3 flats equals that for 1 flat
  - a test with 10 flats and two years of data that stays well inside the Free plan's CPU time

## 6. The year summary page

- [ ] 6.1 Route `src/routes/_authed/year-summary/index.tsx` (`validateSearch` with an optional `year`) and `features/year-summary/YearSummaryPage.tsx`:
  - the year heading, with the months so far in the current year
  - previous and next year buttons, disabled at the ends
  - the cards: address, housing company line or missing, share, row 2.1, rows 2.2–2.5 summed, check chips
  - the "Not included" note
  - the empty state
  - `BottomNav` with Taxes current (the bar item itself lands in group 8)
- [ ] 6.2 fi, sv and en messages with the translate skill; component tests.
- [ ] 6.3 Playwright tests for "The year summary page" (`e2e/support/year-summary.ts`: `openYearSummary(page, year)`).
  - Data is set up in the current and earlier years through the forms, and the year is always given in the URL, because the opening year depends on the date.
  - The member case uses the sharing helpers.

## 7. The form 7H page of a flat

- [ ] 7.1 Route `src/routes/_authed/year-summary/$propertyId.tsx` and `features/year-summary/FlatTaxPage.tsx`:
  - the checks with their links (rent payments of the year, charge amounts)
  - the flat details with Add to `/properties/$propertyId/edit` for each missing one, and the personal identity code row
  - rows 2.1–2.5 with their numbers, names, parts and amounts, and the case law note under row 2.3 when it is above 0
  - the Not on form 7H card
  - the note on how the figures are counted
  - Back to the summary with the same year
  - not found, and no share
- [ ] 7.2 The copy buttons: `navigator.clipboard.writeText` with `amountForCopy` and `shareForCopy`, an `aria-label` naming the value, the notice "Kopioitu: <value>", and on failure a notice plus `clientLog.warn('year_summary.copy_failed')` without the value.
- [ ] 7.3 fi, sv and en messages with the translate skill; component tests, including the copy failure.
- [ ] 7.4 Playwright tests:
  - "The form 7H page of a flat"
  - "Flat details for form 7H": "Missing housing company details"
  - "Checks in the year summary": "A month not paid", with the rent month left without a payment in the current year
  - "Copying form 7H values": "Copying an amount", with the clipboard permissions granted

## 8. Taxes in the bottom bar

- [ ] 8.1 `components/BottomNav.tsx`: `NavPage` with `year-summary`, four columns, Flats · New entry · Taxes · Account, and the `nav_taxes` message in fi, sv and en. Update the file's header comment.
- [ ] 8.2 Playwright test for "The bottom bar opens the year summary". The existing navigation tests keep passing.
- [ ] 8.3 Docs:
  - CLAUDE.md "Current state": the year summary and the Taxes item
  - CONCEPT.md §6: tick "Form 7H asks for the housing company's name…" (done in #118)
  - README if it lists the pages

## 9. Verification and review

- [ ] 9.1 `pnpm check:traceability`, then the full `pnpm test` and `pnpm test:e2e` once.
- [ ] 9.2 Ask the user to paste a copied amount (`4895,00`) into MyTax and confirm that it is accepted. If it isn't, change only `amountForCopy` and its tests.
- [ ] 9.3 Run the `pr-review` skill on the PR, and fix its findings as `fix(...)` commits.

## 10. Archive

- [ ] 10.1 `openspec archive add-year-summary` as the PR's last commit (`docs(openspec): archive add-year-summary`). Update the Purpose line of `openspec/specs/navigation/spec.md` to the four items, and write the new `year-summary` spec's Purpose.
