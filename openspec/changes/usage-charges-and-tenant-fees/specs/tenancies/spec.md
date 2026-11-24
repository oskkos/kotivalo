## ADDED Requirements

### Requirement: Occupants of a tenancy
Each tenancy SHALL have its number of occupants, the persons living in the flat, as a sequence of periods, so that per-occupant usage charges and tenant fees follow it. The first period SHALL start on the tenancy's start day, and every later period on the first of a month after it. Periods SHALL follow each other without gaps or overlaps: a new period SHALL end the previous one on the day before it starts, and the latest period SHALL have no end, because the tenancy's own end bounds it. A month's occupants SHALL be those of the period containing the month's first day, or the tenancy's start day in the month it starts. The number SHALL be a whole number from 1 to 20 (`occupants_invalid`).

**No Playwright test:** rules for stored periods and pure calculations; Vitest covers them with the functions and the repository, and the browser tests of "Changing the occupants" and "The tenancy page" use them.

#### Scenario: The first occupants start on the tenancy's start day
- **WHEN** a tenancy starts on `2026-11-15` with two occupants
- **THEN** its only occupants period starts on `2026-11-15` with no end, and `2026-11` has two occupants

#### Scenario: A change of occupants ends the previous period the day before
- **WHEN** a tenancy has one occupant from `2025-03-01` and two from `2026-09-01`
- **THEN** the first period ends on `2026-08-31`, `2026-08` has one occupant and `2026-09` two

#### Scenario: Zero occupants is refused
- **WHEN** an owner sets the occupants to `0` or `21`
- **THEN** it is refused with the reason `occupants_invalid`, and nothing changes

### Requirement: Changing the occupants
An owner SHALL be able to change a tenancy's occupants from a date, from the occupants row on the Tenancy page. The date SHALL be the first of a month, or the tenancy's start day (`amount_date_not_month_start`); SHALL NOT be before the tenancy's start (`rent_date_before_tenancy`), after its last day when it has one (`rent_date_after_tenancy`), or before the latest period's start (`amount_date_too_early`). A number dated on the latest period's start SHALL correct that period instead of starting a new one. The form SHALL say that per-occupant charges and fees change from that month. An owner SHALL be able to undo the latest change when there are two periods or more, after a confirmation naming the number that stays in force; undoing a tenancy with one period SHALL be refused with the reason `occupants_nothing_to_undo`, and the page SHALL NOT offer it. A tenancy that isn't the flat's SHALL be refused with the reason `tenancy_not_found`. A member SHALL NOT be able to change or undo the occupants.

#### Scenario: A second occupant moves in
- **WHEN** today is `2026-11-24`, `Aino Koski`'s tenancy has one occupant from `2025-03-01`, and Annika sets `2` from `1.12.2026` on the Tenancy page
- **THEN** the occupants row shows `1` and the upcoming change "1.12.2026 alkaen 2"

#### Scenario: Correcting the occupants on the tenancy's start
- **WHEN** a tenancy that started on `2025-03-01` has one occupant from `2025-03-01` only, and Annika sets `2` from `1.3.2025`
- **THEN** the tenancy has one occupants period, two from `2025-03-01`

#### Scenario: Undoing an occupants change
- **WHEN** the tenancy has one occupant from `2025-03-01` and two from `2026-12-01`, and Annika undoes the latest change and confirms
- **THEN** the tenancy has one occupant from `2025-03-01` with no end

#### Scenario: The only occupants period can't be undone
- **WHEN** a tenancy has one occupants period, and an owner sends undoing it to the server
- **THEN** it is refused with the reason `occupants_nothing_to_undo`, and nothing changes

