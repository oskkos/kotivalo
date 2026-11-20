## Why

Flats are often co-owned, and each owner's tax figures depend on their share and on when it applied (#29). `share-properties` brought co-owners into a flat as members; this change records **who owns how much, from when**, as validity periods, so the year summary can split income and expenses correctly when ownership changes mid-year.

## What Changes

- **Ownership periods.** Each flat has a list of owners with shares (in basis points, together exactly 100 %), valid from a date until the next change. Periods are never overwritten. A 0 % share is not stored: someone with access and no share is a member, which means visibility only.
- **The first period.** The new flat form gets an Ownership section with "Owned since" (default today). The user who adds the flat owns 100 % from that date. Existing flats get a period from the day they were added.
- **Changing ownership.** On the flat's page, renamed **Ownership and sharing**, an owner records a new split:
  - It is a free list of everyone with access to the flat, not only two people.
  - Each entry has a share; quick choices are "All to me" and "Equal shares".
  - The change has a date (after the current period's start, today at the latest) and a reason: sale, gift, inheritance, division of property / divorce or other.
  - A person whose share drops to 0 % can lose their access in the same step.
- **Roles follow shares.** Anyone with a current share above 0 % is an owner and can invite, remove members and change ownership. Anyone else with access is a member. A flat always has at least one owner.
- **Correcting mistakes.** Owners can undo the latest ownership change, which reopens the previous period. They can also correct the start date of the first period. Older history stays as it is.
- **History.** The page lists every period: its date, its split and its reason.
- **The card's ownership line.** Each flat card on the list shows "You 50 % · Annika 50 %", or "Annika 100 % · shared with you" for a member.

Not in this change:
- a former owner's read access to their own period (after transactions exist)
- a sale to a buyer who doesn't use Kotivalo (see the design's open questions)
- estates (#20)
- the tax-consequence note (#21)
- the year summary itself (M2)

## Capabilities

### New Capabilities

- `ownership`: ownership periods and shares, the first period, changing ownership, roles that follow shares, undoing the latest change, correcting the first start date, and the history.

### Modified Capabilities

- `properties`:
  - "Adding a flat" asks for the ownership start date.
  - "Listing flats" shows the ownership line on each card.
- `sharing`:
  - Several owners can now exist, so the owner is anyone with a share above 0 %, not only the user who added the flat.
  - "Removing access to a flat" and "Leaving a shared flat" apply to members only; owners leave through an ownership change.
  - The page's name becomes "Ownership and sharing".

## Impact

- **Tables:** new `ownership_periods` (id, property id, user id, share in basis points, `valid_from`, `valid_to`, reason). A migration backfills one 100 % period for each existing flat's owner, starting on the day the flat was created. `property_access.role` is now kept in step with the shares.
- **Code:**
  - `features/ownership/`: a repository, pure functions for shares and periods (validation, the split on a date) with unit tests, server functions, the ownership section and change form.
  - `features/properties/`: the form's "Owned since" field, and the card's ownership line.
  - `features/sharing/`: role checks use the roles that ownership now maintains.
- **Screens:** "Omistus ja jakaminen" and the Ownership section of "Uusi asunto" on the Design canvas.
  - The change form becomes a free list. CONCEPT.md had raised that the sketch handles only two owners.
  - The undo action and the first-date correction aren't sketched. They are drawn on the canvas before implementation.
- **Messages:** fi, sv and en for the screens and the new reason codes.
