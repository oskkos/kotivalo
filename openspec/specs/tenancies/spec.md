# tenancies Specification

## Purpose
TBD - created by archiving change track-tenancies. Update Purpose after archive.
## Requirements
### Requirement: Adding a tenant
An owner of a flat SHALL be able to add a tenant to it from the Tenancy page: the tenant's name, an optional phone number and email address, the contract type (open-ended or fixed-term), the date the contract was made, the start date, the end date for a fixed-term contract, the monthly rent and the due day. *Contract made* SHALL default to the start date. The tenancy SHALL record the user who added it. After saving, the owner SHALL land on the Tenancy page, which shows the new tenancy. A member SHALL NOT be able to add a tenant.

#### Scenario: Adding an open-ended tenancy
- **WHEN** today is `2026-11-22`, and Annika, owner of `Kuusikuja 3 B 12` since `2025-03-01` with no tenancy, adds `Aino Koski`, open-ended, contract made `12.2.2025`, starting `1.3.2025`, rent `890`, due day `5`
- **THEN** the Tenancy page shows `Aino Koski`, "Voimassa", "Toistaiseksi voimassa", contract made `12.2.2025`, start `1.3.2025`, rent `890,00 €/kk` and due day "kuun 5. päivä"

#### Scenario: Adding a fixed-term tenancy
- **WHEN** Annika adds `Mikko Lehtinen`, fixed-term from `1.1.2027` to `31.12.2027`, to a vacant flat
- **THEN** the Tenancy page shows `Mikko Lehtinen` with "Alkaa 1.1.2027" and the term `1.1.2027–31.12.2027`

#### Scenario: Contract made defaults to the start date
- **WHEN** an owner enters the start date `15.3.2027` in the new tenant form and leaves *Contract made* untouched
- **THEN** *Contract made* shows `15.3.2027`

#### Scenario: A member can't add a tenant
- **WHEN** Jussi, a member of the flat, sends a new tenancy to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing is stored

### Requirement: Tenancy dates and details
A tenancy SHALL start and end on any day. The tenancies of a flat SHALL NOT overlap (`tenancy_overlaps`); a tenancy without an end runs indefinitely, so no tenancy can be added after it. An earlier tenancy MAY be added afterwards, before the others, to record the history. A tenancy SHALL NOT start before the start of the flat's first ownership period (`tenancy_start_before_ownership`). *Contract made* SHALL NOT be in the future (`tenancy_contract_made_in_future`). A fixed-term tenancy SHALL have an end date after its start (`tenancy_end_before_start`); an open-ended one SHALL have none until it is ended. The name SHALL NOT be empty (`tenant_name_required`) and SHALL be at most 100 characters (`tenant_name_too_long`); the phone number SHALL be at most 30 characters (`tenant_phone_too_long`); the email address, when given, SHALL be valid (`email_invalid`). The due day SHALL be a whole number from 1 to 31 (`tenancy_due_day_invalid`), and in a month with fewer days it SHALL be the month's last day.

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
The new tenant form SHALL show the flat's rent in effect on the start date, or an empty field when there is none, and the rent SHALL be required. When the owner saves a different amount, it SHALL be recorded as the flat's rent from the first day of the start month, under the rules of "Setting a rent or charge": an amount dated on the latest rent period's start corrects it, and a start month before the latest rent period's start is refused with the reason `amount_date_too_early`. The tenancy and the rent SHALL be saved together or not at all. An unchanged amount SHALL NOT change the rent periods.

#### Scenario: The form shows the rent in effect on the start date
- **WHEN** the flat's rent is 89000 cents from `2025-03-01`, and an owner enters the start date `1.1.2027`
- **THEN** the rent field shows `890,00`

#### Scenario: A changed rent starts from the start month
- **WHEN** the flat's rent is 89000 cents from `2025-03-01`, and Annika adds a tenancy starting `15.1.2027` with the rent `910`
- **THEN** the rent is 89000 cents until `2026-12-31` and 91000 cents from `2027-01-01`, and the tenancy is stored

#### Scenario: A rent for an earlier month than the latest change is refused
- **WHEN** the flat's rent has a period from `2027-03-01`, and an owner adds a tenancy starting `1.1.2027` with a changed rent
- **THEN** it is refused with the reason `amount_date_too_early`, and neither the tenancy nor the rent is stored

