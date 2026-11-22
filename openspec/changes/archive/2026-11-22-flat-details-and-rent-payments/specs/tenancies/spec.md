## MODIFIED Requirements

### Requirement: The tenancy page
Everyone with access to a flat SHALL be able to open its Tenancy page from the tenancy card on the flat's details page ("The flat details page"). The page SHALL show the current tenancy (the one running today, or else the next one to start): the tenant's name, its status, call and email links for the phone and email given, the contract type, contract made, the start, the end or last rent day, the rent in effect today and the due day; and, for notice given, who gave notice and when. The flat's other tenancies (earlier ones, and one to come after the current one) SHALL be listed below, newest first, with their dates and status. When the flat has no current tenancy, the page SHALL say that it is vacant, when the last tenancy ended if there was one, and offer to add a tenant. Owners SHALL see the buttons to add, edit, end and cancel; members SHALL NOT. For owners, each of the other tenancies SHALL open its correction form, and the page SHALL offer to add an earlier tenancy. Ending SHALL NOT be offered for a tenancy that hasn't started.

#### Scenario: Opening the tenancy page from the details page
- **WHEN** Annika opens the details page of `Kuusikuja 3 B 12`, where `Aino Koski` lives, and selects its tenancy card
- **THEN** the Tenancy page of `Kuusikuja 3 B 12` opens and shows `Aino Koski`

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
- **THEN** he sees the tenant's name and contact links, no button to add, edit, end or cancel, and the other tenancies don't open a form
