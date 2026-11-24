## ADDED Requirements

### Requirement: The rent of a tenancy
Each tenancy SHALL have its own rent as a sequence of periods; a flat without a tenancy has no rent. The first period SHALL start on the tenancy's start day, and every later period on the first of a month after it. Periods SHALL follow each other without gaps or overlaps: a new period SHALL end the previous one on the day before it starts, and the latest period SHALL have no end, because the tenancy's own end bounds it. A month's rent SHALL be that of the period containing the month's first day, or the tenancy's start day in the month it starts. A tenancy moved from the flat's earlier rent ("Existing rents move to their tenancies") MAY have no rent for its first months, which then have no rent until an owner fills them ("Changing a tenancy's rent"). A rent SHALL be from 0 to 99 999,99 € with at most two decimals (`amount_invalid`).

**No Playwright test:** these are rules for stored periods and pure calculations; Vitest covers them with the functions and the repository, and the browser tests of "Changing a tenancy's rent" and "The tenancy page" use them.

#### Scenario: The first rent starts on the tenancy's start day
- **WHEN** a tenancy starts on `2026-11-15` with the rent 90000 cents
- **THEN** its only rent period starts on `2026-11-15` with no end, the rent of `2026-11` is 90000 cents, and `2026-10` has no rent

#### Scenario: A change ends the previous rent period the day before
- **WHEN** a tenancy's rent is 89000 cents from `2025-03-01` and 92000 cents from `2027-03-01`
- **THEN** the first period ends on `2027-02-28`, and the second starts on `2027-03-01` with no end

#### Scenario: Each tenancy has its own rent
- **WHEN** `Pekka Virtanen`'s tenancy ends on `2026-11-14` with the rent 80000 cents, and `Aino Koski`'s starts on `2026-11-15` with the rent 90000 cents
- **THEN** the rent of `2026-11` is 80000 cents for `Pekka Virtanen`'s tenancy and 90000 cents for `Aino Koski`'s

### Requirement: Changing a tenancy's rent
An owner of a flat SHALL be able to change a tenancy's rent from a date, from the rent card on the Tenancy page ("The tenancy page") or from the tenancy's correction form ("Correcting a tenancy"). The date SHALL be the first of a month, or the tenancy's start day (`amount_date_not_month_start`); SHALL NOT be before the tenancy's start (`rent_date_before_tenancy`) or after its last day when it has one (`rent_date_after_tenancy`); and SHALL NOT be before the start of the latest rent period (`amount_date_too_early`), unless it is before the first rent period's start, where no rent is in effect: such a rent SHALL fill those months with a period from the date to the day before the first period's start. It MAY be in the future. A rent dated on the latest period's own start SHALL correct that period's amount instead of starting a new period, so the first rent is corrected by dating it on the tenancy's start. A tenancy without a rent SHALL get its first rent the same way. The form SHALL show the current rent and the difference per month and in percent. A tenancy that isn't the flat's SHALL be refused with the reason `tenancy_not_found`. A member SHALL NOT be able to change the rent.

#### Scenario: Raising the rent from March
- **WHEN** today is `2026-11-22`, `Aino Koski`'s rent is 89000 cents from `2026-03-01`, and Annika sets `920` from `1.3.2027` on her Tenancy page
- **THEN** the rent card shows `890,00 €/kk` and the upcoming change "1.3.2027 alkaen 920,00 €/kk", and the changes list "1.3.2027 alkaen 920,00 €" above "1.3.2026 alkaen 890,00 €"

#### Scenario: The form shows the difference
- **WHEN** the rent is 89000 cents, and Annika enters `920`
- **THEN** the form shows "+30,00 €/kk (+3,4 %)"

#### Scenario: Correcting the first rent on the tenancy's start
- **WHEN** a tenancy starts on `2026-11-15` with the rent 90000 cents, and Annika sets `950` from `15.11.2026`
- **THEN** the tenancy's only rent period is 95000 cents from `2026-11-15`

