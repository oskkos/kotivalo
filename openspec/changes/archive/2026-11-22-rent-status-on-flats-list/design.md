## Context

#33 added rent payments, the expected rent and rent status of a month as pure functions (`features/rent-payments/status.ts`), and the flat details page, whose rent card shows this month's status for the current tenancy. The flats list (`/`, `features/properties/PropertyList.tsx`) shows each flat's tenancy status chip from `listTenancyStatuses`, but nothing about rent. The Design canvas board *Asunnot · vuokran tila* (`AsunnotMaksut`) has the summary card above the cards and a rent chip next to the tenancy chip. The user decided on 22.11.2026 that the summary counts each flat's whole rent.

## Goals / Non-Goals

**Goals:**
- The flats list answers "has this month's rent come in, and is anyone late" without opening a flat
- The card's rent chip says exactly what the details page's rent card says
- No new calculation: reuse `rentMonth()` and the status texts

**Non-Goals:**
- Earlier months not fully paid on the list
- The user's own share of the rent
- Changing the flats list's other parts (owners line, tenancy chip, invitations)

## Decisions

### One server function returns raw data; the browser computes

`listRentThisMonth` in `features/rent-payments/functions.ts`, with its logic in `rent-payments.server.ts`, returns:

- `today` (in Finland)
- per flat the user has access to: the tenancies running in this month (`tenancies.currentFor(ids, firstDayOfMonth)`, so a tenancy that ended earlier this month is still there), the rent periods, and the payments recorded for this month's rent

The browser then calls the pure functions, as the details page does. That keeps one code path for the card chip and the details page's rent card, and the server's `today` keeps the server render and the browser's in step.

Alternative: return the computed statuses from the server, as `listTenancyStatuses` does. Rejected: the rent status needs the payments and rent periods anyway to compute, and the details page already computes it in the browser; computing it in two places invites drift.

Access: one `listForUser` read gives the flat ids; every other read is by those ids. Members are included, because they see the rent card on the details page too.

Repository reads, one statement each, in their own features (the server function reads them through the repositories directly, like `getFlatDetails`, so access is checked once):

- `recurringAmountRepository(db).rentFor(propertyIds)`: the rent periods by flat id
- `rentPaymentRepository(db).forMonth(propertyIds, month)`: the payments of the flats' tenancies for that month, without the recorder's name (the list doesn't show it)

With 1–10 flats this is three small reads besides the flats list itself.

### The summary is a pure function over the flats

`rentThisMonth(flats, today)` in `features/rent-payments/status.ts`, with unit tests, returns:

- per flat: the card's row, `rentMonth()` of the current tenancy (`currentTenancy()`) when it starts on or before this month's last day, the same rule as the details page's rent card; otherwise none
- `expected`: the sum of `expected` over every tenancy's row of this month (`rentMonths()` from the first to the last day of the month) where a rent is in effect
- `received`: the sum of `paid` over the same rows
- `late`: the number of flats whose card row is late

The late count follows the chips, so the number matches what the user sees on the cards. An earlier tenancy's late month (the tenant changed mid-month) counts in the totals but not in the late count; the details page warns about it.

`received` is not capped at `expected`: it shows what was recorded. A row without a rent in effect is left out of both totals, so a payment recorded for it doesn't make the summary look overpaid.

The summary is shown when at least one row has a rent in effect; otherwise the list looks as before.

### Components

- `features/rent-payments/RentSummary.tsx`: the card with the month title ("Marraskuun vuokrat"), `received / expected saatu`, a progress bar (the details page's `PaidBar`), and the late count chip when above zero. A `region` labelled by the title.
- `features/rent-payments/CardRentChip.tsx`: `StatusChip` with the short texts the list needs: *Maksettu* and *Osittain maksettu* without the date or amount (`rent_short_*`), *Myöhässä N pv*, *Erääntyy D.M.*, *Vuokraa ei asetettu* and *Ei maksettavaa* as on the details page.
- `PropertyList.tsx` gets a `summary` slot above the notices and a second chip slot per card (`rentStatuses`), as `statuses` today; the route composes them, so `properties` doesn't import `rent-payments` components.

## Risks / Trade-offs

- [The summary counts a co-owner's whole rent, which is more than their own income] → decided by the user; the title says "vuokrat", not "tulot", and the year summary (#34) will use shares.
- [A mid-month tenant change with a different rent shows the outgoing tenant's part with the new rent] → the known limitation of "Expected rent of a month"; the summary inherits it.
- [Months are the server's month in Finland; a user abroad near midnight sees Finland's month] → as everywhere else in the app.
