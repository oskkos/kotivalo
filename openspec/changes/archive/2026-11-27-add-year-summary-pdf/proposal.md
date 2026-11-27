## Why

The year summary shows form 7H figures one flat at a time, on the screen only. Landlords want to keep the year's figures, print them, or send them to an accountant or a co-owner. A PDF of the whole year in one file does all three (#36).

Copying figures into MyTax is already covered by the copy buttons of #34. Copying all figures at once is left out (decision on the Design canvas, section #36).

## What Changes

- **Lataa PDF** button on the year summary page, under the intro card, whenever the year has flats in the summary.
  - It builds one PDF of the year in the browser and downloads it.
  - While the PDF is being built, the button says so. Once it is downloaded, a notice names the file.
  - The PDF library loads only when the button is pressed, so the app's normal load does not grow.
- **Who the PDF is for:** it follows the choice on the page: the own share, another owner, or the whole flats (#122).
- **Cover page:**
  - the logo, the date it was made, the year, and whose figures they are with the person's name
  - each flat in the summary with its share (or its owners for the whole flats), row 2.1, rows 2.2–2.5 summed, the number of checks, and its page number
  - the flats not included, what the figures leave out, and that the summary is not a tax return
- **A page per flat:**
  - for the own share and another owner: the flat details form 7H asks for, with every tenancy of the year and its period
  - rows 2.1–2.5 with their parts, the checks and the Not on form 7H card
- **The whole flats:** a "for checking, not reported as such" band on every page, the owners with their shares and row 2.1, and no flat details.
- **Language:** the PDF is in the user's language, formatted like the app.
  - Text the PDF's standard font can't show is replaced: the share change arrow becomes a dash, and a letter outside the font loses its accent.
  - The Finnish originals of tax terms are left for #121.
- **File name:** by language, year and holder, e.g. `kotivalo-vuosiyhteenveto-2025.pdf`.
- **Not changed:** the figures and the year summary's and form 7H page's views on screen. The form 7H page still says "several" for more than one tenancy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `year-summary`: adds the PDF download, the PDF's cover page, its flat pages, the whole flats' PDF and the replacement of characters the PDF font can't show. The calculation's flat details gain the list of the year's tenancies, used only by the PDF.

## Impact

- **Tables:** none. Nothing is stored; the PDF is built from the computed view.
- **Server:**
  - a new server function `getYearSummaryPdf({ year?, person? })` in `features/year-summary/functions.ts`, loaded with the same fixed number of queries as the year summary (`year-summary.server.ts`)
  - the signed-in user's name for the own share's cover
- **Calculation:** `summary.ts` `FlatDetails` gains the year's tenancies (tenant name, first and last day within the year), a pure addition.
- **Browser:**
  - a pure document model in the feature folder that turns the view and the messages into pages, lines and tables, tested in Vitest
  - a thin renderer with a PDF library, loaded on demand
  - the logo `public/email/logo.png`, fetched and embedded as an image
- **Dependency:** one PDF library, client-side only, loaded with a dynamic import (design.md, decision 1).
- **UI screens:**
  - the year summary page: Design canvas *Vuosiyhteenveto · Lataa PDF* (`VerotPdf`)
  - the PDF itself: *PDF · sivu 1: kansilehti* (`PdfKansi`), *PDF · sivu 2: asunnon lomake 7H* (`PdfAsunto`), *PDF · kansilehti, koko asunnot* (`PdfKoko`) and *PDF · koko asunnon sivu* (`PdfKokoAsunto`)
- **Messages:** new fi, sv and en messages for the button, the notice, the PDF's headings, labels and file names.
