## MODIFIED Requirements

### Requirement: The account page
A signed-in user SHALL have an account page at `/account` that shows their display name, their email address, the language choice and a Sign out button. The page SHALL be opened from Account in the bottom navigation bar ("The bottom navigation bar"), and SHALL have neither a back button nor an account button in the flats list header. The flats list SHALL NOT show the signed-in address or the Sign out button.

#### Scenario: Opening the account page from the flats list
- **WHEN** the signed-in user named `Annika` with the address `annika@example.com` selects Account in the bottom bar on `/`
- **THEN** `/account` shows `Annika` and `annika@example.com`, and Flats in the bottom bar returns to `/`

#### Scenario: The account page needs a signed-in user
- **WHEN** a visitor who is not signed in opens `/account`
- **THEN** they are redirected to `/sign-in`
