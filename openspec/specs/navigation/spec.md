# navigation Specification

## Purpose
The bottom navigation bar on the main pages: Flats, New entry, Taxes and Account; Statistics joins it when its page exists.
## Requirements
### Requirement: The bottom navigation bar
The flats list `/`, the year summary page `/year-summary` and the account page `/account` SHALL show a bottom navigation bar with four items: Flats (`/`), New entry (an icon button labelled for screen readers, opening `/transactions/new`), Taxes (`/year-summary`) and Account (`/account`). The item of the current page SHALL be marked as current (`aria-current="page"`). Other pages (forms, a flat's subpages, a flat's form 7H page, sign-in and the welcome page) SHALL NOT show the bar; they keep their close or back button. Statistics SHALL be added to the bar only when its page exists.

#### Scenario: Moving between the flats list and the account page
- **WHEN** a signed-in user on `/` selects Account in the bottom bar, and then Flats
- **THEN** `/account` opens with Account marked as current, and then `/` opens with Flats marked as current

#### Scenario: The bottom bar opens a new entry
- **WHEN** a signed-in user on `/` selects New entry in the bottom bar
- **THEN** `/transactions/new` opens

#### Scenario: The bottom bar opens the year summary
- **WHEN** a signed-in user on `/` selects Taxes in the bottom bar
- **THEN** `/year-summary` opens with Taxes marked as current

#### Scenario: Forms don't show the bottom bar
- **WHEN** a signed-in user opens the new flat form `/properties/new`
- **THEN** the page has no bottom navigation bar

