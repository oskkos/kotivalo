## 1. The estimate, whole euros and Finnish originals

- [x] 1.1 `src/lib/format.ts`: `formatEuros(cents)`, whole euros in the user's locale, refusing cents that aren't whole euros (design.md, decision 3). Unit tests in `format.test.ts` for fi, sv and en.
- [x] 1.2 `features/year-summary/estimate.ts`: `CAPITAL_INCOME_RATE` and `yearEstimate(cards, holder)` returning income, costs, net, tax and kind (design.md, decisions 1–2).
- [x] 1.3 Unit tests in `estimate.test.ts`:
  - describe "Rental income after costs": "The rental income after costs of the year"
  - describe "The capital income tax estimate": "The estimate of the own share" and "The estimate is rounded to whole euros"
  - describe "A rental loss in the estimate": "A loss in the year" and "No income after costs"
  - no tax for `person` and `whole`
- [x] 1.4 `features/year-summary/original-text.ts`: `originalText(fi)` and `withOriginal(label, fi)` (design.md, decision 4). `row-text.ts`: `rowOriginal`, and `partOriginal` for maintenance charge, financing charge and annual repair.
- [x] 1.5 Unit tests in `original-text.test.ts`: lower-case first letter, inner bracket to comma, `null` in Finnish, and every row's original in Swedish and English.

## 2. The rental income after costs card and the estimate on the year summary page

- [x] 2.1 `YearSummaryPage.tsx`: the card under the flat cards and above the "Not included" note (design.md, decision 5), from `yearEstimate(view.flats, view.holder)`:
  - for the own share: the tax box, or the loss box for a loss
  - for another owner or the whole flats: the note on why there is no estimate
  - the title with its Finnish original
  - no card without flat cards
- [x] 2.2 Messages, Finnish first:
  - the card title and its three lines
  - the estimate label and "n. {amount}"
  - the caveat paragraph
  - the loss title and text
  - the two no-estimate notes

  Swedish and English with the translate skill. Check the terms: `capital_income`, `estate` and `rental_income`. The skill decides whether *alijäämä* (deficit) needs a term; if the term bank changes, the term-critic reviews it.
- [x] 2.3 Component tests in `YearSummaryPage.test.tsx`:
  - "No estimate for another owner"
  - "No estimate for the whole flats"
  - "No card without flats"
  - the loss box
- [x] 2.4 Workers test in `year-summary.server.test.ts`: "A former owner's flat in the estimate" (the cards of a former and an own flat feed `yearEstimate`).
- [x] 2.5 Playwright in `e2e/year-summary.spec.ts`:
  - describe "Rental income after costs": "The rental income after costs of the year" (a flat with rent and a maintenance charge)
  - describe "The capital income tax estimate": "The estimate of the own share"
  - describe "A rental loss in the estimate": "A loss in the year" (a maintenance charge with no rent)
- [x] 2.6 CONCEPT.md: §6's tax-rate question answered (a fixed 30 %, the bracket mentioned, no editable rate), and §4.5's line on the estimate. CLAUDE.md "Current state": the estimate card (`estimate.ts`, `formatEuros`).

## 3. The form 7H page: rental income after costs and Finnish originals

- [x] 3.1 `FlatTaxPage.tsx`:
  - the rental income after costs line after row 2.5, with no copy button, for the own share and another owner
  - the originals after the row names, the parts that are tax terms, the Not on form 7H titles and the identity code label
- [x] 3.2 Messages: the line's label and "not on form 7H" note, in fi, sv and en (translate skill).
- [x] 3.3 Component tests in `FlatTaxPage.test.tsx`:
  - "The rental income after costs of a flat"
  - describe "Finnish originals of tax terms": "A row name in Swedish", "No originals in Finnish" and "A title with a bracket"; render in Swedish or Finnish with Paraglide's locale
  - copy buttons unchanged
- [x] 3.4 Playwright in `e2e/year-summary.spec.ts`: describe "Finnish originals of tax terms", "A row name in English". Update the existing form 7H tests whose row-name assertions now see the original.

## 4. The PDF: the estimate on the cover, the line on a flat's page, the originals

- [x] 4.1 `pdf-document.ts`:
  - the cover's box under the table, with the rental income after costs for every holder, and the estimate or the loss with the short note for the own share
  - each flat's page: the line after row 2.5
  - the originals in the row names, parts and Not on form 7H titles, as one string
- [x] 4.2 Messages for the cover's box and its short note (translate skill).
- [x] 4.3 Vitest in `pdf-document.test.ts`:
  - "The estimate on the own share's cover"
  - "No estimate on another owner's cover"
  - "The rental income after costs on a flat's page"
  - "Originals in the PDF"
  - the existing cover and flat page tests kept passing
- [x] 4.4 Check that `pdf-render.ts` lays out the longer row names (wrapping tests in `pdf-render.test.ts`, if a row name now wraps).

## 5. Verification, review and archive

- [ ] 5.1 The full `pnpm test`, `pnpm test:e2e` and `pnpm check:traceability`.
- [ ] 5.2 The `pr-review` skill, and its findings handled.
- [ ] 5.3 `openspec archive add-tax-estimate` as the PR's last commit.
