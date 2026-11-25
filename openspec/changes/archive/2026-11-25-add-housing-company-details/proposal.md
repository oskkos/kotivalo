## Why

Form 7H asks for each flat's housing company name and Business ID (Y-tunnus) and the apartment number (#16, CONCEPT.md §4.5). They are needed when a flat is first reported to the Tax Administration; after that MyTax pre-fills them. Storing them on the flat puts them next to the year summary's figures (#34) and saves looking them up from the property manager again. Issue #118.

## What Changes

- A flat gets three optional details: the housing company's name, its Business ID and the apartment number (e.g. `B 12`).
- The new flat and edit flat forms get a section *Taloyhtiö* with the three fields and a hint that they are for the tax return. Leaving them empty is fine, so existing flats and quick adds keep working.
- A Business ID is checked for its form (seven digits, a hyphen, a check digit) and its check digit; spaces around it are dropped.
- The flat details page shows the details that are filled in, below the address in the header card.
- No year summary yet: #34 shows these details next to the 7H rows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `properties`: adding and editing a flat include the optional housing company details ("Adding a flat", "Editing a flat"), and a new requirement "Housing company details of a flat" covers the fields, the Business ID check and what the details page shows.

## Impact

- **Tables:** `properties` gets three nullable columns, `housing_company_name`, `business_id` and `apartment_number`, with a migration. No new tables, nothing to add to the flat deletion cascade test.
- **Code:** `features/properties/` (`schemas.ts`, `property.ts`, the repository, `functions.ts`, `PropertyForm.tsx`, `FlatDetailsPage.tsx` and its server read), a pure Business ID check in `src/lib/business-id.ts`, a new reason `business_id_invalid` in `src/lib/reasons.ts`, messages in fi / sv / en, and the term bank for *Y-tunnus* and the apartment number.
- **Screens:** the new flat and edit flat forms (Design canvas: "Uusi asunto"; the canvas has no housing company section, which follows the form's existing section style) and the flat details page header card (Design canvas: "Asunnon tiedot").
- **Dependencies:** none.
