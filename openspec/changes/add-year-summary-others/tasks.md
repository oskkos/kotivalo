## 1. A holder in the calculation

- [x] 1.1 `summary.ts`: `Holder` and `holderShare` (design.md, decision 1). `flatYear`, `ownedInYear`, `shareAtEnd`, `paymentChecks`, `shareChanges` and `summaryYears` take a `Holder`. `whole` sums the period's shares, and `shareChanges` returns nothing for it.
- [x] 1.2 Update the callers in `year-summary.server.ts` to `{ kind: 'owner', userId }`, and the arguments in `summary.test.ts` and `summary.cpu.test.ts`. The own share's results don't change.
- [x] 1.3 Unit tests in `summary.test.ts`:
  - "The whole flat counts every owner's share"
  - the whole flat over a mid-year owner change, with no `share_changed` check
  - another owner's rows at their share
  - `summaryYears` for an owner and for `whole`

## 2. Names, the person parameter and the server functions

- [x] 2.1 `ownershipRepository(db).namesFor(propertyIds)` (design.md, decision 4), with a Workers test that includes a person who no longer has access.
- [x] 2.2 `schemas.ts`: `person`, a user id of 1–64 characters or `whole`, optional, for both server function inputs. A URL schema drops anything else. Unit tests.
- [x] 2.3 `view.ts` and `year-summary.server.ts` (design.md, decisions 3, 5 and 6):
  - `loadYearSummary(deps, year?, person?)` with `holder`, `people` and the whole flats' `owners` on the cards
  - `loadFlatYear(deps, propertyId, year?, person?)` with the holder and the whole flat's `owners`, with each owner's row 2.1
  - the years by holder, the whole flats' years for a member without a share, and an unknown person falling back to the own share
  - `namesFor` added to `loadInputs`' first batch
- [x] 2.4 `functions.ts`: pass `person` through.
- [x] 2.5 Workers tests in `year-summary.server.test.ts`:
  - "The sheet lists the year's owners"
  - "No selector for a sole owner" (empty `people`)
  - "A person without a share that year"
  - "An unknown person in the URL"
  - "A co-owner's cards"
  - "A member sees an owner's figures"
  - "A flat the user can't see is not counted"
  - "The whole flats include a flat without the own share"
  - "An owner change in the middle of the year"
  - "The years of another owner"
  - "A member without a share moves between years"
  - "The whole flat's rows and owners" (the view's `owners` and rows)
  - the fixed number of queries still holds, in `list-reads.server.test.ts`

## 3. The selector and the year summary page

- [x] 3.1 `HolderChoice.tsx`: the *Kenen luvut* button and the bottom sheet with a radio group (design.md, decision 7). Choosing navigates and closes the sheet, and *Oma osuutesi* removes `person`.
- [x] 3.2 `YearSummaryPage.tsx`:
  - the selector when `people` is not empty
  - the intro for another person, with the *Vain yhteiset asunnot* band and the person's "Not included" note
  - the intro for the whole flats, the owners on the cards and the "not reported as such" note
  - the empty state for a person without a share that year
  - `person` on the year buttons and the card links
- [x] 3.3 The route `year-summary/index.tsx`: `person` in `validateSearch` and `loaderDeps`.
- [x] 3.4 Messages in fi, sv and en for the selector, the sheet, the intros, the band, the notes and the empty state. Names go in the basic form only. Use the translate skill for the Swedish and English text, with the term-critic review if a term changes.
- [x] 3.5 Component tests in `YearSummaryPage.test.tsx` and `HolderChoice.test.tsx`: the sheet's options and the chosen one, the person view's band and notes, the whole flats' owners, no selector without `people`, and the person's empty state.
- [x] 3.6 Playwright in `e2e/year-summary.spec.ts`, with Annika and Jussi co-owning from `coOwned`:
  - "Choosing whose figures": the sheet, choosing Jussi, the URL, and the choice kept on the previous year
  - "Another owner's figures": Jussi's card and the band
  - "The whole flats": the owners on the card and the note
  - "No share in any flat" for a member, with the selector

## 4. The form 7H page for another owner and the whole flat

- [x] 4.1 `FlatTaxPage.tsx`:
  - for another owner: the kicker with the name, the band, copy buttons kept
  - for the whole flat: the kicker, the note, the *Omistajat* card with links to each owner's page, rows without copy buttons, and no details card
  - Back with `person`
- [x] 4.2 The route `year-summary/$propertyId.tsx`: `person` in `validateSearch` and `loaderDeps`.
- [x] 4.3 Messages in fi, sv and en for the kickers, the bands and the *Omistajat* card.
- [x] 4.4 Component tests in `FlatTaxPage.test.tsx`: "A co-owner's form 7H page", "Opening an owner from the whole flat", and no copy button and no details card on the whole flat.
- [x] 4.5 Playwright in `e2e/year-summary.spec.ts`:
  - "The whole flat's page": the owners, the rows and no copy button
  - "The choice follows the year and the flat": the URLs, and Back to the same person
  - "The form 7H page of a flat" for another owner, with copy buttons
- [x] 4.6 CLAUDE.md "Current state": the year summary for other owners and whole flats (`Holder`, `person`, `HolderChoice`).

## 5. Verification, review and archive

- [x] 5.1 The full `pnpm test`, `pnpm test:e2e` and `pnpm check:traceability`.
- [ ] 5.2 The `pr-review` skill, and its findings handled.
- [ ] 5.3 `openspec archive add-year-summary-others` as the PR's last commit.
