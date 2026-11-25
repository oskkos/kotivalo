## ADDED Requirements

### Requirement: Usage charges are recorded as monthly periods
A flat SHALL have any number of usage charges: monthly charges the housing company bills the owner besides the maintenance and financing charges. Each usage charge SHALL have a kind, *water*, *parking*, *sauna* or *other*; a description, required for *other* and not stored for the other kinds; and a basis, *fixed* (an amount per month) or *per occupant* (an amount per occupant per month, "Usage charges of a month"). The kind and the basis SHALL NOT change after the charge is added. Each usage charge's amounts SHALL be its own sequence of periods with the rules of the charges: every start date the first of a month, no gaps or overlaps, a new amount ending the previous period on the last day of the month before, a month's amount that of the period containing its first day, and no amount before the first period. An amount SHALL be from 0 to 99 999,99 € with at most two decimals (`amount_invalid`). A description SHALL be 1 to 60 characters after trimming surrounding spaces (`description_required`). Usage charges SHALL be kept apart from the charges: they SHALL NOT appear on the *Vastikkeet* pages or in "Charges of a month".

**No Playwright test:** these are rules for stored periods and pure calculations; Vitest covers them with the functions and the repository, and the browser tests of the usage charge pages use them.

#### Scenario: A usage charge's month comes from the period containing its first day
- **WHEN** the water usage charge is 2000 cents per occupant from `2025-03-01` and 2200 cents from `2026-01-01`
- **THEN** its amount per occupant is 2000 cents in December 2025 and 2200 cents in January 2026, and February 2025 has none

#### Scenario: Other needs a description
- **WHEN** an owner adds a usage charge of the kind *other* with the description `  `
- **THEN** it is refused with the reason `description_required`, and nothing is stored

#### Scenario: Two parking spaces are two usage charges
- **WHEN** the flat has a parking usage charge of 1500 cents, and an owner adds another parking usage charge of 2500 cents from `2026-01-01`
- **THEN** the flat has both, each with its own periods

#### Scenario: A usage charge's date that isn't the first of a month is refused
- **WHEN** an owner adds a water usage charge from `2026-01-15`
- **THEN** it is refused with the reason `amount_date_not_month_start`, and nothing is stored

#### Scenario: An invalid usage charge amount is refused
- **WHEN** an owner enters `-5`, `100000` or `12,345` as a usage charge's amount
- **THEN** it is refused with the reason `amount_invalid`, and nothing is stored

### Requirement: Usage charges of a month
A flat's usage charges in a month SHALL be, for each usage charge with an amount in that month, its monthly amount: the period's amount for a fixed charge, and the period's amount times the month's occupants for a per-occupant charge. The month's occupants SHALL be those of the flat's tenancy running on the month's first day ("Occupants of a tenancy"), and one when no tenancy runs on that day. The amounts SHALL NOT be divided by days. A month's total SHALL be the sum of its usage charges. A usage charge SHALL be marked as changed in a month when its monthly amount is above 0 in both that month and the month before and they differ, whether the amount or the occupants changed; the mark SHALL carry the previous monthly amount.

A year's usage charges SHALL be computed for the year's months up to the current month in the current year, and for all twelve months in an earlier year, leaving out months without usage charges. The year's total SHALL be the sum of those months' totals, given per usage charge, leaving out charges whose sum in the year is 0. The years SHALL be the current year and every earlier year from the year in which the flat's first usage charge period starts. A flat has no usage charges when none has an amount in any month up to the current one.

**No Playwright test:** a pure calculation from the periods and the tenancies' occupants; Vitest covers it, and the usage charges by month page shows it in the browser test of "The usage charges by month page".

#### Scenario: A per-occupant charge follows the occupants
- **WHEN** the water usage charge is 2200 cents per occupant from `2026-01-01`, and `Aino Koski`'s tenancy, running since `2025-03-01`, has one occupant from `2025-03-01` and two from `2026-09-01`
- **THEN** the water usage charge is 2200 cents in August 2026 and 4400 cents in September 2026, and September is marked as changed from 2200 cents

#### Scenario: A vacant flat counts one occupant
- **WHEN** the water usage charge is 2200 cents per occupant, and the flat's only tenancy, with two occupants, ended on `2026-12-31`
- **THEN** the water usage charge of `2027-01` is 2200 cents

