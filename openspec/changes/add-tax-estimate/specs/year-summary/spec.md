## ADDED Requirements

### Requirement: Rental income after costs
The rental income after costs SHALL be row 2.1 minus rows 2.2–2.5 of the holder's share, computed from the year summary's figures and never stored. CONCEPT.md §4.5 notes that form 7H itself asks for no profit or loss, so wherever it is shown it SHALL be marked as not a form 7H value and SHALL have no copy button.
- **The year summary page:** whenever the summary has at least one flat card, a card under the flat cards SHALL show the cards' row 2.1 summed, rows 2.2–2.5 summed, and the rental income after costs. This applies for every holder: the own share, another owner and the whole flats. The card also carries the estimate ("The capital income tax estimate").
- **A flat's form 7H page:** for the own share and another owner, a line under row 2.5 SHALL show the flat's rental income after costs.

#### Scenario: The rental income after costs of the year
- **WHEN** Annika owns 5000 basis points of `Kuusikuja 3 B 12` and `Rantatie 15 C 21` in 2025, row 2.1 of her share is 489500 and 381600 cents, and rows 2.2–2.5 sum to 225500 and 224800 cents
- **THEN** the card under the cards of 2025 shows `8 711,00 €`, `4 503,00 €` and the rental income after costs `4 208,00 €`

#### Scenario: The rental income after costs of a flat
- **WHEN** Annika opens the form 7H page of `Kuusikuja 3 B 12` of 2025, with row 2.1 of 489500 cents and rows 2.2–2.5 summing to 225500 cents
- **THEN** the line under row 2.5 shows `2 640,00 €` with no copy button, and says that it is not on form 7H

#### Scenario: No card without flats
- **WHEN** Jussi, a member without a share, opens the summary of 2025
- **THEN** the page has no rental income after costs card

### Requirement: The capital income tax estimate
For the own share, the card ("Rental income after costs") SHALL also show an estimate of the capital income tax on the rental income: 30 % of a positive rental income after costs, rounded to the nearest whole euro (half up) and shown as about that many euros, e.g. "n. 1 262 €". It SHALL be labelled as an estimate, with a note that:
- it covers only the flats in Kotivalo, without loan interest, other capital income or its costs
- capital income above 30 000 € is taxed at 34 %
- estates are not supported yet
- the Tax Administration computes the final tax

The rate SHALL be fixed. A former owner's flats count for the years of their share ("A former owner's year summary"), as their cards do. For another owner and the whole flats the card SHALL show no estimate. Instead it SHALL say why:
- another owner may have other capital income
- for the whole flats, the tax is counted for each owner separately

#### Scenario: The estimate of the own share
- **WHEN** Annika's rental income after costs in 2025 is 420800 cents
- **THEN** the card shows the estimated tax `n. 1 262 €` with its note

#### Scenario: The estimate is rounded to whole euros
- **WHEN** the rental income after costs is 123500 cents
- **THEN** the estimate is 371 € (30 % is 370,50 €, rounded half up)

#### Scenario: No estimate for another owner
- **WHEN** Annika has chosen Mikko Virtanen on 2025
- **THEN** the card shows his rental income after costs and no estimate, saying that he may have other capital income

#### Scenario: No estimate for the whole flats
- **WHEN** Annika has chosen the whole flats on 2025
- **THEN** the card shows the whole flats' rental income after costs and no estimate, saying that the tax is counted for each owner separately

#### Scenario: A former owner's flat in the estimate
- **WHEN** Jussi, a former owner of `Kuusikuja 3 B 12` whose 5000 basis points ended on `2025-06-30`, owns `Hallilantie 12 B 8` alone, and opens his 2025 summary
- **THEN** the rental income after costs and the estimate include both flats' cards

### Requirement: A rental loss in the estimate
When the own share's rental income after costs is below 0, the card SHALL show it as a negative amount, show no tax, and say that the loss is deducted from other capital income and that a deficit can reduce the tax on earned income, as the Tax Administration computes (CONCEPT.md §4.5). The deficit credit SHALL NOT be computed. A rental income after costs of exactly 0 SHALL give an estimate of 0 €.

#### Scenario: A loss in the year
- **WHEN** Annika's only flat in 2025 has row 2.1 of 178000 cents and rows 2.2–2.5 summing to 302000 cents
- **THEN** the card shows the rental income after costs `−1 240,00 €`, no estimated tax, and the note on deducting the loss

#### Scenario: No income after costs
- **WHEN** row 2.1 equals the sum of rows 2.2–2.5
- **THEN** the estimate is 0 €

### Requirement: Finnish originals of tax terms
In Swedish and English, the form 7H page and the PDF SHALL show the Finnish wording after these labels, in brackets:
- the row names 2.1–2.5
- the parts that are a maintenance charge, a financing charge or an annual repair
- the Not on form 7H card's titles
- the tenant's personal identity code label
- the estimate's title