#### Scenario: A mid-month date other than the start is refused
- **WHEN** a tenancy starts on `2025-03-01`, and an owner sets the rent from `15.3.2027`
- **THEN** it is refused with the reason `amount_date_not_month_start`, and nothing changes

#### Scenario: A date before the tenancy is refused
- **WHEN** a tenancy starts on `2025-03-01`, and an owner sets the rent from `1.1.2025`
- **THEN** it is refused with the reason `rent_date_before_tenancy`, and nothing changes

#### Scenario: A date after the tenancy is refused
- **WHEN** a tenancy's last rent day is `2027-01-31`, and an owner sets the rent from `1.2.2027`
- **THEN** it is refused with the reason `rent_date_after_tenancy`, and nothing changes

#### Scenario: A rent date before the latest change is refused
- **WHEN** a tenancy's latest rent period starts on `2026-03-01`, and an owner sets the rent from `1.6.2025`
- **THEN** it is refused with the reason `amount_date_too_early`, and nothing changes

#### Scenario: Filling the first months of a migrated tenancy
- **WHEN** a tenancy runs from `2025-03-01`, its only rent period is 89000 cents from `2026-01-01`, and Annika sets `850` from `1.3.2025`
- **THEN** the tenancy's rent is 85000 cents from `2025-03-01` to `2025-12-31` and 89000 cents from `2026-01-01` with no end, and a rent from `1.6.2025` is then refused with the reason `amount_date_too_early`

#### Scenario: Another flat's tenancy is not found
- **WHEN** an owner sends a new rent for a tenancy of another flat to the server
- **THEN** it is refused with the reason `tenancy_not_found`, and nothing changes

#### Scenario: A member can't change the rent
- **WHEN** Jussi, a member, sends a new rent for the flat's tenancy to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Undoing a tenancy's rent change
An owner SHALL be able to undo the latest change of a tenancy's rent when it has more than one rent period, after a confirmation naming the rent that stays in force. Undoing SHALL delete the latest period and make the previous one current again, with no end. The first rent SHALL NOT be undone, because a tenancy always has its rent: undoing a tenancy with one rent period or none SHALL be refused with the reason `amount_nothing_to_undo`, and the page SHALL NOT offer it. A member SHALL NOT be able to undo.

#### Scenario: Undoing a rent increase
- **WHEN** a tenancy's rent is 89000 cents from `2026-03-01` and 92000 cents from `2027-03-01`, and Annika undoes the latest change and confirms
- **THEN** the rent is 89000 cents from `2026-03-01` with no end, and no upcoming change is shown

#### Scenario: The first rent can't be undone
- **WHEN** a tenancy has one rent period, and an owner sends undoing its rent to the server
- **THEN** it is refused with the reason `amount_nothing_to_undo`, and nothing changes

#### Scenario: A member can't undo a rent change
- **WHEN** a tenancy's rent has two periods, and Jussi, a member, sends undoing the latest to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Rent changes stay inside their tenancy
A tenancy's rent periods SHALL stay within the tenancy. Ending it ("Ending a tenancy", "Ending a fixed-term tenancy early") or correcting its fixed term's end ("Correcting a tenancy") so that its last day is before the latest rent period's start SHALL be refused with the reason `tenancy_has_rent_after_end`; the owner undoes that change first. Correcting the start SHALL move the first rent period's start to the new start when the first period started on the old start or the new start is after it; a new start on or after the second rent period's start SHALL be refused with the reason `tenancy_start_after_rent_change`. Nothing else SHALL change. Removing a tenancy that hasn't started SHALL remove its rent periods with it ("Removing a tenancy that hasn't started").

**No Playwright test:** server-side checks with the same forms and reason display as the tenancy forms' browser tests; Vitest covers them.

#### Scenario: Ending before a rent change is refused
- **WHEN** `Aino Koski`'s rent is 89000 cents from `2026-03-01` and 92000 cents from `2027-03-01`, and an owner ends the tenancy with the last rent day `2027-01-31`
- **THEN** it is refused with the reason `tenancy_has_rent_after_end`, and the tenancy and its rent are unchanged

