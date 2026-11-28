# year-summary Specification

## Purpose
The form 7H figures of the user's own share, flat by flat and year by year: the year summary page, a flat's form 7H page with its details, rows, what is not on form 7H and the checks, and copying the values into MyTax. Computed from the payments, entries and periods, never stored.
## Requirements
### Requirement: The year summary page
A signed-in user SHALL be able to open the year summary page `/year-summary` from Taxes in the bottom bar. It SHALL show one year at a time, chosen with previous and next year buttons ("The year the summary opens on"), with the year in the URL (`?year=2025`). It SHALL show the user's own share unless another person or the whole flats are chosen ("Choosing whose figures"). For the own share, the page SHALL show a card for each flat in the summary ("Flats in the year summary"), in address order. Each card SHALL show the address, the housing company's name and Business ID or that they are missing, the user's share, row 2.1 and the sum of rows 2.2–2.5 ("Form 7H rows of the own share"), and a chip for each check ("Checks in the year summary"). Selecting a card SHALL open the flat's form 7H page for the same year. Flats the user can see but which are not in the summary SHALL be named in a "Not included" note, with the reason that the user had no share in them that year. The note SHALL also say that loan interest is not on form 7H and that improvements are not counted yet. For the current year the heading SHALL name the months counted so far, e.g. "tammi–marras". When no flat is in the summary, the page SHALL say that the user had no ownership share in any flat that year, and still offer the selector when the year has owners to choose.

#### Scenario: The cards of the flats owned in the year
- **WHEN** Annika owns 5000 basis points of `Kuusikuja 3 B 12` and `Rantatie 15 C 21`, and opens Taxes and the year 2025
- **THEN** the page shows a card for each flat with its row 2.1 and the sum of rows 2.2–2.5 of her share, and selecting `Kuusikuja 3 B 12` opens `/year-summary/<its id>?year=2025`

#### Scenario: A flat without a share is named, not summarised
- **WHEN** Annika also sees `Hallilantie 12 B 8` with a share of 0 basis points all of 2025
- **THEN** the page has no card for `Hallilantie 12 B 8`, and the "Not included" note names it

