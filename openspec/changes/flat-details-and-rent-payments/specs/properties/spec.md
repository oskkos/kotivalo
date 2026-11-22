## ADDED Requirements

### Requirement: The flat details page
Everyone with access to a flat SHALL be able to open its details page, the flat's main page, by selecting its card on the flats list. The page SHALL show:
- the street address, postcode, city, room count and floor area, and the current owners with their shares as on the card ("Listing flats"), opening the Ownership and sharing page
- for the current tenancy ("The tenancy page"), this month's rent card: the month, its expected rent and status ("The rent status of a month"), with "Merkitse maksetuksi" for owners while the month is not paid (*Lisää maksu* when partly paid), and a link to the month's payments page
- a warning about earlier months not fully paid ("Months not fully paid"), naming the month when there is one and the number of months otherwise, opening the rent payments page
- the tenancy card: the tenant's name with the contract type, start and due day, opening the Tenancy page
- the rent, maintenance charge and financing charge in effect today with the financing charge's treatment, or that each is not set, and the accumulated capitalised financing charges when above zero ("Accumulated capitalised financing charges"), opening the Rent and charges page
- the three latest entries by date ("The entries page"), each opening its details, and a link to the Entries page; or that there are no entries yet
- in the header, a back link to the flats list, Edit, and a menu with Edit flat, Rent and charges, Rent payments, Entries and Ownership and sharing for everyone, and for owners End tenancy while the current tenancy runs without a recorded ending and Add tenant

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
- **THEN** the page shows no rent card, says the flat is vacant since `31.12.2026`, and shows "Lisää vuokralainen" to an owner

#### Scenario: A tenancy that starts later
- **WHEN** today is `2026-11-22`, and the flat's only tenancy, `Mikko Lehtinen`'s, starts on `2027-01-01`
- **THEN** the rent card shows "Alkaa 1.1.2027" and no "Merkitse maksetuksi"

#### Scenario: The rent and charges with the capitalised total
- **WHEN** today is `2026-11-22`, the rent is 89000 cents, the maintenance charge 21400 cents, and the financing charge 8600 cents capitalised from `2025-03-01`
- **THEN** the page shows `890,00 €/kk`, `214,00 €/kk`, `86,00 €/kk` with "Rahastoitu", and the accumulated capitalised financing charges

#### Scenario: The latest entries
- **WHEN** the flat has entries on `2026-11-12`, `2026-11-03`, `2026-10-28` and `2026-10-15`
- **THEN** the page lists the entries of 12.11., 3.11. and 28.10., and "Kaikki" opens the Entries page

#### Scenario: Another user can't open the details page
- **WHEN** a user without access opens `/properties/<id of Annika's flat>`
- **THEN** they see that the flat was not found

## MODIFIED Requirements

### Requirement: Editing a flat
A user SHALL be able to edit the street address, postcode, city, room count and floor area of a flat they have access to, from Edit on the flat's details page ("The flat details page"). The edit form SHALL open with the flat's current details, and the same checks as adding SHALL apply. After saving, the user SHALL land on the flat's details page, which shows the new details; closing the form SHALL return there too.

#### Scenario: Editing a flat's floor area
- **WHEN** a user opens the edit form of `Kuusikuja 3 B 12` (48,5 m²), changes the floor area to `49` and saves
- **THEN** they land on the details page of `Kuusikuja 3 B 12`, which shows `49 m²`

#### Scenario: The edit form shows the current details
- **WHEN** a user opens the edit form of `Kuusikuja 3 B 12`, `33100`, `Tampere`, Kaksio, 48,5 m²
- **THEN** the fields show those values, with Kaksio selected

### Requirement: Listing flats
The page `/` SHALL list the flats the user has access to, sorted by street address in the user's language's alphabetical order, with the number of flats. Each card SHALL show the street address, the city, the room count, the floor area, the current owners with their shares, the user themselves as "You", owners with larger shares first, and the flat's tenancy status ("Tenancy statuses"): *Let* with the tenant's name, *Notice given* with the last rent day and the tenant's name, or *Vacant*. A member's card SHALL add that the flat is shared with them. Selecting a card SHALL open that flat's details page ("The flat details page").

#### Scenario: Flats are listed by street address
- **WHEN** a user has added `Rantatie 15 C 21` and then `Koivupolku 7 A 4`
- **THEN** `/` shows "2 flats" and lists `Koivupolku 7 A 4` before `Rantatie 15 C 21`

#### Scenario: The card shows the owners and their shares
- **WHEN** Annika and Jussi own `Kuusikuja 3 B 12` with 50 % each, and Annika opens `/`
- **THEN** the card shows "You 50 % · Jussi 50 %"

#### Scenario: A member's card says the flat is shared with them
- **WHEN** Annika owns 100 % of `Kuusikuja 3 B 12` and Jussi, a member, opens `/`
- **THEN** the card shows "Annika 100 % · shared with you"

#### Scenario: The card shows the tenancy status
- **WHEN** today is `2026-11-25`, `Kuusikuja 3 B 12` has a tenancy of `Aino Koski` with notice given and the last rent day `2026-12-31`, and `Koivupolku 7 A 4` has no tenancy
- **THEN** the card of `Kuusikuja 3 B 12` shows "Irtisanottu · päättyy 31.12." and `Aino Koski`, and the card of `Koivupolku 7 A 4` shows "Vapaa"
