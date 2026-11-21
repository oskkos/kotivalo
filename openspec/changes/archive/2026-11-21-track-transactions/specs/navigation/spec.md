## ADDED Requirements

### Requirement: The bottom navigation bar
The flats list `/` and the account page `/account` SHALL show a bottom navigation bar with three items: Flats (`/`), New entry in the middle (an icon button labelled for screen readers, opening `/transactions/new`) and Account (`/account`). The item of the current page SHALL be marked as current (`aria-current="page"`). Other pages (forms, a flat's subpages, sign-in and the welcome page) SHALL NOT show the bar; they keep their close or back button. Statistics and Taxes SHALL be added to the bar only when those pages exist.

#### Scenario: Moving between the flats list and the account page
- **WHEN** a signed-in user on `/` selects Account in the bottom bar, and then Flats
- **THEN** `/account` opens with Account marked as current, and then `/` opens with Flats marked as current

#### Scenario: The bottom bar opens a new entry
- **WHEN** a signed-in user on `/` selects New entry in the bottom bar
- **THEN** `/transactions/new` opens

#### Scenario: Forms don't show the bottom bar
- **WHEN** a signed-in user opens the new flat form `/properties/new`
- **THEN** the page has no bottom navigation bar