#### Scenario: Ending after the latest rent change is allowed
- **WHEN** `Aino Koski`'s rent is 89000 cents from `2025-03-01` and 92000 cents from `2026-03-01`, and an owner ends the tenancy with the last rent day `2026-12-31`
- **THEN** the tenancy is ended, and its rent periods are unchanged

#### Scenario: Moving the start moves the first rent
- **WHEN** a tenancy and its first rent period start on `2025-03-01`, and an owner corrects the start to `2025-03-15`
- **THEN** the first rent period starts on `2025-03-15`

#### Scenario: Moving the start earlier moves the first rent
- **WHEN** a tenancy and its first rent period start on `2025-03-15`, and an owner corrects the start to `2025-02-15`
- **THEN** the first rent period starts on `2025-02-15`

#### Scenario: A start after a rent change is refused
- **WHEN** a tenancy starts on `2025-03-01` with a rent change from `2026-03-01`, and an owner corrects the start to `2026-04-01`
- **THEN** it is refused with the reason `tenancy_start_after_rent_change`, and the tenancy and its rent are unchanged

### Requirement: Existing rents move to their tenancies
When this change is deployed, the rent periods each flat already has SHALL be copied to the tenancies they overlap, each clipped to the tenancy: a period starting before the tenancy SHALL start on the tenancy's start day, and a period running past the tenancy's last day SHALL have no end. Rent periods outside every tenancy SHALL NOT be copied. The flat-level rent periods SHALL then be deleted.

**No Playwright test:** a one-time database migration; a Workers test applies it to data stored in the previous schema.

#### Scenario: A rent spanning a tenant change is split
- **WHEN** before the migration the flat's rent is 80000 cents from `2025-01-01` to `2026-10-31` and 90000 cents from `2026-11-01`, `Pekka Virtanen`'s tenancy runs from `2025-01-01` to `2026-11-14`, and `Aino Koski`'s from `2026-11-15`
- **THEN** after it `Pekka Virtanen`'s tenancy has 80000 cents from `2025-01-01` to `2026-10-31` and 90000 cents from `2026-11-01` with no end, and `Aino Koski`'s has 90000 cents from `2026-11-15` with no end

#### Scenario: Rent outside every tenancy is left out
- **WHEN** before the migration a flat has the rent 89000 cents from `2025-03-01` and no tenancy
- **THEN** after it no tenancy has a rent, and the flat's rent period is no longer stored

#### Scenario: A tenancy that started before the rent was set
- **WHEN** before the migration a tenancy runs from `2024-06-01`, and the flat's rent is 89000 cents from `2025-01-01`
- **THEN** after it the tenancy has 89000 cents from `2025-01-01`, and its months before `2025-01` have no rent

## MODIFIED Requirements

### Requirement: The rent of a new tenancy
The new tenant form SHALL always ask for the rent, also for an earlier tenancy, and the rent SHALL be required (`amount_invalid`). The field SHALL suggest the latest rent of the flat's previous tenancy, the one that starts last before the new start date, or be empty when there is none. The rent SHALL be saved as the new tenancy's first rent period from its start day ("The rent of a tenancy"), together with the tenancy or not at all. Adding a tenancy SHALL NOT change any other tenancy's rent.

#### Scenario: The form suggests the previous tenancy's rent
- **WHEN** `Aino Koski`'s tenancy runs from `2025-03-01` with the rent 85000 cents and 89000 cents from `2026-03-01`, she has given notice to `2026-12-31`, and an owner enters the start date `1.1.2027` for a new tenant
- **THEN** the rent field shows `890,00`

#### Scenario: The first tenancy's rent field is empty
- **WHEN** the flat has no tenancy, and an owner opens the new tenant form
- **THEN** the rent field is empty

#### Scenario: The rent starts on the tenancy's start day
- **WHEN** Annika adds a tenancy starting `15.1.2027` with the rent `910`
- **THEN** the tenancy is stored with one rent period, 91000 cents from `2027-01-15` with no end

