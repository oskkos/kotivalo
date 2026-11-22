## MODIFIED Requirements

### Requirement: The entries page
Everyone with access to a flat SHALL be able to open its Entries page from the latest entries on the flat's details page ("The flat details page") and from its menu. The page SHALL show one year at a time, the current year first, with a choice of the current year and the years that have entries. For the chosen year it SHALL show the total income and the total expenses of its entries, and the entries grouped by month, newest first, each with its category, date, note, signed amount and whether it has a receipt. The page SHALL say that rent and the monthly charges are computed from their amounts and are not logged. Owners SHALL see a New entry button; members SHALL NOT.

#### Scenario: Opening the entries page from the details page
- **WHEN** Annika, owner of `Kuusikuja 3 B 12`, opens its details page and chooses "Kaikki" next to its latest entries
- **THEN** the Entries page of `Kuusikuja 3 B 12` opens

#### Scenario: Entries are grouped by month, newest first
- **WHEN** today is `2026-11-21` and the flat has an expense of 14550 cents on `2026-11-12`, an income of 4000 cents on `2026-11-03` and an expense of 18600 cents on `2026-10-28`
- **THEN** the page shows 2026, income `+40,00 €` and expenses `−331,50 €`, with November 2026 listing the expense of 12.11. before the income of 3.11., and October 2026 listing the expense of 28.10.

#### Scenario: Choosing an earlier year
- **WHEN** today is `2026-11-21`, the flat has an expense of 21000 cents on `2025-12-09`, and the user chooses 2025
- **THEN** the page shows expenses `−210,00 €` and lists the expense under December 2025

#### Scenario: A flat without entries
- **WHEN** an owner opens the Entries page of a flat with no entries
- **THEN** the page says there are no entries for the current year and shows the New entry button

#### Scenario: A member sees the entries but can't add them
- **WHEN** Jussi, a member of the flat, opens its Entries page
- **THEN** he sees the entries and no New entry button
