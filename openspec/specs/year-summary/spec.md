# year-summary Specification

## Purpose
The form 7H figures of the user's own share, flat by flat and year by year: the year summary page, a flat's form 7H page with its details, rows, what is not on form 7H and the checks, and copying the values into MyTax. Computed from the payments, entries and periods, never stored.
## Requirements
### Requirement: The year summary page
A signed-in user SHALL be able to open the year summary page `/year-summary` from Taxes in the bottom bar. It SHALL show one year at a time, chosen with previous and next year buttons ("The year the summary opens on"), with the year in the URL (`?year=2025`). Only the user's own share is shown. The page SHALL show a card for each flat in the summary ("Flats in the year summary"), in address order. Each card SHALL show the address, the housing company's name and Business ID or that they are missing, the user's share, row 2.1 and the sum of rows 2.2–2.5 ("Form 7H rows of the own share"), and a chip for each check ("Checks in the year summary"). Selecting a card SHALL open the flat's form 7H page for the same year. Flats the user can see but which are not in the summary SHALL be named in a "Not included" note, with the reason that the user had no share in them that year. The note SHALL also say that loan interest is not on form 7H and that improvements are not counted yet. For the current year the heading SHALL name the months counted so far, e.g. "tammi–marras". When no flat is in the summary, the page SHALL say that the user had no ownership share in any flat that year.

#### Scenario: The cards of the flats owned in the year
- **WHEN** Annika owns 5000 basis points of `Kuusikuja 3 B 12` and `Rantatie 15 C 21`, and opens Taxes and the year 2025
- **THEN** the page shows a card for each flat with its row 2.1 and the sum of rows 2.2–2.5 of her share, and selecting `Kuusikuja 3 B 12` opens `/year-summary/<its id>?year=2025`

#### Scenario: A flat without a share is named, not summarised
- **WHEN** Annika also sees `Hallilantie 12 B 8` with a share of 0 basis points all of 2025
- **THEN** the page has no card for `Hallilantie 12 B 8`, and the "Not included" note names it

