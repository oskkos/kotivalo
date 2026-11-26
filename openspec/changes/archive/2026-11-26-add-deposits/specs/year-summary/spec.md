## MODIFIED Requirements

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

### Requirement: The form 7H page of a flat
Everyone with a share in a flat in the year SHALL be able to open its form 7H page `/year-summary/$propertyId?year=…` from the year summary. The page SHALL show:
- the flat's address and the year
- the checks of the flat ("Checks in the year summary")
- the flat details form 7H asks for ("Flat details for form 7H")
- rows 2.1–2.5 of the user's share ("Form 7H rows of the own share"), each with its number, the row name used on form 7H, its parts and its amount
- under row 2.3, when it is above 0, a note that deducting income-recognised capital charges has not always been accepted in case law (CONCEPT.md §4.3)
- the Not on form 7H card ("The Not on form 7H card")
- a note that the figures are counted by payment date with the share on each date, and that they should be checked before filing

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