#### Scenario: No share in any flat
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12` without a share, opens Taxes for 2025, and Annika owned all of it that year
- **THEN** the page says he had no ownership share in any flat that year, shows no cards, and offers the selector with Annika and the whole flats

#### Scenario: Moving to the previous year
- **WHEN** Annika has owned `Kuusikuja 3 B 12` since `2024-05-01`, and selects the previous year on 2025
- **THEN** the page shows 2024 with the card of `Kuusikuja 3 B 12`, and the URL has `?year=2024`

### Requirement: The year the summary opens on
Without a year in the URL, the year summary SHALL open on the previous year from January to June and on the current year from July to December, in Finland's time. The years SHALL range from the first year in which the chosen holder had a share above 0 in a flat the user has access to, up to the current year: the user for the own share, the chosen person for another owner, and any owner for the whole flats. When the own share has no years, the years SHALL be those of the whole flats, so a member without a share can still move between years. Before the first of them the previous year button SHALL be disabled, and on the current year the next year button. When the year it would open on is before the first year, the summary SHALL open on the first year. A year outside the range in the URL SHALL open the nearest year in the range.

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

#### Scenario: The years of another owner
- **WHEN** today is `2026-03-15`, Annika has owned `Kuusikuja 3 B 12` since `2022-06-12`, and Mikko's 5000 basis points of it start on `2025-03-01`
- **THEN** Mikko's figures have the years 2025 to 2026, and the whole flats the years 2022 to 2026

#### Scenario: A member without a share moves between years
- **WHEN** today is `2026-03-15`, and Jussi, a member without a share, sees `Kuusikuja 3 B 12`, owned by Annika since `2022-06-12`
- **THEN** his own share opens on 2025, with the years 2022 to 2026

### Requirement: Flats in the year summary
A year's summary SHALL include each flat the user has access to, or formerly owned ("A former owner's year summary"), and in which the user had a share above 0 basis points on at least one day of the year, up to today in the current year. Flats the user has archived count too. A flat in which the user's share was 0 or which they did not own all year SHALL NOT be included. A flat the user no longer owns but still has access to SHALL be included for the years of their share, counting only their own ownership period ("Shares on the cash basis").

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
For each flat in the summary and each year, the year summary SHALL compute the rows of form 7H for the user's share, each from its parts. All of them are computed from the stored payments, entries, periods and deposit returns, never stored:
- **2.1** (*Bruttovuokratulot*): rent payments by payment date in the year, the tenant fees and the rent kept from a deposit ("Rent kept from the deposit") included, whatever month they are for; and income entries (tenant's water charge, other income) dated in the year
- **2.2** (*Hoitovastikkeet ja vesimaksut*): the maintenance charges of the year's months, the water usage charges, and water charge entries
- **2.3** (*Tuloutetut pääomavastikkeet*): the financing charges of the months whose treatment on the month's first day is income-recognised
- **2.4** (*Vuosikorjaukset*): annual repair entries, less the damage compensation kept from deposits returned in the year (*Vakuudesta korvatut vahingot*), a negative part of at most the annual repairs part, so the row is never below 0
- **2.5** (*Muut kulut*): insurance and other expense entries, and the parking, sauna and other usage charges

A charge or usage charge month SHALL be counted in the year of the month, for the months up to the current one. Each part SHALL be the sum of its amounts at the user's share, rounded to the cent once, half up ("Shares on the cash basis"); the damage compensation part SHALL be capped after rounding. A row is the sum of its parts. Rent computed from the rent periods SHALL NOT be used. Improvement entries and capitalised financing charges SHALL NOT be in any row ("The Not on form 7H card").

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

#### Scenario: Damage kept from a deposit lowers row 2.4
- **WHEN** Annika owns 5000 basis points, an annual repair of 60000 cents is dated `2027-01-20`, and a deposit return on `2027-01-15` keeps 20000 cents for damage
- **THEN** row 2.4 of 2027 is 20000 cents: annual repairs 30000 and damage compensation −10000

#### Scenario: Damage compensation over the repairs leaves row 2.4 at 0
- **WHEN** Annika owns 10000 basis points, an annual repair of 15000 cents is dated in 2027, and a return in 2027 keeps 20000 cents for damage
- **THEN** row 2.4 of 2027 is 0: annual repairs 15000 and damage compensation −15000

#### Scenario: The current year counts the months so far
- **WHEN** today is `2026-11-25`, and the maintenance charge is 20000 cents a month all of 2026 with Annika's share 10000 basis points
- **THEN** row 2.2 of 2026 is 220000 cents, for January to November

### Requirement: Shares on the cash basis
The year summary SHALL count a rent payment at the user's share on its payment date, an entry at the share on its date, a deposit return's damage compensation at the share on the return date, and a charge or usage charge month at the share on the month's first day. On days without a share the amount counts as 0 for the user. A part SHALL be rounded once, from the exact sum of amount × share basis points ÷ 10000 of its amounts, half up.

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

#### Scenario: A deposit return counts at the share on its date
- **WHEN** Annika's share changes from 5000 to 10000 basis points on `2027-02-01`, a return on `2027-01-15` keeps 20000 cents for damage, and the year's annual repairs are 80000 cents at 10000 basis points
- **THEN** the damage compensation part of 2027 is −10000 cents

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
- the damage compensation kept from deposits returned in the year that is more than the year's annual repairs ("Form 7H rows of the own share"), with a note that it is tax-free compensation and that repair costs are deductible only where they exceed it

An amount of 0 SHALL be left out, and the card SHALL be left out when all are 0.

**No Playwright test:** a capitalised treatment, improvements and returned deposits in the past need data a browser test would set up through many forms; the amounts are covered by Vitest, and the form 7H page's Playwright test checks that the card is left out without them.

#### Scenario: Capitalised financing charges
- **WHEN** Annika owns 5000 basis points, and the financing charge of 7883 cents a month is capitalised all of 2025
- **THEN** the card shows the capitalised financing charges 47298 cents, and row 2.3 is 0

#### Scenario: An improvement is shown, not counted
- **WHEN** an improvement entry of 120000 cents is dated `2025-04-02`, and Annika owns 5000 basis points
- **THEN** the card shows improvements 60000 cents, and no row includes it

#### Scenario: Damage compensation over the repairs is shown
- **WHEN** Annika owns 10000 basis points, the year's annual repairs are 15000 cents, and a return in the year keeps 20000 cents for damage
- **THEN** the card shows the damage compensation not deducted, 5000 cents, with the note that it is tax-free

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

### Requirement: Choosing whose figures
The year summary SHALL have a *Kenen luvut* selector under the year when the year has at least one owner other than the user. Without one, every flat in the summary is the user's alone and the whole flats equal the own share, so the selector SHALL NOT be shown, unless another person or the whole flats are chosen: then it SHALL be shown, so the user can return to their own share. The selector SHALL open a sheet with:
- *Oma osuutesi*, the default, with the number of flats in the own summary
- every other person who had a share above 0 on at least one day of the year, up to today in the current year, in a flat the user has access to, archived flats included, with the number of such flats. A person whose share ended during the year is listed too. A chosen person without a share in the year SHALL be listed with 0 flats, so the choice stays marked.
- *Koko asunnot (100 %)*, with the number of flats in the whole flats ("The whole flats")

Names SHALL be shown in their stored form, never inflected. The choice SHALL be in the URL, `?person=<user id>` or `?person=whole`, and SHALL be kept when moving to another year, to a flat's form 7H page and back. Choosing *Oma osuutesi* SHALL remove `person` from the URL. A person in the URL who has no share that year in the user's flats SHALL show that they had no ownership share in the flats the user sees that year. A `person` that is no owner of any of the user's flats in any year SHALL open the own share.

#### Scenario: The sheet lists the year's owners
- **WHEN** Annika and Mikko own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, Jussi owned 5000 basis points of `Koivupolku 7 A 4` until `2025-06-30`, and Annika opens the selector on 2025
- **THEN** the sheet lists *Oma osuutesi*, Mikko with 1 flat, Jussi with 1 flat and *Koko asunnot (100 %)*, with *Oma osuutesi* chosen

#### Scenario: No selector for a sole owner
- **WHEN** Annika alone owns all her flats in 2025
- **THEN** the year summary of 2025 shows no selector

#### Scenario: The choice follows the year and the flat
- **WHEN** Annika has chosen Mikko on 2025, moves to 2024, opens `Kuusikuja 3 B 12` and selects Back
- **THEN** the URLs are `/year-summary?year=2024&person=<Mikko's id>`, `/year-summary/<its id>?year=2024&person=<Mikko's id>` and again the first

#### Scenario: A person without a share that year
- **WHEN** Annika has chosen Jussi, whose 5000 basis points of `Koivupolku 7 A 4` ended on `2025-06-30`, and moves to 2026
- **THEN** the page says that Jussi had no ownership share in the flats she sees in 2026, shows no cards, and offers the selector with Jussi chosen

#### Scenario: An unknown person in the URL
- **WHEN** Annika opens `/year-summary?year=2025&person=someone-else`, and that id owns none of her flats
- **THEN** the page shows her own share

### Requirement: Another owner's figures
Everyone with access to a flat SHALL be able to see the year summary and the form 7H page of every other person who had a share in it, also a member with a 0 % share. The figures SHALL be computed exactly as the own share's ("Form 7H rows of the own share", "Shares on the cash basis", "Checks in the year summary"), with that person's share in place of the user's. They SHALL cover only the flats the user has access to. The page SHALL say that, and that the person may have other rental flats to report. The cards SHALL show the person's share. The "Not included" note SHALL name the user's other flats, with the reason that the person had no share in them that year. The form 7H page SHALL name the person and keep the copy buttons. A person's figures SHALL never include a flat the user has no access to.

#### Scenario: A co-owner's cards
- **WHEN** Annika and Mikko own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, the rent of 89000 cents is paid on `2025-02-03`, Annika alone owns `Koivupolku 7 A 4`, and Annika chooses Mikko on 2025
- **THEN** the page shows one card, `Kuusikuja 3 B 12` with share 50 % and row 2.1 `445,00 €`, the note that only the flats she sees are counted, and the "Not included" note names `Koivupolku 7 A 4`

#### Scenario: A member sees an owner's figures
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12` with a 0 % share, chooses Annika, who owns 10000 basis points of it
- **THEN** he sees the card of `Kuusikuja 3 B 12` with Annika's share and figures

