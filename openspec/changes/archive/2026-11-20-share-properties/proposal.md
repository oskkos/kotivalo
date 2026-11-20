## Why

Kotivalo's flats are often co-owned, but today only the user who added a flat can see it. Before shares and ownership history can be recorded (#29, second part), the co-owners must be in the app: a flat has to be shareable, one flat at a time, by email. Showing who has access needs a name for each user, and accounts have none yet.

#29 is split in two changes. This one is **sharing**. The next one, `track-ownership`, adds shares as validity periods, the ownership change form, the history and the ownership line on the flat card.

## What Changes

- **Display name.** A user without a name is asked for one once, right after signing in, before any other page. New accounts start without a name; existing ones are asked on their next visit. Changing the name later comes with the Account page.
- **Inviting by email.** On a flat's new **Sharing** page (`/properties/$propertyId/sharing`, linked from the flat's edit form), the flat's owner enters an email address. Kotivalo emails an invitation, in the recipient's language, naming the inviter and asking them to sign in with that address. The address may or may not have an account. Other flats stay hidden.
- **Accepting or declining.** After signing in with the invited address, the invitee sees the invitation at the top of the flats list (also on the first-run empty state) with the inviter's name and the flat's address, and accepts or declines. The flat appears in their list only after they accept. An invitation expires after 30 days.
- **Cancelling an invitation.** The owner sees pending invitations on the Sharing page and can cancel one.
- **Who has access.** The Sharing page lists the people with access by name, with "You" for the user themselves, and the pending invitations by email address.
- **Removing access.** The owner can remove an invited user's access. An invited user can leave the flat. The flat then disappears from that user's list.
- **Roles.** The user who adds a flat stays its `owner`. An invited user who accepts becomes a `member`, who can see and edit the flat's details but can't invite or remove anyone. In `track-ownership`, roles will follow the ownership shares.
- **Limits.** At most 10 pending invitations per flat, and 20 invitations sent per user per day (protects the email quota). Accepting counts toward the 100-flat limit.

Not in this change:
- shares, ownership periods, the ownership change form, history and the card's ownership line (`track-ownership`)
- a former owner's read access to their own period (needs transactions first)
- an estate as an owner (#20)
- the tax-consequence note (#21)
- changing one's name (the Account page)

## Capabilities

### New Capabilities

- `sharing`: inviting users to a flat by email, accepting and declining invitations, cancelling them, listing who has access, removing access and leaving a flat, and the invitation limits.

### Modified Capabilities

- `authentication`: a new requirement "Asking for a display name", and "Sign in with an emailed code": a new account lands on the name step, then on `/`.
- `properties`: "Flats are shown only to users with access" also covers accepted invitations (a member sees the flat; an invitation alone doesn't grant access), and "First run without flats" shows pending invitations.

## Impact

- **Tables:**
  - New: `property_invitations` (property id, email address, invited by, created, expires).
  - `property_access.role` gains the value `member`. It is a text column, so there is no data migration.
  - `user.name` (Better Auth's, already present) is now filled in.
- **Code:**
  - `features/sharing/`: repository, schemas, server functions, the invitation email, the Sharing page, the invitation cards.
  - `features/authentication/`: the name step and its server function; the `_authed` layout redirects to it.
  - `features/properties/`: the edit form links to Sharing, and the list shows invitations. Access checks already go through `property_access`, so members work without changes there.
- **Screens:**
  - "Omistus ja jakaminen" (Ownership and sharing) on the Design canvas: this change builds only the people-with-access part, in its card style.
  - The invite form, the invitation cards on the flats list and the name step aren't sketched (CONCEPT.md lists "accepting a flat invitation" as a missing screen). They are built from the theme, and screenshots are reviewed before their commits.
- **Email:** a new invitation email through `renderEmail()`. It counts against Resend's free quota (100 a day), which the per-user limit protects.
- **Messages:** fi, sv and en for the screens, the email and the new reason codes.
