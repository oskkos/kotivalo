## MODIFIED Requirements

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

### Requirement: Listing flats
The page `/` SHALL list the flats the user has access to, sorted by street address in the user's language's alphabetical order, with the number of flats. Each card SHALL show the street address, the city, the room count, the floor area and the current owners with their shares, the user themselves as "You", owners with larger shares first. A member's card SHALL add that the flat is shared with them. Selecting a card SHALL open that flat's edit form.

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
