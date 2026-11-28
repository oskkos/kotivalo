## Why

The year summary gives the form 7H figures flat by flat. It doesn't say what the year means as a whole: the rental income after costs, and roughly how much capital income tax it brings. The tax terms in Swedish and English also don't show the Finnish words that MyTax's Finnish pages and the Tax Administration's guidance use (CONCEPT.md §1). #121 asks for both. #19 asks how to handle the 34 % bracket.

The answers, decided with the user on 28.11.2026 on the Design canvas (section *Veroarvio ja suomenkieliset alkuperäistermit*):
- **Where:** the estimate is on the year summary page, under the cards, because capital income tax is counted per person from all their flats. A flat's form 7H page only gets the rental income after costs, without tax.
- **Whose:** an estimate only for the own share. Another owner and the whole flats get the rental income after costs, without an estimate.
- **A loss:** a negative rental income after costs, no tax, and a note on how the loss is deducted. The deficit credit is not computed.
- **The rate (#19):** a fixed 30 %. The 34 % above 30 000 € is mentioned, not modelled, and there is no editable rate.
- **PDF:** the estimate on the own share's cover only.

## What Changes

- **Rental income after costs:** row 2.1 minus rows 2.2–2.5, computed from the figures the summary already has, never stored.
  - On the year summary page: a card under the flat cards, with all the cards' flats summed, for every holder.
  - On a flat's form 7H page and its PDF page: a line under row 2.5, with no copy button, saying it is not on form 7H.
- **The capital income tax estimate**, for the own share only:
  - 30 % of a positive rental income after costs, rounded to whole euros and shown as "n. 2 789 €" in the card
  - one paragraph of caveats in the card:
    - only the flats in Kotivalo
    - no loan interest, no other capital income and none of its costs
    - 34 % on capital income above 30 000 €
    - estates not supported yet
    - the Tax Administration computes the final tax
  - **A loss:** no tax, and the note that it is deducted from other capital income and that a deficit can reduce the tax on earned income.
  - Another owner and the whole flats: a line saying why there is no estimate.
- **The PDF's cover:**
  - every holder: the rental income after costs
  - the own share: also the estimate with a short caveat
- **Finnish originals of tax terms:**
  - In Swedish and English, the form 7H page and the PDF show the Finnish words after the tax terms in brackets, e.g. *Skötselvederlag och vattenavgifter (hoitovastikkeet ja vesimaksut)*.
  - This covers the row names, the parts that are tax terms, the Not on form 7H card's titles, the personal identity code label and the estimate's title.
  - Finnish is unchanged.
- **CONCEPT.md:** the open question on the tax rate (§6) is answered: a fixed 30 %, the bracket mentioned.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `year-summary`:
  - New requirements: "Rental income after costs", "The capital income tax estimate", "A rental loss in the estimate" and "Finnish originals of tax terms".
  - Changed requirements, which gain the new lines: "The form 7H page of a flat", "The PDF's cover page" and "A flat's page in the PDF".

## Impact

- **Tables:** none. Everything is computed from the summary's existing figures.
- **Server:** none beyond the view. The cards already carry row 2.1 and the sum of rows 2.2–2.5, and the form 7H view has every row. The query count is unchanged.
- **Calculation:** a pure `estimate.ts` in `features/year-summary/` (net, tax, loss) with unit tests, and a pure helper for the Finnish original of a label.
- **UI screens:**
  - **The year summary page (`YearSummaryPage.tsx`):** the estimate card. Canvas: *VerotArvio*, *VerotArvioTappio* and *VerotKokoArvio*.
  - **The form 7H page (`FlatTaxPage.tsx`):** the line under row 2.5 and the originals. Canvas: *Verot7HSv*.
  - **The PDF (`pdf-document.ts`):** the cover's estimate box (canvas: *PdfKansiArvio*), the flat page's line and the originals.
- **Formatting:** whole euros for the estimate, a new option or function in `src/lib/format.ts`.
- **Messages:** fi, sv and en for the card, the caveats, the loss note and the form 7H line. Swedish and English go through the translate skill. The term bank terms (`capital_income`, `estate`, `rental_income` and the form 7H terms) already exist.
- **Canvas difference:** the canvas shows the original after the water charge part too. Usage charge parts get no original, because the part already has a bracket (*Vattenavgift (bruksavgift)*), and row 2.2's name carries the term (design.md, decision 4).
