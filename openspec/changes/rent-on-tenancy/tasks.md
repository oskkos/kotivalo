## 1. Tenancy rents in the database

- [x] 1.1 `schema.ts`: table `tenancy_rents` (`id()`, `tenancy_id` → `tenancies` with cascade, `amount` with `cents()`, `validity()`, index `(tenancy_id, valid_from)`); `pnpm db:generate`, then append the copy and the deletion of the old rent rows from design.md ("The migration in SQL") to the generated `0009` file before committing it
- [x] 1.2 Workers test for "Existing rents move to their tenancies": store rents and tenancies as the previous version did and run the migration's statements from `d1Migrations` on them, for all three scenarios; no `recurring_amounts` row of kind `rent` stays
- [x] 1.3 `tenancy.repository.server.ts`: `rentsFor(tenancyIds)`, each tenancy's rent periods oldest first, for every page that needs a rent; Workers tests

## 2. A tenancy's rent: rules and writes

- [x] 2.1 `features/tenancies/rent.ts` gets pure functions (`rentAsked` stays for the transitional flat-level write until group 4): `rentInMonth(periods, tenancy, month)` (the period on the later of the month's first day and the tenancy's start), `validateRentDate(from, { tenancy, latestStart })` with the order in design.md, `suggestedRent(tenancies, start)` (the latest rent of the tenancy that starts last before `start`), and `firstRentMove(periods, oldStart, newStart)` (the new first start, or `tenancy_start_after_rent_change`) and `rentAfterEnd(periods, lastDay)`; unit tests named after the scenarios of "The rent of a tenancy" and the start scenarios of "Rent changes stay inside their tenancy"
- [x] 2.2 `tenancy.repository.server.ts` rent writes, in the statement pattern of the recurring-amounts repository (expected latest start and owner check in every statement): `setRent` (new period or correction on the latest start) and `undoLatestRent` (only with two periods or more); the first period's move lands with the correction in group 3
- [x] 2.3 Repository Workers tests: a change closes the previous period the day before, a correction on the latest start, undo reopens the previous period, a concurrent change applies nothing, another flat's tenancy applies nothing, removing a tenancy removes its rents (cascade)

## 3. Tenancies saved with their rent

- [x] 3.1 `schemas.ts`: the new tenant form's `rent` is required; `TenancyForm.tsx` always shows the rent field, suggests `suggestedRent` and updates it as the start changes until the user edits it; the field hint follows the canvas ("Uusi vuokralainen · vuokra pakollinen")
- [x] 3.2 `tenancies.server.ts`: adding a tenancy stores its first rent period from its start day in the same batch. Transitional until group 4: the flat-level rent write of today stays as it is, so the pages that still read it keep working
- [x] 3.3 Correcting a tenancy moves the first rent period (`firstRentMove`) in the same batch, or is refused with `tenancy_start_after_rent_change`; ending, ending a fixed term early and correcting the fixed term's end are refused with `tenancy_has_rent_after_end` when the last day is before the latest rent period's start
- [x] 3.4 Reason codes `tenancy_start_after_rent_change` and `tenancy_has_rent_after_end` in `src/lib/reasons.ts`, with fi, sv and en messages written with the translate skill
- [x] 3.5 Workers tests named after "The rent of a new tenancy" (server-side scenarios), "Rent changes stay inside their tenancy" and "Removing a tenancy that hasn't started"; component tests of the form ("The form suggests the previous tenancy's rent", "The first tenancy's rent field is empty", "The rent is required"); `addTenant` in `e2e/support/tenancies.ts` fills 890 € when the form suggests no rent; the existing e2e tests still passing

## 4. Rent read from the tenancy

- [x] 4.1 `rent-payments/status.ts`: `expectedRent` and the month, year and summary functions take each tenancy's rent periods (`rentInMonth`) instead of the flat's; unit tests of "Expected rent of a month" updated to its new scenarios
- [x] 4.2 `rent-payments.server.ts`, `properties/details.server.ts`, the flats list and `tenancies.server.ts` read the tenancies' rents from the tenancy repository; `recurringAmountRepository.rentFor`, the transitional flat-level rent write from 3.2 and `rentAsked` are removed
- [x] 4.3 e2e: the flat details test that set the rent on the Rent and charges page gives it with `addTenant` instead, and the old "A changed rent starts from the start month" test is replaced by "The rent starts on the tenancy's start day"; the Rent and charges page's own rent tests stay until group 6
- [x] 4.4 Workers and e2e tests of rent payments, the flats list and the details page still passing; `pnpm test` and `pnpm test:e2e`