#### Scenario: A member can't change the occupants
- **WHEN** Jussi, a member, sends new occupants for the flat's tenancy to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Tenant fees are recorded as periods
A tenancy SHALL have any number of tenant fees: what the tenant pays the landlord on top of the rent. A fee included in the rent is not recorded. Each tenant fee SHALL have a kind, *water*, *parking*, *sauna* or *other*; a description, required for *other* (`description_required`, 1 to 60 characters after trimming) and not stored for the other kinds; and a basis, *fixed* or *per occupant*. The kind and the basis SHALL NOT change after the fee is added. Tenant fees SHALL NOT be linked to the flat's usage charges. Each fee's amounts SHALL be its own sequence of periods inside the tenancy: every start date the first of a month or the tenancy's start day, no gaps or overlaps, a new amount ending the previous period on the day before it starts, and the latest period with no end. A month's fee SHALL be that of the period containing the month's first day, or the tenancy's start day in the month it starts, times the month's occupants for a per-occupant fee. An amount SHALL be from 0 to 99 999,99 € with at most two decimals (`amount_invalid`). Tenant fees are rental income (form 7H row 2.1) for the year summary (#34).

**No Playwright test:** rules for stored periods and pure calculations; Vitest covers them with the functions and the repository, and the browser tests of the fee forms and the Tenancy page use them.

#### Scenario: A per-occupant water fee
- **WHEN** `Aino Koski`'s tenancy has a water fee of 2200 cents per occupant from `2025-03-01`, one occupant from `2025-03-01` and two from `2026-09-01`
- **THEN** the water fee is 2200 cents in `2026-08` and 4400 cents in `2026-09`

#### Scenario: A parking fee taken mid-tenancy
- **WHEN** `Aino Koski`'s tenancy started on `2025-03-01`, and it has a fixed parking fee of 1500 cents from `2026-02-01`
- **THEN** the parking fee is 1500 cents in `2026-02` and none in `2026-01`

### Requirement: Adding a tenant fee
An owner SHALL be able to add a tenant fee to a tenancy from the fees card on the Tenancy page: the kind, the description when the kind is *other*, the basis, the monthly amount and the start date. The basis SHALL default to *per occupant* for water and to *fixed* for the other kinds. The start date SHALL follow the date rules of "Changing a tenant fee". The form SHALL show the month's total the tenant pays from that date: the rent and the fees, the new one included. For a water fee, the form SHALL show how many of the flat's entries of the category `tenant_water_charge` are dated on or after the start date and their total, with a link to the Entries page, without blocking saving. The fee and its first period SHALL be stored together or not at all. After saving, the owner SHALL land on the Tenancy page. A member SHALL NOT be able to add a tenant fee.

#### Scenario: Adding a parking fee
- **WHEN** today is `2026-11-24`, `Aino Koski`'s rent is 89000 cents, and Annika adds a fixed parking fee of `15` from `1.12.2026`
- **THEN** the form shows "949,00 €" from December before saving, and the Tenancy page's fees card lists `Autopaikka` `15,00 €/kk`, "1.12.2026 alkaen"

#### Scenario: Other fee with a description
- **WHEN** Annika chooses *Muu* on the fee form
- **THEN** the form shows the *Selite* field, and adding `Pyykkitupa`, fixed, `10` from `1.12.2026` lists `Pyykkitupa` `10,00 €/kk`

#### Scenario: Tenant water charge entries are warned about
- **WHEN** the flat has three `tenant_water_charge` entries of 4400 cents dated from `2026-01-05` to `2026-03-05`, and Annika enters a water fee from `1.1.2026`
- **THEN** the form says that there are 3 such entries from `1.1.2026` on, `132,00 €` in all, with a link to the Entries page, and saving keeps the entries

#### Scenario: A fee before the tenancy is refused
- **WHEN** a tenancy starts on `2025-03-01`, and an owner adds a fee from `1.1.2025`
- **THEN** it is refused with the reason `rent_date_before_tenancy`, and nothing is stored

#### Scenario: A member can't add a tenant fee
- **WHEN** Jussi, a member, sends a new tenant fee to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing is stored

