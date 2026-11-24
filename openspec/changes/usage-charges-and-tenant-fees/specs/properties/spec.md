## MODIFIED Requirements

### Requirement: The flat details page
Everyone with access to a flat SHALL be able to open its details page, the flat's main page, by selecting its card on the flats list. The page SHALL show:
- the street address, postcode, city, room count and floor area, and the current owners with their shares as on the card ("Listing flats"), opening the Ownership and sharing page
- for the current tenancy ("The tenancy page"), this month's rent card: the month, its expected rent with the tenant fees as one total ("Expected rent of a month") and status ("The rent status of a month"), with "Merkitse maksetuksi" for owners while the month is not paid (*Lisää maksu* when partly paid), and a link to the month's payments page
- a warning about earlier months not fully paid ("Months not fully paid"), naming the month when there is one and the number of months otherwise, opening the rent payments page
- the tenancy card: the tenant's name with the contract type, start, occupants and due day, and the tenancy's rent in effect today ("The rent of a tenancy"), or its first rent when it starts later, with the next upcoming change and the sum of its fees this month when it has any, opening the Tenancy page
- the charges: the maintenance charge in effect today, or that it is not set; each financing charge in effect today with its name ("Adding a financing charge"), or that none is, with the treatment once; and the accumulated capitalised financing charges when above zero ("Accumulated capitalised financing charges"), under the heading *Vastikkeet*, opening the charge amounts page ("The charge amounts page")
- below them, *Vastikkeet kuukausittain*, opening the charges page ("The charges page"), with this year's charges so far ("Charges of a month") when above zero
- below the charges and apart from them, the usage charges under the heading *Käyttömaksut*: each usage charge in effect today with its name and its amount this month ("Usage charges of a month"), for a per-occupant charge with the amount per occupant and the occupants, or that there are none, opening the usage charges page ("The usage charges page"); and below them *Käyttömaksut kuukausittain*, opening the usage charges by month page ("The usage charges by month page"), with this year's usage charges so far when above zero
- the three latest entries by date ("The entries page"), each opening its details, and a link to the Entries page; or that there are no entries yet
- in the header, a back link to the flats list, Edit, and a menu with Edit flat, Charges (*Vastikkeet*), Rent payments, Entries and Ownership and sharing for everyone, and for owners End tenancy while the current tenancy runs without a recorded ending and Add tenant

When the flat has no current tenancy, the rent card SHALL be replaced by a note that the flat is vacant, since when if a tenancy has ended, and Add tenant for owners. When the current tenancy starts after this month, the rent card SHALL show *No rent this month* with the start date. Members SHALL NOT see "Merkitse maksetuksi", End tenancy or Add tenant. A user without access SHALL see that the flat was not found.

#### Scenario: Selecting a flat opens its details page
- **WHEN** a user selects the card of `Kuusikuja 3 B 12` on `/`
- **THEN** the details page of `Kuusikuja 3 B 12` opens, showing `Kuusikuja 3 B 12`, `33100 Tampere`, Kaksio and `48,5 m²`

#### Scenario: The rent card shows this month's status
- **WHEN** today is `2026-11-22`, `Aino Koski` rents the flat from `2025-03-01` with the due day 5 and the rent 89000 cents, November has no payments, and Annika, an owner, opens the details page
- **THEN** the rent card shows "Marraskuun vuokra", `890,00 €`, "Myöhässä 17 pv" and "Merkitse maksetuksi"

#### Scenario: A paid month has no record button
- **WHEN** November has a payment of 89000 cents on `2026-11-03`
- **THEN** the rent card shows "Maksettu 3.11." and no "Merkitse maksetuksi"

#### Scenario: A member sees the status but can't record a payment
- **WHEN** Jussi, a member of the flat, opens the details page
- **THEN** he sees the rent card with its status, no "Merkitse maksetuksi", and no End tenancy or Add tenant in the menu

#### Scenario: Earlier months not fully paid are warned about
- **WHEN** today is `2026-11-22`, and October 2026 has no payments
- **THEN** the page warns that October's rent is not marked paid, and selecting the warning opens the rent payments page

