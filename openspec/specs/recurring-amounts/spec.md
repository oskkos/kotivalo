# recurring-amounts Specification

## Purpose
A flat's maintenance charge and named financing charges (several per flat, each its own sequence) as monthly validity periods from the first of a month, the financing charge treatment (income-recognised or capitalised, one per flat for all its charges) as periods, the charge amounts page (*Vastikkeet*) opened from the flat details page, setting and undoing amounts and the treatment (owners only; undoing the only period leaves it unset, or removes a financing charge), adding, renaming and ending financing charges, the monthly amounts and capitalised total computed from the periods, never stored, and the charges page by year: each month's maintenance charge and financing charges and the year's sums per charge and treatment, computed the same way. The rent is the tenancy's (tenancies); the year summary (#34) comes later.
## Requirements
### Requirement: The financing charge treatment
An owner of a flat SHALL be able to set whether the housing company recognises its financing charges as income or capitalises them, from a date, with the same date rules as "Setting a charge". The treatment SHALL be the flat's, one for all its financing charges. It SHALL be recorded as periods like the amounts, a treatment dated on the latest period's start SHALL correct it, and the form SHALL show the history, newest first. A member SHALL NOT be able to set it.

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
The charge amounts page SHALL show the financing charges added to the flat's acquisition cost so far: the sum, over all the flat's financing charges, of the amount of every month from the charge's first period up to and including the current month whose treatment on the month's first day is capitalised. Months with no treatment set or an income-recognised treatment SHALL NOT count. When the sum is zero, it SHALL NOT be shown.

#### Scenario: Only capitalised months count
- **WHEN** today is `2026-11-21`, the financing charge is 8000 cents from `2025-03-01` and 8600 cents from `2026-01-01`, and the treatment is capitalised from `2025-03-01` and income-recognised from `2026-07-01`
- **THEN** the page shows that 1 316,00 € of financing charges have been added to the acquisition cost (10 × 8000 + 6 × 8600 cents)

#### Scenario: All financing charges count
- **WHEN** today is `2026-11-23`, `Putkiremontti` is 8600 cents from `2025-03-01`, `Julkisivu` 4200 cents from `2026-01-01`, `Hissiremontti` 2400 cents from `2025-03-01` and 0 cents from `2026-01-01`, and the treatment is capitalised from `2025-03-01`
- **THEN** the page shows that 2 508,00 € have been added to the acquisition cost (21 × 8600 + 11 × 4200 + 10 × 2400 cents)

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
A flat's charges in a month SHALL be its maintenance charge and each of its financing charges in that month ("Charges are recorded as monthly periods"), each with no amount when it is not set, and each financing charge with the treatment in effect on the month's first day, or none. The rent SHALL NOT be a charge. A month's total SHALL be the sum of its charges that are set. A charge SHALL be marked as changed in a month when its amount is above 0 in both that month and the month before, and the amounts differ; the mark SHALL carry the previous amount. A financing charge SHALL be marked as started in the month its first period starts, unless no charge is set in the month before, and as ended in a month when its amount is 0 and the month before's is above 0.

A year's charges SHALL be computed for the year's months up to the current month in the current year, and for all twelve months in an earlier year, leaving out months with no charge set. The year's total SHALL be the sum of those months' totals, given as the maintenance charge's sum and each financing charge's sum per treatment (income-recognised, capitalised, not set), leaving out financing charges whose sum in the year is 0. For the current year before December, an estimate for the whole year SHALL be the sum of all twelve months' charges from the periods as they are now, including changes set to start later in the year.

The years SHALL be the current year and every earlier year from the year in which the flat's first maintenance or financing charge period starts. A flat has no charges when no charge is set in any month up to the current one.

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
- **WHEN** the financing charge's first period starts on `2025-03-01`, and no charge is set before it
- **THEN** March 2025's financing charge is marked neither changed nor started

#### Scenario: Several financing charges in a year
- **WHEN** today is `2026-11-23`, the maintenance charge is 21400 cents from `2026-01-01`, `Putkiremontti` 8600 cents from `2025-03-01`, `Julkisivu` 4200 cents from `2026-01-01`, and `Hissiremontti` 2400 cents from `2025-03-01` and 0 cents from `2026-01-01`, all capitalised
- **THEN** each month of 2026 has the total 34200 cents, the year's total is 235400 cents of maintenance charge, 94600 cents of `Putkiremontti` and 46200 cents of `Julkisivu`, `Hissiremontti` has no line, and January is marked with `Julkisivu` started and `Hissiremontti` ended

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
- **WHEN** today is `2026-11-23`, the flat's tenancy has a rent from `2024-06-01`, and the maintenance charge is set from `2025-03-01`
- **THEN** the years are 2026 and 2025

#### Scenario: Charges set only from a later month
- **WHEN** today is `2026-11-23`, and the maintenance charge's only period starts on `2027-01-01`
- **THEN** the flat has no charges

### Requirement: The charges page
Everyone with access to a flat SHALL be able to open its charges page from the flat details page ("The flat details page"). It SHALL show one year at a time, the current year first, with a choice of the years in "Charges of a month". For the chosen year it SHALL show the year's charges: the total, the maintenance charge's sum, and each financing charge's sum with its name and treatment, one line per treatment when the year has several; for the current year before December, which months are counted and the estimate for the whole year. It SHALL list the year's months newest first, each with its maintenance charge and each financing charge above 0, its total, the previous amount of a charge that changed, and the financing charges that started or ended. It SHALL say that the amounts come from the amounts set on the charge amounts page, not from actual payments, with a link to that page. The amounts SHALL be the whole flat's. When the flat has no charges, the page SHALL say that no charges are set, and show owners a button to the charge amounts page. Back SHALL return to the flat details page. A user without access SHALL see that the flat was not found.

#### Scenario: The current year's charges by month
- **WHEN** today is `2026-11-23`, the maintenance charge is 20500 cents from `2025-03-01` and 21400 cents from `2026-01-01`, the financing charge 8600 cents from `2025-03-01` capitalised from `2025-03-01`, and Annika opens the charges page
- **THEN** the page shows 2026 with `3 300,00 €`, the maintenance charge `2 354,00 €`, the financing charge `946,00 €` with "Rahastoitu", the estimate `3 600,00 €`, and November to January each `300,00 €`, January with "oli 205,00 €"

#### Scenario: Choosing an earlier year
- **WHEN** Annika chooses 2025 on the same flat
- **THEN** the page shows `2 910,00 €` and December to March, each `291,00 €`, with no estimate

#### Scenario: A line for each financing charge
- **WHEN** today is `2026-11-23`, the maintenance charge is 21400 cents from `2026-01-01`, `Putkiremontti` 8600 cents from `2025-03-01` and `Julkisivu` 4200 cents from `2026-01-01`, capitalised from `2025-03-01`, and Annika opens the charges page
- **THEN** the page shows 2026 with `3 762,00 €`, `Putkiremontti` `946,00 €` and `Julkisivu` `462,00 €` each with "Rahastoitu", each month `342,00 €`, and January with "Julkisivu alkoi"

#### Scenario: A member sees the charges
- **WHEN** Jussi, a member of the flat, opens its charges page
- **THEN** he sees the same years, totals and months as Annika

#### Scenario: A flat without charges
- **WHEN** an owner opens the charges page of a flat with no charges set
- **THEN** the page says that no charges are set and shows "Aseta vastikkeet", which opens the *Vastikkeet* page

#### Scenario: A member of a flat without charges
- **WHEN** Jussi, a member, opens the charges page of a flat with no charges set
- **THEN** the page says that no charges are set and shows no button

#### Scenario: Another user can't open the charges page
- **WHEN** a user without access opens `/properties/<id of Annika's flat>/charges`
- **THEN** they see that the flat was not found

### Requirement: Adding a financing charge
An owner of a flat SHALL be able to add a financing charge with a name, a monthly amount and a start date. The name SHALL be 1 to 60 characters after trimming surrounding spaces, and SHALL NOT equal the name of another of the flat's financing charges, ignoring case. The amount and the date SHALL follow the rules of "Charges are recorded as monthly periods" and "Setting a charge" for a first amount. The charge and its first period SHALL be stored together or not at all. The form SHALL say that the flat's treatment applies to the new charge too. A member SHALL NOT be able to add a financing charge.

#### Scenario: Adding a second financing charge
- **WHEN** the flat has the financing charge `Putkiremontti`, 8600 cents from `2025-03-01`, and Annika adds `Julkisivu`, `42` from `1.1.2026`
- **THEN** the *Vastikkeet* page lists `Putkiremontti` `86,00 €/kk` and `Julkisivu` `42,00 €/kk`, "1.1.2026 alkaen"

#### Scenario: A financing charge needs a name
- **WHEN** an owner adds a financing charge with the name `  `
- **THEN** it is refused with the reason `financing_charge_name_required`, and nothing is stored

#### Scenario: A name already in use is refused
- **WHEN** the flat has the financing charge `Putkiremontti`, and an owner adds `putkiremontti `
- **THEN** it is refused with the reason `financing_charge_name_taken`, and nothing is stored

#### Scenario: A new charge's date before the flat's ownership is refused
- **WHEN** the flat's first ownership period starts on `2025-03-01`, and an owner adds a financing charge from `1.1.2025`
- **THEN** it is refused with the reason `amount_date_before_ownership`, and nothing is stored

#### Scenario: A member can't add a financing charge
- **WHEN** Jussi, a member, sends a new financing charge to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing is stored

### Requirement: Renaming a financing charge
An owner SHALL be able to change the name of a financing charge, with the name rules of "Adding a financing charge" (the charge's own current name doesn't count as taken). A name SHALL replace the previous one; it is not a validity period. A charge without a name SHALL be shown as *Rahoitusvastike* in the user's language, and once named its name SHALL NOT be removed. A financing charge that isn't the flat's SHALL be refused with the reason `financing_charge_not_found`. A member SHALL NOT be able to rename.

#### Scenario: Naming the unnamed charge
- **WHEN** the flat's only financing charge has no name, and Annika names it `Putkiremontti`
- **THEN** the *Vastikkeet* page shows `Putkiremontti` with the same amount and history

#### Scenario: Changing the case of a name
- **WHEN** the charge is `julkisivu`, and Annika renames it `Julkisivu`
- **THEN** the charge is `Julkisivu`

#### Scenario: Another flat's charge is not found
- **WHEN** an owner sends renaming a financing charge of another flat to the server
- **THEN** it is refused with the reason `financing_charge_not_found`, and nothing changes

#### Scenario: A member can't rename a financing charge
- **WHEN** Jussi, a member, sends a new name for a financing charge to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Ending a financing charge
The financing charge's change form SHALL offer *Uusi summa* or *Päättyy*. *Päättyy* SHALL set the amount to 0 from the chosen date, with the rules of "Setting a charge". A financing charge SHALL be ended when its amount today is 0 and no later period starts; an ended charge SHALL be listed under *Päättyneet rahoitusvastikkeet* with the day before its last period starts and the amount before it, and SHALL still open its form for renaming and undoing. A charge whose 0 amount starts later SHALL show the end as its upcoming change.

#### Scenario: Ending a charge from next year
- **WHEN** today is `2026-11-23`, the charge `Hissiremontti` is 2400 cents from `2025-03-01`, and Annika chooses *Päättyy* from `1.1.2027`
- **THEN** `Hissiremontti` stays in effect with the upcoming change "1.1.2027 alkaen 0,00 €/kk"

#### Scenario: An ended charge is listed apart
- **WHEN** today is `2026-11-23`, and `Hissiremontti` is 2400 cents from `2025-03-01` and 0 cents from `2026-01-01`
- **THEN** the *Vastikkeet* page lists `Hissiremontti` under *Päättyneet rahoitusvastikkeet* with "Päättyi 31.12.2025" and `24,00 €/kk`, not with the charges in effect

#### Scenario: Undoing an ending
- **WHEN** `Hissiremontti` is 2400 cents from `2025-03-01` and 0 cents from `2026-01-01`, and Annika undoes the latest change
- **THEN** `Hissiremontti` is 2400 cents from `2025-03-01` with no end, and it is listed with the charges in effect

### Requirement: Existing financing charges become unnamed charges
When this change is deployed, the financing charge periods each flat already has SHALL become the periods of one financing charge of that flat without a name, unchanged. A flat without financing charge periods SHALL get no charge.

**No Playwright test:** a one-time database migration; a Workers test applies it to data stored in the previous schema.

#### Scenario: A flat's financing charge periods move to one unnamed charge
- **WHEN** before the migration the flat has the financing charge 8000 cents from `2025-03-01` to `2025-12-31` and 8600 cents from `2026-01-01`
- **THEN** after it the flat has one financing charge without a name, with the same two periods

#### Scenario: A flat without a financing charge gets none
- **WHEN** before the migration the flat has only a rent and a maintenance charge
- **THEN** after it the flat has no financing charge

### Requirement: Charges are recorded as monthly periods
A flat's maintenance charge SHALL be a sequence of periods, and the flat SHALL have any number of financing charges ("Adding a financing charge"), each its own sequence of periods. The rent is not a flat's amount: it belongs to the tenancy ("The rent of a tenancy"). Each period has a monthly amount in cents, a start date and an end date (open for the current one). Every start date SHALL be the first day of a month. Periods of the same sequence SHALL follow each other without gaps or overlaps. A new amount SHALL end the previous period on the last day of the month before it starts, and a recorded period SHALL NOT be changed except by the corrections in "Setting a charge" and "Undoing the latest charge change". A month's amount SHALL be that of the period containing the month's first day, and a month before the first period SHALL have no amount. An amount SHALL be from 0 to 99 999,99 € with at most two decimals.

**No Playwright test:** these are rules for stored periods and pure calculations; Vitest covers them with the functions and the repository, and the browser tests of the other requirements use them.

#### Scenario: A month's amount comes from the period containing its first day
- **WHEN** the maintenance charge was 20500 cents from `2025-03-01` and 21400 cents from `2026-01-01`
- **THEN** the amount for December 2025 is 20500, for January 2026 21400, and for February 2025 there is none

#### Scenario: A new amount ends the previous period the month before
- **WHEN** a maintenance charge of 21400 cents from `2026-01-01` is followed by 22600 cents from `2027-01-01`
- **THEN** the first period ends on `2026-12-31`, and the new one starts on `2027-01-01` with no end

#### Scenario: Each financing charge has its own periods
- **WHEN** `Putkiremontti` is 8600 cents from `2025-03-01`, and `Julkisivu` 4200 cents from `2026-01-01` and 4500 cents from `2027-01-01`
- **THEN** `Putkiremontti` has one period with no end, and `Julkisivu`'s first period ends on `2026-12-31`

#### Scenario: A date that isn't the first of a month is refused
- **WHEN** an owner sets the maintenance charge from `2027-03-15`
- **THEN** it is refused with the reason `amount_date_not_month_start`, and nothing is stored

#### Scenario: An invalid amount is refused
- **WHEN** an owner enters `-5`, `100000` or `12,345` as a monthly amount
- **THEN** it is refused with the reason `amount_invalid`, and nothing is stored

### Requirement: The charge amounts page
Everyone with access to a flat SHALL be able to open its charge amounts page, titled *Vastikkeet*, from the charges on the flat's details page ("The flat details page") and from its menu. The page SHALL show, for the maintenance charge, the amount in effect today with its start date, or that it is not set, and the next upcoming change if there is one. It SHALL show the flat's financing charges in one card: each charge that is not ended ("Ending a financing charge") with its name, its amount in effect today with its start date, or its first amount and start date when it starts later, and its next upcoming change; the sum per month of those in effect today when there are several; that there are none when the flat has none; and the treatment once, applying to all of them, or that it is not set. Ended charges SHALL be listed below the card. The page SHALL say that the rent is changed on the Tenancy page. Only owners SHALL see the buttons to set or change the amounts and the treatment and to add a financing charge. The page SHALL NOT show or set a rent.

#### Scenario: Opening the charge amounts page from the details page
- **WHEN** Annika, owner of `Kuusikuja 3 B 12`, opens its details page and chooses "Muuta" next to its charges
- **THEN** the *Vastikkeet* page of `Kuusikuja 3 B 12` opens, with no rent

#### Scenario: A flat without amounts
- **WHEN** an owner opens the page of a flat with no amounts, financing charges or treatment set
- **THEN** the maintenance charge and the treatment each show "Ei asetettu" with an "Aseta" button, and the financing charges say there are none, with "Lisää rahoitusvastike"

#### Scenario: The current amount and an upcoming change
- **WHEN** today is `2026-11-21` and the maintenance charge is 21400 cents from `2026-01-01` and 22600 cents from `2027-01-01`
- **THEN** the maintenance charge shows `214,00 €/kk`, "1.1.2026 alkaen", and the upcoming change "1.1.2027 alkaen 226,00 €/kk"

#### Scenario: Several financing charges with their sum
- **WHEN** today is `2026-11-23`, `Putkiremontti` is 8600 cents from `2025-03-01`, and `Julkisivu` 4200 cents from `2026-01-01`
- **THEN** the card shows `Putkiremontti` `86,00 €/kk`, `Julkisivu` `42,00 €/kk`, the sum `128,00 €/kk`, and the treatment once

#### Scenario: A member sees the amounts but can't change them
- **WHEN** Jussi, a member of the flat, opens its *Vastikkeet* page
- **THEN** he sees the amounts, the financing charges and the treatment, and no button to set, change or add them

### Requirement: Setting a charge
An owner of a flat SHALL be able to set its maintenance charge or one of its financing charges from a date: the first amount, or a new one. The date SHALL be the first of a month, SHALL NOT be before the month in which the flat's first ownership period starts, and SHALL NOT be before the start of that sequence's latest period. It MAY be in the future. An amount dated on the latest period's own start SHALL correct that period's amount instead of starting a new period. The form SHALL show the amount's change history, newest first, and, when an amount is already set, the current amount, the difference per month and its effect on the year the change starts in. A financing charge that isn't the flat's SHALL be refused with the reason `financing_charge_not_found`. A member SHALL NOT be able to set amounts.

#### Scenario: Setting the first maintenance charge of a flat
- **WHEN** Annika, owner since `2025-03-01`, sets the maintenance charge to `205` from `1.3.2025`
- **THEN** the page shows the maintenance charge `205,00 €/kk`, "1.3.2025 alkaen"

#### Scenario: Raising the maintenance charge from next year
- **WHEN** the maintenance charge is 21400 cents from `2026-01-01`, and Annika sets `226` from `1.1.2027`
- **THEN** the history shows "1.1.2027 alkaen 226,00 €" above "1.1.2026 alkaen 214,00 €", and the page shows the upcoming change

#### Scenario: Changing one financing charge leaves the others
- **WHEN** `Putkiremontti` is 8600 cents from `2025-03-01` and `Julkisivu` 4200 cents from `2026-01-01`, and Annika sets `Julkisivu` to `45` from `1.1.2027`
- **THEN** `Julkisivu` shows the upcoming change "1.1.2027 alkaen 45,00 €/kk", and `Putkiremontti` has one period with no end

#### Scenario: The change form shows the effect on the year
- **WHEN** the maintenance charge is 21400 cents, and Annika enters `226` from `1.1.2027`
- **THEN** the form shows "+12,00 €/kk (+5,6 %)" and that in 2027 it adds 144,00 € to deductible expenses over 12 months

#### Scenario: An amount on the latest period's start corrects it
- **WHEN** the maintenance charge's latest period is 22600 cents from `2027-01-01`, and Annika sets `230` from `1.1.2027`
- **THEN** the maintenance charge has one period from `2027-01-01`, with 23000 cents, and the previous period still ends on `2026-12-31`

#### Scenario: A date before the flat's ownership is refused
- **WHEN** the flat's first ownership period starts on `2025-03-01`, and an owner sets the maintenance charge from `1.1.2025`
- **THEN** it is refused with the reason `amount_date_before_ownership`, and nothing changes

#### Scenario: A date before the latest change is refused
- **WHEN** the maintenance charge's latest period starts on `2026-01-01`, and an owner sets a new amount from `1.6.2025`
- **THEN** it is refused with the reason `amount_date_too_early`, and nothing changes

#### Scenario: Another flat's financing charge is not found
- **WHEN** an owner sends a new amount for a financing charge of another flat to the server
- **THEN** it is refused with the reason `financing_charge_not_found`, and nothing changes

#### Scenario: A member can't set an amount
- **WHEN** Jussi, a member, sends a new maintenance charge to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Undoing the latest charge change
An owner SHALL be able to undo the latest change of a maintenance charge or financing charge that has at least one period. Undoing SHALL delete the latest period and make the previous one current again, with no end. When the deleted period was the maintenance charge's only one, the amount SHALL no longer be set, so that it can be set again from the right date. When it was a financing charge's only one, the financing charge itself SHALL be removed with it, so that a charge added by mistake can be removed. The confirmation SHALL name the amount that stays in force, or say that the amount, or the financing charge, will be removed. A member SHALL NOT be able to undo.

#### Scenario: Undoing a charge increase
- **WHEN** the maintenance charge is 21400 cents from `2026-01-01` and 22600 cents from `2027-01-01`, and Annika undoes the latest change
- **THEN** the maintenance charge is 21400 cents from `2026-01-01` with no end, and no upcoming change is shown

#### Scenario: Undoing the only maintenance charge
- **WHEN** the maintenance charge's only period is 21400 cents from `2025-06-01`, and Annika undoes it and sets `214` from `1.3.2025`
- **THEN** the maintenance charge has one period, 21400 cents from `2025-03-01` with no end

#### Scenario: Undoing a financing charge's only amount removes it
- **WHEN** `Julkisivu`'s only period is 4200 cents from `2026-01-01`, and Annika undoes it
- **THEN** the flat has no financing charge `Julkisivu`, and its other financing charges are unchanged

#### Scenario: Nothing to undo is refused
- **WHEN** an owner sends undoing the maintenance charge of a flat that has no maintenance charge to the server
- **THEN** it is refused with the reason `amount_nothing_to_undo`, and nothing changes

