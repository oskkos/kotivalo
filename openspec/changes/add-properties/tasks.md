## 1. Properties tables

`feat(db): add the properties and property_access tables`

- [x] 1.1 Add the `tenths(name)` column helper (a one-decimal quantity as integer tenths) to `src/server/db/columns.ts`
- [x] 1.2 Add `properties` and `property_access` to `src/server/db/schema.ts` as in design decision 1
- [x] 1.3 Run `pnpm db:generate`, review the SQL and commit the migration; a Workers test checks the tables, the primary key and the cascade from `user`

## 2. Property repository

`feat(properties): add the property repository`

- [x] 2.1 Write `features/properties/property.repository.server.ts`: `create` (property and owner access with `atomically()`), `update` (access checked in the same statement), `findForUser`, `listForUser`, `countForUser`
- [x] 2.2 Write the pure `sortByStreetAddress(properties, locale)` with `Intl.Collator` (numeric), with unit tests (`Kuusikuja 3` before `Kuusikuja 12`, `Åkerv.`/`Äijälä` order in fi)
- [x] 2.3 Workers tests: create gives the creator `owner` access and no one else; list and find return only flats with access; update of a flat without access changes nothing and returns false; count

## 3. Schemas, formatting and the choice field

`feat(properties): validate flat details and format floor areas`

- [x] 3.1 Write `parseDecimal(text, decimals)` in `src/lib/` (comma or point, spaces, too many decimals), with unit tests
- [x] 3.2 Add `formatArea(tenths, locale)` to `src/lib/format.ts` (`48,5 m²`, `49 m²`; `48.5 m²` in English), with unit tests in every locale
- [x] 3.3 Write `features/properties/schemas.ts` (design decision 3) with unit tests per reason
- [x] 3.4 Add the reason codes to `lib/reasons.ts` and their fi, sv and en messages
- [x] 3.5 Write `src/components/form/ChoiceField.tsx` (toggle buttons bound to TanStack Form, `aria-pressed`, the reason under the group, 44 px targets), with component tests; mention it in CLAUDE.md "Forms and validation"

## 4. Property server functions

`feat(properties): add the property server functions`

- [x] 4.1 Write `features/properties/functions.ts`: `listProperties`, `getProperty`, `createProperty`, `updateProperty`, each checking the session, with the logic in a testable `*.server.ts` taking its dependencies like `sign-in.server.ts`
- [x] 4.2 The limit of 100 flats (`property_limit_reached`), `property_not_found` for a flat without access
- [x] 4.3 Log `property.created`, `property.updated` (info, `propertyId`) and `property.limit_reached` (warn)
- [x] 4.4 Workers tests for every scenario of "Flats are shown only to users with access" and "Limiting the number of flats", and that the log lines carry ids and no address

## 5. New and edit flat screens

`feat(properties): add the new flat and edit flat screens`

- [x] 5.1 Write `features/properties/PropertyForm.tsx` from the "Uusi asunto" board's address and flat sections, with component tests (prefilled values, field errors, saving state, a server reason as an alert)
- [x] 5.2 Add the routes `/_authed/properties/new` and `/_authed/properties/$propertyId/edit` (loader, `notFound()`, `notFoundComponent`)
- [x] 5.3 Add the fi messages from the canvas, then sv and en
- [x] 5.4 Playwright: the field errors of "Adding a flat", and the not-found page for a flat id that doesn't exist (scenarios that need a saved flat's id move to group 6, where the list leads to it)
- [x] 5.5 Screenshots of the new and edit forms (fi, 390 × 844) for review before the commit

## 6. Flats list as the home page

`feat(properties): list flats on the home page`

- [ ] 6.1 Write `features/properties/PropertyList.tsx` and `PropertyCard.tsx` from the "Asunnot" board (header with the logo and the add button, title and count, cards linking to the edit form), and the empty state; component tests
- [ ] 6.2 Replace the placeholder home page at `/_authed/` with the list; move sign-out to the end of the list; remove `home_signed_in_as` and the placeholder's test
- [ ] 6.3 Update the authentication e2e tests and the delta scenario "A new address creates an account and signs in" (lands on the empty flats list)
- [ ] 6.4 Playwright: the remaining scenarios of "Adding a flat", "Editing a flat", "Listing flats", "First run without flats" and "Flats are shown only to users with access"
- [ ] 6.5 Screenshots of the list and the empty state (fi, 390 × 844) for review before the commit
- [ ] 6.6 Update CLAUDE.md "Current state"; `pnpm check:traceability` and the full test suite pass

## 7. Archive

`docs(openspec): archive add-properties`

- [ ] 7.1 `openspec archive add-properties`, check the merged `properties` and `authentication` specs, and `pnpm check:traceability`