#### Scenario: A vacant flat
- **WHEN** today is `2027-01-10`, and the flat's only tenancy ended on `2026-12-31`
- **THEN** the page shows no rent card and no rent, says the flat is vacant since `31.12.2026`, and shows "Lisää vuokralainen" to an owner

#### Scenario: A tenancy that starts later
- **WHEN** today is `2026-11-22`, and the flat's only tenancy, `Mikko Lehtinen`'s, starts on `2027-01-01` with the rent 91000 cents
- **THEN** the rent card shows "Alkaa 1.1.2027" and no "Merkitse maksetuksi", and the tenancy card shows `910,00 €/kk`

#### Scenario: The tenancy card shows the rent and its upcoming change
- **WHEN** today is `2026-11-22`, and `Aino Koski`'s rent is 89000 cents from `2026-03-01` and 92000 cents from `2027-03-01`
- **THEN** the tenancy card shows `890,00 €/kk` and the change to `920,00 €` on `1.3.2027`

#### Scenario: The charges with the capitalised total
- **WHEN** today is `2026-11-22`, the maintenance charge is 21400 cents, and the financing charge 8600 cents capitalised from `2025-03-01`
- **THEN** the page shows under *Vastikkeet* `214,00 €/kk` and `86,00 €/kk` with "Rahastoitu", no rent, and the accumulated capitalised financing charges

#### Scenario: Each financing charge in effect today
- **WHEN** today is `2026-11-23`, `Putkiremontti` is 8600 cents from `2025-03-01`, `Julkisivu` 4200 cents from `2026-01-01`, `Hissiremontti` 2400 cents from `2025-03-01` and 0 cents from `2026-01-01`, and the treatment capitalised from `2025-03-01`
- **THEN** the page shows `Putkiremontti` `86,00 €/kk` and `Julkisivu` `42,00 €/kk`, "Rahastoitu" once, and no `Hissiremontti`

#### Scenario: This year's charges open the charges page
- **WHEN** today is `2026-11-23`, the maintenance charge is 21400 cents from `2026-01-01`, and the financing charge 8600 cents from `2025-03-01`
- **THEN** the page shows "Vastikkeet kuukausittain" with `3 300,00 €` this year so far, and selecting it opens the charges page

#### Scenario: The latest entries
- **WHEN** the flat has entries on `2026-11-12`, `2026-11-03`, `2026-10-28` and `2026-10-15`
- **THEN** the page lists the entries of 12.11., 3.11. and 28.10., and "Kaikki" opens the Entries page

#### Scenario: Another user can't open the details page
- **WHEN** a user without access opens `/properties/<id of Annika's flat>`
- **THEN** they see that the flat was not found

#### Scenario: The rent card includes the tenant fees
- **WHEN** today is `2026-11-24`, `Aino Koski`'s rent is 89000 cents, she has two occupants, a water fee of 2200 cents per occupant and a parking fee of 1500 cents, and November has no payments
- **THEN** the rent card shows "Marraskuun vuokra" `949,00 €` without the breakdown, and the tenancy card shows `890,00 €/kk` and "+ maksut 59,00 €"

#### Scenario: The usage charges apart from the charges
- **WHEN** today is `2026-11-24`, the maintenance charge is 21400 cents, the water usage charge 2200 cents per occupant from `2026-01-01` with two occupants, and the parking usage charge 1500 cents from `2026-02-01`
- **THEN** the page shows under *Vastikkeet* only the maintenance charge, and under *Käyttömaksut* `Vesimaksu` `44,00 €/kk` with "22,00 €/asukas · 2 asukasta" and `Autopaikka` `15,00 €/kk`, and selecting *Käyttömaksut kuukausittain* opens the usage charges by month page

#### Scenario: A flat without usage charges on the details page
- **WHEN** the flat has no usage charges
- **THEN** the *Käyttömaksut* section says that there are none and opens the usage charges page
