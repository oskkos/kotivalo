## Context

A flat is reached only through `property_access` (`property_id`, `user_id`, `role`), and the only role today is `owner`, given to whoever adds the flat. Every property query already checks access inside the same SQL statement. Accounts are created by signing in with an emailed code; Better Auth's `user.name` exists but is empty, because the sign-in never asks for it.

This change is the first half of #29. It brings co-owners into a flat. `track-ownership` then records their shares as validity periods. The Design canvas has only "Omistus ja jakaminen" (current owners, change form, history). It has nothing for inviting, accepting or the name step.

## Goals / Non-Goals

**Goals:**
- Share one flat at a time with a person identified by email, whether or not they have an account.
- The invitee consents: a flat appears only after accepting.
- Every user has a display name to show to the people they share with.
- Leave a clear place for `track-ownership`: the Sharing page grows into "Ownership and sharing", and roles follow shares.

**Non-Goals:**
- Shares, ownership periods, history, the card's ownership line.
- A former owner's read access to their own period.
- Estates (#20).
- Changing the name after the first time (Account page).
- Invitation links that sign the user in. The invitation is matched to the signed-in address instead.

## Decisions

### 1. Invitations in their own table, matched by email address

```
property_invitations
  id           text pk (id())
  property_id  text not null → properties.id (on delete cascade)
  email        text not null          -- lower-cased
  invited_by   text not null → user.id (on delete cascade)
  created_at   integer not null (instant())
  expires_at   integer not null (instant())   -- created_at + 30 days
  unique (property_id, email)
  index on email
```

- **A separate table, not a status on `property_access`.** The invitee may have no account, so there is no `user_id` to put in `property_access`. Alternatives:
  - A nullable `user_id` plus an email column on `property_access` would put every access query behind "and status = accepted", a check that is easy to forget in a security-relevant place.
  - Creating a Better Auth user at invitation time would create accounts for people who never signed up.
  - With a separate table, `property_access` keeps meaning "has access". CONCEPT.md's data model draft ("property_access … invitation status") is updated to match.
- **Matched by the signed-in user's email address, no token.** Signing in already proves the address (the emailed code), so the invitation needs no secret link of its own. The email just says "sign in to Kotivalo with this address". Accepting checks `invitation.email = session.user.email` and `expires_at > now` in the same statement as the delete.
- **Resolved invitations are deleted.** Accepted, declined, cancelled and expired invitations leave no row; the log lines record what happened. An expired row blocks nothing: inviting the same address again replaces it.
- **`unique (property_id, email)`** backs "already pending" against double submits.

### 2. Roles: `owner` and `member`

- `PROPERTY_ROLES` becomes `['owner', 'member']`. It is a text column, so no data migration is needed.
- **Owner** (whoever added the flat): sees and edits it, invites, cancels invitations and removes members.
- **Member** (accepted an invitation): sees and edits the flat's details, sees the Sharing page and can leave. They can't invite or remove anyone.
- The owner can't leave or remove their own access. A flat always has its owner, so it is never orphaned.
- *Alternative:* everyone with access is equal. That is simpler, but any invitee could remove the person who added the flat.
- In `track-ownership`, the role follows the current ownership share: a share above 0 % makes the user an owner. That lets several owners exist and lets ownership move to someone else. This change keeps one owner per flat.

### 3. Repository

`features/sharing/sharing.repository.server.ts`, `sharingRepository(db)`. Every method takes the acting user's id, and the access or role check is inside the statement, as in `propertyRepository`.

- `roleOf(userId, propertyId)`: `'owner' | 'member' | undefined`.
- `listPeople(propertyId)`: users with access (id, name, role).
- `listPendingForProperty(propertyId, now)`.
- `findPendingByEmail(email, propertyId, now)`.
- `countPending(propertyId, now)`.
- `invite(...)`: deletes an expired row for the same address, then inserts. Both statements go through `atomically()`.
- `cancel(ownerId, invitationId)`: deletes only where the actor is the flat's owner.
- `listForInvitee(email, now)`: the inviter's name and the flat's street address and city.
- `accept(userId, email, invitationId, now)`: `atomically()` runs two statements:
  1. insert into `property_access` … select from the invitation where the email matches and it hasn't expired
  2. delete the invitation where the same conditions hold

  If the invitation doesn't match, both statements affect nothing, so the result is "not found".
- `decline(email, invitationId)`.
- `removeMember(ownerId, propertyId, memberId)`: deletes where the target's role is `member` and the actor is the owner, in one statement.
- `leave(memberId, propertyId)`: deletes where the role is `member`.

### 4. Server functions and checks

`features/sharing/functions.ts`, with the logic in `sharing.server.ts` taking its dependencies like `sign-in.server.ts`. Every function checks the session first.

- `getSharing({ propertyId })`: the people (the caller marked as "you"), the pending invitations, and the caller's role. No access returns `property_not_found`.
- `inviteToProperty({ propertyId, email })`, in this order:
  1. The caller's role must be `owner` (`sharing_owner_only`).
  2. The address must not already have access, the inviter's own address included (`invitation_already_member`).
  3. It must not have a pending invitation (`invitation_already_pending`).
  4. The flat must have fewer than 10 pending invitations (`invitation_limit_reached`).
  5. `consumeLimit(db, 'invite:user:<id>', { windowSeconds: 86400, max: 20 })` (`invitation_daily_limit_reached`).
  6. Send the email (`EmailError` maps to the same alert reasons as the sign-in code).
  7. Insert the invitation.

  Sending before inserting means a failed send leaves no invitation. If the insert fails after a send, there is an email without an invitation; the recipient would see nothing to accept. That is harmless and rare.
- `listMyInvitations()`, `acceptInvitation({ invitationId })`, `declineInvitation({ invitationId })`.
  - The address comes from the session, never from the input.
  - Accepting checks the 100-flat limit first (`property_limit_reached`, as when adding a flat). The count and the insert are not atomic, as for adding a flat; the limit bounds abuse.
- `cancelInvitation({ invitationId })`, `removeAccess({ propertyId, userId })`, `leaveProperty({ propertyId })`: `sharing_owner_only` when the role doesn't allow it.
- A missing invitation, or one for another address, gives `invitation_not_found`. It never says which.
- **Logging** (ids only, never addresses or names):
  - `info`: `sharing.invitation_sent` (propertyId, invitationId), `sharing.invitation_accepted`, `sharing.invitation_declined`, `sharing.invitation_cancelled`, `sharing.access_removed` (propertyId, removedUserId), `sharing.property_left`
  - `warn`: `sharing.invitation_limit_reached` (which limit)

### 5. The invitation email

`features/sharing/invitation-email.ts` builds the email with `renderEmail()`: a heading, "{inviter} shared a flat with you in Kotivalo. Sign in with {email} to see and accept the invitation.", and a button to the app's address.

- **The flat's address is not in the email.** It is shown after sign-in. That keeps the data sent to Resend (stored in the US) to the inviter's name and the recipient's address.
- **Language:** the stored language of the account with that address, else the inviter's. The recipient's language is looked up in the same query that checks "already a member", so an existing account doesn't take a different code path (no timing or wording difference).

### 6. Display name

- `features/authentication/`:
  - a `displayNameInput` schema: trimmed, 1–50 characters; reasons `name_required` and `text_too_long`
  - a `setDisplayName` server function that updates `user.name` through a small `user.repository.server.ts` and logs `authentication.name_set`
- `getSignedInUser` also returns `name`. The `_authed` layout's `beforeLoad` redirects to `/welcome?redirect=<href>` when it is empty, and `/welcome` redirects to `/` when it isn't. Only same-origin paths are accepted for `redirect`, so it can't send the user elsewhere.
- `/welcome` is a single-field page built from the sign-in pages' layout: logo, "Tervetuloa!", "Millä nimellä sinut näytetään?", the name field and "Jatka".
- Better Auth's `user.name` is reused; no new column.
- *Alternative:* asking for the name on the code step. That would make the sign-in of an existing user longer, and existing accounts with no name would still need the redirect.

### 7. Screens

The Design canvas row "Jakaminen ja kutsut" has every screen below: `Welcome`, `Jakaminen` (owner, invitation sent, already invited, member, the remove and leave dialogs), `AsunnotKutsu` (with flats and without), `JakaminenVirheet` and `KutsuEmail`. The canvas is the reference; the notes here summarise it.

- **Sharing page** `/_authed/properties/$propertyId/sharing`:
  - Header in the style of "Omistus ja jakaminen": back to the edit form, the title "Sharing", and the street address.
  - A card listing people as in "Nykyiset omistajat": an initial in a circle, the name (or "You") and the role. The owner sees a "Remove" button on member rows.
  - Pending invitations in the same card style: the address, "Invited", and "Cancel" for the owner.
  - For the owner, an invite form below: an email field and a "Send invitation" button.
  - For a member, a "Leave flat" button.
  - The page is named "Ownership and sharing" once `track-ownership` adds the shares.
- **Edit form:** a "Sharing" link in the header, next to the title.
- **Invitations on `/`:** a yellow card per invitation above the list, or above the empty state. It shows "{inviter} jakoi sinulle asunnon", the street address, the city with the expiry date, and "Hyväksy" / "Hylkää" side by side. Accepting reloads the list and shows a snackbar ("{address} on nyt listallasi."). Declining shows "Kutsu hylätty."
- **Sending an invitation** clears the field, adds the row to "Odottaa vastausta" (pending), and shows a snackbar.
- **Removing and leaving** ask for confirmation in a dialog, because they can't be undone without a new invitation. The confirm button is red. Cancelling an invitation asks nothing.

### 8. Reasons

- New field reasons: `name_required`, `invitation_already_member`, `invitation_already_pending`
- New alert reasons: `invitation_not_found`, `invitation_limit_reached`, `invitation_daily_limit_reached`, `sharing_owner_only`
- **Email failures:** the sign-in reasons' texts talk about codes ("Koodeja ei voi lähettää juuri nyt"). Invitations therefore map `EmailError` to their own `invitation_email_quota`, `invitation_email_busy` and `invitation_email_failed`.

Each gets messages in fi, sv and en. The Finnish copy is on the Design canvas board "Jakamisen virheilmoitukset".

## Risks / Trade-offs

- [The owner's address must match the invitee's sign-in address exactly] → If someone invites a work address and the invitee signs in with a personal one, the invitation isn't shown. The Sharing page shows the invited address, so the owner can cancel and invite the right one.
- [An email is sent but the insert fails] → The recipient finds nothing to accept. Rare (the earlier checks passed) and harmless; the owner can invite again.
- [One owner per flat until `track-ownership`] → Co-owners join as members and can't invite others yet. Acceptable for a few days between two PRs; the role rule changes with shares.
- [Invitation emails share Resend's 100-a-day quota with sign-in codes] → The per-user limit of 20 a day keeps one user from using it all. Quota errors show the same message as for codes.
- [Members can edit the flat's details] → Intended: co-owners and spouses work on the same flat. A read-only role isn't needed by any scenario yet.

## Migration Plan

- One migration: create `property_invitations`. The old version ignores it.
- The `member` role is only written by the new code. If the deploy were rolled back after someone accepted an invitation, the old version would show the flat to the member, because it doesn't check the role; that is harmless.
- Users without names are asked for one on their next visit.
- Rollback: redeploy the previous version; the table stays.

## Open Questions

- Should the invitee get an email when their access is removed? Not in this change; it is easy to add later.
- **For `track-ownership`: a buyer who doesn't use Kotivalo.** Shares must add up to 100 % among users with access, so a seller alone can't record a sale to someone outside the app. The seller still needs the history for their taxes. Options: an owner without an account (a name only), archiving the flat (#64), or a "sold" state.
- **For `track-ownership` and account deletion: a flat losing its owner.** Deleting a user cascades to `property_access`, which could leave a flat with members only. No account deletion exists yet; when it comes, it must handle this, for example by refusing the deletion or handing the flat over to someone else.
