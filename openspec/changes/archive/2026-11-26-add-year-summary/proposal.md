## Why

Kotivalo collects rent payments, entries, charges and usage charges, but the owner still adds them up by hand for the tax return. The year summary turns them into the form 7H figures of the user's own share, flat by flat, ready to copy into MyTax (issue #34). It is the first piece of milestone M2: the tax estimate (#121), other owners (#122), former owners (#123), improvements (#120) and a partly income-recognised financing charge (#119) build on it. All its hard dependencies (#29, #31, #32, #90, #118) are done.

## What Changes

- **A year summary page** (`/year-summary`), opened from a new **Taxes** item in the bottom bar (agreed: Flats · New entry · Taxes · Account). It shows one year at a time with previous and next year buttons. From January to June it opens on the previous year, from July on the current year (agreed). It shows a card for each flat in which the user had an ownership share above 0 % on some day of the year, archived flats included (agreed). Each card shows row 2.1, the sum of rows 2.2–2.5 and chips for what needs checking. Flats the user can see without a share that year are named in a "Not included" note. A user with no share in any flat that year sees an empty state.
- **The form 7H page of a flat** (`/year-summary/$propertyId?year=…`) shows the flat details form 7H asks for and rows 2.1–2.5 for the user's own share. Each value has its own copy button. Amounts are copied as `4895,00`, without spaces or €, in every language (agreed). Each row lists its parts, such as maintenance charges and water charges.
  - The flat details: the housing company's name and Business ID and the apartment number, each with an Add button when missing (#118); the tenant, or "Several" with more than one tenancy in the year; the tenancy period, the whole year with several tenancies (CONCEPT.md §4.5); and the ownership share.
  - The tenant's personal identity code is not stored. Its row says to fill it in on MyTax (agreed).
- **The figures are computed, never stored,** from rent payments (by payment date), entries (by date), the charge and financing charge periods with their treatment, and the usage charges, using the pure functions of each feature:
  - Rows: 2.1 rent payments and income entries; 2.2 maintenance charges, water usage charges and water charge entries; 2.3 financing charges in months the treatment is income-recognised, with the note on case law (CONCEPT.md §4.3); 2.4 annual repairs; 2.5 insurance, other expenses and parking, sauna and other usage charges.
  - Shares follow the cash basis. A payment or entry counts at the user's share on its date; a charge or usage charge month counts at the user's share on the month's first day (CONCEPT.md §4.5).
- **Not on form 7H** has its own card: capitalised financing charges, added to the acquisition cost, and improvement entries, shown but not counted until #120. Loan interest, deposits (#93), the net result and the tax estimate (#121) are not part of this change, and the page says so.
- **What needs checking, never assumed** (agreed):
  - months of a tenancy not fully paid (late or partly paid, as on the rent payments page);
  - whole vacant months whose charges were deducted, deductible only if the flat was offered for rent;
  - a missing housing company name, Business ID or apartment number;
  - a financing charge month without a treatment, which is left out of row 2.3 and of the capitalised sum until a treatment is set;
  - a change of the user's share during the year. The share field shows the share at the end of the user's period in the year.

## Capabilities

### New Capabilities

- `year-summary`: the year summary page and the form 7H page of a flat for the user's own share, covering:
  - which flats and years are included and which year opens;
  - the rows and their parts computed from payments, entries, charges and usage charges with the cash-basis share;
  - the flat details for form 7H;
  - the Not on form 7H card;
  - the checks;
  - copying values.

### Modified Capabilities

- `navigation`: the bottom navigation bar gets a fourth item, Taxes, opening the year summary. The year summary page shows the bar, and Taxes is marked as current there.

## Impact

- **Tables:** none added or altered. The summary reads `properties`, `property_access`, `ownership_periods`, `tenancies` with `tenancy_rents`, `tenancy_occupants`, `tenant_fees` and `tenant_fee_amounts`, `rent_payments`, `transactions`, `recurring_amounts`, `financing_charges`, `financing_treatments`, `usage_charges` and `usage_charge_amounts`.
- **Code:**
  - New `features/year-summary/`:
    - `summary.ts`, the pure calculation of a flat's year for one user;
    - `year-summary.server.ts`, loading the year's data for all the user's flats with a fixed number of queries;
    - server functions, `YearSummaryPage.tsx` and `FlatTaxPage.tsx`.
  - Changed:
    - the existing repositories get reads by a list of flat ids, as `listRentThisMonth` already does (ownership, tenancies, rent payments, entries, charges, usage charges);
    - `components/BottomNav.tsx` gets the Taxes item;
    - the existing period helpers (`recurring-amounts/charges.ts`, `usage-charges/months.ts`, `rent-payments/status.ts`, `ownership/periods.ts`, `transactions/categories.ts`, `usage-charges/rows.ts`) are reused, not copied.
- **Routes:** adds `/year-summary` and `/year-summary/$propertyId`, both under `_authed`.
- **Messages:** fi / sv / en for both pages, the rows, the checks and the bottom bar item.
  - The term bank gets the form 7H row terms through the translate skill and the term-critic: *bruttovuokratulo* (gross rental income), *tuloutettu pääomavastike* (income-recognised capital charge), *muut kulut* (other costs) and *henkilötunnus* (personal identity code). Each language's 7H row names are taken from the Tax Administration's form in that language.
- **Design canvas:** the section "Vuosiyhteenveto ja lomake 7H (#34)" has these screens:
  - Vuosiyhteenveto · asunnot (oma osuus)
  - Lomake 7H · asunto (kopioi luvut)
  - Lomake 7H · osuus muuttui, taloyhtiön tiedot puuttuvat
  - Lomake 7H · tyhjillään, tuloutettu rahoitusvastike
  - Vuosiyhteenveto · ei omistusosuutta

  Its decisions are recorded in the section's notes. The older "Vuosiyhteenveto" sketch at the top of the canvas (person menu, net result, tax estimate, PDF) is the target picture for #121, #122 and #36, not this change.
- **To verify:**
  - Whether MyTax accepts a pasted amount in the form `4895,00`. Check it in MyTax before the copy buttons ship.
  - The D1 limit on queries per Worker invocation on the Free plan. The repository is designed for a fixed number of queries whatever the number of flats.
