## Context

Form 7H's flat section asks for the housing company's name and Business ID and the apartment number (CONCEPT.md §4.5). A flat today stores only its street address, postcode, city, room count and floor area (`properties`). The details matter when a flat is first reported; MyTax pre-fills them in later years, so they are optional and low-stakes. The year summary (#34) will show them next to the 7H rows; this change only stores, edits and shows them.

## Goals / Non-Goals

**Goals:**
- Store the three details on the flat, optional, with a Business ID check that catches typos.
- Edit them where the flat's other details are edited, and show them on the details page.

**Non-Goals:**
- Looking up the company from the Business Information System (YTJ) or by name. It would need an external API call and gives little for a field filled in once.
- Sharing one housing company between flats, or a list of companies.
- History of the details: they are identifiers, not amounts or shares, so a correction overwrites them (the "everything is time-bound" rule is about rent, charges, shares and tenancies).
- Showing them on the flats list card or in the year summary (#34).

## Decisions

**Three nullable columns on `properties`, not a `housing_companies` table.** `housing_company_name`, `business_id` and `apartment_number`, plain `text`, null when missing. A landlord with 1–10 flats rarely has two in the same company, and access is per flat: a shared company row would need its own access rules and would let one co-owner's edit change another flat. Alternative considered: a `housing_companies` table referenced by flats, rejected for that reason.

**Empty means missing, stored as null.** The form holds strings; the Zod schema trims each value and turns an empty one into `undefined`, which the repository writes as `null`. The repository reads null back as `undefined` on `PropertyDetails`, and the edit form starts from `''`. One schema serves the form and the server function, as with the other fields.

**A pure Business ID check in `src/lib/business-id.ts`.** `isValidBusinessId(text)`: the form `^\d{7}-\d$` and the check digit (weights 7, 9, 10, 5, 8, 4, 2; remainder 0 gives 0, 1 is never valid, else 11 minus the remainder). It is shared domain knowledge, not a properties detail, so it goes to `lib/` with unit tests. Only the strict form is accepted: no hyphen inserted for eight digits, and no old six-digit IDs. The placeholder shows the form, and the field is filled once. Alternative considered: accepting `23456780` and inserting the hyphen; rejected as a guess at a typo the check digit may then hide.

**The apartment number is its own field, not taken from the street address.** Addresses are written in many ways (`Kuusikuja 3 B 12`, `Rantatie 15 as. 4`, `Koivupolku 7 A 4`), and a guess that is wrong ends up on a tax form. The placeholder suggests the form (`Esim. B 12`).

**Form section *Taloyhtiö* after *Asunto*.** Three text fields (name, Business ID, apartment number side by side with the Business ID as in the postcode/city row) and a short hint under the heading: the tax return asks for them, the property manager knows them. The section follows the form's existing `Section`; the canvas has no sketch of it, so the UI commit adds one to the "Uusi asunto" view.

**One line in the details page's header card.** Below `postcode city`, in the same muted style: the parts that are filled, joined with ` · `: name, *huoneisto B 12*, *Y-tunnus 2345678-0*. A pure `housingCompanyLine(details)` in the feature builds the parts from messages, so the joining rule has unit tests. Alternative considered: a separate card further down; rejected because it is static information about the flat, like the address.

**Words.** *Taloyhtiö* / *husbolag* / *housing company* is already in the term bank (`housingCompany`). The Business ID (*Y-tunnus* / *FO-nummer* / *Business ID*) and the apartment number (*huoneisto* as on form 7H) are added with the `translate` skill and reviewed by the `term-critic` agent in the commit that first uses them.

**Logging.** No new events: saving already logs `property.created` and `property.updated` with the flat's id. The details are company data, not personal data, but they are values and stay out of the logs like the address.

## Risks / Trade-offs

- [A real Business ID rejected by the check] → The rule is the published one, and the unit tests use IDs computed with it, including the remainder-1 case. A user can still leave the field empty.
- [Old six-digit Business IDs (`123456-7`)] → They are written with a leading zero today (`0123456-7`), which the check accepts.
- [The details page header gets one line longer] → Only when the details are filled; the line wraps on a phone.
- [Details go stale when a company changes its name] → Rare, and the user edits the flat. No history needed for a field only the first 7H uses.

## Migration Plan

One migration adds three nullable columns to `properties`. The previous Worker version ignores them, so it keeps working between the migration and the deploy. Rollback: redeploy the previous version; the columns stay unused.

## Open Questions

None.
