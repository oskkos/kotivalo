## MODIFIED Requirements

### Requirement: Listing who has access to a flat
Every user with access to a flat SHALL be able to open its Ownership and sharing page from the flat's details page ("The flat details page"): its owners line and its menu. The page SHALL list the users with access by name, the user themselves as "You", each with their role (owner or member), and the pending invitations by email address. A flat MAY have several owners: everyone with a current ownership share above 0 % (see "Roles follow the current shares"). A user without access SHALL see that the flat was not found, as for any flat they can't access.

#### Scenario: The Sharing page lists people and invitations
- **WHEN** Annika (owner) has shared `Kuusikuja 3 B 12` with Jussi (member) and invited `liisa@example.com`, and Jussi opens the flat's Ownership and sharing page
- **THEN** it lists "Annika · Owner", "You · Member" and `liisa@example.com` as invited

#### Scenario: Another user can't open the Sharing page
- **WHEN** a user without access opens `/properties/<id of Annika's flat>/sharing`
- **THEN** they see that the flat was not found
