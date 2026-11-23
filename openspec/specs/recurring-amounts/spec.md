# recurring-amounts Specification

## Purpose
A flat's rent, maintenance charge and financing charge as monthly validity periods from the first of a month, the financing charge treatment (income-recognised or capitalised) as periods, the Rent and charges page opened from the flat details page, setting and undoing amounts and the treatment (owners only; undoing the only period leaves it unset), the monthly amounts and capitalised total computed from the periods, never stored, and the charges page by year: each month's maintenance and financing charge and the year's sums by treatment, computed the same way. Rent per tenancy (#30), payment status (#25), entries (#32) and the year summary (#34) come later.
## Requirements
### Requirement: Rent and charges are recorded as monthly periods
A flat's rent, maintenance charge and financing charge SHALL each be a sequence of periods, each with a monthly amount in cents, a start date and an end date (open for the current one). Every start date SHALL be the first day of a month. Periods of the same kind SHALL follow each other without gaps or overlaps. A new amount SHALL end the previous period on the last day of the month before it starts, and a recorded period SHALL NOT be changed except by the corrections in "Setting a rent or charge" and "Undoing the latest rent or charge change". A month's amount SHALL be that of the period containing the month's first day, and a month before the first period SHALL have no amount. An amount SHALL be from 0 to 99 999,99 € with at most two decimals.

**No Playwright test:** these are rules for stored periods and pure calculations; Vitest covers them with the functions and the repository, and the browser tests of the other requirements use them.

#### Scenario: A month's amount comes from the period containing its first day
- **WHEN** the maintenance charge was 20500 cents from `2025-03-01` and 21400 cents from `2026-01-01`
- **THEN** the amount for December 2025 is 20500, for January 2026 21400, and for February 2025 there is none

#### Scenario: A new amount ends the previous period the month before
- **WHEN** a rent of 89000 cents from `2025-03-01` is followed by 92000 cents from `2027-03-01`
- **THEN** the first period ends on `2027-02-28`, and the new one starts on `2027-03-01` with no end

#### Scenario: A date that isn't the first of a month is refused
- **WHEN** an owner sets the rent from `2027-03-15`
- **THEN** it is refused with the reason `amount_date_not_month_start`, and nothing is stored

#### Scenario: An invalid amount is refused
- **WHEN** an owner enters `-5`, `100000` or `12,345` as a monthly amount
- **THEN** it is refused with the reason `amount_invalid`, and nothing is stored

### Requirement: The rent and charges page
Everyone with access to a flat SHALL be able to open its Rent and charges page from the rent and charges on the flat's details page ("The flat details page") and from its menu. The page SHALL show, for the rent, the maintenance charge and the financing charge, the amount in effect today with its start date, or that it is not set, and the next upcoming change if there is one. The financing charge SHALL also show its current treatment, or that it is not set. Only owners SHALL see the buttons to set or change them.

#### Scenario: Opening the rent and charges page from the details page
- **WHEN** Annika, owner of `Kuusikuja 3 B 12`, opens its details page and chooses "Muuta" next to its rent and charges
- **THEN** the Rent and charges page of `Kuusikuja 3 B 12` opens

#### Scenario: A flat without amounts
- **WHEN** an owner opens the page of a flat with no amounts or treatment set
- **THEN** the rent, maintenance charge, financing charge and treatment each show "Ei asetettu" with an "Aseta" button

#### Scenario: The current amount and an upcoming change
- **WHEN** today is `2026-11-21` and the maintenance charge is 21400 cents from `2026-01-01` and 22600 cents from `2027-01-01`
- **THEN** the maintenance charge shows `214,00 €/kk`, "1.1.2026 alkaen", and the upcoming change "1.1.2027 alkaen 226,00 €/kk"

#### Scenario: A member sees the amounts but can't change them
- **WHEN** Jussi, a member of the flat, opens its Rent and charges page
- **THEN** he sees the amounts and the treatment, and no button to set or change them

### Requirement: Setting a rent or charge
An owner of a flat SHALL be able to set its rent, maintenance charge or financing charge from a date: the first amount, or a new one. The date SHALL be the first of a month, SHALL NOT be before the month in which the flat's first ownership period starts, and SHALL NOT be before the start of that amount's latest period. It MAY be in the future. An amount dated on the latest period's own start SHALL correct that period's amount instead of starting a new period. The form SHALL show the amount's change history, newest first, and, when an amount is already set, the current amount, the difference per month and its effect on the year the change starts in. A member SHALL NOT be able to set amounts.

#### Scenario: Setting the first rent of a flat
- **WHEN** Annika, owner since `2025-03-01`, sets the rent to `890` from `1.3.2025`
- **THEN** the page shows the rent `890,00 €/kk`, "1.3.2025 alkaen"

#### Scenario: Raising the maintenance charge from next year
- **WHEN** the maintenance charge is 21400 cents from `2026-01-01`, and Annika sets `226` from `1.1.2027`
- **THEN** the history shows "1.1.2027 alkaen 226,00 €" above "1.1.2026 alkaen 214,00 €", and the page shows the upcoming change

#### Scenario: The change form shows the effect on the year
- **WHEN** the maintenance charge is 21400 cents, and Annika enters `226` from `1.1.2027`
- **THEN** the form shows "+12,00 €/kk (+5,6 %)" and that in 2027 it adds 144,00 € to deductible expenses over 12 months

