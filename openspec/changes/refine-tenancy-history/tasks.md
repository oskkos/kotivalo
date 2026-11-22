## 1. Server: ending on create, rent from the latest period, removing

- [x] 1.1 `features/tenancies/rent.ts`: `rentAsked(rents, start)` as in design.md ("Rent is asked only from the latest rent period on"), with unit tests (no periods; start month before, on and after the latest period's start)
- [x] 1.2 Repository: the create statement takes `validTo`, `noticeGivenBy` and `noticeDate`, and its overlap condition uses `validTo`; `removeNotStarted(actorId, propertyId, tenancyId, today)` conditioned on the owner role and `valid_from > today`. Workers tests: an ended earlier tenancy goes in before a later one; removing writes nothing on or after the start day or for a member
- [x] 1.3 `schemas.ts`: an optional ending on `createTenancyInput` with the fields of `endTenancyInput`; `rent` optional; `removeTenancyInput`
- [x] 1.4 `tenancies.server.ts`:
  - `createTenancy` with an optional ending: `validateTenancyDates` with the ending's last day, then `validateEnding`; the ending stored with the tenancy
  - the rent ignored, with no rent statements, when `rentAsked` is false; `amount_invalid` when it is asked and missing
  - `removeTenancy`: `tenancy_already_started`, `tenancy_not_found`, the role; logs `tenancy.removed`
- [x] 1.5 Reason `tenancy_already_started` (alert) in `src/lib/reasons.ts`; its messages in fi, then sv and en with the translate skill
- [x] 1.6 Server function `removeTenancy` in `functions.ts`; `createTenancy` passes the ending
- [x] 1.7 Workers tests named after the scenarios:
  - "Adding a tenant": "Adding an earlier tenancy with its ending", "The ending of an earlier tenancy follows the notice rules", "The ending can't be recorded for a tenancy that hasn't started"
  - "Tenancy dates and details": "An earlier open-ended tenancy without its ending is refused"
  - "The rent of a new tenancy": "A tenancy starting before the latest rent period leaves the rent alone", replacing the test of the removed scenario "A rent for an earlier month than the latest change is refused"
  - "Removing a tenancy that hasn't started": "A started tenancy can't be removed", "A member can't remove a tenancy"
  - "Cancelling an ending": "A later tenancy after the original term doesn't prevent cancelling"
  - "Correcting a tenancy": rename the existing test to "A correction must fit a recorded ending"
  - the `tenancy.removed` log line
- [x] 1.8 `pnpm check:traceability`: a main-spec scenario that an active change removes or renames doesn't block (`blockingProblems` in `scripts/traceability/check.ts`, with unit tests; CLAUDE.md "Specs and tests"), so the removed rent scenario's test can go in this commit

## 2. The new tenant form: the ending and the rent

- [ ] 2.1 Move the end form's fields (who gave notice, notice date, last rent day with the suggested date and the period hint) into a component shared by `EndTenancyForm` and `TenancyForm`
- [ ] 2.2 `TenancyForm` (adding): the ending section, shown when the start entered is before today, sent with the save; the rent field hidden when `rentAsked` is false, with a line that the rent is set on the Rent and charges page
- [ ] 2.3 Messages for the section and the line in fi, then sv and en with the translate skill
- [ ] 2.4 Component tests for the section and the hidden rent; Playwright: "Adding an earlier tenancy with its ending"

## 3. The Tenancy page: earlier tenancies and no ending before the start

- [ ] 3.1 `TenancyPage`: an `otherAction` render prop for the other tenancies; the route links each to its correction form for owners
- [ ] 3.2 "Add an earlier tenancy" for owners under the other tenancies while the flat has a current tenancy; its messages in fi, sv and en
- [ ] 3.3 The route offers no "End tenancy" while the status is `starts`
- [ ] 3.4 Playwright: "Adding an earlier tenancy from the tenancy page", "Correcting an earlier tenancy from the list", "A tenancy that hasn't started can't be ended"; extend "A member sees the tenancy but can't change it" with the other tenancies not opening a form

## 4. Removing a tenancy from the correction form

- [ ] 4.1 A confirmation dialog for removing, like the entry delete dialog
- [ ] 4.2 `TenancyForm` (correcting): "Remove tenancy" while the tenancy hasn't started; after removing, the Tenancy page
- [ ] 4.3 Messages in fi, then sv and en with the translate skill
- [ ] 4.4 Playwright: "Removing a tenancy whose tenant withdrew"
- [ ] 4.5 CLAUDE.md: the current state mentions removing a tenancy that hasn't started and recording an earlier tenancy's ending

## 5. Archive

- [ ] 5.1 `pnpm check:traceability` and the full test suite pass
- [ ] 5.2 `openspec archive refine-tenancy-history` as the PR's last commit
