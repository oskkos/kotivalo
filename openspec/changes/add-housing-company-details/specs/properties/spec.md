## MODIFIED Requirements

### Requirement: Adding a flat
A signed-in user SHALL be able to add a flat with its street address, postcode, city, room count, floor area and the date they have owned it since ("Owned since", default today), and optionally its housing company details ("Housing company details of a flat"). The room count SHALL be one of 1, 2, 3 or 4 and more ("Yksiö", "Kaksio", "Kolmio", "4h+"). The floor area SHALL be between 1 and 10 000 m² with at most one decimal, written with a comma or a point. The postcode SHALL be five digits. Every field except the housing company details SHALL be required. The user who adds a flat SHALL get access to it as an owner and own 100 % of it from the "Owned since" date (see "The first ownership period"). After saving, the user SHALL land on the flats list, which shows the new flat. Invalid details SHALL show an error under the field and SHALL NOT be saved.

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
A user SHALL be able to edit the street address, postcode, city, room count, floor area and housing company details ("Housing company details of a flat") of a flat they have access to, from Edit on the flat's details page ("The flat details page"). The edit form SHALL open with the flat's current details, and the same checks as adding SHALL apply. After saving, the user SHALL land on the flat's details page, which shows the new details; closing the form SHALL return there too.

#### Scenario: Editing a flat's floor area
- **WHEN** a user opens the edit form of `Kuusikuja 3 B 12` (48,5 m²), changes the floor area to `49` and saves
- **THEN** they land on the details page of `Kuusikuja 3 B 12`, which shows `49 m²`

#### Scenario: The edit form shows the current details
- **WHEN** a user opens the edit form of `Kuusikuja 3 B 12`, `33100`, `Tampere`, Kaksio, 48,5 m², housing company `As Oy Kuusikuja 3`, Business ID `2345678-0`, apartment `B 12`
- **THEN** the fields show those values, with Kaksio selected

## ADDED Requirements

### Requirement: Housing company details of a flat
A flat SHALL have three optional details for the tax return's form 7H: the housing company's name (at most 100 characters), its Business ID (*Y-tunnus*) and the apartment number (at most 20 characters, e.g. `B 12`). The new flat and edit flat forms SHALL ask for them in their own section, *Taloyhtiö*, after the flat's section, with a hint that the tax return asks for them and the property manager knows them. Each field MAY be left empty, and an empty field SHALL be stored as missing; spaces around a value SHALL be dropped. A Business ID SHALL be seven digits, a hyphen and a check digit, and the check digit SHALL match the Finnish Business ID rule (the digits weighted 7, 9, 10, 5, 8, 4, 2, the sum's remainder modulo 11: 0 gives 0, 1 is never valid, otherwise 11 minus the remainder); an invalid one SHALL show an error under the field and nothing SHALL be saved. Everyone who can edit the flat ("Editing a flat") SHALL be able to set, change and clear them. The flat details page SHALL show the filled-in details in its header card below the postcode and city, joined with ` · ` in this order: the housing company's name, the apartment number (*huoneisto B 12*) and the Business ID (*Y-tunnus 2345678-0*); a flat without any SHALL show no such line.

#### Scenario: Adding a flat with its housing company details
- **WHEN** a user adds `Kuusikuja 3 B 12` with housing company `As Oy Kuusikuja 3`, Business ID `2345678-0` and apartment `B 12`, then opens its details page
- **THEN** the header card shows `As Oy Kuusikuja 3 · huoneisto B 12 · Y-tunnus 2345678-0`

#### Scenario: A flat without housing company details
- **WHEN** a user adds `Kuusikuja 3 B 12` leaving the housing company section empty
- **THEN** the flat is saved with the three details missing, and its details page shows no housing company line

#### Scenario: Only the filled-in details are shown
- **WHEN** a flat has only the housing company `As Oy Kuusikuja 3`
- **THEN** the header card shows `As Oy Kuusikuja 3`

#### Scenario: A Business ID with a wrong check digit is not saved
- **WHEN** a user enters the Business ID `2345678-9` and saves
- **THEN** the Business ID field shows that the Business ID is not valid, and nothing is saved

#### Scenario: A Business ID in the wrong form is not saved
- **WHEN** a user enters the Business ID `2345678`, `23456780` or `3141592-0` and saves
- **THEN** the Business ID field shows that the Business ID is not valid, and nothing is saved

#### Scenario: Spaces around the details are dropped
- **WHEN** a user saves the Business ID ` 2345678-0 ` and the apartment `  B 12 `
- **THEN** they are stored as `2345678-0` and `B 12`

#### Scenario: Clearing the housing company details
- **WHEN** a user empties the three housing company fields of a flat that had them and saves
- **THEN** the details are stored as missing, and the details page shows no housing company line

#### Scenario: A member can set the housing company details
- **WHEN** user B has accepted A's invitation to `Kuusikuja 3 B 12` and sets its housing company to `As Oy Kuusikuja 3`
- **THEN** the change is saved, and A sees `As Oy Kuusikuja 3` on the flat's details page
