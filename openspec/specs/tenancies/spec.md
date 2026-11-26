# tenancies Specification

## Purpose
A flat's tenancies as periods: adding a tenant with the contract date that decides the landlord's notice period and the tenancy's first rent, each tenancy's own rent as periods (changed, corrected and undone by owners, kept inside the tenancy), its occupants and its tenant fees (*maksut vuokran lisäksi*: water, parking, sauna or other, fixed or per occupant) as periods inside the tenancy, the new tenant form asking for the occupants and offering the previous tenancy's fees, the Tenancy page opened from the flat details page with the occupants, the rent card and the fees card, statuses, ending an open-ended tenancy by notice, agreement or another legal ground with the notice periods of the Act on Residential Leases (CONCEPT.md §4.2), ending a fixed term early, cancelling an ending and correcting a tenancy (owners only). The deposit and its return are in deposits, the lease card on the Tenancy page in documents, and rent payments in rent-payments.
## Requirements
### Requirement: Adding a tenant
An owner of a flat SHALL be able to add a tenant to it from the Tenancy page: the tenant's name, an optional phone number and email address, the contract type (open-ended or fixed-term), the date the contract was made, the start date, the end date for a fixed-term contract, the monthly rent and the due day. *Contract made* SHALL default to the start date. When the start is before today, the owner SHALL be able to record the tenancy's ending in the same form: who gave notice, the notice date and the last rent day, under the rules of "Ending a tenancy" and "Ending a fixed-term tenancy early", with the same reasons. The tenancy SHALL record the user who added it. After saving, the owner SHALL land on the Tenancy page, which shows the new tenancy. A member SHALL NOT be able to add a tenant.

#### Scenario: Adding an open-ended tenancy
- **WHEN** today is `2026-11-22`, and Annika, owner of `Kuusikuja 3 B 12` since `2025-03-01` with no tenancy, adds `Aino Koski`, open-ended, contract made `12.2.2025`, starting `1.3.2025`, rent `890`, due day `5`
- **THEN** the Tenancy page shows `Aino Koski`, "Voimassa", "Toistaiseksi voimassa", contract made `12.2.2025`, start `1.3.2025`, rent `890,00 €/kk` and due day "kuun 5. päivä"

#### Scenario: Adding a fixed-term tenancy
- **WHEN** Annika adds `Mikko Lehtinen`, fixed-term from `1.1.2027` to `31.12.2027`, to a vacant flat
- **THEN** the Tenancy page shows `Mikko Lehtinen` with "Alkaa 1.1.2027" and the term `1.1.2027–31.12.2027`

#### Scenario: Contract made defaults to the start date
- **WHEN** an owner enters the start date `15.3.2027` in the new tenant form and leaves *Contract made* untouched
- **THEN** *Contract made* shows `15.3.2027`

#### Scenario: Adding an earlier tenancy with its ending
- **WHEN** today is `2026-11-22`, the flat's tenancy of `Aino Koski` runs open-ended from `2025-03-01`, and Annika adds `Pekka Virtanen`, open-ended from `1.6.2023`, with the tenant's notice on `20.1.2025` and the last rent day `28.2.2025`
- **THEN** the tenancy is stored with the last rent day `2025-02-28`, and the Tenancy page lists `Pekka Virtanen` as ended under the other tenancies

#### Scenario: The ending of an earlier tenancy follows the notice rules
- **WHEN** today is `2026-11-22`, and an owner adds an open-ended tenancy from `1.6.2023` with the landlord's notice on `10.1.2025`, the contract made on `15.5.2023` and the last rent day `28.2.2025`
- **THEN** it is refused with the reason `tenancy_end_before_notice_period`, because the earliest last rent day is `2025-07-31`, and nothing is stored

#### Scenario: The ending can't be recorded for a tenancy that hasn't started
- **WHEN** today is `2026-11-22`, and an owner sends a new tenancy starting `2027-01-01` with an agreed ending on `20.11.2026` and the last rent day `31.12.2026` to the server
- **THEN** it is refused with the reason `tenancy_notice_before_start`, and nothing is stored

#### Scenario: A member can't add a tenant
- **WHEN** Jussi, a member of the flat, sends a new tenancy to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing is stored