#### Scenario: No share in any flat
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12` without a share, opens Taxes
- **THEN** the page says he had no ownership share in any flat that year and shows no cards

#### Scenario: Moving to the previous year
- **WHEN** Annika has owned `Kuusikuja 3 B 12` since `2024-05-01`, and selects the previous year on 2025
- **THEN** the page shows 2024 with the card of `Kuusikuja 3 B 12`, and the URL has `?year=2024`

### Requirement: The year the summary opens on
Without a year in the URL, the year summary SHALL open on the previous year from January to June and on the current year from July to December, in Finland's time. The years SHALL range from the first year in which the user had a share above 0 in a flat they have access to, up to the current year. Before the first of them the previous year button SHALL be disabled, and on the current year the next year button. When the year it would open on is before the first year, the summary SHALL open on the first year. A year outside the range in the URL SHALL open the nearest year in the range.

**No Playwright test:** the opening year depends on today's date, which a browser test can't set for the server; Vitest covers it with a fixed today.

#### Scenario: In spring the previous year opens
- **WHEN** today is `2026-03-15`, and Annika has owned a flat since `2024-05-01`
- **THEN** the summary opens on 2025, with the years 2024 to 2026

#### Scenario: From July the current year opens
- **WHEN** today is `2026-07-01`
- **THEN** the summary opens on 2026

#### Scenario: A first share this year
- **WHEN** today is `2026-03-15`, and Annika's first share starts on `2026-02-01`
- **THEN** the summary opens on 2026, with 2026 as the only year

### Requirement: Flats in the year summary
A year's summary SHALL include each flat the user has access to and in which the user had a share above 0 basis points on at least one day of the year, up to today in the current year. Flats the user has archived count too. A flat in which the user's share was 0 or which they did not own all year SHALL NOT be included. A flat the user no longer owns but still has access to SHALL be included for the years of their share, counting only their own ownership period ("Shares on the cash basis").

**No Playwright test:** the archived and mid-year ownership cases need ownership periods in the past; the page's Playwright test covers a flat included and one left out, and Vitest covers the rules.

#### Scenario: An archived flat is included
- **WHEN** Annika has archived `Koivupolku 7 A 4`, in which she owned 5000 basis points in 2025
- **THEN** the 2025 summary includes `Koivupolku 7 A 4`

#### Scenario: A share starting during the year
- **WHEN** Annika's share of `Rantatie 15 C 21` starts on `2025-10-01`
- **THEN** the 2025 summary includes `Rantatie 15 C 21`, and the 2024 summary does not

#### Scenario: A share ended during the year
- **WHEN** Annika's share of `Kuusikuja 3 B 12` was 5000 basis points until `2025-06-30` and 0 from `2025-07-01`, and she still has access
- **THEN** the 2025 summary includes `Kuusikuja 3 B 12`, and the 2026 summary does not

### Requirement: Form 7H rows of the own share
For each flat in the summary and each year, the year summary SHALL compute the rows of form 7H for the user's share, each from its parts. All of them are computed from the stored payments, entries and periods, never stored:
- **2.1** (*Bruttovuokratulot*): rent payments by payment date in the year, the tenant fees included, whatever month they are for; and income entries (tenant's water charge, other income) dated in the year
- **2.2** (*Hoitovastikkeet ja vesimaksut*): the maintenance charges of the year's months, the water usage charges, and water charge entries
- **2.3** (*Tuloutetut pääomavastikkeet*): the financing charges of the months whose treatment on the month's first day is income-recognised
- **2.4** (*Vuosikorjaukset*): annual repair entries
- **2.5** (*Muut kulut*): insurance and other expense entries, and the parking, sauna and other usage charges

A charge or usage charge month SHALL be counted in the year of the month, for the months up to the current one. Each part SHALL be the sum of its amounts at the user's share, rounded to the cent once, half up ("Shares on the cash basis"). A row is the sum of its parts. Rent computed from the rent periods SHALL NOT be used. Improvement entries and capitalised financing charges SHALL NOT be in any row ("The Not on form 7H card").

**No Playwright test:** a pure calculation over many periods and dates; the form 7H page's Playwright test shows rows computed by it.

#### Scenario: Rent counts in the year it was paid
- **WHEN** Annika owns 10000 basis points, the rent is 89000 cents, and the payments for January to November 2025 are made in their own months, and December 2025's on `2026-01-02`
- **THEN** row 2.1 of 2025 is 979000 cents, and December's payment is in row 2.1 of 2026

#### Scenario: Income entries add to the rent
- **WHEN** Annika owns 10000 basis points, the year's rent payments are 979000 cents, and an other income entry of 12000 cents is dated `2025-05-10`
- **THEN** row 2.1 is 991000 cents, with the parts rent payments 979000 and other income 12000

#### Scenario: Maintenance charges and water in row 2.2
- **WHEN** Annika owns 5000 basis points all of 2025, the maintenance charge is 19617 cents a month from `2024-01-01`, a water usage charge per occupant 2017 cents with one occupant, and a water charge entry of 3600 cents dated `2025-06-15`
- **THEN** row 2.2 of 2025 is 131604 cents: maintenance charges 117702, water usage charges 12102 and water charge entries 1800

#### Scenario: An income-recognised financing charge in row 2.3
- **WHEN** Annika owns 5000 basis points, the financing charge `Putkiremontti` is 6050 cents a month all of 2025, and the treatment is income-recognised from `2025-01-01`
- **THEN** row 2.3 of 2025 is 36300 cents

#### Scenario: A treatment change during the year
- **WHEN** the same financing charge's treatment is capitalised until `2025-06-30` and income-recognised from `2025-07-01`
- **THEN** row 2.3 of 2025 is 18150 cents, and the capitalised financing charges are 18150 cents

#### Scenario: Entries in rows 2.4 and 2.5
- **WHEN** Annika owns 5000 basis points, and the year has an annual repair of 134200 cents, an insurance of 18600 cents and a parking usage charge of 1200 cents a month all year
- **THEN** row 2.4 is 67100 cents and row 2.5 is 16500 cents: insurance 9300 and parking 7200

#### Scenario: The current year counts the months so far
- **WHEN** today is `2026-11-25`, and the maintenance charge is 20000 cents a month all of 2026 with Annika's share 10000 basis points
- **THEN** row 2.2 of 2026 is 220000 cents, for January to November

### Requirement: Shares on the cash basis
The year summary SHALL count a rent payment at the user's share on its payment date, an entry at the share on its date, and a charge or usage charge month at the share on the month's first day. On days without a share the amount counts as 0 for the user. A part SHALL be rounded once, from the exact sum of amount × share basis points ÷ 10000 of its amounts, half up.

**No Playwright test:** needs ownership changes in the past; the calculation is covered by Vitest.

#### Scenario: A share change during the year
- **WHEN** Annika owns 5000 basis points of `Koivupolku 7 A 4` until `2025-06-30` and 10000 from `2025-07-01`, the rent of 75000 cents is paid on the 3rd of every month, and the maintenance charge is 15400 cents a month
- **THEN** row 2.1 of 2025 is 675000 cents and the maintenance charges part 138600 cents

#### Scenario: A charge month follows its first day
- **WHEN** Annika's share changes from 5000 to 10000 basis points on `2025-07-15`, and the maintenance charge is 15400 cents a month
- **THEN** July's maintenance charge counts at 5000 basis points, 7700 cents, and August's at 10000, 15400 cents

#### Scenario: Rounding a part once
- **WHEN** Annika owns 3333 basis points, and three rent payments of 89000 cents are made in 2025
- **THEN** the rent payments part is 88991 cents (267000 × 3333 ÷ 10000 = 88991.1), not three times 29664

### Requirement: The form 7H page of a flat
Everyone with a share in a flat in the year SHALL be able to open its form 7H page `/year-summary/$propertyId?year=…` from the year summary. The page SHALL show:
- the flat's address and the year
- the checks of the flat ("Checks in the year summary")
- the flat details form 7H asks for ("Flat details for form 7H")
- rows 2.1–2.5 of the user's share ("Form 7H rows of the own share"), each with its number, the row name used on form 7H, its parts and its amount
- under row 2.3, when it is above 0, a note that deducting income-recognised capital charges has not always been accepted in case law (CONCEPT.md §4.3)
- the Not on form 7H card ("The Not on form 7H card")
- a note that the figures are counted by payment date with the share on each date, that they should be checked before filing, and that deposits are not counted yet

Each value SHALL have a copy button ("Copying form 7H values"). Back SHALL return to the year summary of the same year. The page SHALL NOT show the bottom bar. A user without access to the flat SHALL see that the flat was not found. A user with access but no share that year SHALL see that they had no share in the flat that year.

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
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12` without a share, opens its form 7H page
- **THEN** he sees that he had no ownership share in the flat that year, and no rows

