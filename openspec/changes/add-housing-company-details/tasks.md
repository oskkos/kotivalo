## 1. Schema and migration

- [x] 1.1 Add the nullable `housing_company_name`, `business_id` and `apartment_number` text columns to `properties` in `src/server/db/schema.ts`, with comments
- [x] 1.2 Run `pnpm db:generate`, check the SQL only adds the three columns, commit the migration, and apply it with `pnpm db:migrate:local`

## 2. Business ID check, schemas and repository

- [x] 2.1 Add `isValidBusinessId()` to `src/lib/business-id.ts` with unit tests named after the scenarios "A Business ID with a wrong check digit is not saved" and "A Business ID in the wrong form is not saved" (`2345678-0` valid, `2345678-9`, `2345678`, `23456780`, `3141592-0` invalid, a remainder-0 ID)
- [x] 2.2 Add the field reason `business_id_invalid` to `src/lib/reasons.ts` and its Finnish, Swedish and English messages; add the term *Y-tunnus* / *FO-nummer* / *Business ID* (`businessId`) with the `translate` skill, reviewed by the `term-critic` agent
- [x] 2.3 Extend `propertyDetailsInput` in `features/properties/schemas.ts` with the three optional fields (trimmed, empty becomes missing, name up to 100 and apartment number up to 20 characters, the Business ID through `isValidBusinessId`), with schema tests for "Spaces around the details are dropped"
- [x] 2.4 Add the optional fields to `PropertyDetails` in `property.ts`, and read and write them in `property.repository.server.ts` (null when missing), with Workers tests for "A flat without housing company details" and "Clearing the housing company details"
- [x] 2.5 Pass them through the create and update server functions and `getFlatDetails`, with Workers tests for saving them, for "A member can set the housing company details", and that `property.updated` logs the id and no values

## 3. Form, details page and browser tests

- [x] 3.1 Add the section *Taloyhtiö* to `PropertyForm.tsx` (name, Business ID and apartment number, the hint) and the empty values to `EMPTY_PROPERTY` and the edit form's initial values, with component tests
- [x] 3.2 Add `housingCompanyLine()` to the feature (the filled parts joined with ` · `), with unit tests for "Only the filled-in details are shown", and show it in the details page's header card
- [x] 3.3 Add the Finnish, Swedish and English messages for the section, labels, placeholders, hint and the line's parts, adding the apartment number term with the `translate` skill, reviewed by the `term-critic` agent
- [x] 3.4 Playwright tests in `e2e/` under "Housing company details of a flat" for "Adding a flat with its housing company details", "A flat without housing company details", "A Business ID with a wrong check digit is not saved", "Clearing the housing company details" and "A member can set the housing company details", and update "The edit form shows the current details" under "Editing a flat"
- [x] 3.5 Add a "Taloyhtiö" section to the "Uusi asunto" view on the Design canvas, and describe the housing company details in CLAUDE.md's "Current state"

## 4. Verification

- [ ] 4.1 Run `pnpm lint`, `pnpm typecheck`, the whole `pnpm test`, the whole `pnpm test:e2e` and `pnpm check:traceability`, all passing, then the `pr-review` skill

## 5. Archive

- [ ] 5.1 Archive the change with `openspec archive add-housing-company-details` as the PR's last commit