#### Scenario: A flat the user can't see is not counted
- **WHEN** Mikko also owns `Pyynikintie 5 A 3`, which Annika has no access to, and Annika chooses Mikko
- **THEN** her page has no card for `Pyynikintie 5 A 3`, and its address is nowhere on the page

#### Scenario: A co-owner's form 7H page
- **WHEN** Annika opens `Kuusikuja 3 B 12` with Mikko chosen
- **THEN** the form 7H page names Mikko, shows his share of 50 % and his rows, each with a copy button

### Requirement: The whole flats
With *Koko asunnot (100 %)* chosen, the year summary SHALL show a card for each flat the user has access to, archived flats included, that had an owner with a share above 0 on at least one day of the year, up to today in the current year. Flats in which the user's own share is 0 % are included too. The figures SHALL be computed as the own share's, with the sum of all owners' shares on each date in place of the user's, which is 100 % whenever the flat is owned. Each card SHALL show the owners with their shares at the end of the year, or at the end of their period, instead of the user's share. The page SHALL say that the figures are not reported as such, because each owner reports their own share on form 7H. The share changed check SHALL NOT be shown for the whole flat.

#### Scenario: The whole flats include a flat without the own share
- **WHEN** Annika and Mikko own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, Annika has a 0 % share of `Hallilantie 12 B 8`, which Mikko owns alone, and Annika chooses *Koko asunnot (100 %)* on 2025
- **THEN** the page shows cards for both flats, `Kuusikuja 3 B 12` with "Annika 50 % · Mikko Virtanen 50 %", and the note that the figures are not reported as such

