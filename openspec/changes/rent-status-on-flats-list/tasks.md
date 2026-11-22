## 1. This month's rent across flats

- [x] 1.1 `features/rent-payments/status.ts`: `rentThisMonth(flats, today)` as in design.md ("The summary is a pure function over the flats"): each flat's card row, `expected`, `received` and `late`
- [x] 1.2 Unit tests named after every scenario of "The rent summary on the flats list" and the row rules of "The rent status on a flat's card" (current tenancy, a tenancy that starts after this month, vacant)

## 2. The server function

- [ ] 2.1 `recurringAmountRepository(db).rentFor(propertyIds)` and `rentPaymentRepository(db).forMonth(propertyIds, month)`, each one statement, with Workers tests (other flats and other months left out, no ids gives nothing)
- [ ] 2.2 `rent-payments.server.ts`: `listRentThisMonth(deps)`: the user's flats with `listForUser`, today in Finland, the tenancies running this month, the rent periods and this month's payments by flat; `functions.ts` exposes it with its session check
- [ ] 2.3 Workers tests: an owner's and a member's flats included, a stranger's flat left out, a tenancy that ended earlier this month included, one that ended last month left out

## 3. The summary and the chips on the flats list

- [ ] 3.1 `RentSummary.tsx` and `CardRentChip.tsx` as in design.md ("Components"); `PropertyList.tsx` gets the `summary` and `rentStatuses` slots; the route `/` loads `listRentThisMonth` and composes them
- [ ] 3.2 fi, sv and en messages for the summary's title (a select by month), the amounts and the late count, with the translate skill and the term-critic on the diff
- [ ] 3.3 Component tests for the summary and the chips (every chip text, no chip for a vacant flat or one starting later, no summary without rent)
- [ ] 3.4 Playwright tests "The summary adds up this month's rent of every flat" and "A late month shows on the card", with dates relative to today so they don't age; the existing flats list tests still passing
- [ ] 3.5 CLAUDE.md "Current state": the summary and the rent chips on the flats list

## 4. Archive

- [ ] 4.1 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass
- [ ] 4.2 `openspec archive rent-status-on-flats-list` as the last commit