Each of these labels uses a tax term of the term bank marked to show its original (`showOriginal` in `i18n/terms.json`). The Finnish wording SHALL be the label's Finnish text, starting in lower case. A bracket inside it SHALL become a comma, so that "Rahoitusvastikkeet (rahastoitu)" is shown as "(rahoitusvastikkeet, rahastoitu)". In Finnish nothing SHALL be added. Usage charge parts SHALL get no original, since they already carry a bracket and row 2.2's name has the term. Copying a value SHALL be unchanged.

#### Scenario: A row name in Swedish
- **WHEN** Annika's language is Swedish and she opens the form 7H page of `Kuusikuja 3 B 12`
- **THEN** row 2.2 is named "Skötselvederlag och vattenavgifter (hoitovastikkeet ja vesimaksut)", and its maintenance charge part "Skötselvederlag (hoitovastike)"

#### Scenario: A row name in English
- **WHEN** Annika's language is English and she opens the form 7H page
- **THEN** row 2.1 is named "Gross rental income (bruttovuokratulot)"

#### Scenario: No originals in Finnish
- **WHEN** Annika's language is Finnish
- **THEN** row 2.2 is named "Hoitovastikkeet ja vesimaksut", with no bracket

#### Scenario: A title with a bracket
- **WHEN** the Not on form 7H card shows capitalised financing charges in English
- **THEN** its title is "Financing charges (placed in reserve) (rahoitusvastikkeet, rahastoitu)"

#### Scenario: Originals in the PDF
- **WHEN** Annika's language is English and she makes the PDF of 2025
- **THEN** the flat's page names row 2.1 "Gross rental income (bruttovuokratulot)"

## MODIFIED Requirements

### Requirement: The form 7H page of a flat
Everyone with access to a flat, and its former owners for their own share ("A former owner's year summary"), SHALL be able to open its form 7H page `/year-summary/$propertyId?year=…` from the year summary, for the own share, for another owner (`&person=<user id>`, "Another owner's figures") or for the whole flat (`&person=whole`, "The whole flat's page"). For the own share and another owner, the page SHALL show:
- the flat's address and the year, and whose share it is
- the checks of the flat ("Checks in the year summary")
- the flat details form 7H asks for ("Flat details for form 7H"), with that person's share
- rows 2.1–2.5 of that person's share ("Form 7H rows of the own share"), each with its number, the row name used on form 7H, its parts and its amount
- under row 2.3, when it is above 0, a note that deducting income-recognised capital charges has not always been accepted in case law (CONCEPT.md §4.3)
- under row 2.5, the flat's rental income after costs, not a form 7H value ("Rental income after costs")
- the Not on form 7H card ("The Not on form 7H card")
- a note that the figures are counted by payment date with the share on each date, and that they should be checked before filing

Each form 7H value SHALL have a copy button ("Copying form 7H values"). Back SHALL return to the year summary of the same year and the same choice of person. The page SHALL NOT show the bottom bar. A user without access to the flat who never had a share above 0 % in it SHALL see that the flat was not found. When the person had no share that year, the page SHALL say so and show no rows.

#### Scenario: The rows of a flat
- **WHEN** Annika owns 10000 basis points of `Kuusikuja 3 B 12` from `2026-01-01`, the rent of 89000 cents is paid on `2026-02-03`, the maintenance charge is 20000 cents a month from `2026-01-01`, and she opens its form 7H page for the current year
- **THEN** row 2.1 shows `890,00 €` and row 2.2 the maintenance charges of the months so far, and Back returns to `/year-summary` with the same year

#### Scenario: The case law note under row 2.3
- **WHEN** the flat's financing charge is income-recognised, and row 2.3 is above 0
- **THEN** the page shows the note on case law under row 2.3

#### Scenario: A flat the user can't see
- **WHEN** Jussi opens the form 7H page of a flat he has no access to
- **THEN** he sees that the flat was not found

