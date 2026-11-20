## 1. Ownership periods table

`feat(db): add the ownership_periods table`

- [ ] 1.1 Add `ownership_periods` to `src/server/db/schema.ts` (design decision 1); run `pnpm db:generate`, name the migration `0003_ownership_periods.sql`, and add the backfill of one 100 % period per existing `owner` access from the flat's creation date
- [ ] 1.2 Workers tests: the cascades from `properties` and `user`, and the backfill on a database with flats created before the migration

## 2. Period rules

`feat(ownership): add the ownership period rules`

- [ ] 2.1 Write `features/ownership/periods.ts`: `sharesOn`, `validateSplit`, `validateChangeDate`, `parsePercent`, `equalSplit` (the remainder to the first person), with unit tests for the scenarios of "Ownership is recorded as periods" and the boundaries (the day before and the day of a change, 33,34 + 33,33 + 33,33)
- [ ] 2.2 Add `parseFiDate(text)` (`12.6.2022`, `2022-06-12`) and `formatShare(basisPoints)` (`50 %`, `33,33 %`, per language) to `src/lib/`, with unit tests
- [ ] 2.3 Add the reason codes `ownership_shares_total`, `ownership_share_invalid`, `ownership_no_owner`, `ownership_date_too_early`, `ownership_date_in_future`, `ownership_date_too_late`, `ownership_nothing_to_undo`, `ownership_invalid`, `date_invalid` with fi, sv and en messages

## 3. Ownership repository and the first period

`feat(ownership): record ownership periods`

- [ ] 3.1 Write `features/ownership/ownership.repository.server.ts` (design decision 3): `history`, `current`, `currentForUser`, `change`, `undoLatest`, `correctFirstDate`, with the guards in the statements and roles rewritten in the same batch
- [ ] 3.2 `propertyRepository.create` takes `ownedSince` and inserts the first period in its batch; `propertyDetailsInput` gets `ownedSince` (`parseFiDate`, not in the future) for new flats only
- [ ] 3.3 Workers tests:
  - a change closes the previous period on the day before
  - undo reopens it and resets the roles
  - the first date correction
  - roles match the shares after every operation
  - a change by a member changes nothing

## 4. Ownership server functions

`feat(ownership): change, undo and correct ownership on the server`

- [ ] 4.1 Write `getOwnership`, `changeOwnership`, `undoOwnershipChange` and `correctFirstOwnershipDate` (design decision 5) in `ownership.server.ts` and `functions.ts`, with the logging
- [ ] 4.2 Workers tests for every server-side scenario of the `ownership` spec, "Removing access to a flat" ("An owner can't remove another owner") and the role scenarios; log lines carry ids and no shares

## 5. Owned since and the card line

`feat(properties): ask when a flat was bought and show its owners`

- [ ] 5.1 Add the Ownership section with "Owned since" to the new flat form; the edit form doesn't show it
- [ ] 5.2 Show the ownership line on the flat cards from `currentForUser` ("You 50 % · Jussi 50 %", "Annika 100 % · shared with you")
- [ ] 5.3 fi, sv and en messages; component tests; Playwright for "The first ownership period" and the modified "Adding a flat" and "Listing flats"
- [ ] 5.4 Screenshots of the new flat form and the list (fi, 390 × 844) for review before the commit

## 6. Ownership and sharing page

`feat(ownership): change ownership on the ownership and sharing page`

- [ ] 6.1 Turn the Sharing page into "Ownership and sharing" (design decision 6): current owners, the change form (free list, presets, date, reason, remove-access checkboxes, live total), the history with Undo and Correct date
- [ ] 6.2 Component tests; Playwright for the browser scenarios of "Changing a flat's ownership", "Roles follow the current shares", "Undoing the latest ownership change", "Correcting the first ownership date", "Showing a flat's ownership history" and the modified sharing requirements
- [ ] 6.3 Screenshots of the page as an owner (form open, history) and as a member (fi, 390 × 844) for review before the commit
- [ ] 6.4 Update CLAUDE.md (current state, glossary) and CONCEPT.md (data model, the free-list open question); `pnpm check:traceability` and the full test suite pass

## 7. Archive

`docs(openspec): archive track-ownership`

- [ ] 7.1 `openspec archive track-ownership`, fill in the new spec's Purpose, check the merged specs and `pnpm check:traceability`
