## MODIFIED Requirements

### Requirement: Removing access to a flat
An owner of a flat SHALL be able to remove a member's access on the Ownership and sharing page. The flat SHALL then disappear from the removed user's list and SHALL behave for them as if it didn't exist, except that a user who had a share above 0 % in it on some day SHALL keep it in their year summary (openspec: year-summary, "A former owner's year summary"). A member SHALL NOT be able to remove anyone. No one SHALL be able to remove an owner's access, their own included, other than through an ownership change that takes the owner's share to 0 %.

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
A member SHALL be able to leave a flat on its Ownership and sharing page. The flat SHALL then disappear from their list. A member who had a share above 0 % in it on some day SHALL keep it in their year summary (openspec: year-summary, "A former owner's year summary"). An owner SHALL NOT be able to leave; their share must first go to others through an ownership change.

#### Scenario: A member leaves a flat
- **WHEN** Jussi leaves `Kuusikuja 3 B 12`
- **THEN** he lands on `/`, which no longer shows the flat, and Annika's Sharing page no longer lists him

#### Scenario: The owner can't leave
- **WHEN** Annika sends leaving `Kuusikuja 3 B 12` to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and she keeps her access
