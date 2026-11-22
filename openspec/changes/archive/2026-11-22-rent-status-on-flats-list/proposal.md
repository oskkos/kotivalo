## Why

Rent payments and the monthly rent status landed with the flat details page (#33), but an owner with several flats still has to open each one to see whether this month's rent has come in. The flats list is the home page, so it should answer that at a glance: how much of this month's rent has been received, and which flat is late (#96, CONCEPT.md §3).

## What Changes

- **A rent summary at the top of the flats list:** this month's rent received out of the rent expected, across all the flats the user has access to, and how many flats are late. "Marraskuun vuokrat · 640,00 € / 1 530,00 € saatu · Vuokra myöhässä 1 asunnossa".
  - It counts each flat's whole rent, also for co-owned flats and for members, as the details page shows it (decided 22.11.2026).
  - The expected rent is the sum of this month's expected rent of every tenancy that runs in the month ("Expected rent of a month"): a month a tenancy starts or ends in counts by days, and when the tenant changes mid-month, both tenancies' parts count.
  - The received rent is the sum of the payments recorded for this month's rent of those tenancies, whatever their payment date.
  - A tenancy without a rent in effect this month is left out of both. Without any rent this month (all flats vacant, or no rents set), the summary is not shown.
- **A rent status chip on each rented flat's card,** next to the tenancy status chip: *Maksettu*, *Osittain maksettu*, *Myöhässä N pv*, *Erääntyy D.M.*, *Vuokraa ei asetettu* or *Ei maksettavaa*, for the same tenancy and month as the details page's rent card. A vacant flat, and one whose tenancy starts after this month, gets no rent chip.
- The statuses are computed in the browser with the existing pure functions (`features/rent-payments/status.ts`) from raw data and the server's `today`, as on the details page.

Not in this change:
- earlier months not fully paid on the flats list (the details page and the rent payments page warn about them)
- the user's own share of the rent (the year summary, #34, handles shares)

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `rent-payments`: new requirements "The rent summary on the flats list" and "The rent status on a flat's card".
- `properties`: "Listing flats": the card shows this month's rent status, and the list starts with the rent summary.

## Impact

- **Tables:** none added or altered. The repositories get reads across the user's flats: the rent periods of several flats, and the payments of several flats for one month.
- **Server:** a new server function in `features/rent-payments/` returning, for the user's flats, today, the tenancies running this month, the rent periods and this month's payments.
- **UI:** the flats list `/` (Design canvas: *Asunnot · vuokran tila*, `AsunnotMaksut`). `PropertyList.tsx` gets a summary slot; the route loader adds the new server function.
- **Messages:** the summary's title, amounts and late count in fi, sv and en.