#### Scenario: The tenancy on the month's first day decides
- **WHEN** `Pekka Virtanen`'s tenancy with three occupants ends on `2026-11-14`, `Aino Koski`'s with one starts on `2026-11-15`, and the water usage charge is 2200 cents per occupant
- **THEN** the water usage charge of `2026-11` is 6600 cents and of `2026-12` 2200 cents

#### Scenario: A fixed charge is not divided by days
- **WHEN** the parking usage charge is 1500 cents from `2026-02-01`, and the flat's tenancy starts on `2026-02-15`
- **THEN** the parking usage charge of `2026-02` is 1500 cents

#### Scenario: A year's usage charges
- **WHEN** today is `2026-11-24`, the water usage charge is 2200 cents per occupant from `2026-01-01` with one occupant until `2026-08-31` and two from `2026-09-01`, and the parking usage charge 1500 cents from `2026-02-01`
- **THEN** 2026 has January to November, January with 2200 cents and November with 5900 cents, and the year's total is 45800 cents: water 30800 cents and parking 15000 cents

### Requirement: The usage charges page
Everyone with access to a flat SHALL be able to open its usage charges page, titled *Käyttömaksut*, from the *Käyttömaksut* card on the flat details page ("The flat details page"). The page SHALL list each usage charge that is not ended with its name (the kind's word, or the description for *other*), its amount in effect today per month, its basis, for a per-occupant charge the amount per occupant and this month's occupants (those on its first day, as in "Usage charges of a month"), and its start date, or its first amount and start date when it starts later, and the next upcoming change. A usage charge SHALL be ended when its amount today is 0 and no later period starts; ended charges SHALL be listed below the others under *Päättyneet käyttömaksut* with the day before their last period starts. When the flat has no usage charges, the page SHALL say so. The page SHALL say that a per-occupant charge uses the tenancy's occupants, and one occupant while the flat is vacant. Only owners SHALL see *Lisää käyttömaksu* and each charge's *Muuta*. A user without access SHALL see that the flat was not found.

#### Scenario: The usage charges in effect today
- **WHEN** today is `2026-11-24`, the water usage charge is 2200 cents per occupant from `2026-01-01`, `Aino Koski`'s tenancy has two occupants, the parking usage charge is 1500 cents from `2026-02-01`, and Annika opens the usage charges page
- **THEN** it shows `Vesimaksu` `44,00 €/kk` with "22,00 €/asukas/kk · 2 asukasta", and `Autopaikka` `15,00 €/kk` with "1.2.2026 alkaen", each with *Muuta*, and *Lisää käyttömaksu*

#### Scenario: Other shows its description
- **WHEN** the flat has a usage charge of the kind *other* with the description `Pyykkitupa`, 1000 cents from `2026-01-01`
- **THEN** the page lists it as `Pyykkitupa` `10,00 €/kk`

#### Scenario: An ended usage charge is listed apart
- **WHEN** today is `2026-11-24`, and the sauna usage charge is 1200 cents from `2025-03-01` and 0 cents from `2026-06-01`
- **THEN** the page lists `Sauna` under *Päättyneet käyttömaksut* with "Päättyi 31.5.2026", not with the charges in effect

#### Scenario: A flat without usage charges
- **WHEN** an owner opens the usage charges page of a flat with no usage charges
- **THEN** the page says that there are no usage charges, and shows *Lisää käyttömaksu*

#### Scenario: A member sees the usage charges but can't change them
- **WHEN** Jussi, a member of the flat, opens its usage charges page
- **THEN** he sees the usage charges and no *Lisää käyttömaksu* or *Muuta*

#### Scenario: Another user can't open the usage charges page
- **WHEN** a user without access opens `/properties/<id of Annika's flat>/usage-charges`
- **THEN** they see that the flat was not found

### Requirement: Adding a usage charge
An owner of a flat SHALL be able to add a usage charge: the kind, the description when the kind is *other*, the basis, the monthly amount and the start date. The basis SHALL default to *per occupant* for water and to *fixed* for the other kinds. The date SHALL be the first of a month and SHALL NOT be before the month in which the flat's first ownership period starts (`amount_date_before_ownership`); it MAY be in the future. For a per-occupant charge the form SHALL show the monthly amount with this month's occupants (those on its first day). The form SHALL show the kind's form 7H row ("Usage charge rows on form 7H"). The charge and its first period SHALL be stored together or not at all. After saving, the owner SHALL land on the usage charges page. A member SHALL NOT be able to add a usage charge.

#### Scenario: Adding the water charge per occupant
- **WHEN** Annika, owner since `2025-03-01`, adds a usage charge of the kind water, per occupant, `22` from `1.1.2026`, while `Aino Koski`'s tenancy has two occupants
- **THEN** the form shows `44,00 €/kk` with two occupants before saving, and the usage charges page lists `Vesimaksu` `44,00 €/kk`

#### Scenario: Other with a description
- **WHEN** Annika chooses *Muu*
- **THEN** the form shows the *Selite* field, and adding `Pyykkitupa`, fixed, `10` from `1.1.2026` lists `Pyykkitupa` `10,00 €/kk`

#### Scenario: A usage charge's date before the flat's ownership is refused
- **WHEN** the flat's first ownership period starts on `2025-03-01`, and an owner adds a usage charge from `1.1.2025`
- **THEN** it is refused with the reason `amount_date_before_ownership`, and nothing is stored

#### Scenario: A member can't add a usage charge
- **WHEN** Jussi, a member, sends a new usage charge to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing is stored

### Requirement: Changing a usage charge
An owner SHALL be able to give a usage charge a new amount from a date, from its *Muuta* on the usage charges page. The form SHALL offer *Uusi summa* or *Päättyy*; *Päättyy* SHALL set the amount to 0 from the chosen date. The date SHALL be the first of a month, SHALL NOT be before the flat's first ownership month (`amount_date_before_ownership`) and SHALL NOT be before the start of the charge's latest period (`amount_date_too_early`); it MAY be in the future. An amount dated on the latest period's own start SHALL correct that period's amount instead of starting a new period. The form SHALL show the charge's amounts, newest first, and the kind's form 7H row. A usage charge that isn't the flat's SHALL be refused with the reason `usage_charge_not_found`. A write based on a latest period that has changed meanwhile SHALL be refused with the reason `amount_changed`. A member SHALL NOT be able to change a usage charge.

#### Scenario: Raising the water charge from next year
- **WHEN** today is `2026-11-24`, the water usage charge is 2200 cents per occupant from `2026-01-01`, and Annika sets `24` from `1.1.2027`
- **THEN** the usage charges page shows `Vesimaksu` with the upcoming change "1.1.2027 alkaen 24,00 €/asukas/kk"

#### Scenario: Ending a parking space
- **WHEN** the parking usage charge is 1500 cents from `2026-02-01`, and Annika chooses *Päättyy* from `1.3.2027`
- **THEN** the parking usage charge is 0 cents from `2027-03-01`, and the page shows the end as its upcoming change

#### Scenario: An amount on the latest start corrects it
- **WHEN** the water usage charge's latest period is 2400 cents from `2027-01-01`, and Annika sets `25` from `1.1.2027`
- **THEN** the water usage charge has one period from `2027-01-01`, with 2500 cents

#### Scenario: A usage charge date before the latest change is refused
- **WHEN** the water usage charge's latest period starts on `2026-01-01`, and an owner sets a new amount from `1.6.2025`
- **THEN** it is refused with the reason `amount_date_too_early`, and nothing changes

#### Scenario: Another flat's usage charge is not found
- **WHEN** an owner sends a new amount for a usage charge of another flat to the server
- **THEN** it is refused with the reason `usage_charge_not_found`, and nothing changes

#### Scenario: A member can't change a usage charge
- **WHEN** Jussi, a member, sends a new amount for the flat's water usage charge to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Undoing the latest usage charge change
An owner SHALL be able to undo the latest change of a usage charge, from its change form, after a confirmation that names the amount that stays in force or says that the usage charge will be removed. Undoing SHALL delete the latest period and make the previous one current again, with no end. When the deleted period was the charge's only one, the usage charge itself SHALL be removed with it, so that a charge added by mistake can be removed. Undoing a usage charge without periods SHALL be refused with the reason `amount_nothing_to_undo`. A member SHALL NOT be able to undo.

#### Scenario: Undoing a usage charge increase
- **WHEN** the water usage charge is 2200 cents from `2026-01-01` and 2400 cents from `2027-01-01`, and Annika undoes the latest change and confirms
- **THEN** the water usage charge is 2200 cents from `2026-01-01` with no end, and no upcoming change is shown

#### Scenario: Undoing the only amount removes the usage charge
- **WHEN** the sauna usage charge's only period is 1200 cents from `2026-01-01`, and Annika undoes it and confirms
- **THEN** the flat has no sauna usage charge, and its other usage charges are unchanged

#### Scenario: A member can't undo a usage charge change
- **WHEN** Jussi, a member, sends undoing the water usage charge's latest change to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: The usage charges by month page
Everyone with access to a flat SHALL be able to open its usage charges by month page, titled *Käyttömaksut kuukausittain*, from the *Käyttömaksut* card on the flat details page. It SHALL show one year at a time, the current year first, with a choice of the years in "Usage charges of a month". For the chosen year it SHALL show the year's total and each usage charge's sum, and, for the current year, which months are counted. It SHALL list the year's months newest first, each with each usage charge above 0, for a per-occupant charge with the occupants and the amount per occupant, the month's total, and the previous amount of a charge marked as changed. It SHALL say that the amounts come from the usage charges and the tenancies' occupants, not from actual payments, with a link to the usage charges page. When the flat has no usage charges, the page SHALL say so, and show owners a button to the usage charges page. Back SHALL return to the flat details page. A user without access SHALL see that the flat was not found.

#### Scenario: The current year's usage charges by month
- **WHEN** today is `2026-11-24`, the water usage charge is 2200 cents per occupant from `2026-01-01` with one occupant until `2026-08-31` and two from `2026-09-01`, the parking usage charge 1500 cents from `2026-02-01`, and Annika opens the page
- **THEN** it shows 2026 with `458,00 €`, `Vesimaksu` `308,00 €` and `Autopaikka` `150,00 €`, November `59,00 €` with "Vesi 2 × 22,00 €", and September `59,00 €` with the water charge's previous amount `22,00 €`

#### Scenario: A member sees the usage charges by month
- **WHEN** Jussi, a member of the flat, opens the page
- **THEN** he sees the same years, totals and months as Annika

#### Scenario: A flat without usage charges by month
- **WHEN** an owner opens the page of a flat with no usage charges
- **THEN** the page says that there are no usage charges and shows *Lisää käyttömaksuja*, which opens the usage charges page

### Requirement: Water charge entries are warned about
When an owner adds a water usage charge, or sets a new amount for one, the form SHALL show how many of the flat's entries of the category `water_charge` are dated on or after the chosen start date, and their total, saying that they are counted in addition to the usage charge and should be deleted if they are the same monthly charges, with a link to the Entries page. The warning SHALL NOT block saving, and no entry SHALL be changed or deleted by it. Other kinds SHALL show no warning.

#### Scenario: Water charge entries after the start are warned about
- **WHEN** the flat has ten `water_charge` entries of 4400 cents dated from `2026-01-20` to `2026-10-20`, and Annika enters a water usage charge from `1.1.2026`
- **THEN** the form says that there are 10 water charge entries from `1.1.2026` on, `440,00 €` in all, with a link to the Entries page, and saving keeps the entries

#### Scenario: Entries before the start are not counted
- **WHEN** the flat's only `water_charge` entry is dated `2025-12-20`, and Annika enters a water usage charge from `1.1.2026`
- **THEN** the form shows no warning

### Requirement: Usage charge rows on form 7H
Each usage charge kind SHALL map to the form 7H row it fills in the year summary: water to row 2.2 (*Hoitovastikkeet ja vesimaksut*), and parking, sauna and other to row 2.5 (*Muut kulut*). The add and change forms SHALL show the row as a hint. The year summary (#34) uses the mapping; nothing is stored per row.

**No Playwright test:** pure data; Vitest covers the mapping, and the form's hint is shown in the browser test of "Adding a usage charge".

#### Scenario: Water goes with the maintenance charges
- **WHEN** a usage charge's kind is water
- **THEN** its row is 2.2

#### Scenario: Parking is another cost
- **WHEN** a usage charge's kind is parking
- **THEN** its row is 2.5