### Requirement: Flat details for form 7H
The form 7H page SHALL show the flat details form 7H asks for:
- the housing company's name, Business ID and apartment number as stored on the flat. Each missing one SHALL be shown as missing, with an Add button that opens the flat's edit form.
- the tenant: the name of the tenant whose tenancy ran in the year, on days up to today in the current year; "Several" when more than one tenancy ran; nothing, with a note, when none ran
- a row for the tenant's personal identity code, saying it is not stored in Kotivalo and is filled in on MyTax
- the tenancy period: from the later of the tenancy's start and 1 January to the earlier of its last day and 31 December; the whole year when more than one tenancy ran
- the ownership share: the user's share on the last day of their ownership in the year (31 December, the day before their share ended, or today in the current year)

#### Scenario: Missing housing company details
- **WHEN** `Koivupolku 7 A 4` has no housing company name, Business ID or apartment number, and Annika opens its form 7H page
- **THEN** the three rows show that they are missing, each with Add, and Add opens the flat's edit form

#### Scenario: One tenancy for part of the year
- **WHEN** `Mikko Laine`'s tenancy runs from `2025-01-01` to `2025-09-30`
- **THEN** the tenant is `Mikko Laine` and the tenancy period `1.1.–30.9.2025`

#### Scenario: Several tenancies in the year
- **WHEN** one tenancy ends on `2025-05-31` and the next starts on `2025-06-15`
- **THEN** the tenant is "Several" and the tenancy period `1.1.–31.12.2025`

#### Scenario: The share at the end of the year
- **WHEN** Annika's share is 5000 basis points until `2025-06-30` and 10000 from `2025-07-01`
- **THEN** the ownership share is `100 %`

#### Scenario: The share at the end of the user's period
- **WHEN** Annika's share is 5000 basis points until `2025-06-30` and 0 from `2025-07-01`
- **THEN** the ownership share is `50 %`

