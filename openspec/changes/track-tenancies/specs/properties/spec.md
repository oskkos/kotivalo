## MODIFIED Requirements

### Requirement: Editing a flat
A user SHALL be able to edit the street address, postcode, city, room count and floor area of a flat they have access to. The edit form SHALL open with the flat's current details, and the same checks as adding SHALL apply. After saving, the user SHALL land on the flats list, which shows the new details. Above the form, a tenancy card SHALL show the current tenant's name with the contract type and start, or that the flat is vacant, and selecting it SHALL open the flat's Tenancy page ("The tenancy page").

#### Scenario: Editing a flat's floor area
- **WHEN** a user opens the edit form of `Kuusikuja 3 B 12` (48,5 m²), changes the floor area to `49` and saves
- **THEN** they land on `/`, and the card shows `Tampere · Kaksio 49 m²`

#### Scenario: The edit form shows the current details
- **WHEN** a user opens the edit form of `Kuusikuja 3 B 12`, `33100`, `Tampere`, Kaksio, 48,5 m²
- **THEN** the fields show those values, with Kaksio selected

#### Scenario: The edit page shows the tenancy card
- **WHEN** `Aino Koski` rents `Kuusikuja 3 B 12` open-ended from `2025-03-01`, and a user opens its edit page
- **THEN** the tenancy card shows `Aino Koski` and "Toistaiseksi · 1.3.2025 alkaen"; for a flat with no tenancy it shows "Vapaa"

### Requirement: Listing flats
The page `/` SHALL list the flats the user has access to, sorted by street address in the user's language's alphabetical order, with the number of flats. Each card SHALL show the street address, the city, the room count, the floor area, the current owners with their shares, the user themselves as "You", owners with larger shares first, and the flat's tenancy status ("Tenancy statuses"): *Let* with the tenant's name, *Notice given* with the last rent day and the tenant's name, or *Vacant*. A member's card SHALL add that the flat is shared with them. Selecting a card SHALL open that flat's edit form.

#### Scenario: Flats are listed by street address
- **WHEN** a user has added `Rantatie 15 C 21` and then `Koivupolku 7 A 4`
- **THEN** `/` shows "2 flats" and lists `Koivupolku 7 A 4` before `Rantatie 15 C 21`

#### Scenario: Selecting a flat opens its edit form
- **WHEN** a user selects the card of `Koivupolku 7 A 4` on `/`
- **THEN** the edit form of that flat opens

#### Scenario: The card shows the owners and their shares
- **WHEN** Annika and Jussi own `Kuusikuja 3 B 12` with 50 % each, and Annika opens `/`
- **THEN** the card shows "You 50 % · Jussi 50 %"

#### Scenario: A member's card says the flat is shared with them
- **WHEN** Annika owns 100 % of `Kuusikuja 3 B 12` and Jussi, a member, opens `/`
- **THEN** the card shows "Annika 100 % · shared with you"

#### Scenario: The card shows the tenancy status
- **WHEN** today is `2026-11-25`, `Kuusikuja 3 B 12` has a tenancy of `Aino Koski` with notice given and the last rent day `2026-12-31`, and `Koivupolku 7 A 4` has no tenancy
- **THEN** the card of `Kuusikuja 3 B 12` shows "Irtisanottu · päättyy 31.12." and `Aino Koski`, and the card of `Koivupolku 7 A 4` shows "Vapaa"
