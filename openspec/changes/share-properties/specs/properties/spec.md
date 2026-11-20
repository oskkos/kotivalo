## MODIFIED Requirements

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