#### Scenario: The rent is required
- **WHEN** an owner saves the new tenant form with the rent empty
- **THEN** it is refused with the reason `amount_invalid` under the rent, and nothing is stored

#### Scenario: An earlier tenancy gets its own rent
- **WHEN** `Aino Koski`'s tenancy runs from `2025-03-01` with the rent 89000 cents, and Annika adds `Pekka Virtanen`'s earlier tenancy from `1.6.2023` to `28.2.2025` with the rent `820`
- **THEN** `Pekka Virtanen`'s tenancy has 82000 cents from `2023-06-01`, and `Aino Koski`'s rent is unchanged

### Requirement: The tenancy page
Everyone with access to a flat SHALL be able to open its Tenancy page from the tenancy card on the flat's details page ("The flat details page"). The page SHALL show the current tenancy (the one running today, or else the next one to start): the tenant's name, its status, call and email links for the phone and email given, the contract type, contract made, the start, the end or last rent day and the due day; and, for notice given, who gave notice and when. Below it, a rent card SHALL show the tenancy's rent ("The rent of a tenancy") in effect today, or its first rent when the tenancy starts later, with its start date, or that it is not set; the next upcoming change; and the rent periods, newest first. Owners SHALL see *Muuta* on the rent card ("Changing a tenancy's rent") and, when the rent has more than one period, *Peru viimeisin muutos* ("Undoing a tenancy's rent change"). The flat's other tenancies (earlier ones, and one to come after the current one) SHALL be listed below, newest first, with their dates, status and latest rent. When the flat has no current tenancy, the page SHALL say that it is vacant, when the last tenancy ended if there was one, and offer to add a tenant. Owners SHALL see the buttons to add, edit, end and cancel; members SHALL NOT. For owners, each of the other tenancies SHALL open its correction form, and the page SHALL offer to add an earlier tenancy. Ending SHALL NOT be offered for a tenancy that hasn't started.

#### Scenario: Opening the tenancy page from the details page
- **WHEN** Annika opens the details page of `Kuusikuja 3 B 12`, where `Aino Koski` lives, and selects its tenancy card
- **THEN** the Tenancy page of `Kuusikuja 3 B 12` opens and shows `Aino Koski`

#### Scenario: The rent card with its changes
- **WHEN** today is `2026-11-22`, and `Aino Koski`'s rent is 85000 cents from `2025-03-01` and 89000 cents from `2026-03-01`
- **THEN** the rent card shows `890,00 €/kk`, "1.3.2026 alkaen", the changes "1.3.2026 alkaen 890,00 €" above "1.3.2025 alkaen 850,00 €", and to Annika *Muuta* and *Peru viimeisin muutos*

#### Scenario: Other tenancies show their latest rent
- **WHEN** the flat lists `Pekka Virtanen`'s ended tenancy, whose rent was 82000 cents
- **THEN** his row shows `820,00 €/kk`

#### Scenario: A vacant flat offers to add a tenant
- **WHEN** today is `2027-01-10`, the flat's only tenancy ended on `2026-12-31`, and Annika opens the Tenancy page
- **THEN** the page says the flat is vacant since the tenancy ended on `31.12.2026`, lists that tenancy under the other tenancies, and shows "Lisää vuokralainen"

#### Scenario: Adding an earlier tenancy from the tenancy page
- **WHEN** `Aino Koski`'s open-ended tenancy runs, and Annika selects "Lisää aiempi vuokrasuhde" on the Tenancy page
- **THEN** the new tenant form opens

#### Scenario: Correcting an earlier tenancy from the list
- **WHEN** the flat lists `Pekka Virtanen`'s ended tenancy under the other tenancies, and Annika selects it
- **THEN** the correction form of `Pekka Virtanen`'s tenancy opens

