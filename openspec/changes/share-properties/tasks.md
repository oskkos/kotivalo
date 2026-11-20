## 1. Display name

`feat(auth): ask for a display name after the first sign-in`

- [ ] 1.1 Write `displayNameInput` in `features/authentication/schemas.ts` (trimmed, 1–50; `name_required`, `text_too_long`), with unit tests; add `name_required` to `lib/reasons.ts` with fi, sv and en messages
- [ ] 1.2 Write `features/authentication/user.repository.server.ts` (`setName`) and the `setDisplayName` server function (session check, logs `authentication.name_set` with no name), with Workers tests
- [ ] 1.3 `getSignedInUser` returns `name`; the `_authed` layout redirects to `/welcome?redirect=<path>` when it is empty; `/welcome` redirects to `/` when it isn't; only same-origin paths are accepted for `redirect` (unit test)
- [ ] 1.4 Write the `/welcome` page (logo, heading, name field, continue) from the sign-in pages' layout, with component tests; fi, sv and en messages
- [ ] 1.5 Update the e2e sign-in helper to enter a name for new accounts; Playwright for "Asking for a display name" and the modified "A new address creates an account and signs in"
- [ ] 1.6 Screenshot of `/welcome` (fi, 390 × 844) for review before the commit

## 2. Invitations table and sharing repository

`feat(sharing): add the property_invitations table and sharing repository`

- [ ] 2.1 Add `property_invitations` (design decision 1) and the `member` role to `src/server/db/schema.ts`; run `pnpm db:generate`, review and commit the migration; a Workers test checks the unique key and the cascades from `properties` and `user`
- [ ] 2.2 Write `features/sharing/sharing.repository.server.ts` (design decision 3)
- [ ] 2.3 Workers tests:
  - `accept` gives `member` access and deletes the invitation, and does nothing for another address or an expired invitation (30 days + 1 s)
  - `invite` replaces an expired invitation for the same address
  - `removeMember` and `leave` never touch the owner's row
  - `listForInvitee` doesn't return expired invitations

## 3. Inviting and cancelling

`feat(sharing): invite to a flat by email and cancel invitations`

- [ ] 3.1 Write `features/sharing/invitation-email.ts` with `renderEmail()` (inviter's name, the invited address, a button to the app; no flat address), with unit tests in each language; fi, sv and en messages
- [ ] 3.2 Write `features/sharing/schemas.ts` (`inviteInput`: property id, email normalised as in sign-in)
- [ ] 3.3 Write `inviteToProperty`, `cancelInvitation` and `getSharing` in `sharing.server.ts` and `functions.ts`, with the checks in the order of design decision 4 and the email in the recipient's language
- [ ] 3.4 Add the reason codes `invitation_already_member`, `invitation_already_pending`, `invitation_not_found`, `invitation_limit_reached`, `invitation_daily_limit_reached`, `sharing_owner_only` and `invitation_email_quota` / `_busy` / `_failed`, with the canvas's fi copy and sv and en messages
- [ ] 3.5 Workers tests:
  - the scenarios of "Inviting a user to a flat" and "Limiting invitations"
  - a failed send saves no invitation
  - log lines carry ids and no address

## 4. Accepting, declining, removing and leaving

`feat(sharing): accept, decline, remove access and leave a flat`

- [ ] 4.1 Write `listMyInvitations`, `acceptInvitation`, `declineInvitation`, `removeAccess` and `leaveProperty` (address from the session, the 100-flat limit when accepting)
- [ ] 4.2 Log `sharing.invitation_accepted`, `sharing.invitation_declined`, `sharing.invitation_cancelled`, `sharing.access_removed` and `sharing.property_left`
- [ ] 4.3 Workers tests:
  - the server-side scenarios of "Accepting a flat invitation", "Cancelling a flat invitation", "Removing access to a flat" and "Leaving a shared flat"
  - a member can edit the flat through `updateProperty`

## 5. Sharing page

`feat(sharing): add the flat's sharing page`

- [ ] 5.1 Write `features/sharing/SharingPage.tsx`, built from the "Omistus ja jakaminen" card style (design decision 7):
  - people with roles
  - pending invitations with "Cancel"
  - the invite form (TanStack Form, `TextField`)
  - "Remove" and "Leave flat" with a confirmation dialog

  Component tests per role.
- [ ] 5.2 Add the route `/_authed/properties/$propertyId/sharing` (loader, `notFound()`) and the "Sharing" link on the edit form; fi, sv and en messages
- [ ] 5.3 Playwright: inviting (the email arrives in the test inbox), the refused duplicate invitation, cancelling, and another user's not-found page
- [ ] 5.4 Screenshots of the Sharing page as owner, with an invitation and the form (fi, 390 × 844), for review before the commit

## 6. Invitations on the flats list

`feat(sharing): show flat invitations on the flats list`

- [ ] 6.1 Write `features/sharing/InvitationCards.tsx` (inviter, address, Accept, Decline), with component tests; show them on `/` above the list and the empty state
- [ ] 6.2 Playwright for the rest of the browser scenarios:
  - "Accepting a flat invitation" and "Declining a flat invitation"
  - "Listing who has access to a flat" as a member
  - removing and leaving
  - the modified "First run without flats" and "Flats are shown only to users with access" (pending invitation, member edits)
- [ ] 6.3 Screenshots of the invitation card on the list and on the empty state, and of the Sharing page as a member (fi, 390 × 844), for review before the commit
- [ ] 6.4 Update CLAUDE.md "Current state" and the glossary's access row, and CONCEPT.md's data model (`property_invitations`; `property_access` without invitation status); `pnpm check:traceability` and the full test suite pass

## 7. Archive

`docs(openspec): archive share-properties`

- [ ] 7.1 `openspec archive share-properties`, check the merged `sharing`, `authentication` and `properties` specs, and `pnpm check:traceability`
