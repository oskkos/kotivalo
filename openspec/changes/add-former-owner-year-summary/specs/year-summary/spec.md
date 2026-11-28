## MODIFIED Requirements

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

### Requirement: The form 7H page of a flat
Everyone with access to a flat, and its former owners for their own share ("A former owner's year summary"), SHALL be able to open its form 7H page `/year-summary/$propertyId?year=…` from the year summary, for the own share, for another owner (`&person=<user id>`, "Another owner's figures") or for the whole flat (`&person=whole`, "The whole flat's page"). For the own share and another owner, the page SHALL show:
- the flat's address and the year, and whose share it is
- the checks of the flat ("Checks in the year summary")
- the flat details form 7H asks for ("Flat details for form 7H"), with that person's share
- rows 2.1–2.5 of that person's share ("Form 7H rows of the own share"), each with its number, the row name used on form 7H, its parts and its amount
- under row 2.3, when it is above 0, a note that deducting income-recognised capital charges has not always been accepted in case law (CONCEPT.md §4.3)
- the Not on form 7H card ("The Not on form 7H card")
- a note that the figures are counted by payment date with the share on each date, and that they should be checked before filing

Each value SHALL have a copy button ("Copying form 7H values"). Back SHALL return to the year summary of the same year and the same choice of person. The page SHALL NOT show the bottom bar. A user without access to the flat who never had a share above 0 % in it SHALL see that the flat was not found. When the person had no share that year, the page SHALL say so and show no rows.

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

## ADDED Requirements

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
