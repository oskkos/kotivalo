# sharing Specification

## Purpose
Sharing a flat, one flat at a time: the owner invites a person by email, the invitee accepts or declines after signing in with that address, and the owner can cancel invitations and remove members, who can also leave. Owners are the people with a current ownership share above 0 % (openspec: ownership); everyone else with access is a member. Invitation limits protect the email quota.
## Requirements
### Requirement: Inviting a user to a flat
A flat's owner SHALL be able to invite a person to the flat by email address on the flat's Sharing page. The invitation SHALL be emailed to that address in the recipient's language: the stored language of the account with that address, or the inviter's language when there is no account. The email SHALL name the inviter together with the inviter's verified email address and ask the recipient to sign in to Kotivalo with the invited address. Its subject SHALL NOT contain the inviter's name, which anyone can choose. The email SHALL NOT reveal whether the address has an account. Email addresses SHALL be compared case-insensitively. Inviting an address that already has access or already has a pending invitation to the flat SHALL be refused, and so SHALL inviting from a user who is not the flat's owner. If the email can't be sent, the invitation SHALL NOT be saved and the user SHALL see why, as when sending a sign-in code fails.

#### Scenario: Inviting an address sends an invitation
- **WHEN** Annika, the owner of `Kuusikuja 3 B 12`, invites `Jussi@Example.com`
- **THEN** an email is sent to `jussi@example.com` with a subject that doesn't contain her name and a text that names "Annika (anna@example.com)", and the Sharing page lists `jussi@example.com` as invited

#### Scenario: The invitation email is in the recipient's language
- **WHEN** Annika, whose language is `fi`, invites `jussi@example.com`, whose account's language is `sv`
- **THEN** the email's subject and text are the Swedish messages

#### Scenario: A user who already has access is not invited again
- **WHEN** Annika invites her own address, or the address of a member of the flat
- **THEN** it is refused with the reason `invitation_already_member`, and no email is sent

#### Scenario: An address with a pending invitation is not invited twice
- **WHEN** Annika invites `jussi@example.com` again while the first invitation is pending
- **THEN** it is refused with the reason `invitation_already_pending`, and no email is sent

#### Scenario: A member can't invite
- **WHEN** Jussi, a member of `Kuusikuja 3 B 12`, sends an invitation for that flat to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and no email is sent

### Requirement: Accepting a flat invitation
A user signed in with an invited address SHALL see each pending invitation at the top of the flats list, with the inviter's name and the flat's street address and city, and SHALL be able to accept it. Accepting SHALL give the user access to the flat as a `member` and remove the invitation. An invitation SHALL be valid for 30 days. It SHALL be shown to and accepted by only a user whose email address is the invited address. Accepting SHALL be refused when the user already has access to 100 flats.

#### Scenario: Accepting an invitation shows the flat in the list
- **WHEN** Annika invites `jussi@example.com` to `Kuusikuja 3 B 12`, and Jussi signs in with that address, sees "Annika shared Kuusikuja 3 B 12, Tampere with you" and accepts
- **THEN** Jussi's list shows `Kuusikuja 3 B 12`, and the invitation is no longer shown

#### Scenario: An invitation is only for the invited address
- **WHEN** the user `toinen@example.com` opens `/`, or sends the acceptance of an invitation for `jussi@example.com` to the server
- **THEN** the invitation is not shown, and the acceptance is refused with the reason `invitation_not_found`

#### Scenario: An expired invitation can't be accepted
- **WHEN** Jussi accepts an invitation created 30 days and 1 second ago
- **THEN** it is refused with the reason `invitation_not_found`, and Jussi has no access to the flat

#### Scenario: Accepting is refused at the flat limit
- **WHEN** Jussi, who has access to 100 flats, accepts an invitation
- **THEN** it is refused with the reason `property_limit_reached`, the invitation stays pending, and Jussi still has 100 flats

### Requirement: Declining a flat invitation
An invited user SHALL be able to decline an invitation. Declining SHALL remove it, and the flat SHALL NOT appear in their list.

#### Scenario: Declining removes the invitation
- **WHEN** Jussi declines the invitation to `Kuusikuja 3 B 12`
- **THEN** Jussi's list doesn't show the invitation or the flat, and Annika's Sharing page no longer lists `jussi@example.com`

### Requirement: Cancelling a flat invitation
A flat's owner SHALL be able to cancel a pending invitation on the Sharing page. A cancelled invitation SHALL no longer be shown to the invitee or accepted.

#### Scenario: A cancelled invitation can't be accepted
- **WHEN** Annika cancels the invitation for `jussi@example.com`, and Jussi then accepts it from a list loaded before the cancellation
- **THEN** it is refused with the reason `invitation_not_found`, and Jussi has no access to the flat

### Requirement: Listing who has access to a flat
Every user with access to a flat SHALL be able to open its Ownership and sharing page from the flat's details page ("The flat details page"): its owners line and its menu. The page SHALL list the users with access by name, the user themselves as "You", each with their role (owner or member), and the pending invitations by email address. A flat MAY have several owners: everyone with a current ownership share above 0 % (see "Roles follow the current shares"). A user without access SHALL see that the flat was not found, as for any flat they can't access.

#### Scenario: The Sharing page lists people and invitations
- **WHEN** Annika (owner) has shared `Kuusikuja 3 B 12` with Jussi (member) and invited `liisa@example.com`, and Jussi opens the flat's Ownership and sharing page
- **THEN** it lists "Annika · Owner", "You · Member" and `liisa@example.com` as invited

#### Scenario: Another user can't open the Sharing page
- **WHEN** a user without access opens `/properties/<id of Annika's flat>/sharing`
- **THEN** they see that the flat was not found

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

### Requirement: Limiting invitations
A flat SHALL have at most 10 pending invitations, and a user SHALL be able to send at most 20 invitations in 24 hours, counted from their first invitation in that window. An invitation over either limit SHALL be refused with a message, and no email SHALL be sent. The daily limit protects the email quota shared with sign-in codes.

**No Playwright test:** reaching the limits needs 11 or 21 invitations, each sending an email; Workers tests cover both limits with the server functions.

#### Scenario: The 11th pending invitation is refused
- **WHEN** a flat has 10 pending invitations and its owner invites another address
- **THEN** it is refused with the reason `invitation_limit_reached`, and no email is sent

#### Scenario: The 21st invitation in a day is refused
- **WHEN** a user who has sent 20 invitations, to any of their flats, within 24 hours of the first of them sends another
- **THEN** it is refused with the reason `invitation_daily_limit_reached`, and no email is sent