### Requirement: Changing a tenant fee
An owner SHALL be able to give a tenant fee a new amount from a date, from the fee's *Muuta* on the Tenancy page. The form SHALL offer *Uusi summa* or *Päättyy*; *Päättyy* SHALL set the amount to 0 from the chosen date. The date SHALL be the first of a month, or the tenancy's start day (`amount_date_not_month_start`); SHALL NOT be before the tenancy's start (`rent_date_before_tenancy`), after its last day when it has one (`rent_date_after_tenancy`), or before the start of the fee's latest period (`amount_date_too_early`); it MAY be in the future. An amount dated on the latest period's own start SHALL correct that period instead of starting a new one. The form SHALL show the fee's amounts, newest first. A fee that isn't the tenancy's, or a tenancy that isn't the flat's, SHALL be refused with the reason `tenant_fee_not_found`. A write based on a latest period that has changed meanwhile SHALL be refused with the reason `amount_changed`. A member SHALL NOT be able to change a tenant fee.

#### Scenario: The tenant gives up the parking space
- **WHEN** today is `2026-11-24`, the parking fee is 1500 cents from `2026-02-01`, and Annika chooses *Päättyy* from `1.1.2027`
- **THEN** the fees card shows `Autopaikka` `15,00 €/kk` with the upcoming change "1.1.2027 alkaen 0,00 €/kk"

#### Scenario: An ended fee is listed apart
- **WHEN** today is `2027-02-10`, and the parking fee is 1500 cents from `2026-02-01` and 0 cents from `2027-01-01`
- **THEN** the fees card lists `Autopaikka` as ended with "Päättyi 31.12.2026", and leaves it out of the month's total

#### Scenario: A fee date after the tenancy is refused
- **WHEN** a tenancy's last rent day is `2027-01-31`, and an owner sets a fee from `1.2.2027`
- **THEN** it is refused with the reason `rent_date_after_tenancy`, and nothing changes

#### Scenario: Another tenancy's fee is not found
- **WHEN** an owner sends a new amount for a fee of another flat's tenancy to the server
- **THEN** it is refused with the reason `tenant_fee_not_found`, and nothing changes

#### Scenario: A member can't change a tenant fee
- **WHEN** Jussi, a member, sends a new amount for the tenancy's parking fee to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Undoing a tenant fee change
An owner SHALL be able to undo the latest change of a tenant fee, from its change form, after a confirmation that names the amount that stays in force or says that the fee will be removed. Undoing SHALL delete the latest period and make the previous one current again, with no end. When the deleted period was the fee's only one, the fee itself SHALL be removed with it. Undoing a fee without periods SHALL be refused with the reason `amount_nothing_to_undo`. A member SHALL NOT be able to undo.

#### Scenario: Undoing a fee's ending
- **WHEN** the parking fee is 1500 cents from `2026-02-01` and 0 cents from `2027-01-01`, and Annika undoes the latest change and confirms
- **THEN** the parking fee is 1500 cents from `2026-02-01` with no end

#### Scenario: Undoing a fee's only amount removes it
- **WHEN** the sauna fee's only period is 1000 cents from `2026-12-01`, and Annika undoes it and confirms
- **THEN** the tenancy has no sauna fee, and its other fees are unchanged

#### Scenario: A member can't undo a tenant fee change
- **WHEN** Jussi, a member, sends undoing the parking fee's latest change to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Occupants and fees of a new tenancy
The new tenant form SHALL ask for the number of occupants (`occupants_invalid`), defaulting to 1, saved as the tenancy's first occupants period from its start day. When the flat has a previous tenancy (the one that starts last before the new start date) with fees not ended on its last day, the form SHALL list them, each with its kind or description, basis and latest amount, unchecked, saying that a fee left unchecked is included in the rent. Each checked fee SHALL be saved as a fee of the new tenancy with the same kind, description, basis and amount from the new tenancy's start day. The form SHALL show the month's total the tenant pays: the rent and the checked fees with the occupants given. The occupants and the fees SHALL be stored together with the tenancy or not at all. Adding a tenancy SHALL NOT change another tenancy's occupants or fees.

