## MODIFIED Requirements

### Requirement: Listing who has access to a flat
Every user with access to a flat SHALL be able to open its Ownership and sharing page from the flat's edit form. The page SHALL list the users with access by name, the user themselves as "You", each with their role (owner or member), and the pending invitations by email address. A flat MAY have several owners: everyone with a current ownership share above 0 % (see "Roles follow the current shares"). A user without access SHALL see that the flat was not found, as for any flat they can't access.

#### Scenario: The Sharing page lists people and invitations
- **WHEN** Annika (owner) has shared `Kuusikuja 3 B 12` with Jussi (member) and invited `liisa@example.com`, and Jussi opens the flat's Ownership and sharing page
- **THEN** it lists "Annika · Owner", "You · Member" and `liisa@example.com` as invited

#### Scenario: Another user can't open the Sharing page
- **WHEN** a user without access opens `/properties/<id of Annika's flat>/sharing`
- **THEN** they see that the flat was not found

### Requirement: Removing access to a flat
An owner of a flat SHALL be able to remove a member's access on the Ownership and sharing page. The flat SHALL then disappear from the removed user's list and SHALL behave for them as if it didn't exist. A member SHALL NOT be able to remove anyone. No one SHALL be able to remove an owner's access, their own included, other than through an ownership change that takes the owner's share to 0 %.

#### Scenario: The owner removes a member
- **WHEN** Annika removes Jussi's access to `Kuusikuja 3 B 12`
- **THEN** Jussi's list no longer shows the flat, and opening its edit page shows that the flat was not found

#### Scenario: A member can't remove access
- **WHEN** Jussi, a member, sends the removal of Annika's or another member's access to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

#### Scenario: The owner can't remove their own access
- **WHEN** Annika sends the removal of her own access to `Kuusikuja 3 B 12` to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and she keeps her access

#### Scenario: An owner can't remove another owner
- **WHEN** Annika and Jussi own 50 % each, and Annika sends the removal of Jussi's access to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and Jussi keeps his access and share

### Requirement: Leaving a shared flat
A member SHALL be able to leave a flat on its Ownership and sharing page. The flat SHALL then disappear from their list. An owner SHALL NOT be able to leave; their share must first go to others through an ownership change.

#### Scenario: A member leaves a flat
- **WHEN** Jussi leaves `Kuusikuja 3 B 12`
- **THEN** he lands on `/`, which no longer shows the flat, and Annika's Sharing page no longer lists him

#### Scenario: The owner can't leave
- **WHEN** Annika sends leaving `Kuusikuja 3 B 12` to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and she keeps her access
