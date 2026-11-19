## Why

Kotivalo has sign-in but nothing to sign in to: the home page is a placeholder. Flats are the root of everything else (ownership, tenancies, rent, entries, the year summary), so the user must first be able to add, edit and list them (#28).

## What Changes

- A signed-in user can **add a flat**: street address, postcode, city, room count (1, 2, 3, 4+) and floor area. The user who adds it gets access to it as an owner.
- A user can **edit** the same details of a flat they have access to.
- **`/` becomes the flats list**, replacing the placeholder home page: one card per flat (street address, city, room count and floor area), sorted by street address, with the number of flats. Selecting a card opens its edit form until the flat details page exists (#33).
- **First run without flats:** an empty state with an "Add flat" button (from #26; that issue keeps invitation acceptance).
- **Access is per flat:** a user sees and changes only flats they have access to; another user's flat behaves as if it didn't exist.
- **A user can have at most 100 flats**, which bounds what one account can write to D1 under open sign-up.
- Sign-out moves from the placeholder to the bottom of the flats list, until the Account page exists.

Not in this change (each comes with its own issue and adds its section to the same form and card): owners and shares (#29), rent and charges (#31), tenant (#30), rent status and the monthly summary (#25, #33), the bottom navigation bar (when a second tab exists), deleting a flat.

## Capabilities

### New Capabilities

- `properties`: adding, editing and listing flats, the empty state, per-flat access and the flat limit.

### Modified Capabilities

- `authentication`: "Sign in with an emailed code": a new user lands on `/`, which is now the flats list (empty for a new account) instead of a page showing their email address.

## Impact

- **Tables:** `properties` (id, street address, postcode, city, room count, floor area, created/updated) and `property_access` (property id, user id, role `owner`, created), with a migration. The invitation status from the data model draft comes with #29, which adds invitations.
- **Code:** `features/properties/` (repository, schemas, server functions, form and list components), routes `/` (list), `/properties/new`, `/properties/$propertyId/edit`; the placeholder home page and its test go.
- **Screens:** "Asunnot" (Flats) and "Uusi asunto" (New flat) on the Design canvas, the address and flat sections only. The empty state and the edit form's title aren't sketched; they are built from the theme and the New flat board.
- **Shared:** a column helper for one-decimal quantities, `formatArea()` in `lib/format.ts`, a decimal parser that accepts `48,5` and `48.5`, and a segmented choice field for TanStack Form.
- **Messages:** fi, sv, en for the screens and the new reason codes.
