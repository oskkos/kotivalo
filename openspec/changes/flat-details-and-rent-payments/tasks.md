## 1. Table and repository

- [x] 1.1 Add `rent_payments` to `src/server/db/schema.ts` as in design.md ("`rent_payments` belongs to a tenancy and a month"): `id()`, the tenancy reference with cascade, `month` text, `cents()` amount, `isoDate()` `paid_on`, `created_by`, `instant()` `created_at`, the `(tenancy_id, month)` index
- [x] 1.2 `pnpm db:generate`; commit `migrations/0007_rent_payments.sql`
- [x] 1.3 `features/rent-payments/rent-payment.repository.server.ts`:
  - `forProperty(propertyId)`: the payments of the flat's tenancies with the recorder's display name, by month then payment date
  - `record(...)`: one `INSERT … SELECT` conditioned on the user owning the flat, the tenancy belonging to it and the month being inside the tenancy's stored range
  - `remove(...)`: one `DELETE` conditioned on the owner role and the flat
- [x] 1.4 Workers tests for the repository: other flats left out; a member's or a stranger's write writes nothing; a month outside the tenancy writes nothing; removing a tenancy row removes its payments (cascade)
- [x] 1.5 CONCEPT.md: the `rent_payments` row of the data model as built

## 2. Expected rent, statuses and reasons

- [x] 2.1 `src/lib/dates.ts`: `daysInMonth(month)` and `daysBetween(a, b)`, with unit tests (leap years, month ends)
- [x] 2.2 `features/rent-payments/status.ts` as in design.md ("Expected rent and status are pure functions"): `expectedRent`, `rentDueDate`, `monthStatus`, `tenancyMonths`, `monthsNotFullyPaid`
- [x] 2.3 Unit tests named after every scenario of "Expected rent of a month", "The rent status of a month" and "Months not fully paid"
- [x] 2.4 `features/rent-payments/schemas.ts`: the amount (`parseDecimal`, 2 decimals, 1–10 000 000 cents), `paid_on`, `month` (`YYYY-MM`), shared by the dialog and the server, with schema unit tests
- [x] 2.5 Reason codes in `src/lib/reasons.ts`: field `rent_payment_amount_invalid`, `rent_payment_date_in_future`; alerts `rent_payment_month_outside_tenancy`, `rent_payment_not_found`, `tenancy_has_payments_outside`, `tenancy_has_payments`. Messages in fi, then sv and en with the translate skill (terms *vuokranmaksu*, *eräpäivä*, *osittain maksettu* as the skill decides), then the term-critic on the diff
- [x] 2.6 CONCEPT.md §4.2: the partial-month rule (by days, rounded to the cent) and the due date of the first month

## 3. Rent payment server functions

- [x] 3.1 `features/rent-payments/rent-payments.server.ts`:
  - the rent payments view of a flat: role, today, tenancies, rent periods and all payments
  - the month view of a tenancy (the same data narrowed to the tenancy, `tenancy_not_found` when it isn't the flat's)
  - record: access (`property_not_found`), owner (`sharing_owner_only`), the tenancy (`tenancy_not_found`), `paid_on` not after today, the month inside the tenancy; logs `rent_payment.recorded` with ids
  - delete: access, owner, the payment belonging to the flat (`rent_payment_not_found`); logs `rent_payment.deleted`
- [x] 3.2 `features/rent-payments/functions.ts`: `getRentPayments`, `getRentMonth`, `recordRentPayment`, `deleteRentPayment`, each with its session check
- [x] 3.3 Workers tests named after the server-side scenarios: "A payment date in the future is refused", "A month outside the tenancy is refused", "A member can't record a payment", "A member can't delete a payment", plus a stranger refused as not found and the log lines asserted

## 4. Payments stay inside their tenancy

- [x] 4.1 `tenancies.server.ts` and the tenancy repository: correcting and ending refuse with `tenancy_has_payments_outside`, removing with `tenancy_has_payments`; the `UPDATE` and `DELETE` carry the `NOT EXISTS` condition of design.md
- [x] 4.2 Workers tests named after every scenario of "Payments stay inside their tenancy", and the existing tenancy tests still passing; the tenancy forms show the new alerts (component test)

## 5. Flat details server function

- [x] 5.1 `features/properties/details.server.ts`: `getFlatDetails` as in design.md ("The details page reads through one server function"), reusing the tenancies, recurring-amounts and transactions loaders; `functions.ts` exposes it
- [x] 5.2 Workers tests: the shape for an owner and a member; the three latest entries; a stranger gets not found

## 6. Recording, the month page

- [x] 6.1 `RecordPaymentDialog.tsx`: amount and payment date with the missing amount and today as defaults, server reasons under the fields and as alerts
- [x] 6.2 Route `/properties/$propertyId/rent/$tenancyId/$month` and `RentMonthPage.tsx`: status, expected, paid, missing, the payments with who recorded them, "Lisää maksu" and delete with confirmation for owners
- [x] 6.3 Component tests for the dialog and the page; Playwright tests named after "A second payment defaults to the missing amount", "An invalid amount is refused", "Deleting a wrongly recorded payment", "The month's payments" and "A member sees the payments but can't change them"
- [x] 6.4 fi, sv and en messages for the dialog and the page (translate skill, term-critic)

## 7. The rent payments page

- [x] 7.1 Route `/properties/$propertyId/rent` with `?year=` and `RentPaymentsPage.tsx`: year choice, received total by payment date, the months with their statuses (one row per tenancy), the warning, the empty state
- [x] 7.2 Component tests; Playwright tests named after every scenario of "The rent payments page"
- [x] 7.3 fi, sv and en messages (translate skill, term-critic)

## 8. The flat details page

- [x] 8.1 Route `/properties/$propertyId` and `FlatDetailsPage.tsx` with its parts: the header with Edit and the menu, the flat card with owners, the rent card (status, record button, payments link), the warning, the tenancy card (moved from the edit page, `TenancyCard.tsx` reused), rent and charges with the capitalised total, latest entries, the vacant and *starts later* states
- [x] 8.2 Component tests; Playwright tests named after every scenario of "The flat details page" and "Recording this month's rent from the details page" and "A smaller amount leaves the month partly paid", reaching the page by its URL
- [x] 8.3 fi, sv and en messages (translate skill, term-critic)

## 9. The details page as the flat's main page

- [ ] 9.1 The flats list card opens the details page; the edit page loses its header icons and the tenancy card, and saving and closing go to the details page
- [ ] 9.2 The back links of the Tenancy, Rent and charges, Entries and Ownership and sharing pages go to the details page
- [ ] 9.3 Update the Playwright and component tests of the modified scenarios: "Selecting a flat opens its details page", "Editing a flat's floor area", "Opening the tenancy page from the details page", "Opening the rent and charges page from the details page", "Opening the entries page from the details page"; remove the tests of "Selecting a flat opens its edit form" and "The edit page shows the tenancy card"
- [ ] 9.4 CLAUDE.md "Current state": the details page and rent payments (`features/rent-payments/`, the statuses in `status.ts`)

## 10. Archive

- [ ] 10.1 `pnpm check:traceability`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass
- [ ] 10.2 `openspec archive flat-details-and-rent-payments` as the PR's last commit
