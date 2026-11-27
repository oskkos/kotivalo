## Context

The year summary (#34, #122) computes each flat's form 7H year in one pure function, `flatYear(input, holder, year, today)` in `features/year-summary/summary.ts`. `year-summary.server.ts` loads the inputs for the user's flats with a fixed number of queries, and returns two computed views:
- `YearSummaryView`, the cards
- `FlatYearView`, one flat's form 7H page

Nothing is stored.

The PDF needs both at once: the cards for the cover, and every flat's full year for its page. It also needs every tenancy of the year, which `FlatDetails` reduces to one, several or none today.

Constraints:
- Workers Free: 10 ms CPU per request, so the PDF is not built on the server (proposal).
- No hard-coded text: the PDF's words come from Paraglide messages in the user's language.
- The canvas decisions (section #36):
  - one PDF of the year
  - a cover page and a page per flat
  - the logo as an image
  - the user's name on the cover
  - every tenancy listed
  - a standard font

## Goals / Non-Goals

**Goals:**
- One server call gives everything the PDF shows, with the same figures as the pages, and the fixed query count holds.
- The PDF's content is decided by pure code that Vitest can check without reading a PDF file.
- The PDF library stays out of the app's normal bundle and behind one module, so it can be swapped.

**Non-Goals:**
- A PDF of one flat from the form 7H page.
- The Finnish originals of tax terms (#121).
- Copying all figures at once (dropped, canvas section #36).
- Embedding Nunito or any other font.
- A server-side or emailed PDF.

## Decisions

### 1. The library: jsPDF, loaded with a dynamic import

`jspdf` (4.x, maintained, MIT) draws text, lines and PNG images with the standard Helvetica font. It is imported only inside the click handler: `await import('./pdf-render')`, which imports `jspdf`. Vite puts it in its own chunk, so the app's first load does not grow.

Alternatives considered:
- **`pdf-lib`:** a clean API, but no release since 2021.
- **Its maintained fork `@cantoo/pdf-lib`:** brings in an HTML parser and a colour library for SVG support the PDF doesn't need.
- **`window.print()` with a print stylesheet:** no dependency, but on a phone the user has to find "Save as PDF" behind the print dialog, and the result depends on the browser. The user chose a real downloaded file.

Verification first, in the renderer's group: check that jsPDF's standard Helvetica writes `€`, `–`, `·`, `ä`, `ö`, `å`, `Å`, `Ä` and `Ö` correctly, in a Vitest test that renders them and reads the text back from the PDF.
- If it doesn't, switch to `@cantoo/pdf-lib` before going further. The renderer is the only file that knows the library.
- Raise the switch with the user, because it changes the dependency named here.

### 2. One server function for the PDF

`getYearSummaryPdf({ year?, person? })` in `functions.ts` calls `loadYearSummaryPdf(deps, year?, person?)` in `year-summary.server.ts`, which:
- resolves the holder and the year exactly as `loadYearSummary` does: the same `holderOf` and `yearsOf`, and the same clamping
- loads the inputs once with `loadInputs`, so the query count stays the year summary's
- returns `YearSummaryPdfView`:
  - the `YearSummaryView` fields: holder, year, today, cards, not included
  - the holder's name, from `namesFor`: the user's own name for the own share
  - `flats`: for each card, in address order, the flat's address, postcode and city, and its `Omit<FlatYear, 'propertyId' | 'included'>`
  - for the whole flats, `owners` per flat, built as in `loadFlatYear`

`loadYearSummary` and `loadYearSummaryPdf` share a helper, so the cards are computed once. The PDF view adds the full flat years it already computed.

The user's own name comes from `namesFor`, not the session: an owner is always in their flats' ownership periods, and a member without a share has no flats in the summary and so no PDF.

Alternative considered: one `getFlatYear` call per flat from the browser. That costs a request and a full load per flat, and the figures could differ if data changes between calls.

### 3. The year's tenancies in the flat details

`FlatDetails` gains `tenancies: { name, from, to }[]`: the tenancies of `tenanciesInYear(year, today)` in start order, each clipped to the year and to today. `tenant` and `period` stay as they are, so the form 7H page is unchanged. This is a pure addition in `summary.ts`, with unit tests.

### 4. A document model, then a renderer

The PDF is built in two steps.

1. **`pdf-document.ts`** (pure, no library) turns a `YearSummaryPdfView` and a "now" date into a document: pages of blocks.
   - The blocks are a heading, a key-value table, a table with right-aligned number columns, a band, a paragraph and a footer.
   - Every string in it comes from Paraglide messages and the app's formatters (`formatMoney`, `formatDate`, `formatShare`).
   - It knows the page numbers. The cover's "page" column needs them, and they are known without measuring, because each flat starts a new page.
2. **`pdf-render.ts`** draws the document with jsPDF on A4.
   - It wraps long text to the column width with the library's text measuring.
   - When a page overflows, it continues the flat on a new page with the address repeated, and renumbers the footers.
   - It embeds the logo. It is the only file that imports `jspdf`.

Vitest checks the requirements on the document model: texts, order, page numbers, the band, no flat details for the whole flats. The renderer gets one smoke test that it produces a PDF, plus the font check of decision 1.

The cover's page numbers assume one page per flat. When a flat's page overflows, the renderer adds pages, and the cover's numbers must follow. The renderer therefore measures first and returns each flat's first page, and the model fills the cover's "page" column from that. This is a two-pass layout inside the renderer; the model stays pure.

### 5. Text the font can't show

`pdfText(s)` in `pdf-text.ts` is a pure function that the renderer applies to every string. It keeps the WinAnsi (Windows-1252) characters Helvetica has, and replaces the rest:
- `→` → `–`
- a letter with a diacritic → its NFD base letter, if that is in WinAnsi
- anything else → `?`

A Vitest test renders every message the PDF uses, in fi, sv and en with sample values, and asserts `pdfText(text) === text`. The share change therefore has its own PDF message with a dash, not `flat_tax_check_share_title`.

### 6. The logo

The renderer fetches `/email/logo.png`, the PNG the emails use (246 × 64), and draws it at 32 px height on the cover and 24 px on the other pages. If the fetch fails, the PDF is made without the logo. The logo is decoration, and the figures matter more.

### 7. The button and its states

`YearSummaryPage` gets a `PdfButton` under the intro card, rendered when `flats` is not empty. It has three states:
- **idle:** *Lataa PDF*
- **busy:** a disabled button that says the PDF is being made
- **done:** a notice with the file name

A failure shows an error with `failureReason`, logs `year_summary.pdf_failed` (warn for a network failure, error otherwise, `clientLog`, no figures or names), and returns the button to idle.

The download is a Blob URL on an `<a download>` clicked from code, then revoked. Nothing is logged on success, because building the PDF changes no data.

The route passes `year` and `person` to the button. The button calls `getYearSummaryPdf` itself on click, so the page's loader stays as it is.

### 8. The file name

`pdfFileName(holder, year, locale)` is a pure function:
- The stem comes from messages: `kotivalo-vuosiyhteenveto`, `kotivalo-arssammandrag` (from *Årssammandrag*, the slug rule dropping the ring), `kotivalo-year-summary`.
- For another owner, a slug of their name is added: lower case, diacritics dropped as in decision 5, runs of anything but letters and digits made into `-`, trimmed. If nothing is left, nothing is added.
- For the whole flats, a message is added: `koko-asunnot`, `hela-bostaderna`, `whole-flats`.

## Risks / Trade-offs

- **[jsPDF's standard font garbles `€` or Nordic letters]** → Decision 1 checks this first, and the fallback library is named.
- **[A long flat page (many parts, checks and tenancies) overflows A4]** → The renderer continues on a new page with the address repeated, and the cover's page numbers come from the measured layout (decision 4).
- **[Large chunk on a slow phone]** → It loads only on click, and the busy state shows that something is happening. jsPDF minified is a few hundred KB, which is acceptable for a once-a-year action.
- **[A whole flats PDF mistaken for a filing copy]** → A band on every page, and no flat details.
- **[Personal data in a file that leaves the app]** → Tenant names are what form 7H asks for, and the user chose to include them. Nothing about the PDF is logged.
- **[Figures differ from the screen]** → Both come from the same `flatYear` calls in one load, and a Workers test compares the PDF view's cards and flat rows with `loadYearSummary` and `loadFlatYear`.

## Migration Plan

- No schema change.
- Deploy as usual.
- Rollback: revert the commits.

## Open Questions

None.