### Requirement: The Not on form 7H card
The form 7H page SHALL show, apart from the rows, a card of amounts not reported on form 7H, each at the user's share for the year:
- the capitalised financing charges: the financing charges of the months whose treatment is capitalised, added to the acquisition cost
- the improvement entries dated in the year, with a note that they are not deducted yet (#120)

An amount of 0 SHALL be left out, and the card SHALL be left out when both are 0.

**No Playwright test:** a capitalised treatment and improvements in the past need data a browser test would set up through many forms; the amounts are covered by Vitest, and the form 7H page's Playwright test checks that the card is left out without them.

#### Scenario: Capitalised financing charges
- **WHEN** Annika owns 5000 basis points, and the financing charge of 7883 cents a month is capitalised all of 2025
- **THEN** the card shows the capitalised financing charges 47298 cents, and row 2.3 is 0

#### Scenario: An improvement is shown, not counted
- **WHEN** an improvement entry of 120000 cents is dated `2025-04-02`, and Annika owns 5000 basis points
- **THEN** the card shows improvements 60000 cents, and no row includes it

### Requirement: Checks in the year summary
The year summary SHALL show what needs checking, without changing any figure:
- **Months not fully paid:** months of the year up to the current one, in the user's ownership, whose rent status is late or partly paid (rent-payments, "The rent status of a month"), named with the month, and partly paid with the amount missing. It opens the rent payments page of the year.
- **Vacant months:** whole calendar months of the year up to the current one in which no tenancy ran on any day, while the user had a share and the month had charges or usage charges. It says that their charges are deducted, but only if the flat was offered for rent.
- **Missing housing company details:** any of the housing company's name, Business ID or apartment number missing.
- **Treatment not set:** months with a financing charge above 0 but no treatment. Their financing charges are left out of row 2.3 and of the capitalised sum, and the check opens the charge amounts page.
- **Share changed:** the user's share changed during the year, with the date and the shares before and after. A share that starts during the year changes from 0 %, and one that ends changes to 0 %.

On the year summary page each check SHALL be a chip on the flat's card; on the form 7H page each SHALL be listed with its explanation.

#### Scenario: A month not paid
- **WHEN** Annika's tenant's rent is 89000 cents due on the 5th, and December 2025 has no payment
- **THEN** the 2025 summary card shows a chip for one month not paid, and the form 7H page names December 2025 and opens the rent payments page

#### Scenario: A partly paid month
- **WHEN** November 2025 has a payment of 50000 cents of 89000
- **THEN** the form 7H page names November 2025 as partly paid with `390,00 €` missing

#### Scenario: Vacant months with charges
- **WHEN** the only tenancy of `Rantatie 15 C 21` ended on `2025-09-30`, and the maintenance charge is 24458 cents a month all year
- **THEN** the check names October to December 2025 as vacant, and their maintenance charges are in row 2.2

#### Scenario: A financing charge without a treatment
- **WHEN** the financing charge is 6050 cents a month all of 2025, and no treatment is set
- **THEN** the check says the treatment is not set for 12 months, row 2.3 is 0, and the card of capitalised financing charges is not shown

#### Scenario: A share change
- **WHEN** Annika's share changes from 5000 to 10000 basis points on `2025-07-01`
- **THEN** the check says her share changed on `1.7.2025` from `50 %` to `100 %`

#### Scenario: A share bought during the year
- **WHEN** Annika's first share of `Rantatie 15 C 21`, 5000 basis points, starts on `2025-10-01`
- **THEN** the check says her share changed on `1.10.2025` from `0 %` to `50 %`

### Requirement: Copying form 7H values
Each value on the form 7H page SHALL have its own copy button, labelled for screen readers with what it copies. It copies the value to the clipboard and shows "Kopioitu: <value>". Amounts SHALL be copied as digits with a decimal comma and two decimals, without spaces, thousand separators or €, in every language (`489500` cents → `4895,00`). The share SHALL be copied as a percentage without the sign, with a decimal comma only when needed (`5000` → `50`, `3333` → `33,33`). Text values are copied as shown. A missing value and the personal identity code row SHALL have no copy button.

#### Scenario: Copying an amount
- **WHEN** Annika selects the copy button of row 2.1, which is `4 895,00 €`
- **THEN** the clipboard holds `4895,00`, and the page shows "Kopioitu: 4895,00"

#### Scenario: Amounts and shares in the copy format
- **WHEN** the values are 30250 cents, 0 cents, 5000 basis points and 3333 basis points
- **THEN** they are copied as `302,50`, `0,00`, `50` and `33,33`

