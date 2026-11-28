## Context

The year summary (`features/year-summary/`) computes each flat's form 7H rows for a holder: the own share, another owner, or the whole flats. The server returns computed views only:
- `YearSummaryView.flats`: one card per flat, with `income` (row 2.1) and `costs` (rows 2.2–2.5 summed)
- `FlatYearView.flat.rows`: every row with its parts
- `YearSummaryPdfView`: the same cards plus each flat's full year

The PDF is built in the browser from that view (`pdf-document.ts` → `pdf-render.ts`).

So everything #121 needs is already in the views: the rental income after costs is the cards' income minus costs, and the estimate is 30 % of it. Nothing new has to be read or stored.

The Finnish originals concern labels that already exist as Paraglide messages:
- `rowLabel` and `partsText` in `row-text.ts`
- the Not on form 7H titles
- the identity code label

Paraglide renders any message in another language with `m.key({}, { locale: 'fi' })`, as the email templates already do.

The decisions taken with the user on 28.11.2026 on the Design canvas (proposal.md) fix the placement and who gets an estimate.

## Goals / Non-Goals

**Goals:**
- **Rental income after costs:** shown on the year summary page for every holder, and on the form 7H page and the PDF's flat page for the own share and another owner.
- **Estimate:** for the own share only, with its caveats and a loss shown as a loss.
- **Finnish originals:** shown after the tax terms in Swedish and English, on the form 7H page and in the PDF.
- **No new server reads, no stored figures,** and the year summary's fixed query count unchanged.

**Non-Goals:**
- **The bracket (#19):** modelling the 34 % bracket. It is mentioned only.
- **The rate:** an editable tax rate, in Account or elsewhere.
- **Other figures:** loan interest (#35), other capital income, the deficit credit amount, estates (#20).
- **Originals elsewhere:** originals outside the form 7H page and the PDF. The charges pages and entries keep their labels.
- **The whole flat's form 7H page:** a rental income after costs line there. That page is for checking, and the summary card covers the whole flats.

## Decisions

### 1. The estimate is a pure function of the cards, computed in the browser

`estimate.ts` exports `yearEstimate(cards, holder)`, which returns:
- `income`, `costs` and `net`, in cents
- `tax`: whole-euro cents, or `null` for another owner, for the whole flats and for a loss
- `kind`: `own` | `loss` | `person` | `whole`

The tax is `floor((net × 3 + 500) / 1000) × 100` cents, which is 30 % rounded half up to whole euros in integer arithmetic. A net of 0 gives 0.

`YearSummaryPage` and `pdf-document.ts` both call it on `view.flats`, so the page and the PDF can't differ.

Alternative considered: compute it on the server into the view. That would add nothing the browser doesn't have, and it would put a presentation rounding into the server's contract.

### 2. The rate is a constant, and the bracket is text

`CAPITAL_INCOME_RATE` is 30 % (`3 / 10`), a named constant in `estimate.ts`. The 34 % above 30 000 € is only a message. Because the app sees only rental income, modelling the bracket would suggest a precision it doesn't have (#19). CONCEPT.md §6's open question is answered this way.

### 3. Whole euros through `formatEuros`

`formatEuros(cents)` in `src/lib/format.ts` formats whole euros with the user's locale: `1 262 €` in Finnish and Swedish, `€1,262` in English. It sets `maximumFractionDigits: 0` and refuses cents that aren't whole euros. The estimate's message wraps it as "n. {amount}" ("ca", "approx."). Every other amount keeps `formatMoney`.

### 4. Finnish originals from the Finnish text of the same message

`original-text.ts` has two parts:
- **`originalText(fi)`:** pure. It lowers the first letter and turns an inner bracket into a comma: "Rahoitusvastikkeet (rahastoitu)" → "rahoitusvastikkeet, rahastoitu".
- **`withOriginal(label, fi)`:** returns `{ text, original }`, where `original` is `null` in Finnish and otherwise `originalText(fi())`.

`row-text.ts` gains Finnish twins of the labels that carry a tax term, each calling the message with `{ locale: 'fi' }`:
- `rowOriginal[row]`
- `partOriginal` for `maintenance_charge`, `financing_charge` and `annual_repair`
- the Not on form 7H titles, the identity code label and the estimate's title

The form 7H page renders the original in a muted span after the label. The PDF gets one string, `label (original)`, which `pdfText` already makes safe for the standard font.

Usage charge parts get no original. Their label already has a bracket (*Vattenavgift (bruksavgift)*), and row 2.2's name carries the water charge term. The canvas showed one on the water part; this is the only difference from it.

Alternative considered: write the original into the Swedish and English messages. The same messages are used on the charges pages and in entries, where the originals aren't wanted, and they would drift from the Finnish ones.

### 5. Where the lines go

- **The summary card:** under the flat cards and above the "Not included" note, on the same card surface as the cards. For the own share it has the tax box (accent tint), or the loss box (lavender) for a loss. For another owner and the whole flats it has a lavender note on why there is no estimate. The canvas has *VerotArvio*, *VerotArvioTappio* and *VerotKokoArvio*.
- **The form 7H page:** a last line in the rows card, after row 2.5, above a 2 px rule. It shows the label, the note "Ei lomakkeelle 7H", the amount, and no copy button (canvas: *Verot7HSv*).
- **The PDF:**
  - the cover: a box under the table (canvas: *PdfKansiArvio*)
  - each flat's page: a line after row 2.5

## Risks / Trade-offs

- **[The estimate is read as the tax owed]** → It is always "n." with whole euros, under "Arvio", and the caveats are in the same card. It is only shown for the own share.
- **[Long caveats on a phone]** → One paragraph, as the user agreed. If the phone review finds it heavy, the wording can be shortened without a spec change, as long as each listed point stays.
- **[A Finnish original with an odd case or bracket]** → `originalText` is unit-tested against every label that gets one, in all three languages.
- **[The PDF's standard font]** → The originals are Finnish text, so only ä and ö, which WinAnsi has.
- **[Rounding at the half euro]** → Integer arithmetic, with a unit test at the half.

## Migration Plan

None: no tables and no stored data. Deploy as usual. Rollback means reverting the commits.

## Open Questions

None.
