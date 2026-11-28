## 1. Finding a user's former flats

- [x] 1.1 `schema.ts`: index `ownership_periods_user_idx` on `ownership_periods.user_id`; `pnpm db:generate` and commit the migration (only `CREATE INDEX`).
- [x] 1.2 `property.repository.server.ts`: `listFormerlyOwnedForUser(userId)`, the flats where the user has no access row and a period with a share above 0, distinct (design.md, decision 1).
- [x] 1.3 Workers tests in `property.repository.server.test.ts`:
  - access removed in an ownership change
  - a member who leaves after their share ended
  - a member with only a 0 % share is not listed
  - a user with access is not listed
  - another user's flat is not listed

## 2. Clipping tenancies to the holder's days

- [x] 2.1 `summary.ts`: `flatYear(…, { ownDaysOnly })`, with the holder's spans in the year and `flatDetails` clipping `tenant`, `period` and `tenancies` to them (design.md, decision 3). Without the option nothing changes.
- [x] 2.2 Unit tests in `summary.test.ts`, describe "Tenants in a former owner's period":
  - "Only the former owner's tenants"
  - "A tenancy only after the sale"
  - "A former owner who kept access sees the whole year" (no option: unchanged)
  - a share ended and started again in the year
  - the existing "Flat details for form 7H" tests unchanged

## 3. The year summary for a former owner

- [x] 3.1 `year-summary.server.ts` (design.md, decision 2):
  - `userFlats` with the former flats
  - holder and years from the accessible flats, with the own share's years from all flats
  - former flats only in the own share's cards, never in "Not included", people or `counts.whole`
  - `flatYear` with `ownDaysOnly` for former flats
- [x] 3.2 `loadFlatYear`: a former flat opens for the own share whatever `person` says, with no owners and `former: true`. `view.ts`: `former` on `FlatYearView`.
- [x] 3.3 Workers tests in `year-summary.server.test.ts`:
  - describe "A former owner's year summary": "A former owner sees their period", "Only the own share of a former flat", "The years after a former owner's period" and "A member who leaves after their share ended"
  - the PDF view's tenancies clipped for a former owner
  - a stranger with no share still gets not found
  - the query count test with a former flat

## 4. The read-only form 7H page and the ownership hint

- [x] 4.1 `FlatTaxPage.tsx`: with `view.former`, the note band, no links in the checks and no Add buttons, copy buttons kept (design.md, decision 4).
- [x] 4.2 Messages in fi, sv and en: the former owner's note (title and text), and the second half of `ownership_remove_access_hint`. Finnish first. Use the translate skill for Swedish and English, and add the term *entinen omistaja* if the messages use it, with the term-critic review.
- [x] 4.3 Component tests in `FlatTaxPage.test.tsx`: "A former owner's read-only form 7H page" (the note, missing Business ID without Add, the unpaid check without a link, the copy buttons).
- [ ] 4.4 Playwright in `e2e/year-summary.spec.ts`, describe "A former owner's year summary", using `coOwned` and an ownership change that removes Jussi's access:
  - "A former owner sees their period": his current year's summary has the card, his flats list doesn't have the flat
  - "No flat pages for a former owner": its details page shows not found
  - "A former owner's read-only form 7H page": the note
- [ ] 4.5 Update the tests that assert the old remove-access hint, if any, and the ownership and sharing scenario tests named in the deltas: "Removing access from a person who no longer owns a share" (Workers: the flat stays in his year summary).
- [ ] 4.6 CLAUDE.md "Current state": a former owner's year summary (`listFormerlyOwnedForUser`, `ownDaysOnly`, `former` on the form 7H page).

## 5. Verification, review and archive

- [ ] 5.1 The full `pnpm test`, `pnpm test:e2e` and `pnpm check:traceability`.
- [ ] 5.2 The `pr-review` skill, and its findings handled.
- [ ] 5.3 `openspec archive add-former-owner-year-summary` as the PR's last commit.