#### Scenario: The whole flat counts every owner's share
- **WHEN** `Kuusikuja 3 B 12` is owned by Annika and Mikko at 5000 basis points each, and the rent of 89000 cents is paid on `2025-02-03`
- **THEN** its whole flat row 2.1 counts `890,00 €` for that payment

#### Scenario: An owner change in the middle of the year
- **WHEN** Jussi owned 5000 basis points of `Koivupolku 7 A 4` until `2025-06-30`, Annika the other 5000 and all of it from `2025-07-01`
- **THEN** the whole flat card shows "Annika 100 % · Jussi Laine 50 %", and no share changed chip

### Requirement: The whole flat's page
The form 7H page of a flat with `person=whole` SHALL show the flat as a whole for checking, not for filing. It SHALL show:
- the flat's address, the year and that it is the whole flat at 100 %
- a note that the figures are not reported as such
- the checks of the flat, without the share changed check
- an *Omistajat* card with each owner who had a share in the year: their name, their share at the end of the year or of their period, and their row 2.1, each opening that owner's form 7H page (`person=<their id>`, or no `person` for the user)
- rows 2.1–2.5 at 100 %, with their parts, without copy buttons
- the Not on form 7H card

It SHALL NOT show the flat details card or any copy button. Back SHALL return to the whole flats of the same year.

#### Scenario: The whole flat's rows and owners
- **WHEN** Annika and Mikko own 5000 basis points each of `Kuusikuja 3 B 12` in 2025, the rent of 89000 cents is paid on `2025-02-03`, and Annika opens it with *Koko asunnot (100 %)* chosen
- **THEN** the page shows the owners Annika and Mikko Virtanen at 50 % each, row 2.1 at 100 %, and no copy button

#### Scenario: Opening an owner from the whole flat
- **WHEN** Annika selects Mikko Virtanen in the *Omistajat* card
- **THEN** his form 7H page of the flat opens with `person=<Mikko's id>` and the same year

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

### Requirement: A former owner's year summary
A former owner of a flat is a user who has no access to it and had a share above 0 basis points in it on at least one day. They become one when their access is removed in an ownership change ("Changing a flat's ownership"), when an owner removes them as a member, or when they leave the flat as a member. A former owner who kept their access is a member and SHALL see the flat as any member does.

