## ADDED Requirements

### Requirement: The rent summary on the flats list
The flats list SHALL start with this month's rent summary across all the flats the user has access to, owners and members alike: the month's title, the rent received out of the rent expected, and the number of flats whose card shows the rent as late ("The rent status on a flat's card") when above zero. Each flat SHALL count with its whole rent, whatever the user's share. The expected rent SHALL be the sum of this month's expected rent ("Expected rent of a month") of every tenancy that runs in the month, so a month a tenancy starts or ends in counts by days and both tenancies of a mid-month change count. The received rent SHALL be the sum of the payments recorded for this month's rent of those tenancies, whatever their payment date. A tenancy without a rent in effect this month SHALL be left out of both sums. When no tenancy has a rent in effect this month, the summary SHALL NOT be shown.

#### Scenario: The summary adds up this month's rent of every flat
- **WHEN** today is `2026-11-22`; `Kuusikuja 3 B 12` is let from `2025-03-01` with the rent 89000 cents and the due day 5, and November has no payments; `Koivupolku 7 A 4` is let from `2026-01-01` with the rent 64000 cents, and 64000 cents were paid for November on `2026-11-03`; `Rantatie 15 C 21` is vacant
- **THEN** the flats list shows "Marraskuun vuokrat", "640,00 € / 1 530,00 € saatu" and "1 myöhässä"

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