#### Scenario: A flat without a share that year
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12` without a share, opens its form 7H page for his own share
- **THEN** he sees that he had no ownership share in the flat that year, and no rows

### Requirement: The PDF's cover page
The PDF's first page SHALL show:
- the Kotivalo logo and the day the PDF was made
- the heading "Vuosiyhteenveto <year>", form 7H, and whose figures they are: the own share with the user's name, another owner with their name, or the whole flats at 100 %
- the period the figures cover: 1 January to 31 December, or to today in the current year
- a table with a row per flat in the summary, in address order: the address, the housing company's name or that it is missing, the number of checks when there are any, the holder's share (every share of the year with a dash when it changed, e.g. `50 % – 100 %` or `50 % – 100 % – 50 %`), row 2.1, rows 2.2–2.5 summed, and the page number of the flat's page
- under the table, the rental income after costs of all the flats ("Rental income after costs"). For the own share it SHALL also show the capital income tax estimate, or the loss without a tax ("The capital income tax estimate", "A rental loss in the estimate"). Either way it SHALL carry a short note: an estimate of these flats only, without loan interest or other capital income, and 34 % above 30 000 €.
- the "Not included" note of the year summary page, when it names flats, and what the figures leave out ("The year summary page")
- how the figures are dated (rent payments by payment date, other entries by their date and charges by month, each at the share on that day), and that the summary is not a tax return: the figures are checked and reported on MyTax

Every page SHALL have a footer with the app, the year, the holder and "page n/m".

**No Playwright test:** a browser test can only see that a PDF was downloaded; the pages' content is checked from the PDF's document model in Vitest.

#### Scenario: The cover page of the own share
- **WHEN** Annika, named `Annika Kotivalo`, owns 5000 basis points of `Kuusikuja 3 B 12` and `Rantatie 15 C 21` in 2025, with row 2.1 of 489500 and 381600 cents, and makes the PDF of 2025 on `2026-11-27`
- **THEN** the cover says "Vuosiyhteenveto 2025", her own share and `Annika Kotivalo`, the period `1.1.–31.12.2025` and `27.11.2026`, and lists `Kuusikuja 3 B 12` on page 2 and `Rantatie 15 C 21` on page 3 with `50 %`, `4 895,00 €` and `3 816,00 €`, and the footer says "Sivu 1/3"

#### Scenario: A share change on the cover
- **WHEN** Annika's share of `Koivupolku 7 A 4` changes from 5000 to 10000 basis points on `2025-07-01`
- **THEN** its share on the cover is `50 % – 100 %`

#### Scenario: Flats not included on the cover
- **WHEN** Annika also sees `Hallilantie 12 B 8` with a 0 % share all of 2025
- **THEN** the cover names `Hallilantie 12 B 8` as not included, and the PDF has no page for it

#### Scenario: The estimate on the own share's cover
- **WHEN** Annika's rental income after costs in 2025 is 420800 cents, and she makes the PDF of her own share
- **THEN** the cover shows `4 208,00 €` and the estimated tax `n. 1 262 €` with the short note

#### Scenario: No estimate on another owner's cover
- **WHEN** Annika makes the PDF of Mikko Virtanen's figures of 2025
- **THEN** the cover shows his rental income after costs and no estimated tax

### Requirement: A flat's page in the PDF
For the own share and another owner, the PDF SHALL have a page for each flat in the summary, in the cover's order, showing:
- the flat's address, the year and whose share it is
- the flat details form 7H asks for ("Flat details for form 7H"), with a missing value shown as missing, and the personal identity code row saying it is filled in on MyTax
- every tenancy that ran in the year, on days up to today in the current year, each with the tenant's name and its period within the year, in start order; or that there was no tenancy in the year
- the ownership share
- rows 2.1–2.5 with their numbers, names, parts and amounts, and under row 2.3, when it is above 0, the note on case law
- under row 2.5, the flat's rental income after costs, marked as not a form 7H value ("Rental income after costs")
- the checks with their explanations ("Checks in the year summary"), the share change with a dash in place of the arrow
- the Not on form 7H card, when it has amounts ("The Not on form 7H card")

A flat's page that does not fit on one sheet SHALL continue on the next, with the address repeated.

**No Playwright test:** a browser test can only see that a PDF was downloaded; the pages' content is checked from the PDF's document model in Vitest.

#### Scenario: Every tenancy of the year
- **WHEN** Aino Koski's tenancy of `Kuusikuja 3 B 12` runs from `2024-03-15` to `2025-08-31`, and Pekka Laine's from `2025-10-01` on, and Annika makes the PDF of 2025
- **THEN** the flat's page lists `Aino Koski` `1.1.–31.8.2025` and `Pekka Laine` `1.10.–31.12.2025`

#### Scenario: A tenancy starting after today is not listed
- **WHEN** today is `2026-11-27`, and a tenancy starts on `2026-12-01`
- **THEN** the PDF of 2026 does not list it

#### Scenario: The rows and checks of a flat
- **WHEN** Annika owns 5000 basis points of `Kuusikuja 3 B 12` in 2025, row 2.2 is the maintenance charge 117700 cents and the water charge 24200 cents, and December 2025 has no rent payment
- **THEN** the flat's page shows row 2.2 `1 419,00 €` with both parts, and the check that the rent of December 2025 is not recorded

#### Scenario: The rental income after costs on a flat's page
- **WHEN** the flat's row 2.1 is 489500 cents and rows 2.2–2.5 sum to 225500 cents
- **THEN** the flat's page shows `2 640,00 €` under row 2.5, marked as not on form 7H
