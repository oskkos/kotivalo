# rent-payments Specification

## Purpose
Rent received for a tenancy's months (CONCEPT.md §4.2): recording payments (several per month) and deleting a wrong one (owners only), a month's expected rent, the tenancy's rent and its tenant fees (each by days in a month a tenancy starts or ends in, with the breakdown on the month's payments page), and its status computed from the rent, fee and occupants periods, the due day and the payments, never stored, the months not fully paid of this and last year, the month's payments page and the rent payments page by year with the rent received by payment date. This month's rent across the flats on the flats list: the summary of received and expected rent and a status chip on each card. Payments stay inside their tenancy. The year summary (#34) comes later.
## Requirements
### Requirement: Recording a rent payment
An owner of a flat SHALL be able to record that rent was paid for a month of a tenancy: the amount and the payment date. The form SHALL open from the rent card on the flat details page (this month) and from a month's payments page, and SHALL show the month and the tenant. The amount SHALL default to the month's expected rent still missing ("Expected rent of a month"), or to empty when the rent is not set, and SHALL be more than 0 and at most 100 000 €, with at most two decimals, written with a comma or a point (`rent_payment_amount_invalid`). The payment date SHALL default to today and SHALL NOT be in the future (`rent_payment_date_in_future`); it MAY be before the month, for rent paid in advance. The month SHALL be a month in which the tenancy runs (`rent_payment_month_outside_tenancy`). A month MAY have several payments, and their total MAY exceed the expected rent. The payment SHALL record the user who recorded it. A member SHALL NOT be able to record payments.

#### Scenario: Recording this month's rent from the details page
- **WHEN** today is `2026-11-22`, `Aino Koski` rents `Kuusikuja 3 B 12` from `2025-03-01` with the due day 5 and the rent 89000 cents, and Annika chooses "Merkitse maksetuksi" on the details page and saves without changes
- **THEN** a payment of 89000 cents for `2026-11` paid on `2026-11-22` is stored, and the rent card shows "Maksettu 22.11."

#### Scenario: A smaller amount leaves the month partly paid
- **WHEN** Annika records 50000 cents paid on `4.11.2026` for November
- **THEN** the rent card shows "Osittain maksettu" and "puuttuu 390,00 €"

#### Scenario: A second payment defaults to the missing amount
- **WHEN** November has a payment of 50000 cents, and Annika opens the form again
- **THEN** the amount shows `390,00`, and saving it makes the rent card show "Maksettu" with the second payment's date

#### Scenario: A payment date in the future is refused
- **WHEN** today is `2026-11-22`, and an owner records a payment dated `23.11.2026`
- **THEN** the date field shows the reason `rent_payment_date_in_future`, and nothing is stored

#### Scenario: An invalid amount is refused
- **WHEN** an owner records the amount `0` or `890,555`
- **THEN** the amount field shows the reason `rent_payment_amount_invalid`, and nothing is stored

#### Scenario: A month outside the tenancy is refused
- **WHEN** `Aino Koski`'s tenancy starts on `2025-03-01`, and an owner sends a payment for `2025-02` to the server
- **THEN** it is refused with the reason `rent_payment_month_outside_tenancy`, and nothing is stored

#### Scenario: A member can't record a payment
- **WHEN** Jussi, a member of the flat, sends a payment to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing is stored

### Requirement: Deleting a rent payment
An owner SHALL be able to delete a recorded payment from the month's payments page after a confirmation, for example to record it again with the right amount or date. Payments SHALL NOT be edited. A member SHALL NOT be able to delete payments.

#### Scenario: Deleting a wrongly recorded payment
- **WHEN** November's only payment is 89000 cents on `2026-11-03`, and Annika deletes it and confirms
- **THEN** the month's payments page lists no payments, and the month's status is computed without it

#### Scenario: A member can't delete a payment
- **WHEN** Jussi, a member of the flat, sends deleting a payment to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and the payment stays

### Requirement: Expected rent of a month
A month's expected rent for a tenancy SHALL be the tenancy's own rent in that month ("The rent of a tenancy") and each of its tenant fees in that month ("Tenant fees are recorded as periods"), each in proportion to the days of the month the tenancy runs: the amount × the tenancy's days in the month ÷ the month's days, rounded to the nearest cent, halves up, for the rent and for each fee separately, and then added up. For a month the tenancy runs in full it SHALL be the month's rent and fees. The breakdown (the rent and each fee with its amount in the month) SHALL be kept with the expected rent. When the tenancy has no rent in the month, the expected rent SHALL be unknown, whatever its fees, and the month's status SHALL be *Rent not set*. When the tenant changes mid-month, each tenancy's part of the month SHALL use its own rent and fees.

**No Playwright test:** a pure calculation from the tenancy's rent, fee and occupants periods and dates; Vitest covers it, and the details page and the month's payments page show it in the browser tests of "The flat details page" and "The month's rent payments page".

#### Scenario: A full month
- **WHEN** a tenancy runs from `2025-03-01` without an end, with the rent 89000 cents from `2025-03-01`
- **THEN** the expected rent of `2026-11` is 89000 cents

#### Scenario: A tenancy starting mid-month
- **WHEN** a tenancy starts on `2026-11-15` with the rent 89000 cents
- **THEN** the expected rent of `2026-11` is 47467 cents (16 of 30 days)

#### Scenario: A tenancy ending mid-month
- **WHEN** a tenancy's rent is 89000 cents, and its last rent day is `2027-01-14`
- **THEN** the expected rent of `2027-01` is 40194 cents (14 of 31 days)

#### Scenario: A rent change during the tenancy
- **WHEN** a tenancy runs from `2025-03-01` with the rent 89000 cents from `2025-03-01` and 92000 cents from `2026-03-01`
- **THEN** the expected rent of `2026-02` is 89000 cents and of `2026-03` 92000 cents

#### Scenario: A tenant change with a new rent mid-month
- **WHEN** `Pekka Virtanen`'s tenancy has the rent 80000 cents and its last rent day is `2026-11-14`, and `Aino Koski`'s starts on `2026-11-15` with the rent 90000 cents
- **THEN** the expected rent of `2026-11` is 37333 cents (14 of 30 days of 80000) for the first and 48000 cents (16 of 30 days of 90000) for the second

#### Scenario: No rent set
- **WHEN** a tenancy runs in `2026-11` and has no rent in that month
- **THEN** the expected rent is unknown, and the month's status is *Rent not set*

#### Scenario: The rent with the tenant fees
- **WHEN** a tenancy runs from `2025-03-01` with the rent 89000 cents, two occupants, a water fee of 2200 cents per occupant and a parking fee of 1500 cents
- **THEN** the expected rent of `2026-11` is 94900 cents: the rent 89000, water 4400 and parking 1500 cents

#### Scenario: Fees by days in a partial month
- **WHEN** a tenancy starts on `2026-11-15` with the rent 89000 cents, one occupant and a water fee of 2200 cents per occupant
- **THEN** the expected rent of `2026-11` is 48640 cents: the rent 47467 and water 1173 cents (16 of 30 days each)

#### Scenario: Fees without a rent
- **WHEN** a tenancy has a parking fee of 1500 cents in `2026-11` and no rent in that month
- **THEN** the expected rent is unknown, and the month's status is *Rent not set*

### Requirement: The rent status of a month
A month's rent status for a tenancy on a given day SHALL be computed, never stored, from its expected rent, its payments and its due date. The due date SHALL be the tenancy's due day in that month, the month's last day in a shorter month ("Tenancy dates and details"), and no earlier than the tenancy's start. The status SHALL be:
- *Paid* (with the date of the latest payment) when the payments add up to at least the expected rent
- *Partly paid* (with the missing amount) when there are payments adding up to less
- *Late* (with the days since the due date) when there are no payments and the day is after the due date
- *Due* (with the due date) when there are no payments and the day is on or before the due date
- *Nothing to pay* when the expected rent is 0 € and there are no payments
- *Rent not set* when the expected rent is unknown, whatever the payments
For a day before the tenancy starts, the flat details page SHALL show *No rent this month* with the tenancy's start instead.

**No Playwright test:** a pure calculation from the expected rent, the payments and the day; Vitest covers it, and the details page shows the statuses in the browser tests of "The flat details page".

#### Scenario: Due until the due date
- **WHEN** the due day is 5, November has no payments, and the day is `2026-11-05`
- **THEN** November is *Due 5.11.*

#### Scenario: Late from the day after the due date
- **WHEN** the due day is 5, November has no payments, and the day is `2026-11-22`
- **THEN** November is *Late 17 days*

#### Scenario: Partly paid
- **WHEN** the expected rent is 89000 cents and November has a payment of 50000 cents
- **THEN** November is *Partly paid*, 39000 cents missing

#### Scenario: Paid in two payments
- **WHEN** the expected rent is 89000 cents, and November has payments of 50000 cents on `2026-11-04` and 39000 cents on `2026-11-20`
- **THEN** November is *Paid 20.11.*

#### Scenario: Paid more than expected
- **WHEN** the expected rent is 89000 cents and November has a payment of 90000 cents
- **THEN** November is *Paid*

#### Scenario: A rent of 0 € is never late
- **WHEN** the rent is 0 cents, the due day is 5, November has no payments, and the day is `2026-11-22`
- **THEN** November is *Nothing to pay*, and it is not a month not fully paid

#### Scenario: The due date in the first month is no earlier than the start
- **WHEN** the due day is 5, a tenancy starts on `2026-11-15`, and the day is `2026-11-10`
- **THEN** November's due date is `2026-11-15`, and on `2026-11-16` without payments it is *Late 1 day*

#### Scenario: The due day in a shorter month
- **WHEN** the due day is 31
- **THEN** the due date of `2027-02` is `2027-02-28`

### Requirement: Months not fully paid
The months not fully paid of a flat on a given day SHALL be the months of its tenancies in the current and the previous calendar year, up to and including the current month, whose status on that day is *Late* or *Partly paid*. A month that is *Due* or *Rent not set* SHALL NOT count. The flat details page SHALL warn about these months other than the one its rent card shows, opening the rent payments page on the year of the newest of them, and the rent payments page SHALL warn about those of the chosen year.

**No Playwright test:** a pure selection of months by their status; Vitest covers it, and the warnings are shown in the browser tests of "The flat details page" and "The rent payments page".

#### Scenario: Earlier months of this and last year count
- **WHEN** today is `2026-01-20`, the due day is 5, December 2025 has no payments and January 2026 has none
- **THEN** December 2025 and January 2026 are not fully paid, and the details page warns about December 2025

#### Scenario: Months two years back don't count
- **WHEN** today is `2026-11-22`, and a tenancy that ran in 2023 and 2024 has no payments
- **THEN** none of its months are not fully paid

#### Scenario: An earlier tenancy's month is warned about on the details page
- **WHEN** today is `2026-11-22`, `Pekka Virtanen`'s tenancy with the due day 5 ended on `2026-11-10` without a payment for November, and `Aino Koski`'s started on `2026-11-15`
- **THEN** the rent card shows Aino's November, and the details page warns about Pekka's November

#### Scenario: The warning opens the year of the newest month
- **WHEN** today is `2026-09-22`, and December 2025 is the only month not fully paid
- **THEN** the details page's warning opens the rent payments page on 2025

#### Scenario: A month before its due date doesn't count
- **WHEN** today is `2026-11-03`, the due day is 5, and November has no payments
- **THEN** November is not counted

### Requirement: The month's rent payments page
Everyone with access to a flat SHALL be able to open a month's payments page for a tenancy from the rent card on the details page and from the rent payments page. It SHALL show the month, the tenant, the due date, the status, the expected rent, the total paid and the amount missing, and the payments with their amount, payment date and who recorded them. When the tenancy has fees in the month, the page SHALL show the expected rent's breakdown: the rent and each fee with its amount, a per-occupant fee with the occupants and the amount per occupant, and a link to the Tenancy page. Owners SHALL see "Lisää maksu" and a delete button on each payment; members SHALL NOT. The payment form SHALL default to the amount missing of the expected rent with the fees, and say that the rent and the fees are recorded as one payment.

#### Scenario: The month's payments
- **WHEN** November has a payment of 50000 cents on `2026-11-04` recorded by Annika, and Jussi opens the month's payments page
- **THEN** it shows "Marraskuun vuokra", `Aino Koski`, the due date `5.11.2026`, "Osittain maksettu", the rent `890,00 €`, paid `500,00 €`, missing `390,00 €`, and the payment `500,00 €` paid `4.11.2026` recorded by Annika

#### Scenario: A member sees the payments but can't change them
- **WHEN** Jussi, a member of the flat, opens a month's payments page
- **THEN** he sees the payments and no button to add or delete them

#### Scenario: The breakdown of the rent and the fees
- **WHEN** `Aino Koski`'s rent is 89000 cents, she has two occupants, a water fee of 2200 cents per occupant and a parking fee of 1500 cents, November has a payment of 50000 cents, and Annika opens November's payments page
- **THEN** it shows the expected `949,00 €`, paid `500,00 €`, missing `449,00 €`, and the breakdown: rent `890,00 €`, `Vesimaksu` "2 × 22,00 €" `44,00 €` and `Autopaikka` `15,00 €`

#### Scenario: The rent and the fees as one payment
- **WHEN** November has no payments, and Annika chooses "Merkitse maksetuksi" for November with the same rent and fees
- **THEN** the amount shows `949,00`, and saving it makes November "Maksettu"

### Requirement: The rent payments page
Everyone with access to a flat SHALL be able to open its rent payments page from the flat details page. It SHALL show one year at a time, the current year first, with a choice of the current year and the earlier years in which a tenancy of the flat ran or rent was paid. For the chosen year it SHALL show the rent received in the year: the total of the payments of the flat's tenancies whose payment date is in that year, whatever month they are for. It SHALL list the months up to the current one in which a tenancy ran, newest first, each with its status and opening its payments page, whose Back returns to the chosen year; a month in which two tenancies ran SHALL be listed once per tenancy with the tenant's name. It SHALL warn about the year's months not fully paid ("Months not fully paid"), and say that the year summary does not assume them paid.

#### Scenario: Months newest first with their statuses
- **WHEN** today is `2026-11-22`, `Aino Koski`'s tenancy runs from `2025-03-01` with the due day 5, every month to September 2026 is paid, October has no payments and November has 50000 cents
- **THEN** the page shows 2026 with November "Osittain", October "Myöhässä" and September to January "Maksettu", and a warning about October and November

#### Scenario: Rent is received in the year it is paid
- **WHEN** December 2025's rent of 89000 cents was paid on `2026-01-02`, and the months January to September 2026 were paid in 2026, each 89000 cents
- **THEN** 2026 shows the rent received `8 900,00 €`, and 2025 doesn't count December's payment

#### Scenario: Rent paid in advance before the tenancy
- **WHEN** today is `2026-01-20`, a tenancy starts on `2026-01-01`, and January's rent was paid on `2025-12-28`
- **THEN** the page offers 2026 and 2025

#### Scenario: Two tenancies in the same month
- **WHEN** `Pekka Virtanen`'s tenancy ended on `2025-02-14` and `Aino Koski`'s started on `2025-02-15`
- **THEN** 2025 lists February twice, once with `Pekka Virtanen` and once with `Aino Koski`

#### Scenario: A flat without tenancies
- **WHEN** a user opens the rent payments page of a flat that has never had a tenancy
- **THEN** the page says that rent payments are recorded once the flat has a tenant

### Requirement: Payments stay inside their tenancy
Recorded payments SHALL stay within the months of their tenancy. Correcting a tenancy's start or end ("Correcting a tenancy"), ending it ("Ending a tenancy", "Ending a fixed-term tenancy early") so that a month with payments would fall outside it SHALL be refused with the reason `tenancy_has_payments_outside`, and removing a tenancy that hasn't started but has payments ("Removing a tenancy that hasn't started") SHALL be refused with the reason `tenancy_has_payments`. Nothing SHALL change. The owner deletes those payments first.

**No Playwright test:** server-side checks with the same forms and reason display as the tenancy forms' browser tests; Vitest covers them.

#### Scenario: Ending before a paid month is refused
- **WHEN** `Aino Koski`'s rent for `2027-01` was paid in advance, and an owner ends the tenancy with the last rent day `2026-12-31`
- **THEN** it is refused with the reason `tenancy_has_payments_outside`, and the tenancy is unchanged

#### Scenario: Correcting the start past a paid month is refused
- **WHEN** `Aino Koski`'s tenancy starts on `2025-03-01` and March 2025 has a payment, and an owner corrects the start to `2025-04-01`
- **THEN** it is refused with the reason `tenancy_has_payments_outside`, and the tenancy is unchanged

#### Scenario: Moving the start within the paid month is allowed
- **WHEN** March 2025 has a payment, and an owner corrects the start from `2025-03-01` to `2025-03-15`
- **THEN** the correction is saved, and March's expected rent becomes 17 of 31 days

#### Scenario: Removing a tenancy with payments is refused
- **WHEN** `Mikko Lehtinen`'s tenancy starts on `2027-01-01` and January 2027 was paid in advance, and an owner removes it
- **THEN** it is refused with the reason `tenancy_has_payments`, and the tenancy and the payment stay

### Requirement: The rent summary on the flats list
The flats list SHALL start with this month's rent summary across all the flats the user has access to, owners and members alike: the month's title, the rent received out of the rent expected, and the number of flats whose card shows the rent as late ("The rent status on a flat's card") when above zero. Each flat SHALL count with its whole rent, whatever the user's share. The expected rent SHALL be the sum of this month's expected rent ("Expected rent of a month") of every tenancy that runs in the month, so a month a tenancy starts or ends in counts by days and both tenancies of a mid-month change count. The received rent SHALL be the sum of the payments recorded for this month's rent of those tenancies, whatever their payment date. A tenancy without a rent in effect this month SHALL be left out of both sums. When no tenancy has a rent in effect this month, the summary SHALL NOT be shown.

#### Scenario: The summary adds up this month's rent of every flat
- **WHEN** today is `2026-11-22`; `Kuusikuja 3 B 12` is let from `2025-03-01` with the rent 89000 cents and the due day 5, and November has no payments; `Koivupolku 7 A 4` is let from `2026-01-01` with the rent 64000 cents, and 64000 cents were paid for November on `2026-11-03`; `Rantatie 15 C 21` is vacant
- **THEN** the flats list shows "Marraskuun vuokrat", "640,00 € / 1 530,00 € saatu" and "Vuokra myöhässä 1 asunnossa"

#### Scenario: A shared flat counts with its whole rent
- **WHEN** Annika and Jussi own `Kuusikuja 3 B 12` with 50 % each, its rent is 89000 cents, November has no payments, and Annika opens the flats list on `2026-11-22`
- **THEN** the summary shows "0,00 € / 890,00 € saatu"

#### Scenario: A tenancy that starts mid-month counts by days
- **WHEN** today is `2026-11-22`, the only flat is let from `2026-11-15` with the rent 90000 cents, and November has no payments
- **THEN** the summary shows "0,00 € / 480,00 € saatu"

#### Scenario: Both tenancies of a mid-month change count
- **WHEN** today is `2026-11-22`, the rent is 90000 cents, Pekka's tenancy ends on `2026-11-14` and 42000 cents were paid for his November, and Aino's tenancy starts on `2026-11-15`
- **THEN** the summary shows "420,00 € / 900,00 € saatu"

#### Scenario: A payment for a month without rent is left out
- **WHEN** today is `2026-11-22`, `Kuusikuja 3 B 12` is let with the rent 89000 cents and paid for November, and `Koivupolku 7 A 4` is let without a rent set and has a payment of 50000 cents for November
- **THEN** the summary shows "890,00 € / 890,00 € saatu"

#### Scenario: No summary without rent this month
- **WHEN** a user's only flat is vacant
- **THEN** the flats list shows no rent summary

### Requirement: The rent status on a flat's card
Each flat's card on the flats list SHALL show this month's rent status ("The rent status of a month") next to its tenancy status, for the same tenancy and month as the details page's rent card ("The flat details page"): *Maksettu*, *Osittain maksettu*, *Myöhässä N pv*, *Erääntyy D.M.*, *Vuokraa ei asetettu* or *Ei maksettavaa*. A vacant flat, and a flat whose tenancy starts after this month, SHALL show no rent status.

#### Scenario: A late month shows on the card
- **WHEN** today is `2026-11-22` and `Kuusikuja 3 B 12` is let to `Aino Koski` from `2025-03-01` with the rent 89000 cents and the due day 5, and November has no payments
- **THEN** its card shows "Vuokrattu", `Aino Koski` and "Myöhässä 17 pv"

#### Scenario: The card shows paid, partly paid and due
- **WHEN** the rent is 89000 cents with the due day 5, and on `2026-11-22` one flat has 89000 cents paid for November, another 50000 cents, and on `2026-11-03` a third has nothing paid
- **THEN** the cards show "Maksettu", "Osittain maksettu" and "Erääntyy 5.11." respectively

#### Scenario: A card without a rent set
- **WHEN** a flat is let without a rent set
- **THEN** its card shows "Vuokraa ei asetettu"

#### Scenario: A vacant flat has no rent status
- **WHEN** today is `2026-11-22`, `Koivupolku 7 A 4` has no tenancy, and `Rantatie 15 C 21` has a tenancy from `2026-12-01`
- **THEN** neither card shows a rent status

