## Why

Besides the maintenance and financing charges, a housing company bills the owner monthly for things like water (usually per person), a parking space or a sauna slot, and the tenant often pays the owner for the same things on top of the rent, taking or dropping them during the tenancy. Today both sides are logged by hand as entries, nothing knows the monthly amounts or the number of persons, and a fee paid with the rent makes the rent status wrong, because the expected rent leaves it out (issue #100). The year summary (#34) needs these amounts as periods before it is built.

## What Changes

- **Usage charges (*käyttömaksut*) on the flat**, a new capability kept apart from the charges (*Vastikkeet*): named monthly charges from the housing company of the kind water, parking, sauna or other (other with a required description, e.g. "Pyykkitupa"), each with a basis, fixed €/month or €/person/month, and its amounts as monthly validity periods with the charges' rules (from the first of a month, correction on the latest start, undo the latest, end with 0 €, undoing the only amount removes the charge). Owners add, change, end and undo them; everyone with access sees them.
- **A per-person usage charge** is multiplied by the number of occupants of the tenancy running on the month's first day, or by one when the flat is vacant (agreed: a fixed minimum of one person).
- **The Usage charges page** (own page, opened from a new *Käyttömaksut* card on the flat details page) and **the usage charges by month page** (*Käyttömaksut kuukausittain*), computed from the periods and the occupants, never stored. The *Vastikkeet* pages stay as they are.
- **Occupants on the tenancy:** the number of persons living in the flat, as periods of the tenancy (agreed): the first from the tenancy's start, changes from the first of a month, correction on the latest start, undo the latest. The new tenant form asks for it (default 1). Existing tenancies get one occupant from their start.
- **Tenant fees (*maksut vuokran lisäksi*) on the tenancy:** fees the tenant pays on top of the rent (water, parking, sauna, other with a description), fixed or per occupant, each with its own periods inside the tenancy, so one can start or end mid-tenancy. "Included in the rent" is the default, with no fee. They are not linked to the usage charges in any way (agreed). The new tenant form offers the previous tenancy's fees, unchecked.
- **The expected rent of a month includes the tenant fees,** each part by days in a partial month like the rent. The rent status, the payment form's default amount, the flats list summary and the cards follow. A payment stays one amount. The month's payments page shows the breakdown (rent and each fee); the flat details page shows only the total.
- **Correcting, ending or removing a tenancy** can't leave a fee or occupants change outside it, as with the rent; a corrected start moves their first periods.
- **Double counting:** existing entries are not moved or deleted (agreed). Adding a water usage charge or a tenant water fee warns about `water_charge` or `tenant_water_charge` entries from its start date on, with a link to the entries.

## Capabilities

### New Capabilities

- `usage-charges`: a flat's usage charges (kind, description, basis, amount periods), adding, changing, ending, undoing and removing them, the Usage charges page, a month's usage charges with per-person amounts from the occupants, the usage charges by month page, the warning about water charge entries, and the form 7H row of each kind.

### Modified Capabilities

- `tenancies`: occupants and tenant fees as periods of the tenancy, the new tenant form asking for the occupants and offering the previous tenancy's fees, the Tenancy page's occupants row and fees card, changing and undoing them, keeping them inside the tenancy on correcting, ending and removing, and the existing tenancies' first occupants.
- `rent-payments`: the expected rent of a month is the rent and the tenant fees, each by days; the month's payments page shows the breakdown; the payment form's default and the statuses follow.
- `properties`: the flat details page gets the *Käyttömaksut* card with this year's usage charges, and the rent card's expected rent includes the fees.

## Impact

- **Tables:** adds `usage_charges` (id, `property_id` → `properties` cascade, `kind`, `basis`, `description`), `usage_charge_amounts` (id, `usage_charge_id` → `usage_charges` cascade, `amount` in cents, `valid_from` / `valid_to`), `tenancy_occupants` (id, `tenancy_id` → `tenancies` cascade, `persons`, validity), `tenant_fees` (id, `tenancy_id` → `tenancies` cascade, `kind`, `basis`, `description`) and `tenant_fee_amounts` (id, `tenant_fee_id` → `tenant_fees` cascade, `amount`, validity). Migration `0010` creates them and gives every existing tenancy one occupant from its start. No existing table changes.
- **Code:** new `features/usage-charges/` (repository, pure month and year calculations, server functions, pages and forms); `features/tenancies/` (occupants and fees in the repository and the tenancy writes, pure period rules, the Tenancy page's occupants row and fees card, the fee form, the new tenant form); `features/rent-payments/status.ts` (expected rent with the fees, the breakdown) and its pages; `features/properties/FlatDetailsPage.tsx` and `details.server.ts`. Period helpers from `recurring-amounts/periods.ts` are reused, not copied.
- **Routes:** adds `/properties/$propertyId/usage-charges` (with `new`, `$usageChargeId` and `months`) and `/properties/$propertyId/tenancy/$tenancyId/fees/new` and `/fees/$feeId`.
- **Messages:** fi / sv / en for the new pages, forms, kinds, reasons and log-free UI copy; the term bank gets *käyttömaksu* (usage charge), *asukasmäärä* (occupants) and *maksu vuokran lisäksi* (tenant fee) through the translate skill and the term-critic.
- **Design canvas:** row "Käyttömaksut ja vuokralaisen maksut (#100)": Asunnon tiedot · vastikkeet ja käyttömaksut erikseen, Käyttömaksut (oma sivu), Lisää käyttömaksu, Käyttömaksut kuukausittain, Vuokrasuhde · asukkaat ja maksut, Lisää maksu vuokran lisäksi, Uusi vuokralainen · asukkaat ja maksut, Merkitse vuokra maksetuksi · maksut mukana, Kuukauden vuokra · erittely, Vuokranmaksut · maksut mukana.
- **To verify:** the form 7H row for parking, sauna and other usage charges (assumed 2.5 *Muut kulut*; water 2.2, tenant fees 2.1) against the Tax Administration's 7H instructions (#16) before the rows are written; the year summary (#34) uses them later.
- **Later:** the year summary (#34) reads the usage charges and the tenant fees. Metered water readings and balancing invoices stay entries.
