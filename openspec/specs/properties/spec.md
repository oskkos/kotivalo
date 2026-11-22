# properties Specification

## Purpose
The user's flats: adding, editing and listing them, the first-run empty state, per-flat access (a user sees and changes only flats they have access to) and the limit of 100 flats per user. Ownership (openspec: ownership) records the first owner, and the cards show the current owners. The flat details page is each flat's main page: the flats list card opens it, and it shows the rent status, tenancy, rent and charges and latest entries, opening each of their pages.
## Requirements
### Requirement: Adding a flat
A signed-in user SHALL be able to add a flat with its street address, postcode, city, room count, floor area and the date they have owned it since ("Owned since", default today). The room count SHALL be one of 1, 2, 3 or 4 and more ("Yksiö", "Kaksio", "Kolmio", "4h+"). The floor area SHALL be between 1 and 10 000 m² with at most one decimal, written with a comma or a point. The postcode SHALL be five digits. Every field SHALL be required. The user who adds a flat SHALL get access to it as an owner and own 100 % of it from the "Owned since" date (see "The first ownership period"). After saving, the user SHALL land on the flats list, which shows the new flat. Invalid details SHALL show an error under the field and SHALL NOT be saved.

#### Scenario: Adding a flat shows it in the list
- **WHEN** a user adds `Kuusikuja 3 B 12`, `33100`, `Tampere`, Kaksio, `48,5`
- **THEN** they land on `/`, and the list shows `Kuusikuja 3 B 12` with `Tampere · Kaksio 48,5 m²`

#### Scenario: The user who adds a flat gets access as an owner
- **WHEN** a user adds a flat
- **THEN** the flat is stored with that user's access as `owner`, and no other user has access to it

#### Scenario: An invalid postcode is not saved
- **WHEN** a user enters the postcode `3310` and saves
- **THEN** the postcode field shows that a postcode has five digits, and no flat is added

#### Scenario: An invalid floor area is not saved
- **WHEN** a user enters the floor area `0` or `48,55` and saves
- **THEN** the floor area field shows an error, and no flat is added

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

### Requirement: First run without flats
A user who has access to no flats SHALL see, on `/`, a short explanation and an "Add flat" action that opens the new flat form, instead of an empty list. Their pending flat invitations SHALL be shown above the explanation.

#### Scenario: A new user sees how to add the first flat
- **WHEN** a user with no flats opens `/` and selects "Add flat"
- **THEN** the new flat form opens

#### Scenario: A new user sees a pending invitation
- **WHEN** a user with no flats and an invitation to `Kuusikuja 3 B 12` opens `/`
- **THEN** they see the invitation above the explanation and the "Add flat" action

### Requirement: Flats are shown only to users with access
A user SHALL see and change only the flats they have access to: flats they added and flats whose invitation they accepted. A pending invitation SHALL NOT give access. Another user's flat SHALL NOT appear in the list, and opening its edit page or changing it through a server function SHALL behave as if the flat did not exist, without revealing whether it does.

#### Scenario: Another user's flat is not listed
- **WHEN** user A adds `Kuusikuja 3 B 12` and user B opens `/`
- **THEN** B's list does not include it

#### Scenario: Another user's flat cannot be opened
- **WHEN** user B opens `/properties/<id of A's flat>/edit`
- **THEN** B sees that the flat was not found, the same as for an id that doesn't exist

#### Scenario: Another user's flat cannot be changed
- **WHEN** user B sends a change to the floor area of A's flat to the server
- **THEN** the change is refused as not found, and the flat is unchanged

#### Scenario: A pending invitation does not give access
- **WHEN** user A invites user B to `Kuusikuja 3 B 12`, and B opens `/properties/<id of that flat>/edit` before accepting
- **THEN** B sees that the flat was not found, and B's list doesn't include the flat

#### Scenario: A member can edit a shared flat
- **WHEN** user B has accepted A's invitation to `Kuusikuja 3 B 12` and changes its floor area to `49`
- **THEN** the change is saved, and A's card shows `Tampere · Kaksio 49 m²`

### Requirement: Limiting the number of flats
A user SHALL be able to add flats until they have access to 100. Adding one more SHALL be refused with a message, and nothing SHALL be saved. Kotivalo is made for 1–10 flats; the limit bounds what one account can store under open sign-up.

**No Playwright test:** reaching the limit needs 100 flats, too slow to create through the browser; Workers tests cover it with the repository.

#### Scenario: The 101st flat is refused
- **WHEN** a user who has access to 100 flats adds another
- **THEN** it is refused with the reason `property_limit_reached`, and they still have 100 flats

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

