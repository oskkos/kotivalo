# properties Specification

## Purpose
The user's flats: adding, editing and listing them, the first-run empty state, per-flat access (a user sees and changes only flats they have access to) and the limit of 100 flats per user. Owners and shares (#29), rent and charges (#31), tenancies (#30) and the flat details page (#33) build on it.
## Requirements
### Requirement: Adding a flat
A signed-in user SHALL be able to add a flat with its street address, postcode, city, room count and floor area. The room count SHALL be one of 1, 2, 3 or 4 and more ("Yksiö", "Kaksio", "Kolmio", "4h+"). The floor area SHALL be between 1 and 10 000 m² with at most one decimal, written with a comma or a point. The postcode SHALL be five digits. Every field SHALL be required. The user who adds a flat SHALL get access to it as an owner. After saving, the user SHALL land on the flats list, which shows the new flat. Invalid details SHALL show an error under the field and SHALL NOT be saved.

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
A user SHALL be able to edit the street address, postcode, city, room count and floor area of a flat they have access to. The edit form SHALL open with the flat's current details, and the same checks as adding SHALL apply. After saving, the user SHALL land on the flats list, which shows the new details.

#### Scenario: Editing a flat's floor area
- **WHEN** a user opens the edit form of `Kuusikuja 3 B 12` (48,5 m²), changes the floor area to `49` and saves
- **THEN** they land on `/`, and the card shows `Tampere · Kaksio 49 m²`

#### Scenario: The edit form shows the current details
- **WHEN** a user opens the edit form of `Kuusikuja 3 B 12`, `33100`, `Tampere`, Kaksio, 48,5 m²
- **THEN** the fields show those values, with Kaksio selected

### Requirement: Listing flats
The page `/` SHALL list the flats the user has access to, sorted by street address in the user's language's alphabetical order, with the number of flats. Each card SHALL show the street address, the city, the room count and the floor area. Selecting a card SHALL open that flat's edit form.

#### Scenario: Flats are listed by street address
- **WHEN** a user has added `Rantatie 15 C 21` and then `Koivupolku 7 A 4`
- **THEN** `/` shows "2 flats" and lists `Koivupolku 7 A 4` before `Rantatie 15 C 21`

#### Scenario: Selecting a flat opens its edit form
- **WHEN** a user selects the card of `Koivupolku 7 A 4` on `/`
- **THEN** the edit form of that flat opens

### Requirement: First run without flats
A user who has access to no flats SHALL see, on `/`, a short explanation and an "Add flat" action that opens the new flat form, instead of an empty list.

#### Scenario: A new user sees how to add the first flat
- **WHEN** a user with no flats opens `/` and selects "Add flat"
- **THEN** the new flat form opens

### Requirement: Flats are shown only to users with access
A user SHALL see and change only the flats they have access to. Another user's flat SHALL NOT appear in the list, and opening its edit page or changing it through a server function SHALL behave as if the flat did not exist, without revealing whether it does.

#### Scenario: Another user's flat is not listed
- **WHEN** user A adds `Kuusikuja 3 B 12` and user B opens `/`
- **THEN** B's list does not include it

#### Scenario: Another user's flat cannot be opened
- **WHEN** user B opens `/properties/<id of A's flat>/edit`
- **THEN** B sees that the flat was not found, the same as for an id that doesn't exist

#### Scenario: Another user's flat cannot be changed
- **WHEN** user B sends a change to the floor area of A's flat to the server
- **THEN** the change is refused as not found, and the flat is unchanged

### Requirement: Limiting the number of flats
A user SHALL be able to add flats until they have access to 100. Adding one more SHALL be refused with a message, and nothing SHALL be saved. Kotivalo is made for 1–10 flats; the limit bounds what one account can store under open sign-up.

**No Playwright test:** reaching the limit needs 100 flats, too slow to create through the browser; Workers tests cover it with the repository.

#### Scenario: The 101st flat is refused
- **WHEN** a user who has access to 100 flats adds another
- **THEN** it is refused with the reason `property_limit_reached`, and they still have 100 flats

