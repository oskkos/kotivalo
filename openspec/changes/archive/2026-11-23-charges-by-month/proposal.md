## Why

A flat's maintenance charge and financing charge are monthly periods (#31), computed on the fly and never stored as entries. The Rent and charges page shows the periods, but nowhere shows which charges fell in which month and how much they came to in a year. The rent payments page answers that question for rent; charges need the same view (#99).

## What Changes

- **A charges page per flat, by year** (*Vastikkeet*), opened from the flat details page:
  - The current year first, with a choice of the earlier years since the flat's first charge.
  - A year summary: the charges of the year, split into the maintenance charge and the financing charge. The financing charge is labelled by its treatment (*Tuloutettu* / *Rahastoitu*), with one row per treatment when the treatment changes during the year.
  - For the current year, the months up to the current one, and an estimate for the whole year using the amounts set now, including upcoming changes already set. Earlier years show all their months.
  - The months, newest first, each with its maintenance charge, financing charge and total. A month in which a charge's amount changed shows the previous amount.
  - The amounts are the whole flat's, as on the Rent and charges page, not the user's share. Shares are for the year summary (#34). Decided 23.11.2026.
  - Computed from the periods, never stored: correcting a period corrects the months shown. A footnote says the amounts come from the periods, not from actual payments, and links to the Rent and charges page.
  - Without any charge up to the current month: a note that no charges are set, and for owners a button to the Rent and charges page.
  - Everyone with access sees it; there is nothing to change on it.
- **The flat details page:** the rent and charges card gets a row *Vastikkeet kuukausittain* with this year's charges so far, opening the charges page.
- The rent is not a charge and is not on the page.

Not in this change:
- Marking charges paid (actual payments to the housing company). See #99 "Out of scope".
- Several capital charges per flat (#90): the summary and the month rows get one line per capital charge then.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `recurring-amounts`: new requirements "Charges of a month" (the calculation) and "The charges page".
- `properties`: "The flat details page": the rent and charges card opens the charges page with this year's total so far.

## Impact

- **Tables:** none added or altered. The page reads the periods with the existing `getRecurringAmounts` server function, which already returns the amounts, the treatments and today.
- **Code:** pure functions for a year's charges in `features/recurring-amounts/charges.ts`. The page `ChargesPage.tsx` and the route `/properties/$propertyId/charges?year=`. The details page's `Amounts` section gets the new row, computed in the browser from the periods `getFlatDetails` already returns.
- **UI:** Design canvas, row *Vastikkeet kuukausittain (#99)*: *Asunnon tiedot · vastikkeet kuukausittain* (`AsuntoTiedotVastikkeet`), *Vastikkeet kuukausittain* (`VastikeKuukaudet`), *Vastikkeet · ei asetettu* (`VastikeKuukaudetTyhja`).
- **Messages:** the page and the details page row in fi, sv and en. "Vastike" as a general word (*Vastikkeet*) is not in the term bank yet; it is added with the translate skill.
