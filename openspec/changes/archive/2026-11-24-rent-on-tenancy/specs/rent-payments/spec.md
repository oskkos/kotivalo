## MODIFIED Requirements

### Requirement: Expected rent of a month
A month's expected rent for a tenancy SHALL be the tenancy's own rent in that month ("The rent of a tenancy"), in proportion to the days of the month the tenancy runs: the rent × the tenancy's days in the month ÷ the month's days, rounded to the nearest cent, halves up. For a month the tenancy runs in full it SHALL be the month's rent. When the tenancy has no rent in the month, the expected rent SHALL be unknown, and the month's status SHALL be *Rent not set*. When the tenant changes mid-month, each tenancy's part of the month SHALL use its own rent.

**No Playwright test:** a pure calculation from the tenancy's rent periods and dates; Vitest covers it, and the details page and the month's payments page show it in the browser tests of "The flat details page" and "The month's rent payments page".

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
