## MODIFIED Requirements

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