### Requirement: Tenancy dates and details
A tenancy SHALL start and end on any day. The tenancies of a flat SHALL NOT overlap (`tenancy_overlaps`); a tenancy without an end runs indefinitely, so no tenancy can be added after it. An earlier tenancy MAY be added afterwards, before the others, to record the history: a fixed-term one with its term, and an open-ended one with its ending (see "Adding a tenant"), whose last rent day is then its end for the overlap. A tenancy SHALL NOT start before the start of the flat's first ownership period (`tenancy_start_before_ownership`). *Contract made* SHALL NOT be in the future (`tenancy_contract_made_in_future`). A fixed-term tenancy SHALL have an end date after its start (`tenancy_end_before_start`); an open-ended one SHALL have none until it is ended. The name SHALL NOT be empty (`tenant_name_required`) and SHALL be at most 100 characters (`tenant_name_too_long`); the phone number SHALL be at most 30 characters (`tenant_phone_too_long`); the email address, when given, SHALL be valid (`email_invalid`). The due day SHALL be a whole number from 1 to 31 (`tenancy_due_day_invalid`), and in a month with fewer days it SHALL be the month's last day.

**No Playwright test:** these are server-side rules and pure date calculations; Vitest covers them, and "Adding a tenant" and "Ending a tenancy" show reasons in the browser.

#### Scenario: A tenancy overlapping the previous one is refused
- **WHEN** the flat's previous tenancy ends on `2026-12-31`, and an owner adds a tenancy starting `2026-12-15`
- **THEN** it is refused with the reason `tenancy_overlaps`, and nothing is stored

#### Scenario: A new tenant can be added during the notice period
- **WHEN** the flat's tenancy has notice given with the last rent day `2026-12-31`, and an owner adds a tenancy starting `2027-01-01`
- **THEN** the new tenancy is stored, and the previous one still ends on `2026-12-31`

#### Scenario: A tenancy can't be added while one runs without an end
- **WHEN** the flat has an open-ended tenancy that hasn't been ended, and an owner adds a tenancy starting `2030-01-01`
- **THEN** it is refused with the reason `tenancy_overlaps`, and nothing is stored

#### Scenario: An earlier tenancy can be added afterwards
- **WHEN** the flat's only tenancy starts on `2025-03-01`, and an owner adds a fixed-term tenancy from `1.6.2023` to `28.2.2025`
- **THEN** it is stored and listed under the other tenancies

#### Scenario: An earlier open-ended tenancy without its ending is refused
- **WHEN** the flat's only tenancy starts on `2025-03-01`, and an owner adds an open-ended tenancy from `1.6.2023` without an ending
- **THEN** it is refused with the reason `tenancy_overlaps`, and nothing is stored

#### Scenario: A tenancy before the ownership is refused
- **WHEN** the flat's first ownership period starts on `2025-03-01`, and an owner adds a tenancy starting `2025-02-15`
- **THEN** it is refused with the reason `tenancy_start_before_ownership`

#### Scenario: Contract made in the future is refused
- **WHEN** today is `2026-11-22`, and an owner adds a tenancy with the contract made `30.11.2026`
- **THEN** it is refused with the reason `tenancy_contract_made_in_future`

#### Scenario: A fixed term ending before it starts is refused
- **WHEN** an owner adds a fixed-term tenancy from `1.1.2027` to `31.12.2026`
- **THEN** it is refused with the reason `tenancy_end_before_start`

#### Scenario: Invalid tenant details are refused
- **WHEN** an owner adds a tenancy with an empty name, or the email `aino@`, or the due day `0` or `32`
- **THEN** it is refused with the reason `tenant_name_required`, `email_invalid` or `tenancy_due_day_invalid` respectively

#### Scenario: The due day falls on the last day of a short month
- **WHEN** a tenancy's due day is 31
- **THEN** its due date in February 2027 is `2027-02-28`, and in April 2027 `2027-04-30`

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

### Requirement: Tenancy statuses
A tenancy's status on a given day SHALL be: *Starts* (with the start date) before its start; *Ends* (with the end date) for a fixed-term tenancy that hasn't been ended early; *Notice given* (with the last rent day) from the notice date until the last rent day for one that has been ended; and *Active* otherwise while it runs. After its last day it SHALL be *Ended*. A flat SHALL be *Let* while a tenancy runs, *Notice given* while it runs with notice given, and *Vacant* when no tenancy runs; a vacant flat with a tenancy to come SHALL show when it starts.

