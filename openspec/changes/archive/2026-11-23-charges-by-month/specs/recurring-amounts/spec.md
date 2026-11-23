## ADDED Requirements

### Requirement: Charges of a month
A flat's charges in a month SHALL be its maintenance charge and its financing charge in that month ("Rent and charges are recorded as monthly periods"), each with no amount when it is not set, and the financing charge with the treatment in effect on the month's first day, or none. The rent SHALL NOT be a charge. A month's total SHALL be the sum of its charges that are set. A charge SHALL be marked as changed in a month when it is set in both that month and the month before, and the amounts differ; the mark SHALL carry the previous amount.

A year's charges SHALL be computed for the year's months up to the current month in the current year, and for all twelve months in an earlier year, leaving out months with neither charge set. The year's total SHALL be the sum of those months' totals, given as the maintenance charge's sum and the financing charge's sum per treatment (income-recognised, capitalised, not set). For the current year before December, an estimate for the whole year SHALL be the sum of all twelve months' charges from the periods as they are now, including changes set to start later in the year.

The years SHALL be the current year and every earlier year from the year in which the flat's first maintenance or financing charge period starts. A flat has no charges when neither charge is set in any month up to the current one.

**No Playwright test:** a pure calculation from the periods; Vitest covers it, and the charges page shows it in the browser test of "The charges page".

#### Scenario: A year's charges up to the current month
- **WHEN** today is `2026-11-23`, the maintenance charge is 21400 cents from `2026-01-01`, and the financing charge 8600 cents from `2025-03-01`
- **THEN** 2026 has the months January to November, each with the total 30000 cents, and the year's total is 235400 cents of maintenance charge and 94600 cents of financing charge

#### Scenario: An earlier year starts from the first charge
- **WHEN** today is `2026-11-23`, the maintenance charge is 20500 cents from `2025-03-01`, and the financing charge 8600 cents from `2025-03-01`
- **THEN** 2025 has the months March to December, each with the total 29100 cents, and the year's total is 291000 cents with no estimate

#### Scenario: A change shows the previous amount
- **WHEN** the maintenance charge is 20500 cents from `2025-03-01` and 21400 cents from `2026-01-01`
- **THEN** January 2026's maintenance charge is marked changed from 20500 cents, and February 2026's is not marked

#### Scenario: The first month of a charge is not a change
- **WHEN** the financing charge's first period starts on `2025-03-01`
- **THEN** March 2025's financing charge is not marked changed

#### Scenario: The financing charge by treatment when it changes mid-year
- **WHEN** today is `2026-11-23`, the financing charge is 8600 cents from `2026-01-01`, and the treatment is capitalised from `2025-03-01` and income-recognised from `2026-07-01`
- **THEN** 2026's financing charge is 51600 cents capitalised and 43000 cents income-recognised

#### Scenario: A financing charge without a treatment
- **WHEN** the financing charge is 8600 cents from `2026-01-01`, and no treatment is set
- **THEN** 2026's financing charge is counted as not set for its treatment

#### Scenario: The whole-year estimate includes a change set for later in the year
- **WHEN** today is `2026-11-23`, the maintenance charge is 21400 cents from `2026-01-01` and 22600 cents from `2026-12-01`, and the financing charge 8600 cents from `2025-03-01`
- **THEN** 2026's total is 330000 cents and its estimate for the whole year is 361200 cents

#### Scenario: No estimate in December
- **WHEN** today is `2026-12-05`
- **THEN** 2026 has all twelve months and no estimate

#### Scenario: The years since the first charge
- **WHEN** today is `2026-11-23`, the rent is set from `2024-06-01`, and the maintenance charge from `2025-03-01`
- **THEN** the years are 2026 and 2025

#### Scenario: Charges set only from a later month
- **WHEN** today is `2026-11-23`, and the maintenance charge's only period starts on `2027-01-01`
- **THEN** the flat has no charges

### Requirement: The charges page
Everyone with access to a flat SHALL be able to open its charges page from the flat details page ("The flat details page"). It SHALL show one year at a time, the current year first, with a choice of the years in "Charges of a month". For the chosen year it SHALL show the year's charges: the total, the maintenance charge's sum, and the financing charge's sum with its treatment, one line per treatment when the year has several; for the current year before December, which months are counted and the estimate for the whole year. It SHALL list the year's months newest first, each with its maintenance charge and financing charge, its total, and the previous amount of a charge that changed. It SHALL say that the amounts come from the amounts set on the Rent and charges page, not from actual payments, with a link to that page. The amounts SHALL be the whole flat's. When the flat has no charges, the page SHALL say that no charges are set, and show owners a button to the Rent and charges page. Back SHALL return to the flat details page. A user without access SHALL see that the flat was not found.

#### Scenario: The current year's charges by month
- **WHEN** today is `2026-11-23`, the maintenance charge is 20500 cents from `2025-03-01` and 21400 cents from `2026-01-01`, the financing charge 8600 cents from `2025-03-01` capitalised from `2025-03-01`, and Annika opens the charges page
- **THEN** the page shows 2026 with `3 300,00 €`, the maintenance charge `2 354,00 €`, the financing charge `946,00 €` with "Rahastoitu", the estimate `3 600,00 €`, and November to January each `300,00 €`, January with "oli 205,00 €"

#### Scenario: Choosing an earlier year
- **WHEN** Annika chooses 2025 on the same flat
- **THEN** the page shows `2 910,00 €` and December to March, each `291,00 €`, with no estimate

#### Scenario: A member sees the charges
- **WHEN** Jussi, a member of the flat, opens its charges page
- **THEN** he sees the same years, totals and months as Annika

#### Scenario: A flat without charges
- **WHEN** an owner opens the charges page of a flat with no charges set
- **THEN** the page says that no charges are set and shows "Aseta vastikkeet", which opens the Rent and charges page

#### Scenario: A member of a flat without charges
- **WHEN** Jussi, a member, opens the charges page of a flat with no charges set
- **THEN** the page says that no charges are set and shows no button

#### Scenario: Another user can't open the charges page
- **WHEN** a user without access opens `/properties/<id of Annika's flat>/charges`
- **THEN** they see that the flat was not found
