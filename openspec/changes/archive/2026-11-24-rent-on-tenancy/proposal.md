## Why

The rent is income agreed in the tenancy, but today it is a flat-level validity period set on the Rent and charges page next to the housing company's charges. A vacant flat can have a rent, a tenancy starting before the latest rent period can't set its own rent (`rentAsked`), and when tenants change mid-month both tenancies' parts of the month use the same rent (the known limitation in "Expected rent of a month"). Rent payments are already recorded per tenancy, and tenant fees (#100) will go on the tenancy next to the rent, so the rent moves there now, before the year summary (#34) starts reading it (issue #102).

## What Changes

- **BREAKING (data):** each tenancy has its own rent periods in a new table `tenancy_rents`. The first period starts on the tenancy's start day; later changes start on the first of a month inside the tenancy. A vacant flat has no rent.
- The migration copies the flat's existing rent periods into the tenancies they overlap, clipped to each tenancy. Periods outside every tenancy are left out. The same migration then deletes the `recurring_amounts` rows of kind `rent`, and `rent` is no longer a kind of recurring amount.
- **The Tenancy page gets a rent card:** the rent in effect today, the upcoming change, the change history, "Muuta" (change the rent from a date inside the tenancy) and "Peru viimeisin muutos" (undo the latest change, never the first rent), owners only. Earlier tenancies in the list show their last rent.
- **The new tenant form always asks for the rent** (required, also for an earlier tenancy), prefilled from the previous tenancy's latest rent. The `rentAsked` special case goes away.
- **Correcting a tenancy's start moves the first rent period's start with it.** Correcting, ending or removing a tenancy can't leave a rent change outside it, just as with rent payments. Removing a tenancy that hasn't started removes its rent periods.
- **Expected rent, the rent status, the flats list summary and the flat cards** read the tenancy's own rent. The mid-month tenant change limitation is gone: each tenancy's part of the month uses its own rent.
- **The Rent and charges page becomes Charges (Vastikkeet):** the maintenance charge, the financing charges and their treatment. Setting and undoing a rent there is removed.
- **The flat details page** shows the rent on the tenancy card (with an upcoming change); the charges card and the menu entry become "Vastikkeet".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tenancies`: the rent belongs to the tenancy: its periods, changing and undoing it on the Tenancy page, the rent always asked for a new tenancy, a corrected start moving the first rent period, rent changes staying inside the tenancy, removing a tenancy with its rent, and moving the existing rents to their tenancies.
- `recurring-amounts`: the rent is removed: the periods, the page (now Charges), setting and undoing cover the maintenance charge and the financing charges only.
- `rent-payments`: the expected rent of a month comes from the tenancy's own rent periods; the mid-month limitation is removed.
- `properties`: the flat details page shows the rent on the tenancy card, and the charges card and menu entry are named Charges.

## Impact

- **Tables:** adds `tenancy_rents` (id, `tenancy_id` → `tenancies` with cascade, `amount` in cents, `valid_from` / `valid_to`), with migration `0009` that fills it from `recurring_amounts` and then deletes the `recurring_amounts` rows of kind `rent`. `RECURRING_AMOUNT_KINDS` loses `rent`.
- **Code:** `features/tenancies/` (repository, server functions, rent periods and their rules, the Tenancy page's rent card, the rent change form, the new tenant form; `rent.ts` and `rentAsked` replaced), `features/recurring-amounts/` (rent removed from the repository, page, forms, labels and the `$kind` route), `features/rent-payments/` (`expectedRent` and the summaries take each tenancy's rent periods), `features/properties/FlatDetailsPage.tsx` and `details.server.ts`.
- **Routes:** adds `/properties/$propertyId/tenancy/$tenancyId/rent` (the rent change form); `/properties/$propertyId/amounts/rent` stops existing; the amounts page keeps its URL with the title Vastikkeet.
- **Messages:** new and changed fi / sv / en messages for the rent card, the rent form, the new reasons and the renamed page, with the term bank (`Vastikkeet` as the page title).
- **Tests:** e2e helpers that set the rent on the Rent and charges page (`e2e/support/amounts.ts`, used by the rent payment, flat details and flats list tests) set it through the new tenant form instead.
- **Design canvas:** row "Vuokra vuokrasuhteella (#102)": Asunnon tiedot · vuokra vuokrasuhteella, Vuokrasuhde · vuokra ja muutokset, Muuta vuokraa · vuokrasuhteelle, Uusi vuokralainen · vuokra pakollinen, Vastikkeet · ilman vuokraa.
- **Later:** the year summary (#34) reads the tenancy's rent; tenant fees (#100) go on the tenancy next to the rent.
