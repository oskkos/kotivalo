## ADDED Requirements

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
Everyone with access to a flat SHALL be able to open its Rent and charges page from a button in the header of the flat's edit page. The page SHALL show, for the rent, the maintenance charge and the financing charge, the amount in effect today with its start date, or that it is not set, and the next upcoming change if there is one. The financing charge SHALL also show its current treatment, or that it is not set. Only owners SHALL see the buttons to set or change them.

#### Scenario: Opening the page from the edit page
- **WHEN** Annika, owner of `Kuusikuja 3 B 12`, opens its edit page and chooses "Vuokra ja vastikkeet" in the header
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
An owner SHALL be able to undo the latest change of a rent or charge that has more than one period. Undoing SHALL delete the latest period and make the previous one current again, with no end.

#### Scenario: Undoing a charge increase
- **WHEN** the maintenance charge is 21400 cents from `2026-01-01` and 22600 cents from `2027-01-01`, and Annika undoes the latest change
- **THEN** the maintenance charge is 21400 cents from `2026-01-01` with no end, and no upcoming change is shown

#### Scenario: The only period can't be undone
- **WHEN** an owner sends undoing the rent of a flat whose rent has one period to the server
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
