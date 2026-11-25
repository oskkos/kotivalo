## Context

Everything the year summary needs is already stored, and most of it already has pure calculations:
- rent payments with their payment date (`rent_payments.paid_on`), and the month statuses (`rent-payments/status.ts`: `rentMonths`, `monthStatus`, fed by `RentsByTenancy`, `OccupantsByTenancy` and `FeesByTenancy`)
- entries by date, and the form 7H row of each category (`transactions/categories.ts`, `CATEGORIES[category].row`)
- the maintenance and financing charges by month, and the treatment on each month's first day (`recurring-amounts/charges.ts`: `chargeMonth`, `chargesOfYear`)
- usage charges by month with the occupants (`usage-charges/months.ts`: `usageChargesOfMonth`), and the row of each kind (`usage-charges/rows.ts`)
- ownership periods and the split on a date (`ownership/periods.ts`: `groupPeriods`, `sharesOn`)
- the housing company details on the flat (#118)

What is missing is combining them for one user and one year, by share, and showing the result.

The decisions agreed on the design canvas (section "Vuosiyhteenveto ja lomake 7H (#34)"):
1. A Taxes item in the bottom bar.
2. The year that opens: the previous year in January to June, the current year from July.
3. The flats with a share above 0 on some day of the year, archived ones included.
4. The checks.
5. The tenant's personal identity code is not stored.
6. The copy format `4895,00`.

## Goals / Non-Goals

**Goals:**
- One pure function computes a flat's year for one user: the rows and their parts, the Not on form 7H amounts, the flat details and the checks. Vitest covers it with fixed dates.
- The data of all the user's flats is loaded with a fixed number of queries, whatever the number of flats.
- The rules of the existing features are reused, not copied: a month's charges, usage charges, rent status, the category's row and the split on a date.

**Non-Goals:**
- The other owners' and whole flats' figures (#122), a former owner without access (#123), improvements in tenths (#120), a partly income-recognised financing charge (#119), the net result and the tax estimate (#121), deposits (#93), loans (#35), the PDF and copying everything at once (#36).
- Storing anything: there is no table, cache or snapshot of a year.

## Decisions

### 1. One pure calculation: `features/year-summary/summary.ts`

`flatYear(input, userId, year, today)` takes one flat's data as plain values and returns:

```
FlatYear {
  propertyId
  included: boolean               share > 0 on some day of the year (up to today)
  rows: Record<'2.1'..'2.5', { parts: Part[]; cents }>
  outside: { capitalised: cents; improvements: cents }
  details: { housingCompanyName, businessId, apartmentNumber,
             tenant: { kind: 'one', name } | { kind: 'several' } | { kind: 'none' },
             period: { from, to } | null,
             share: basisPoints }   at the end of the user's period in the year
  checks: Check[]                 unpaid | partly_paid | vacant | details_missing
                                  | treatment_not_set | share_changed
}
Part { key: 'rent_payments' | <category> | 'maintenance_charge'
            | 'financing_charge' | <usage kind>; cents }
```

Each amount is collected with its weight: the user's basis points on the date that decides it. This is the payment date, the entry's date, or the month's first day (`sharesOn(periods, date)`, 0 without a share). Each part sums `amount × bp` as an integer, then divides by 10000 once, rounding half up. A row is the sum of its parts. Rounding each part once, not each amount, keeps the error under a cent per part. The parts always add up to the row, so the page never shows a row that differs from its parts.

The months counted are January to December, or to the current month in the current year, as `chargesOfYear` and `usageChargesOfYear` already do. The function calls `chargeMonth` and `usageChargesOfMonth` per month, not the year functions, because the share is applied per month. A financing charge month without a treatment goes to neither 2.3 nor the capitalised sum, and raises `treatment_not_set`.

The months not fully paid use `rentMonths` over the year's months and keep `late` and `partly_paid`, the statuses `monthsNotFullyPaid` keeps. Only months in which the user had a share on the month's first day count. A month is vacant when `tenancyMonths` of every tenancy leaves it out, and the user's charges and usage charges for it are above 0.

*Alternative:* computing the whole flat first and multiplying each row by a share. This is rejected because a share changes during the year, and the cash-basis rule needs the share per date.

### 2. Loading with a fixed number of queries

`year-summary.server.ts` exposes `loadYearSummary(deps, year)`:
1. It lists the user's flats, archived included (`listForUser` and `listArchived` of the property repository). This is the access check.
2. It reads, by the list of flat ids:
   - the ownership rows
   - the tenancies, then their rents, occupants and fees by tenancy ids (`rentsFor`, `occupantsFor` and `feesFor` already take lists)
   - the rent payments
   - the entries dated in the year
   - the charges, financing charges and treatments
   - the usage charges with their amounts

It then calls `flatYear` per flat. The existing repositories get list variants next to their per-flat reads (e.g. `ownership.rowsFor(ids)`, `transactions.forPropertiesYear(ids, year)`, `recurringAmounts.forProperties(ids)`, `usageCharges.forProperties(ids)`, `payments.forProperties(ids)`, `tenancies.forProperties(ids)`), and the per-flat reads become wrappers where that removes duplication. This follows `listRentThisMonth`. The total is about 12 queries for any number of flats.

The form 7H page reads the same way with one id, after the same access check: the flat must be in the user's list. A flat that isn't SHALL be "not found".

*Why:* the Workers Free plan limits the queries per invocation; per-flat reads would grow with the flats, up to about 80 for 10 flats.

*Alternative:* one new repository that reads every table for the summary. This is rejected because the reads would duplicate the row mapping of each feature's repository.

### 3. Rent payments need the year's payments and the statuses' months

Row 2.1 sums payments with `paid_on` in the year. The checks need the payments for the year's months, whatever their payment date. The repository read takes all payments of the flats' tenancies, as `forProperty` already does, and the calculation filters them both ways. A flat has at most a few hundred payments, so the read stays small.

### 4. The years and the opening year are pure, in the same module

`summaryYears(ownershipRows, userId, today)` returns the years from the first year with a share above 0 up to the current year. `openingYear(years, today)` picks the previous year in January to June and the current year from July, clamped to the range. The route's `validateSearch` keeps `year` optional. The loader uses the opening year when it is missing and clamps one outside the range. Today is `isoDateInFinland(now)`, as elsewhere.

### 5. Routes and pages

- `src/routes/_authed/year-summary/index.tsx` is `YearSummaryPage`, with the bottom bar (`current: 'year-summary'`).
- `src/routes/_authed/year-summary/$propertyId.tsx` is `FlatTaxPage`, without the bar. Its back link goes to the summary with the same `year`.

Both routes are thin. One server function each in `features/year-summary/functions.ts` (`getYearSummary({ year? })`, `getFlatYear({ propertyId, year? })`) checks the session, loads and computes on the server. Each returns the computed view, not the raw rows, so the browser gets only what it shows. The other owners' ids, tenancies outside the year and payment rows don't reach it.

Add opens `/properties/$propertyId/edit`. The unpaid check opens `/properties/$propertyId/rent?year=…`; the treatment check opens `/properties/$propertyId/amounts`.

### 6. Copying

`copyValue` in `features/year-summary/copy.ts` is pure:
- `amountForCopy(cents)` gives `4895,00`
- `shareForCopy(bp)` gives `50` or `33,33`

The button calls `navigator.clipboard.writeText`. A failure (no permission, or not a secure context) shows a notice that copying failed, logged with `clientLog.warn('year_summary.copy_failed')`, which carries no value. Playwright grants `clipboard-read` and `clipboard-write` in the test that reads the clipboard.

### 7. Bottom bar

`BottomNav` gets `NavPage = 'flats' | 'year-summary' | 'account'`, four columns, with New entry in the second column: Flats · New entry · Taxes · Account, as drawn. The label is `nav_taxes` (*Verot* / *Skatter* / *Taxes*).

### 8. Messages and terms

The row names follow form 7H in each language: Finnish from the form, Swedish from the Swedish form 7H, English from the Tax Administration's English instructions. They are researched with the translate skill. The term bank gets *bruttovuokratulo*, *tuloutettu pääomavastike*, *muut kulut* and *henkilötunnus*, with their sources, and the term-critic reviews them. Messages pass formatted amounts and dates (`formatMoney`, `formatDate`) as parameters.

### 9. No logging of reads

The summary only reads, so it logs nothing on the server (CLAUDE.md: no logs of reads or page views). The one client line is the copy failure.

## Risks / Trade-offs

- **The cash-basis share rule is an inference** (CONCEPT.md §6): the 7H instructions have one share per flat. → The page shows the share change as a check, and the rows list their parts so the owner can check them.
- **Charges are assumed paid in their month.** Kotivalo doesn't record when a charge was paid, so a December charge paid in January counts in December's year. → The note under the rows says how the figures are counted. A paid-date for charges is a new issue if needed.
- **The D1 query limit per invocation is not verified for the Free plan.** → The loading is a fixed number of queries. A Workers test asserts it by counting the queries of the summary with 3 flats, the same as with 1.
- **MyTax may not accept `4895,00` when pasted.** → Check by hand in MyTax before archiving. If it fails, change only `amountForCopy`.
- **CPU time on the Free plan (10 ms):** 10 flats × 12 months of charges, usage charges and statuses are small loops, but `rentMonths` per flat recomputes the expected rent per month. → A Workers test with 10 flats and two years of data measures the server function. If the time is near the limit, the statuses are computed only for the months the user owned.
- **Vacant months can be legitimate** (offered for rent) or not. → The summary never removes them. It names them and explains.
