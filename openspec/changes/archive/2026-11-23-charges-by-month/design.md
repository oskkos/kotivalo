## Context

#31 made the rent, the maintenance charge, the financing charge and the financing charge treatment monthly validity periods, with pure functions in `features/recurring-amounts/periods.ts` (`valueInMonth`, `monthlyAmounts`, `accumulatedCapitalised`). The Rent and charges page reads them with `getRecurringAmounts`, which returns the periods, the treatments, the user's role and today in Finland. `getFlatDetails` returns the same periods and today for the details page. Nothing shows the charges month by month. The rent payments page (`features/rent-payments/RentPaymentsPage.tsx`, route `/properties/$propertyId/rent?year=`) has the shape this page follows: year buttons, a summary card, a list of months newest first. Design canvas row *Vastikkeet kuukausittain (#99)*.

## Goals / Non-Goals

**Goals:**
- Answer "which charges fell in which month, and how much in a year" per flat, without storing anything
- Reuse the period functions and the existing server function; no new reads
- A calculation that #34's year summary can reuse for rows 2.2 and 2.3

**Non-Goals:**
- Marking charges paid, or charges as entries
- The user's share of the charges (#34)
- Several capital charges (#90)
- The rent on this page

## Decisions

### A year's charges are one pure function

`features/recurring-amounts/charges.ts`:

- `chargeYears(amounts, today): number[]`: the current year and the earlier years from the first maintenance or financing period's start, newest first. Empty when neither charge is set in any month up to the current one, so the page and the details row can show the "no charges" state from the same function.
- `chargesOfYear(amounts, treatments, year, today): ChargeYear`, where `ChargeYear` holds:
  - `months`: newest first. Each month has its maintenance and financing charges (`{ cents, previous? } | undefined`), the financing treatment, and the total.
  - `maintenance`: the maintenance charge's sum.
  - `financing`: the financing charge's sums by treatment, `Partial<Record<FinancingTreatment | 'not_set', number>>`.
  - `total`.
  - `estimate`: the whole-year sum, present only for the current year before December.

It is built on `valueInMonth`, so a month's value keeps the rule "the period containing the first day". `previous` is set when the month before has a different set amount.

The details page row uses `chargesOfYear(…, currentYear, today).total`.

Alternative: compute on the server and return rows. Rejected: the periods are already in the browser on both pages, the rent pages compute in the browser too, and a server-side copy would add a server function and Workers tests for no gain.

### The page reuses `getRecurringAmounts`

The route `src/routes/_authed/properties/$propertyId/charges.tsx` loads `getRecurringAmounts` and `getProperty` (for the address in the header), as the Rent and charges route does, and validates `?year=` like the rent payments route. A year that isn't in `chargeYears` falls back to the current year. Not found is the same `NotFoundView`.

The role from `getRecurringAmounts` decides whether the empty state shows "Aseta vastikkeet" (to `/properties/$propertyId/amounts`).

### Components

- `ChargesPage.tsx` in `features/recurring-amounts/`:
  - Header with back and the address.
  - Year buttons (`aria-pressed`), as on `RentPaymentsPage`. If that page's year buttons are a local component, move them to `components/` in the same commit rather than copying them.
  - The summary card: the total, a `dl` of the maintenance charge and one financing line per treatment present, the counted months ("Tammi–marraskuu") and the estimate.
  - The month list: a `ul` of plain rows; nothing to open, so no links.
  - The footnote with a link to the Rent and charges page.
- `FlatDetailsPage.tsx` `Amounts`: the `dl` and a new link row inside one card, as on the canvas (`AsuntoTiedotVastikkeet`).

### Words

The page title is *Vastikkeet*: a general word for the housing company's monthly charges, used with *hoitovastike* and *rahoitusvastike* below it. It goes into the term bank as a new term (code `charge`) with the translate skill, so the Swedish and English titles follow sources rather than guesses (likely *vederlag* / *charges*). Month ranges ("Tammi–marraskuu") come from a message with the first and last month as parameters, not from `Intl`, so the three languages control their own forms.

## Risks / Trade-offs

- [The page shows the periods, not what was paid] → The footnote says so, and #99 records payment tracking as out of scope. A missed or late payment to the housing company doesn't show.
- [An upcoming change makes the estimate differ from "current amount × 12"] → That is intended: the estimate uses the amounts set now. The message says "if the amounts don't change", not "at the current rate".
- [#90 adds capital charges] → `ChargeYear` keys the financing sums by treatment and the month rows by charge, so a list of capital charges replaces the single financing field without changing the page's layout.

## Migration Plan

None: no schema change. Deploys with the code.

## Open Questions

None. The decisions from 23.11.2026 (months up to the current one with an estimate, whole-flat amounts, the financing charge split by treatment) are in the proposal.