#### Scenario: The occupants of a new tenancy
- **WHEN** Annika adds a tenancy starting `15.1.2027` with `2` occupants
- **THEN** the tenancy is stored with one occupants period, two from `2027-01-15` with no end

#### Scenario: The previous tenancy's fees are offered unchecked
- **WHEN** `Aino Koski`'s tenancy ends on `2026-12-31` with a water fee of 2200 cents per occupant and a parking fee of 1500 cents, and an owner opens the new tenant form with the start `1.1.2027`
- **THEN** the form lists `Vesimaksu` "22,00 €/asukas" and `Autopaikka` `15,00 €`, both unchecked

#### Scenario: A checked fee is copied to the new tenancy
- **WHEN** on that form Annika enters the rent `890`, `1` occupant and checks only `Vesimaksu`
- **THEN** the form shows "912,00 €" a month, and the new tenancy has a water fee of 2200 cents per occupant from `2027-01-01`, and no parking fee

#### Scenario: No fees are offered for the first tenancy
- **WHEN** the flat has no tenancy, and an owner opens the new tenant form
- **THEN** the form asks for the occupants with `1` and lists no fees

### Requirement: Occupants and fees stay inside their tenancy
A tenancy's occupants and fee periods SHALL stay within the tenancy, as its rent does. Ending a tenancy ("Ending a tenancy", "Ending a fixed-term tenancy early") or correcting its fixed term's end so that its last day is before the latest occupants period's start or a fee's latest period start SHALL be refused with the reason `tenancy_has_changes_after_end`, after the rent's own check ("Rent changes stay inside their tenancy"). Correcting the start SHALL move the occupants' first period, and each fee's first period, to the new start when that period started on the old start or the new start is after it; a new start on or after the second period's start of the occupants or of a fee SHALL be refused with the reason `tenancy_start_after_change`. Removing a tenancy that hasn't started SHALL remove its occupants and fees with it.

**No Playwright test:** server-side checks with the same forms and reason display as the tenancy forms' browser tests; Vitest covers them.

#### Scenario: Ending before a fee change is refused
- **WHEN** the parking fee is 1500 cents from `2026-02-01` and 2000 cents from `2027-03-01`, and an owner ends the tenancy with the last rent day `2027-01-31`
- **THEN** it is refused with the reason `tenancy_has_changes_after_end`, and the tenancy and its fees are unchanged

#### Scenario: Ending before an occupants change is refused
- **WHEN** the tenancy has two occupants from `2027-03-01`, and an owner ends it with the last rent day `2027-01-31`
- **THEN** it is refused with the reason `tenancy_has_changes_after_end`, and nothing changes

#### Scenario: Moving the start moves the first occupants and fees
- **WHEN** a tenancy, its first occupants period and its water fee start on `2025-03-01`, and its parking fee on `2026-02-01`, and an owner corrects the start to `2025-03-15`
- **THEN** the first occupants period and the water fee start on `2025-03-15`, and the parking fee still starts on `2026-02-01`

#### Scenario: A start after an occupants change is refused
- **WHEN** a tenancy starts on `2025-03-01` with an occupants change from `2026-09-01`, and an owner corrects the start to `2026-10-01`
- **THEN** it is refused with the reason `tenancy_start_after_change`, and nothing changes

#### Scenario: Removing a tenancy removes its fees
- **WHEN** `Mikko Lehtinen`'s tenancy starts on `2027-01-01` with a parking fee, and an owner removes it
- **THEN** no fee or occupants period of that tenancy remains

### Requirement: Existing tenancies get one occupant
When this change is deployed, every existing tenancy SHALL get one occupants period of one occupant from its start day, with no end, so that every tenancy has its occupants. Owners correct it by setting the number on the tenancy's start ("Changing the occupants").

**No Playwright test:** a one-time database migration; a Workers test applies it to data stored in the previous schema.