#### Scenario: An amount on the latest period's start corrects it
- **WHEN** the rent's latest period is 92000 cents from `2027-03-01`, and Annika sets `950` from `1.3.2027`
- **THEN** the rent has one period from `2027-03-01`, with 95000 cents, and the previous period still ends on `2027-02-28`

#### Scenario: A date before the flat's ownership is refused
- **WHEN** the flat's first ownership period starts on `2025-03-01`, and an owner sets the rent from `1.1.2025`
- **THEN** it is refused with the reason `amount_date_before_ownership`, and nothing changes

#### Scenario: A date before the latest change is refused
- **WHEN** the maintenance charge's latest period starts on `2026-01-01`, and an owner sets a new amount from `1.6.2025`
- **THEN** it is refused with the reason `amount_date_too_early`, and nothing changes

#### Scenario: A member can't set an amount
- **WHEN** Jussi, a member, sends a new rent to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Undoing the latest rent or charge change
An owner SHALL be able to undo the latest change of a rent or charge that has at least one period. Undoing SHALL delete the latest period and make the previous one current again, with no end. When the deleted period was the only one, the amount SHALL no longer be set, so that it can be set again from the right date. The confirmation SHALL name the amount that stays in force, or say that the amount will be removed. A member SHALL NOT be able to undo.

#### Scenario: Undoing a charge increase
- **WHEN** the maintenance charge is 21400 cents from `2026-01-01` and 22600 cents from `2027-01-01`, and Annika undoes the latest change
- **THEN** the maintenance charge is 21400 cents from `2026-01-01` with no end, and no upcoming change is shown

#### Scenario: Undoing the only rent
- **WHEN** the rent's only period is 89000 cents from `2025-06-01`, and Annika undoes it and sets `890` from `1.3.2025`
- **THEN** the rent has one period, 89000 cents from `2025-03-01` with no end

#### Scenario: Nothing to undo is refused
- **WHEN** an owner sends undoing the rent of a flat that has no rent to the server
- **THEN** it is refused with the reason `amount_nothing_to_undo`, and nothing changes

### Requirement: The financing charge treatment
An owner of a flat SHALL be able to set whether the housing company recognises its financing charge as income or capitalises it, from a date, with the same date rules as "Setting a rent or charge". The treatment SHALL be recorded as periods like the amounts, a treatment dated on the latest period's start SHALL correct it, and the form SHALL show the history, newest first. A member SHALL NOT be able to set it.

#### Scenario: Setting the treatment for the first time
- **WHEN** Annika sets the treatment to capitalised from `1.3.2025`
- **THEN** the page shows "Rahastoitu", "1.3.2025 alkaen"

#### Scenario: A new treatment keeps the history
- **WHEN** the treatment is capitalised from `2025-03-01`, and Annika sets income-recognised from `1.1.2027`
- **THEN** the history shows "1.1.2027 alkaen Tuloutettu" above "1.3.2025 alkaen Rahastoitu"

#### Scenario: A member can't set the treatment
- **WHEN** Jussi, a member, sends a treatment to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Accumulated capitalised financing charges
The Rent and charges page SHALL show the financing charges added to the flat's acquisition cost so far: the sum of the financing charge of every month from the first period up to and including the current month whose treatment on the month's first day is capitalised. Months with no treatment set or an income-recognised treatment SHALL NOT count. When the sum is zero, it SHALL NOT be shown.

#### Scenario: Only capitalised months count
- **WHEN** today is `2026-11-21`, the financing charge is 8000 cents from `2025-03-01` and 8600 cents from `2026-01-01`, and the treatment is capitalised from `2025-03-01` and income-recognised from `2026-07-01`
- **THEN** the page shows that 1 316,00 € of financing charges have been added to the acquisition cost (10 × 8000 + 6 × 8600 cents)

#### Scenario: Months without a treatment don't count
- **WHEN** the financing charge is 8000 cents from `2025-03-01` and no treatment is set
- **THEN** no accumulated amount is shown

### Requirement: Undoing the latest treatment change
An owner SHALL be able to undo the latest change of the financing charge treatment, with the same confirmation as undoing an amount. Undoing SHALL delete the latest treatment period and make the previous one current again, with no end. When the deleted period was the only one, the treatment SHALL no longer be set. Undoing when no treatment is set SHALL be refused with the reason `treatment_nothing_to_undo`. A member SHALL NOT be able to undo the treatment.

#### Scenario: Undoing a treatment change
- **WHEN** the treatment is capitalised from `2025-03-01` and income-recognised from `2027-01-01`, and Annika undoes the latest change
- **THEN** the treatment is capitalised from `2025-03-01` with no end

#### Scenario: Undoing the only treatment
- **WHEN** today is `2026-11-21`, the financing charge is 8000 cents from `2025-03-01`, the treatment's only period is capitalised from `2025-03-01`, and Annika undoes it
- **THEN** no treatment is set, and no accumulated capitalised amount is shown

#### Scenario: No treatment to undo is refused
- **WHEN** an owner sends undoing the treatment of a flat that has no treatment to the server
- **THEN** it is refused with the reason `treatment_nothing_to_undo`, and nothing changes

#### Scenario: A member can't undo the treatment
- **WHEN** the treatment is capitalised from `2025-03-01`, and Jussi, a member, sends undoing it to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

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

