## 1. Table and repository

- [x] 1.1 Add `tenancies` to `src/server/db/schema.ts` as in design.md ("One table, the tenancy as a period"): `validity()`, the contract type and notice-given-by text enums, `isoDate()` for `contract_made` and `term_end`, `due_day`, the nullable contact and notice columns, `instant()` timestamps, the property cascade and the `(property_id, valid_from)` index
- [x] 1.2 `pnpm db:generate`; commit the migration
- [x] 1.3 `features/tenancies/tenancy.repository.server.ts`:
  - `forProperty(propertyId)`: the flat's tenancies, newest first
  - `get(tenancyId)`: the tenancy with its property id
  - `currentFor(propertyIds)`: each flat's tenancies that haven't ended before today's caller-given date, for the flats list and the edit page card
  - `createStatements(...)`: the `INSERT … SELECT` with the owner and overlap conditions, returned for the caller's `atomically` batch, and `create(...)` running it alone
  - `update`, `end` and `cancelEnding`, each conditioned on the owner role, the expected state and no overlap
  - `delete(tenancyId)` for the compensating delete
- [x] 1.4 Workers tests for the repository:
  - newest first; other flats left out
  - an overlapping insert or update writes nothing, also against an earlier tenancy
  - a member's write writes nothing
  - ending and cancelling set and restore `valid_to` (an open-ended back to none, a fixed term back to `term_end`)
  - deleting a flat deletes its tenancies

## 2. Notice periods, statuses and date rules