#### Scenario: An existing tenancy gets one occupant
- **WHEN** before the migration `Aino Koski`'s tenancy runs from `2025-03-01`
- **THEN** after it the tenancy has one occupant from `2025-03-01` with no end

## MODIFIED Requirements

### Requirement: The tenancy page
Everyone with access to a flat SHALL be able to open its Tenancy page from the tenancy card on the flat's details page ("The flat details page"). The page SHALL show the current tenancy (the one running today, or else the next one to start): the tenant's name, its status, call and email links for the phone and email given, the contract type, contract made, the start, the end or last rent day and the due day; for notice given, who gave notice and when; and the occupants in effect today, or the first ones when the tenancy starts later, with the next upcoming change and when the latest change started. Below it, a rent card SHALL show the tenancy's rent ("The rent of a tenancy") in effect today, or its first rent when the tenancy starts later, with its start date, or that it is not set; the next upcoming change; and the rent periods, newest first. Owners SHALL see *Muuta* on the rent card ("Changing a tenancy's rent") and, when the rent has more than one period, *Peru viimeisin muutos* ("Undoing a tenancy's rent change"). Below the rent card, a fees card titled *Maksut vuokran lisäksi* SHALL list the tenancy's fees that are not ended, each with its kind or description, its amount this month or its first amount when it starts later, for a per-occupant fee the amount per occupant and the occupants, its start date and the next upcoming change; the ended fees after them; that there are none when the tenancy has none; and the month's total the tenant pays, the rent and the fees. Owners SHALL see *Muuta* on the occupants row ("Changing the occupants"), *Lisää maksu* ("Adding a tenant fee") and each fee's *Muuta* ("Changing a tenant fee"). The flat's other tenancies (earlier ones, and one to come after the current one) SHALL be listed below, newest first, with their dates, status and latest rent. When the flat has no current tenancy, the page SHALL say that it is vacant, when the last tenancy ended if there was one, and offer to add a tenant. Owners SHALL see the buttons to add, edit, end and cancel; members SHALL NOT. For owners, each of the other tenancies SHALL open its correction form, and the page SHALL offer to add an earlier tenancy. Ending SHALL NOT be offered for a tenancy that hasn't started.

#### Scenario: Opening the tenancy page from the details page
- **WHEN** Annika opens the details page of `Kuusikuja 3 B 12`, where `Aino Koski` lives, and selects its tenancy card
- **THEN** the Tenancy page of `Kuusikuja 3 B 12` opens and shows `Aino Koski`

#### Scenario: The rent card with its changes
- **WHEN** today is `2026-11-22`, and `Aino Koski`'s rent is 85000 cents from `2025-03-01` and 89000 cents from `2026-03-01`
- **THEN** the rent card shows `890,00 €/kk`, "1.3.2026 alkaen", the changes "1.3.2026 alkaen 890,00 €" above "1.3.2025 alkaen 850,00 €", and to Annika *Muuta* and *Peru viimeisin muutos*

#### Scenario: The occupants and the fees with the month's total
- **WHEN** today is `2026-11-24`, `Aino Koski`'s rent is 89000 cents, she has one occupant from `2025-03-01` and two from `2026-09-01`, a water fee of 2200 cents per occupant and a parking fee of 1500 cents from `2026-02-01`
- **THEN** the page shows the occupants `2` with "1.9.2026 alkaen", the fees card lists `Vesimaksu` `44,00 €` with "22,00 €/asukas/kk × 2" and `Autopaikka` `15,00 €`, and the month's total `949,00 €`

#### Scenario: A tenancy without fees
- **WHEN** `Aino Koski`'s tenancy has no fees
- **THEN** the fees card says that no fees are paid on top of the rent, and shows *Lisää maksu* to Annika

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
- **THEN** he sees the tenant's name, contact links, the occupants, the rent card and the fees card, no button to add, edit, end or cancel, to change or undo the rent or the occupants, or to add or change a fee, and the other tenancies don't open a form