**No Playwright test:** a pure calculation from a tenancy's dates and today; Vitest covers it, and the tenancy page and the flats list show it in the browser tests of "The tenancy page", "Ending a tenancy" and "Listing flats".

#### Scenario: Statuses through an ended tenancy
- **WHEN** an open-ended tenancy starts on `2025-03-01`, notice was given on `2026-11-22` and its last rent day is `2026-12-31`
- **THEN** on `2025-02-28` it is *Starts 1.3.2025*, on `2026-11-21` *Active*, on `2026-12-31` *Notice given* and on `2027-01-01` *Ended*, and the flat is *Vacant* on `2027-01-01`

#### Scenario: A fixed-term tenancy shows when it ends
- **WHEN** a fixed-term tenancy runs from `2027-01-01` to `2027-12-31`
- **THEN** on `2027-06-01` it is *Ends 31.12.2027*, and on `2028-01-01` *Ended*

### Requirement: Notice periods
The earliest last rent day SHALL be calculated from the notice date, who gave notice and the tenancy, by CONCEPT.md §4.2: the notice period runs from the last day of the month in which notice was given, and the last rent day is the last day of the month the period ends in. The tenant's notice period SHALL be 1 month. The landlord's SHALL be, for a contract made before `2026-10-01`, 6 months if the tenancy has lasted at least 1 year on the notice date and otherwise 3; and for a contract made on or after `2026-10-01`, 4 months if it has lasted at least 2 years and otherwise 3. An agreed ending, a court's permission and another legal ground SHALL have no notice period.

**No Playwright test:** a pure calculation; Vitest covers it, and "Ending a tenancy" shows the suggested date in the browser.

#### Scenario: The tenant's notice ends at the end of the next month
- **WHEN** the tenant gives notice on `2026-11-22`
- **THEN** the earliest last rent day is `2026-12-31`

#### Scenario: Landlord's notice under an older contract after a year
- **WHEN** the contract was made on `2025-02-12`, the tenancy started on `2025-03-01`, and the landlord gives notice on `2026-11-22`
- **THEN** the notice period is 6 months, and the earliest last rent day is `2027-05-31`

#### Scenario: Landlord's notice under an older contract within the first year
- **WHEN** the contract was made on `2026-05-20`, the tenancy started on `2026-06-01`, and the landlord gives notice on `2026-11-22`
- **THEN** the notice period is 3 months, and the earliest last rent day is `2027-02-28`

#### Scenario: Landlord's notice under a newer contract within two years
- **WHEN** the contract was made on `2026-10-15`, the tenancy started on `2026-11-01`, and the landlord gives notice on `2028-03-10`
- **THEN** the notice period is 3 months, and the earliest last rent day is `2028-06-30`

#### Scenario: Landlord's notice under a newer contract after two years
- **WHEN** the contract was made on `2026-10-01`, the tenancy started on `2026-10-01`, and the landlord gives notice on `2028-11-10`
- **THEN** the notice period is 4 months, and the earliest last rent day is `2029-03-31`

### Requirement: Ending a tenancy
An owner SHALL be able to end an open-ended tenancy that hasn't been ended: who gave notice (the tenant, the landlord, by agreement, or another legal ground such as rescission or an estate's notice), the date notice was received and the last rent day. The last rent day SHALL default to the earliest date from "Notice periods", and the form SHALL explain the period. The notice date SHALL NOT be in the future (`tenancy_notice_in_future`) or before the tenancy's start (`tenancy_notice_before_start`), and the last rent day SHALL NOT be before the notice date (`tenancy_end_before_notice`). For the tenant's notice, an agreed ending and another legal ground, any last rent day on or after the notice date SHALL be accepted: the contract may shorten the tenant's period or count it from mid-month, and the app doesn't check the other grounds. For the landlord's notice a last rent day before the earliest date SHALL be refused with the reason `tenancy_end_before_notice_period`. A tenancy already ended SHALL be refused with the reason `tenancy_already_ending`. A member SHALL NOT be able to end a tenancy.

#### Scenario: The tenant gives notice
- **WHEN** today is `2026-11-22`, and Annika ends the tenancy of `Aino Koski`, notice given by the tenant on `22.11.2026`, keeping the suggested last rent day
- **THEN** the form suggested `31.12.2026`, and the Tenancy page shows "Irtisanottu · päättyy 31.12.2026" and that the tenant gave notice on `22.11.2026`