- [x] 2.1 `src/lib/dates.ts`: `lastDayOfMonth`, `addMonths` on a month, `addYears` on a date, with unit tests (month ends, leap years)
- [x] 2.2 `features/tenancies/notice.ts` as in design.md ("Notice periods and statuses are pure functions"): `LANDLORD_RULE_CHANGE`, `noticePeriodMonths`, `earliestLastDay`, `validateEnding` (the landlord's limit only; fixed-term notice refused; notice in the future or before the start; last day before the notice; a fixed term's last day on or after the term's end)
- [x] 2.3 `features/tenancies/status.ts`: `tenancyStatus`, `flatStatus`, `dueDate`
- [x] 2.4 `features/tenancies/rules.ts`: `validateTenancyDates(tenancy, { today, ownershipStart, others })` for overlap, ownership start, contract made and the fixed term's end
- [x] 2.5 `features/tenancies/schemas.ts`, shared by the forms and the server: the name, phone, email, contract type, dates (`parseFiDate`), due day and rent (`parseDecimal`), with their reason codes
- [x] 2.6 Reason codes in `src/lib/reasons.ts`:
  - field reasons: `tenant_name_required`, `tenant_name_too_long`, `tenant_phone_too_long`, `tenancy_overlaps`, `tenancy_start_before_ownership`, `tenancy_contract_made_in_future`, `tenancy_end_before_start`, `tenancy_due_day_invalid`, `tenancy_notice_in_future`, `tenancy_notice_before_start`, `tenancy_end_before_notice`, `tenancy_end_before_notice_period`, `tenancy_end_after_term`, `tenancy_fixed_term_notice`
  - alerts: `tenancy_not_found`, `tenancy_already_ending`, `tenancy_not_ending`, `tenancy_already_ended`, `tenancy_cancel_later_tenancy`

  The messages in fi, then sv and en with the translate skill, then the term-critic on the diff
- [x] 2.7 Unit tests named after the scenarios:
  - every scenario of "Notice periods" and "Tenancy statuses"
  - "The due day falls on the last day of a short month"
  - the pure ones of "Tenancy dates and details": overlap (both directions, an open-ended one), "An earlier tenancy can be added afterwards", ownership start, contract made, the fixed term's end, invalid details
  - "A mid-month last rent day is accepted for the tenant's notice", "The landlord's notice can't be shorter than the law allows", "An agreed ending can be on any day after the notice", "A notice date in the future is refused", "Notice on a fixed term is refused"

## 3. The rent as statements

- [ ] 3.1 Split `recurringAmountRepository.setAmount` so that `rentStatements(...)` returns its statements, optionally conditioned on a given row existing (design.md, "The rent is saved with the tenancy"); `setAmount` runs them as before
- [ ] 3.2 The existing recurring-amounts tests pass unchanged; add a Workers test for the conditioned statements writing nothing when the condition row is missing

## 4. Server functions

- [ ] 4.1 `features/tenancies/tenancies.server.ts`:
  - the Tenancy page (current, earlier, role, today, the rent in effect today)
  - the new tenant options (the rent periods, the ownership start, the flat's other tenancies for the form's checks)
  - the tenancy for correcting and for ending, with the earliest last day for each way of ending
  - create (with the rent when it changed, in one batch, and the compensating delete of design.md), update, end and cancel
  - each write checks access (`property_not_found`), the owner role (`sharing_owner_only`), the tenancy belonging to the flat (`tenancy_not_found`) and the rules of group 2
- [ ] 4.2 `features/tenancies/functions.ts`: `getTenancies`, `getNewTenancyOptions`, `getTenancy`, `createTenancy`, `updateTenancy`, `endTenancy`, `cancelTenancyEnding`, each with its session check
- [ ] 4.3 Log the events of design.md ("Logging"), ids only, never the tenant's details
- [ ] 4.4 Workers tests, named after the scenarios:
  - "Adding an open-ended tenancy" and "Adding a fixed-term tenancy"
  - "A member can't add a tenant", "A member can't end a tenancy", "A member can't correct a tenancy"
  - "A tenancy overlapping the previous one is refused", "A new tenant can be added during the notice period", "A tenancy can't be added while one runs without an end", "A tenancy before the ownership is refused", "Contract made in the future is refused", "A fixed term ending before it starts is refused", "Invalid tenant details are refused"
  - "A changed rent starts from the start month", "A rent for an earlier month than the latest change is refused", "An unchanged rent leaves the periods alone"
  - "The tenant gives notice", "Ending a fixed term by agreement"
  - "Cancelling the tenant's notice", "Cancelling after the last rent day is refused", "Cancelling is refused when a new tenancy follows"
  - "Correcting the tenant's phone number", "A correction can't make tenancies overlap"
  - each logged event, and no tenant name, phone or email in any line

## 5. The tenancy page and the edit page card

- [ ] 5.1 Route `/properties/$propertyId/tenancy` with a loader calling `getTenancies`, and a page title
- [ ] 5.2 `TenancyPage.tsx`, as on the Design canvas ("Vuokrasuhde", "· irtisanottu", "· vapaa"): the tenant, the status chip, call and email links, the details rows, earlier tenancies, the vacant prompt; the owner's buttons come with their routes in groups 6 and 7
- [ ] 5.3 The tenancy card at the top of the edit page ("Muokkaa asuntoa · vuokrasuhdekortti"), linking to the page; the edit page's loader gets the card's summary
- [ ] 5.4 Messages in fi, then sv and en with the translate skill; the term-critic on the diff
- [ ] 5.5 Component tests: the statuses on the page, the vacant state with and without history, the member view, a tenancy without phone or email
- [ ] 5.6 Playwright: "A vacant flat offers to add a tenant" for a new flat (no history). The scenarios that need tenancies get their Playwright tests in group 6, where tenancies can be added through the form

## 6. Adding and correcting a tenant

- [ ] 6.1 Routes `/properties/$propertyId/tenancy/new` and `/properties/$propertyId/tenancy/$tenancyId/edit`; members are sent back to the Tenancy page
- [ ] 6.2 `TenancyForm.tsx`, as on the Design canvas ("Uusi vuokralainen", "· virheet"): the previous tenancy's summary, name, phone, email, the contract type, contract made (following the start until edited), start, the fixed term's end, the rent (from the rent in effect on the start date; not in the correction mode) and the due day, with the field reasons
- [ ] 6.3 Add tenant and Edit on the Tenancy page for owners
- [ ] 6.4 Messages in fi, then sv and en with the translate skill. Add fixed-term, open-ended, contract made, due day and vacant to the term bank where they are domain terms, and run the term-critic on the diff
- [ ] 6.5 Component tests: "Contract made defaults to the start date", "The form shows the rent in effect on the start date", the fixed term's end shown only for fixed-term, the field reasons, the correction mode without the rent
- [ ] 6.6 `e2e/support/tenancies.ts`: `addTenant(page, flatId, details)` through the form
- [ ] 6.7 Playwright:
  - "Adding an open-ended tenancy" and "Adding a fixed-term tenancy"
  - "Opening the tenancy page from the edit page" and "The edit page shows the tenancy card"
  - "A member sees the tenancy but can't change it"
  - "A changed rent starts from the start month" (the Rent and charges page shows the new amount)
  - "Correcting the tenant's phone number"

## 7. Ending and cancelling

- [ ] 7.1 Route `/properties/$propertyId/tenancy/$tenancyId/end`; members are sent back to the Tenancy page
- [ ] 7.2 `EndTenancyForm.tsx`, as on the Design canvas ("Päätä vuokrasuhde", "Päätä määräaikainen vuokrasuhde"):
  - open-ended: tenant / landlord / agreed, the notice date, the last rent day following the earliest date until edited, and the hint for each case and contract date
  - fixed-term: the explanation, agreed / court, the date and the last rent day
- [ ] 7.3 End tenancy on the Tenancy page for owners; Cancel ending with a confirmation dialog during the notice period
- [ ] 7.4 Messages in fi, then sv and en with the translate skill; add notice period to the term bank if it isn't there; the term-critic on the diff
- [ ] 7.5 Component tests: the hint and default per way of ending and contract date, the landlord's limit reason, the fixed-term form, the cancel dialog
- [ ] 7.6 Playwright:
  - "The tenant gives notice"
  - "Ending a fixed term by agreement"
  - "Cancelling the tenant's notice"

## 8. Statuses on the flats list

- [ ] 8.1 The flats list's loader gets each flat's status in one query (`currentFor`); `PropertyList.tsx` shows the status chip and the tenant's name, as on "Asunnot · vuokrasuhteen tila"
- [ ] 8.2 Messages in fi, then sv and en with the translate skill; the term-critic on the diff
- [ ] 8.3 Component tests for the three statuses; Playwright "The card shows the tenancy status"

## 9. Docs and checks

- [ ] 9.1 CONCEPT.md: the `tenancies` row of the data model (no deposit; the validity columns, `term_end`, `contract_made`)
- [ ] 9.2 CLAUDE.md: the current state (`features/tenancies/`, notice periods in `notice.ts`) and the e2e helper `tenancies.ts`
- [ ] 9.3 `pnpm check:traceability`, the full Vitest suite, Playwright, lint and typecheck pass

## 10. Archive

- [ ] 10.1 `openspec archive track-tenancies` as the PR's last commit
