## Context

The first domain feature. The database has only Better Auth's tables and `rate_limit`; there are no repositories yet, so this change sets the pattern the following features copy: schema and migration, an aggregate repository, Zod schemas with reason codes, server functions that check the session, TanStack Form screens and Playwright tests.

The Design canvas has "Asunnot" (Flats) and "Uusi asunto" (New flat). This change builds the address and flat sections of the form and the address lines of the card. Owners (#29), rent and charges (#31) and the tenant (#30) add their sections later.

## Goals / Non-Goals

**Goals:**
- Add, edit and list flats, with access per flat from the start.
- The first repository, server functions with access checks, and forms with server-side validation, as patterns for the next features.

**Non-Goals:**
- Ownership periods and shares, invitations, rent and charges, tenancies, rent status, the monthly summary, the flat details page, the bottom navigation bar, deleting a flat.

## Decisions

### 1. Tables

```
properties
  id            text pk (id())
  street_address text not null        -- "Kuusikuja 3 B 12"
  postcode      text not null          -- 5 digits, text: leading zeros
  city          text not null
  room_count    integer not null       -- 1, 2, 3 or 4 (= 4 or more)
  floor_area    integer not null       -- tenths of m²: 485 = 48,5 m²
  created_at    integer not null (instant())
  updated_at    integer not null (instant())

property_access
  property_id   text not null → properties.id (on delete cascade)
  user_id       text not null → user.id (on delete cascade)
  role          text not null          -- 'owner' (only value for now)
  created_at    integer not null (instant())
  primary key (property_id, user_id)
  index on user_id
```

- **Room count as 1–4 where 4 means "4 or more"**, matching the canvas's four choices. It is shown, not calculated with, so a five-room house losing its exact count costs nothing today. *Alternative:* an exact count with a number field behind "4h+"; more UI for no current use. Easy to widen later (values stay valid).
- **Floor area as integer tenths of m²**, like money in cents: exact, portable, sortable. A new helper `tenths(name)` in `columns.ts` documents the unit. *Alternative:* a `real` column; floats are what the money rule avoids.
- **The address in three columns**, as on the canvas and in the data model draft. No address validation beyond required and the 5-digit postcode: Finland only, as the product is.
- **`property_access` without invitation status for now.** #29 adds invitations, which can be for an email address with no account yet, so they likely need their own table or nullable `user_id`; deciding that belongs with #29. `role` is text with one value so #29 can add more without a migration of existing rows.
- **No `ownership_periods` row on create.** Shares are #29's; until then the creator's access is what makes the flat theirs.

### 2. Repository

`features/properties/property.repository.server.ts`: `propertyRepository(db)` with

- `create(userId, details, now)`: inserts the property and the owner access with `atomically()`.
- `update(userId, id, details, now)`: one `UPDATE … WHERE id = ? AND id IN (SELECT property_id FROM property_access WHERE user_id = ?)`; returns whether a row changed. The access check is in the same statement, so there is no read-then-write gap.
- `findForUser(userId, id)`, `listForUser(userId)`: joined through `property_access`; a flat without access is `undefined`, the same as a missing one.
- `countForUser(userId)`: for the limit.

Sorting by street address happens in a pure function with `Intl.Collator(locale, { numeric: true })`, so `Kuusikuja 3` comes before `Kuusikuja 12` and å/ä/ö sort as in Finnish and Swedish. SQLite's `ORDER BY` compares bytes. With at most 100 flats per user, sorting in the Worker costs nothing.

### 3. Validation

`features/properties/schemas.ts`, one Zod schema used by the form and the server functions' `inputValidator`:

- `streetAddress`, `city`: trimmed, 1–100 characters (`street_address_required`, `city_required`, `text_too_long`)
- `postcode`: `/^\d{5}$/` after trimming (`postcode_invalid`)
- `roomCount`: 1–4 (`room_count_required`)
- `floorArea`: the form sends the text the user typed; a shared `parseDecimal(text, decimals)` in `lib/` accepts `48,5`, `48.5` and spaces, and returns tenths or a reason (`floor_area_invalid`: not a number, more than one decimal, outside 1–10 000 m²)

New reason codes go in `lib/reasons.ts` with messages in fi, sv and en. `property_not_found` and `property_limit_reached` are alert reasons.

### 4. Server functions

`features/properties/functions.ts`: `listProperties`, `getProperty({ id })`, `createProperty(details)`, `updateProperty({ id, ...details })`.

- Each checks the session itself (`auth.getSession()`); no session throws, as the layout already redirects pages.
- `createProperty` checks `countForUser < 100` and returns `property_limit_reached` otherwise. The count and the insert are separate statements, so two simultaneous requests at 99 could reach 101; the limit bounds abuse, it is not an invariant, so this is accepted.
- `updateProperty` and `getProperty` return `property_not_found` for a flat without access.
- Logging: `property.created` and `property.updated` at `info` with `propertyId`; `property.limit_reached` at `warn`. No address or other values.

### 5. Routes and screens

- `/_authed/` (`/`): the list. The loader calls `listProperties`. Empty → the empty state.
- `/_authed/properties/new` and `/_authed/properties/$propertyId/edit`: the same `PropertyForm`. The edit loader calls `getProperty` and throws `notFound()` for `property_not_found`; the route's `notFoundComponent` shows "Flat not found" with a link to `/`.
- The form follows "Uusi asunto": a close button to `/`, the Osoite section (street, postcode and city side by side), the Asunto section (room count as four toggle buttons, floor area), and a fixed "Save flat" button at the bottom. The edit form's title is "Edit flat".
- The room count uses a new `form/ChoiceField.tsx` (a group of toggle buttons bound to TanStack Form, with the reason under it), to be reused by later choices (e.g. contract type).
- Saving navigates to `/` with `router.invalidate()` so the list reloads.
- The card follows the canvas: the house mark, street address, `City · Kaksio 48,5 m²`. The rows for owners, status and rent are left out until their features exist.
- Sign-out: a text button at the end of the list page until the Account page exists.

## Risks / Trade-offs

- [Two requests at 99 flats can both pass the limit] → Accepted: the limit bounds abuse, it isn't a domain rule.
- [The card opens the edit form, not details] → #33 changes the link; the spec scenario "Selecting a flat opens its edit form" is then modified in that change.
- [Room count 4 loses exact counts above four] → Stored as 4; an exact count can be added later without breaking stored values.
- [No delete] → A flat added by mistake stays until a delete feature exists. Raised as a follow-up; deleting will need to handle shares and entries, so it is not trivial to add here.

## Migration Plan

New tables only: the migration runs before the new code is live and the old version ignores the tables. Rollback: redeploy the previous version; the tables stay.

## Open Questions

- Should deleting a flat get its own issue now? (Recommended: yes, in M1, after entries exist so that its rules are known.)
