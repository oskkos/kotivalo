## ADDED Requirements

### Requirement: Downloading the year summary as a PDF
The year summary page SHALL have a *Lataa PDF* button under the intro card whenever the year has at least one flat in the summary. Selecting it SHALL build one PDF of the shown year for the chosen holder, the own share, another owner or the whole flats ("Choosing whose figures"), in the browser, and download it. While the PDF is being built, the button SHALL say so and be disabled. Once the file is downloaded, the page SHALL show a notice with the file name. When building it fails, the page SHALL say that the PDF could not be made and the button SHALL work again.

The file name SHALL be `<app>-<year summary>-<year>` in the user's language, followed by the holder for another owner (their name in lower case, letters and digits only, words joined by hyphens) or for the whole flats, and `.pdf`. In Finnish: `kotivalo-vuosiyhteenveto-2025.pdf`, `kotivalo-vuosiyhteenveto-2025-mikko-virtanen.pdf` and `kotivalo-vuosiyhteenveto-2025-koko-asunnot.pdf`.

The PDF's figures SHALL be the same as the year summary's and the form 7H pages' for that year and holder. The PDF SHALL be made in the user's language with the app's formats ("Formatting" in CLAUDE.md).

#### Scenario: Downloading the own share's PDF
- **WHEN** Annika owns 10000 basis points of `Kuusikuja 3 B 12` all of 2025, her language is Finnish, and she selects *Lataa PDF* on the 2025 summary
- **THEN** a file `kotivalo-vuosiyhteenveto-2025.pdf` is downloaded, it is a PDF, and the page shows that it was downloaded

#### Scenario: The PDF follows the chosen holder
- **WHEN** Annika has chosen Mikko Virtanen on 2025 and selects *Lataa PDF*
- **THEN** the file is `kotivalo-vuosiyhteenveto-2025-mikko-virtanen.pdf`, and its figures are Mikko's

#### Scenario: No PDF without flats in the summary
- **WHEN** Jussi, a member without a share, opens the summary of 2025 for his own share
- **THEN** the page has no *Lataa PDF* button

#### Scenario: Building the PDF fails
- **WHEN** the PDF library can't be loaded
- **THEN** the page says that the PDF could not be made, and *Lataa PDF* can be selected again

### Requirement: The PDF's cover page
The PDF's first page SHALL show:
- the Kotivalo logo and the day the PDF was made
- the heading "Vuosiyhteenveto <year>", form 7H, and whose figures they are: the own share with the user's name, another owner with their name, or the whole flats at 100 %
- the period the figures cover: 1 January to 31 December, or to today in the current year
- a table with a row per flat in the summary, in address order: the address, the housing company's name or that it is missing, the number of checks when there are any, the holder's share (both shares with a dash when it changed during the year, e.g. `50 % – 100 %`), row 2.1, rows 2.2–2.5 summed, and the page number of the flat's page
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

### Requirement: A flat's page in the PDF
For the own share and another owner, the PDF SHALL have a page for each flat in the summary, in the cover's order, showing:
- the flat's address, the year and whose share it is
- the flat details form 7H asks for ("Flat details for form 7H"), with a missing value shown as missing, and the personal identity code row saying it is filled in on MyTax
- every tenancy that ran in the year, on days up to today in the current year, each with the tenant's name and its period within the year, in start order; or that there was no tenancy in the year
- the ownership share
- rows 2.1–2.5 with their numbers, names, parts and amounts, and under row 2.3, when it is above 0, the note on case law
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

### Requirement: The whole flats' PDF
With the whole flats chosen, the PDF SHALL show the whole flats at 100 % for checking ("The whole flats"):
- every page SHALL carry a band saying that the figures are for checking and are not reported as such, because each owner reports their own share on form 7H
- the cover's table SHALL show each flat's owners with their shares at the end of the year or of their period, in place of a share
- each flat's page SHALL show the owners with their shares and row 2.1, rows 2.1–2.5 at 100 % with their parts, the checks without the share change, and the Not on form 7H card
- the flat details form 7H asks for SHALL NOT be shown

**No Playwright test:** a browser test can only see that a PDF was downloaded; the pages' content is checked from the PDF's document model in Vitest.

#### Scenario: The whole flats' cover
- **WHEN** Annika and Mikko Virtanen own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, and Annika makes the whole flats' PDF of 2025
- **THEN** the cover says "Koko asunnot (100 %)", lists `Kuusikuja 3 B 12` with `Annika Kotivalo 50 % · Mikko Virtanen 50 %`, and every page has the band

#### Scenario: The whole flat's page
- **WHEN** the rent payments of `Kuusikuja 3 B 12` are 979000 cents in 2025
- **THEN** its page shows row 2.1 `9 790,00 €`, the owners with `4 895,00 €` each, and no flat details

### Requirement: Text the PDF font can't show
The PDF SHALL use a standard PDF font. Text it can't show SHALL be replaced before it is written, so no character is lost or garbled:
- the arrow `→` with a dash `–`
- a letter with a diacritic outside the font with the same letter without it (`Łukasz Wiśniewski` → `Lukasz Wisniewski`)
- any other character outside the font with `?`

Finnish, Swedish and English letters, `€`, `–`, `·` and `§` SHALL be kept as they are. Every message the PDF uses SHALL be checked in all three languages to need no replacement.

**No Playwright test:** the replacement is a pure function over text, covered by Vitest.

#### Scenario: Names outside the font
- **WHEN** the tenant is `Łukasz Wiśniewski`
- **THEN** the PDF shows `Lukasz Wisniewski`

#### Scenario: Finnish and Swedish letters are kept
- **WHEN** the address is `Åkerögatan 4 Ä`, and an amount is `1 234,56 €`
- **THEN** the PDF shows them unchanged

#### Scenario: The PDF's messages need no replacement
- **WHEN** every message the PDF uses is rendered in Finnish, Swedish and English
- **THEN** none of them has a character the font can't show
