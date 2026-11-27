## 1. The year's tenancies and the PDF's text

- [x] 1.1 `summary.ts`: `FlatDetails.tenancies`, `{ name, from, to }[]`, from `tenanciesInYear` in start order, each clipped to the year and to today (design.md, decision 3). `tenant` and `period` stay as they are.
- [x] 1.2 Unit tests in `summary.test.ts`:
  - "Every tenancy of the year"
  - "A tenancy starting after today is not listed"
  - the existing "Flat details for form 7H" tests unchanged
- [x] 1.3 `pdf-text.ts`: `pdfText(s)` keeps the WinAnsi characters and replaces the rest: `→` with `–`, a letter with a diacritic with its base letter, anything else with `?` (design.md, decision 5). Unit tests for "Names outside the font" and "Finnish and Swedish letters are kept".

## 2. The PDF's view from the server

- [x] 2.1 `view.ts`: `YearSummaryPdfView` (design.md, decision 2).
- [x] 2.2 `year-summary.server.ts`:
  - `loadYearSummaryPdf(deps, year?, person?)`, sharing the card computation with `loadYearSummary`
  - each card's flat (unsorted; the document sorts by address) with its address, postcode, city and full flat year
  - the holder's name from `namesFor`, the user's own for the own share
  - the whole flats' owners per flat
- [x] 2.3 `functions.ts`: `getYearSummaryPdf({ year?, person? })` with the `yearSummaryInput` schema; the route mock in `src/router.test.ts` if a route reaches it.
- [x] 2.4 Workers tests in `year-summary.server.test.ts`:
  - the PDF view's cards and each flat's rows equal `loadYearSummary` and `loadFlatYear` for the own share, another owner and the whole flats
  - the own share's name, another owner's name, the year clamped as on the page
  - no flat the user can't see
- [x] 2.5 `year-summary.server.test.ts`, beside the page's query count test: the PDF view keeps the year summary's fixed number of queries.

## 3. The PDF's document model and messages

- [ ] 3.1 `pdf-document.ts`: `pdfDocument(view, now, firstPages?)` turns a `YearSummaryPdfView` into pages of blocks: the cover, a page per flat, the whole flats' band and owners, and the footers (design.md, decision 4). It is pure, and its texts come from messages and the app's formatters.
- [ ] 3.2 Messages in fi, sv and en for the cover, the flat pages, the band, the share change with a dash, the footer, the file name parts, the button, the busy state, the notice and the failure. Write the Finnish first; use the translate skill for Swedish and English, with the term-critic review if a term changes.
- [ ] 3.3 Unit tests in `pdf-document.test.ts`:
  - "The cover page of the own share"
  - "A share change on the cover"
  - "Flats not included on the cover"
  - "The rows and checks of a flat", with "Every tenancy of the year" on the page
  - "The whole flats' cover"
  - "The whole flat's page"
  - another owner's cover with their name
  - Swedish text in the Swedish locale
- [ ] 3.4 `pdf-file-name.ts`: `pdfFileName(holder, year)` with the stem and the whole flats' part from messages and a slug of another owner's name (design.md, decision 8). Unit tests for all three holders and a name that leaves no slug.
- [ ] 3.5 "The PDF's messages need no replacement": every message the PDF uses, rendered in fi, sv and en with sample values, passes `pdfText` unchanged.

## 4. The renderer

- [ ] 4.1 Add `jspdf`. First, a Vitest test that writes `€ – · ä ö å Ä Ö Å` in the standard Helvetica and reads them back from the PDF (design.md, decision 1). If they don't survive, stop and raise switching to `@cantoo/pdf-lib` with the user.
- [ ] 4.2 `pdf-render.ts`, the only file that imports `jspdf`:
  - draws the document model on A4 with `pdfText` applied to every string
  - wraps text to its column
  - continues an overflowing flat on a new page with the address repeated, and measures first so the cover's page numbers follow
  - embeds the logo from `/email/logo.png`, or goes without it if the fetch fails
  - returns a `Blob`
- [ ] 4.3 Unit tests in `pdf-render.test.ts`:
  - the output starts with `%PDF`
  - a flat with many parts and checks continues on a second page, and the cover's page number for the next flat follows
  - the PDF is made without the logo when the fetch fails

## 5. The button on the year summary page

- [ ] 5.1 `PdfButton.tsx`: *Lataa PDF* under the intro card when the year has flats in the summary. On click it calls `getYearSummaryPdf`, loads `pdf-render` with a dynamic import, downloads the `Blob` with the file name, and shows the busy state, the notice and the failure (design.md, decision 7). On failure, log `year_summary.pdf_failed` with `clientLog` and no figures or names.
- [ ] 5.2 `YearSummaryPage.tsx` and the route `year-summary/index.tsx`: pass `year` and `person` to the button.
- [ ] 5.3 Component tests in `PdfButton.test.tsx` and `YearSummaryPage.test.tsx`:
  - the button only with flats in the summary
  - the busy state
  - the notice with the file name
  - "Building the PDF fails", with its log line
- [ ] 5.4 Playwright in `e2e/year-summary.spec.ts`, describe "Downloading the year summary as a PDF":
  - "Downloading the own share's PDF": the download's file name and that it starts with `%PDF`
  - "The PDF follows the chosen holder", with Jussi from `coOwned`: the file name
  - "No PDF without flats in the summary"
- [ ] 5.5 CLAUDE.md "Current state": the year summary PDF (`getYearSummaryPdf`, `pdf-document.ts`, `pdf-render.ts`, jsPDF loaded on demand, `pdfText`).

## 6. Verification, review and archive

- [ ] 6.1 The full `pnpm test`, `pnpm test:e2e` and `pnpm check:traceability`.
- [ ] 6.2 The `pr-review` skill, and its findings handled.
- [ ] 6.3 `openspec archive add-year-summary-pdf` as the PR's last commit.