#### Scenario: A tenancy that hasn't started can't be ended
- **WHEN** today is `2026-11-22`, and the flat's current tenancy, `Mikko Lehtinen`'s, starts on `2027-01-01`
- **THEN** the Tenancy page offers no "Päätä vuokrasuhde" for it

#### Scenario: A member sees the tenancy but can't change it
- **WHEN** Jussi, a member of the flat, opens its Tenancy page
- **THEN** he sees the tenant's name, contact links and the rent card, no button to add, edit, end or cancel or to change or undo the rent, and the other tenancies don't open a form

### Requirement: Correcting a tenancy
An owner SHALL be able to correct a tenancy's details: the name, phone, email, contract type, contract made, start, the fixed term's end and the due day, with the same checks as adding against the flat's other tenancies. When an ending is recorded, the corrected tenancy SHALL still fit it under the rules of "Ending a tenancy" and "Ending a fixed-term tenancy early", or the correction SHALL be refused with the reason `tenancy_correction_conflicts_ending`. The correction SHALL change the tenancy in place, without a history. The rent SHALL NOT be changed in this form; the form SHALL offer owners *Muuta vuokraa*, which opens the tenancy's rent form ("Changing a tenancy's rent") and returns to the Tenancy page, so every tenancy's rent can be changed, not only the current one's. A corrected start moves the first rent period with it ("Rent changes stay inside their tenancy"). A member SHALL NOT be able to correct a tenancy.

#### Scenario: Correcting the tenant's phone number
- **WHEN** Annika corrects the phone number of `Aino Koski` to `040 765 4321`
- **THEN** the Tenancy page shows `040 765 4321`, and no earlier number is kept

#### Scenario: Changing an earlier tenancy's rent from its correction form
- **WHEN** `Pekka Virtanen`'s ended tenancy ran from `2023-06-01` with the rent 82000 cents, and Annika opens its correction form, selects "Muuta vuokraa" and sets `850` from `1.6.2024`
- **THEN** the Tenancy page opens again, and `Pekka Virtanen`'s row shows `850,00 €/kk`

#### Scenario: A correction can't make tenancies overlap
- **WHEN** the previous tenancy ended on `2025-02-28`, and an owner corrects the next tenancy's start to `2025-02-15`
- **THEN** it is refused with the reason `tenancy_overlaps`, and the tenancy is unchanged

#### Scenario: A correction must fit a recorded ending
- **WHEN** `Aino Koski`'s open-ended tenancy has the tenant's notice with the last rent day `2026-12-31`, and an owner corrects it to fixed-term ending `30.11.2026`
- **THEN** it is refused with the reason `tenancy_correction_conflicts_ending`, and the tenancy is unchanged

#### Scenario: A member can't correct a tenancy
- **WHEN** Jussi, a member, sends a correction to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and the tenancy is unchanged

### Requirement: Removing a tenancy that hasn't started
An owner SHALL be able to remove a tenancy before its start day, for example when the tenant withdraws before moving in, from the tenancy's correction form after a confirmation. On or after its start day removing SHALL be refused with the reason `tenancy_already_started`, and the form SHALL NOT offer it. The tenancy's rent periods SHALL be removed with it. After removing, the owner SHALL land on the Tenancy page. A member SHALL NOT be able to remove a tenancy.

#### Scenario: Removing a tenancy whose tenant withdrew
- **WHEN** today is `2026-11-22`, `Mikko Lehtinen`'s fixed-term tenancy starts on `1.1.2027` with the rent 91000 cents, and Annika removes it from its correction form and confirms
- **THEN** the Tenancy page no longer lists `Mikko Lehtinen`, and no rent period of his tenancy is stored

#### Scenario: A started tenancy can't be removed
- **WHEN** today is `2026-11-22`, and an owner sends removing a tenancy that started on `2026-11-22` to the server
- **THEN** it is refused with the reason `tenancy_already_started`, and the tenancy is unchanged

#### Scenario: A member can't remove a tenancy
- **WHEN** Jussi, a member, sends removing a tenancy that hasn't started to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and the tenancy is unchanged