#### Scenario: A mid-month last rent day is accepted for the tenant's notice
- **WHEN** the tenant gives notice on `2026-11-10` and the owner sets the last rent day `15.12.2026`
- **THEN** the tenancy is ended with the last rent day `2026-12-15`

#### Scenario: The landlord's notice can't be shorter than the law allows
- **WHEN** the earliest last rent day for the landlord's notice is `2027-05-31`, and the owner sets `31.3.2027`
- **THEN** it is refused with the reason `tenancy_end_before_notice_period`, and the tenancy is unchanged

#### Scenario: An agreed ending can be on any day after the notice
- **WHEN** the owner ends a tenancy by agreement on `2026-11-22` with the last rent day `30.11.2026`
- **THEN** the tenancy is ended with the last rent day `2026-11-30`

#### Scenario: A notice date in the future is refused
- **WHEN** today is `2026-11-22`, and the owner enters the notice date `1.12.2026`
- **THEN** it is refused with the reason `tenancy_notice_in_future`

#### Scenario: A member can't end a tenancy
- **WHEN** Jussi, a member, sends ending a tenancy to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and the tenancy is unchanged

### Requirement: Ending a fixed-term tenancy early
A fixed-term tenancy SHALL end by itself on its end date, with no action. It SHALL NOT be ended by the tenant's or the landlord's ordinary notice (`tenancy_fixed_term_notice`). An owner SHALL be able to end it early by agreement, with a court's permission, or on another legal ground such as rescission or an estate's notice: the date it was agreed or permitted, which SHALL NOT be in the future (`tenancy_notice_in_future`), and a last rent day on or after it (`tenancy_end_before_notice`) and before the term's end (`tenancy_end_after_term`). The form SHALL say that the contract usually can't be ended by notice and show no notice period.

#### Scenario: Ending a fixed term by agreement
- **WHEN** a fixed-term tenancy runs from `2027-01-01` to `2027-12-31`, and Annika ends it by agreement on `15.5.2027` with the last rent day `30.6.2027`
- **THEN** the Tenancy page shows "Irtisanottu · päättyy 30.6.2027"

#### Scenario: Another legal ground ends a fixed term early
- **WHEN** a fixed-term tenancy runs from `2027-01-01` to `2027-12-31`, and the owner records another legal ground (rescission) on `3.3.2027` with the last rent day `31.3.2027`
- **THEN** the tenancy is ended with the last rent day `2027-03-31`

#### Scenario: Notice on a fixed term is refused
- **WHEN** an owner sends the tenant's notice for a fixed-term tenancy to the server
- **THEN** it is refused with the reason `tenancy_fixed_term_notice`, and the tenancy is unchanged

### Requirement: Cancelling an ending
An owner SHALL be able to cancel the ending of a tenancy before its last rent day has passed, after a confirmation. An open-ended tenancy SHALL then run with no end again, and a fixed-term tenancy SHALL end on its original term's end again. Cancelling SHALL be refused when a later tenancy of the flat would overlap the tenancy as restored (`tenancy_cancel_later_tenancy`), when the tenancy hasn't been ended (`tenancy_not_ending`) or when its last rent day has passed (`tenancy_already_ended`). A later tenancy that starts after a fixed term's original end SHALL NOT prevent cancelling. A member SHALL NOT be able to cancel.

#### Scenario: Cancelling the tenant's notice
- **WHEN** today is `2026-11-25`, and the tenancy of `Aino Koski` ends on `2026-12-31` after the tenant's notice, and Annika cancels the ending
- **THEN** the Tenancy page shows `Aino Koski` as "Voimassa" with no end and no notice

#### Scenario: Cancelling after the last rent day is refused
- **WHEN** today is `2027-01-02`, and an owner cancels the ending of a tenancy whose last rent day was `2026-12-31`
- **THEN** it is refused with the reason `tenancy_already_ended`

#### Scenario: Cancelling is refused when a new tenancy follows
- **WHEN** a tenancy ends on `2026-12-31` and the next one starts on `2027-01-01`, and an owner cancels the first one's ending
- **THEN** it is refused with the reason `tenancy_cancel_later_tenancy`