## 5. The rent card and changing the rent

- [x] 5.1 Messages: the card and the form reuse the amounts page's words (*Vuokra*, "{date} alkaen", the upcoming change, *Muuta*, *Peru viimeisin muutos*, the undo confirmation, *Muuta vuokraa*, *Uusi summa*, *Voimassa alkaen*); new are the changes list, the form hint and the reasons `rent_date_before_tenancy` and `rent_date_after_tenancy`, fi, sv and en with the term bank's words (no term bank change, so no critic review)
- [x] 5.2 `tenancies.server.ts` and `functions.ts`: `setTenancyRent` and `undoTenancyRent` (session, owner `sharing_owner_only`, `tenancy_not_found`, `validateRentDate`, `amount_nothing_to_undo` with fewer than two periods, `amount_changed` on a concurrent write); logs `tenancy.rent_changed`, `tenancy.rent_corrected`, `tenancy.rent_change_undone` with ids only; Workers tests named after the server-side scenarios of "Changing a tenancy's rent" and "Undoing a tenancy's rent change", asserting the log events
- [x] 5.3 `TenancyPage.tsx`: the rent card below the tenancy (rent in effect today or the first rent, the upcoming change, the periods newest first, *Muuta* and *Peru viimeisin muutos* for owners, the undo dialog), the Vuokra row removed from the details, and the latest rent on the other tenancies' rows; component tests
- [x] 5.4 Route `/properties/$propertyId/tenancy/$tenancyId/rent` with the rent change form (`TenancyRentForm.tsx`: current rent, new rent, the difference, the date); owners only, like the tenancy's edit route; component tests
- [x] 5.5 `e2e/support/tenancies.ts`: `changeRent(page, flatId, amount, from)`; Playwright tests for "Changing a tenancy's rent", "Undoing a tenancy's rent change" and the new scenarios of "The tenancy page"

## 6. Charges without the rent

- [ ] 6.1 `recurring-amounts`: the rent removed from the repository's view, `RecurringAmountsPage.tsx`, `AmountForm.tsx`, `labels.ts` and the `$kind` route (`rent` is not found); `rent` removed from `RECURRING_AMOUNT_KINDS`, so `setRecurringAmount` and `undoRecurringAmount` refuse it; the page says the rent is changed on the Tenancy page
- [ ] 6.2 Titles: the amounts page *Vastikkeet*, the charges-by-year page *Vastikkeet kuukausittain* (design.md, "Routes and pages"), the details page's card and menu entry *Vastikkeet*; fi, sv and en with the translate skill and the term-critic on the diff
- [ ] 6.3 `FlatDetailsPage.tsx`: the tenancy card shows the rent in effect today, or the first rent of a tenancy that starts later, and the upcoming change; the charges card without the rent; component tests
- [ ] 6.4 Tests renamed and rewritten after the renamed requirements of `recurring-amounts` ("Charges are recorded as monthly periods", "The charge amounts page", "Setting a charge", "Undoing the latest charge change") with their rent scenarios turned into maintenance charge scenarios; Playwright tests for "The flat details page" scenarios "A tenancy that starts later", "The tenancy card shows the rent and its upcoming change" and "The charges with the capitalised total"
- [ ] 6.5 CLAUDE.md "Current state": the rent on the tenancy (`tenancy_rents`, the rent card and form), the amounts page as *Vastikkeet* without the rent; `openspec/config.yaml` if its summary mentions the rent and charges page

## 7. Archive

- [ ] 7.1 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass
- [ ] 7.2 The Purpose lines of the `recurring-amounts` and `tenancies` specs updated for the rent's move (archive doesn't touch them)
- [ ] 7.3 `openspec archive rent-on-tenancy` as the last commit