For a former owner, the flat SHALL be in the year summary only, until the flat is deleted:
- The own share's summary SHALL include it in the years they had a share above 0 on at least one day, with their own figures ("Shares on the cash basis"), and its form 7H page and PDF SHALL open from there.
- It SHALL NOT be in their whole flats, in another person's figures, in the *Kenen luvut* sheet's people or counts, or in the "Not included" note.
- Its form 7H page SHALL show their own share whatever `person` the URL has.
- The page SHALL say that they no longer own the flat and see only their own ownership period. It SHALL have no Add buttons for missing housing company details and no links to the rent payments or the charge amounts. The copy buttons SHALL stay.
- The flat SHALL NOT be on their flats list, in the new entry form or on any flat page, which SHALL show that the flat was not found.

#### Scenario: A former owner sees their period
- **WHEN** Jussi owned 5000 basis points of `Kuusikuja 3 B 12` until `2025-06-30`, Annika recorded herself at 10000 from `2025-07-01` with "Remove Jussi's access" selected, and rent payments of 89000 cents were paid on `2025-02-03` and `2025-08-04`
- **THEN** Jussi's 2025 summary has the card of `Kuusikuja 3 B 12` with row 2.1 `445,00 €`, and his flats list doesn't show the flat

#### Scenario: No flat pages for a former owner
- **WHEN** Jussi, a former owner of `Kuusikuja 3 B 12`, opens its details page
- **THEN** he sees that the flat was not found

#### Scenario: Only the own share of a former flat
- **WHEN** Jussi, a former owner of `Kuusikuja 3 B 12` with access to no other flat, opens his 2025 summary with `?person=whole`, and then its form 7H page with Annika's id as `person`
- **THEN** the whole flats have no card for `Kuusikuja 3 B 12`, and the form 7H page shows his own share of 50 %

#### Scenario: The years after a former owner's period
- **WHEN** Jussi, a former owner of `Kuusikuja 3 B 12` whose share ended on `2025-06-30`, opens his 2026 summary
- **THEN** it has no card for `Kuusikuja 3 B 12` and does not name it as not included

#### Scenario: A former owner's read-only form 7H page
- **WHEN** `Kuusikuja 3 B 12` has no Business ID, December 2025 has no rent payment, and Jussi, a former owner, opens its form 7H page of 2025
- **THEN** the page says that he no longer owns the flat, the Business ID is shown as missing without Add, the unpaid rent check has no link, and every value has a copy button

#### Scenario: A member who leaves after their share ended
- **WHEN** Jussi's 5000 basis points of `Kuusikuja 3 B 12` ended on `2025-06-30`, he stayed as a member and then leaves the flat
- **THEN** his 2025 summary still has the card of `Kuusikuja 3 B 12`

### Requirement: Tenants in a former owner's period
On a former owner's form 7H page and in their PDF, the tenancies SHALL be clipped to the days of the year on which they had a share above 0: the tenant, the tenancy period ("Flat details for form 7H") and the PDF's list of tenancies ("A flat's page in the PDF") SHALL cover only those days, and a tenancy that ran on none of them SHALL NOT be named. For everyone with access to the flat, the tenancies SHALL stay those of the whole year.

**No Playwright test:** the scenarios need tenancies on both sides of a sale in the past; the clipping is a pure function covered by Vitest, and the former owner's page is covered by "A former owner's year summary".

#### Scenario: Only the former owner's tenants
- **WHEN** Aino Koski's tenancy of `Kuusikuja 3 B 12` runs from `2024-03-15` to `2025-08-31` and Pekka Laine's from `2025-10-01`, and Jussi, a former owner whose 5000 basis points ended on `2025-06-30`, opens its form 7H page of 2025
- **THEN** the tenant is `Aino Koski` and the tenancy period `1.1.–30.6.2025`, and his PDF lists only `Aino Koski` `1.1.–30.6.2025`

#### Scenario: A tenancy only after the sale
- **WHEN** the flat's only tenancy of 2025 starts on `2025-10-01`, and Jussi's share ended on `2025-06-30`
- **THEN** his form 7H page of 2025 says there was no tenant in 2025

#### Scenario: A former owner who kept access sees the whole year
- **WHEN** Jussi's share ended on `2025-06-30` but he kept access as a member, with Aino Koski's and Pekka Laine's tenancies as above
- **THEN** his form 7H page of 2025 shows the tenant as "Several", as for every member

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