#### Scenario: A later tenancy after the original term doesn't prevent cancelling
- **WHEN** a fixed-term tenancy runs from `2027-01-01` to `2027-12-31` and was ended by agreement with the last rent day `2027-06-30`, the next tenancy starts on `2028-02-01`, and today is `2027-06-15`
- **THEN** cancelling the ending succeeds, and the tenancy ends on `2027-12-31` again

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
An owner of a flat SHALL be able to change a tenancy's rent from a date, from the rent card on the Tenancy page ("The tenancy page") or from the tenancy's correction form ("Correcting a tenancy"). The date SHALL be the first of a month, or the tenancy's start day (`amount_date_not_month_start`); SHALL NOT be before the tenancy's start (`rent_date_before_tenancy`) or after its last day when it has one (`rent_date_after_tenancy`); and SHALL NOT be before the start of the latest rent period (`amount_date_too_early`), unless it is before the first rent period's start, where no rent is in effect: such a rent SHALL fill those months with a period from the date to the day before the first period's start. It MAY be in the future. A rent dated on the start of any of the tenancy's rent periods SHALL correct that period's amount instead of starting a new period, and the other periods and all dates SHALL stay as they are; so the first rent is corrected by dating it on the tenancy's start, and an earlier period, such as one that filled a migrated tenancy's first months, by dating it on that period's start. A tenancy without a rent SHALL get its first rent the same way. The form SHALL show the current rent and the difference per month and in percent. A tenancy that isn't the flat's SHALL be refused with the reason `tenancy_not_found`. A member SHALL NOT be able to change the rent.

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

#### Scenario: Correcting an earlier rent period
- **WHEN** a tenancy runs from `2025-03-01`, its rent is 85000 cents from `2025-03-01` and 89000 cents from `2026-01-01`, and Annika sets `800` from `1.3.2025`
- **THEN** the tenancy's rent is 80000 cents from `2025-03-01` to `2025-12-31` and 89000 cents from `2026-01-01` with no end

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
A tenancy SHALL have any number of tenant fees: what the tenant pays the landlord on top of the rent. A fee included in the rent is not recorded. Each tenant fee SHALL have a kind, *water*, *parking*, *sauna* or *other*; a description, required for *other* (`description_required`, 1 to 60 characters after trimming) and not stored for the other kinds; and a basis, *fixed* or *per occupant*. The kind and the basis SHALL NOT change after the fee is added. Tenant fees SHALL NOT be linked to the flat's usage charges. Each fee's amounts SHALL be its own sequence of periods inside the tenancy (a 0 € period may start after the tenancy's last day, "Occupants and fees stay inside their tenancy"): every start date the first of a month or the tenancy's start day, no gaps or overlaps, a new amount ending the previous period on the day before it starts, and the latest period with no end. A month's fee SHALL be that of the period containing the month's first day, or the tenancy's start day in the month it starts, times the month's occupants for a per-occupant fee. An amount SHALL be from 0 to 99 999,99 € with at most two decimals (`amount_invalid`). Tenant fees are rental income (form 7H row 2.1) for the year summary (#34).

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
A tenancy's occupants and fee periods SHALL stay within the tenancy, as its rent does. Ending a tenancy ("Ending a tenancy", "Ending a fixed-term tenancy early") or correcting its fixed term's end so that its last day is before the latest occupants period's start or a fee's latest period start SHALL be refused with the reason `tenancy_has_changes_after_end`, after the rent's own check ("Rent changes stay inside their tenancy"). A fee's period of 0 € that starts after the last day only records that the fee ends, and SHALL NOT block it. Correcting the start SHALL move the occupants' first period, and each fee's first period, to the new start when that period started on the old start or the new start is after it; a new start on or after the second period's start of the occupants or of a fee SHALL be refused with the reason `tenancy_start_after_change`. Removing a tenancy that hasn't started SHALL remove its occupants and fees with it.

**No Playwright test:** server-side checks with the same forms and reason display as the tenancy forms' browser tests; Vitest covers them.

#### Scenario: Ending before a fee change is refused
- **WHEN** the parking fee is 1500 cents from `2026-02-01` and 2000 cents from `2027-03-01`, and an owner ends the tenancy with the last rent day `2027-01-31`
- **THEN** it is refused with the reason `tenancy_has_changes_after_end`, and the tenancy and its fees are unchanged

#### Scenario: A fee ended after the last day doesn't block ending
- **WHEN** the parking fee is 1500 cents from `2026-02-01` and 0 cents from `2027-01-01`, and an owner ends the tenancy with the last rent day `2026-12-31`
- **THEN** the tenancy ends on `2026-12-31`, and the parking fee keeps its periods

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