#### Scenario: An unchanged rent leaves the periods alone
- **WHEN** the flat's rent is 89000 cents from `2025-03-01`, and an owner adds a tenancy starting `1.1.2027` with the rent `890`
- **THEN** the rent still has one period, 89000 cents from `2025-03-01`

### Requirement: The tenancy page
Everyone with access to a flat SHALL be able to open its Tenancy page from the tenancy card at the top of the flat's edit page. The page SHALL show the current tenancy (the one running today, or else the next one to start): the tenant's name, its status, call and email links for the phone and email given, the contract type, contract made, the start, the end or last rent day, the rent in effect today and the due day; and, for notice given, who gave notice and when. The flat's other tenancies (earlier ones, and one to come after the current one) SHALL be listed below, newest first, with their dates and status. When the flat has no current tenancy, the page SHALL say that it is vacant, when the last tenancy ended if there was one, and offer to add a tenant. Owners SHALL see the buttons to add, edit, end and cancel; members SHALL NOT.

#### Scenario: Opening the tenancy page from the edit page
- **WHEN** Annika opens the edit page of `Kuusikuja 3 B 12`, where `Aino Koski` lives, and selects its tenancy card
- **THEN** the Tenancy page of `Kuusikuja 3 B 12` opens and shows `Aino Koski`

#### Scenario: A vacant flat offers to add a tenant
- **WHEN** today is `2027-01-10`, the flat's only tenancy ended on `2026-12-31`, and Annika opens the Tenancy page
- **THEN** the page says the flat is vacant since the tenancy ended on `31.12.2026`, lists that tenancy under the other tenancies, and shows "Lisää vuokralainen"

#### Scenario: A member sees the tenancy but can't change it
- **WHEN** Jussi, a member of the flat, opens its Tenancy page
- **THEN** he sees the tenant's name and contact links and no button to add, edit, end or cancel

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
An owner SHALL be able to cancel the ending of a tenancy before its last rent day has passed, after a confirmation. An open-ended tenancy SHALL then run with no end again, and a fixed-term tenancy SHALL end on its original term's end again. Cancelling SHALL be refused when the flat has a later tenancy (`tenancy_cancel_later_tenancy`), when the tenancy hasn't been ended (`tenancy_not_ending`) or when its last rent day has passed (`tenancy_already_ended`). A member SHALL NOT be able to cancel.

#### Scenario: Cancelling the tenant's notice
- **WHEN** today is `2026-11-25`, and the tenancy of `Aino Koski` ends on `2026-12-31` after the tenant's notice, and Annika cancels the ending
- **THEN** the Tenancy page shows `Aino Koski` as "Voimassa" with no end and no notice

#### Scenario: Cancelling after the last rent day is refused
- **WHEN** today is `2027-01-02`, and an owner cancels the ending of a tenancy whose last rent day was `2026-12-31`
- **THEN** it is refused with the reason `tenancy_already_ended`

#### Scenario: Cancelling is refused when a new tenancy follows
- **WHEN** a tenancy ends on `2026-12-31` and the next one starts on `2027-01-01`, and an owner cancels the first one's ending
- **THEN** it is refused with the reason `tenancy_cancel_later_tenancy`

### Requirement: Correcting a tenancy
An owner SHALL be able to correct a tenancy's details: the name, phone, email, contract type, contract made, start, the fixed term's end and the due day, with the same checks as adding against the flat's other tenancies. The correction SHALL change the tenancy in place, without a history. The rent SHALL NOT be changed from this form; it stays on the Rent and charges page. A member SHALL NOT be able to correct a tenancy.

#### Scenario: Correcting the tenant's phone number
- **WHEN** Annika corrects the phone number of `Aino Koski` to `040 765 4321`
- **THEN** the Tenancy page shows `040 765 4321`, and no earlier number is kept

#### Scenario: A correction can't make tenancies overlap
- **WHEN** the previous tenancy ended on `2025-02-28`, and an owner corrects the next tenancy's start to `2025-02-15`
- **THEN** it is refused with the reason `tenancy_overlaps`, and the tenancy is unchanged

#### Scenario: A member can't correct a tenancy
- **WHEN** Jussi, a member, sends a correction to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and the tenancy is unchanged

