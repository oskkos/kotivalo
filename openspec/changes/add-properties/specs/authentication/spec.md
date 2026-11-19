## MODIFIED Requirements

### Requirement: Sign in with an emailed code
A user SHALL sign in by entering their email address and then the 6-digit code emailed to that address, in the same tab. Signing in with an address that has no account SHALL create the account; there is no separate sign-up. Email addresses SHALL be compared case-insensitively. The code email SHALL be in the language the request resolved to for a new account, and in the user's stored language for an existing one.

#### Scenario: A new address creates an account and signs in
- **WHEN** a visitor enters `uusi@example.com` on `/sign-in`, then the code from the email sent to that address
- **THEN** an account exists for `uusi@example.com`, the visitor is signed in and lands on `/`, the flats list, which is empty for the new account

#### Scenario: An existing user signs in to the same account
- **WHEN** the user with the account `omistaja@example.com` signs in again with a new code
- **THEN** they are signed in to that same account and no second account is created

#### Scenario: The address is matched without regard to case
- **WHEN** the user with the account `omistaja@example.com` signs in as `Omistaja@Example.com`
- **THEN** they are signed in to the existing account

#### Scenario: The code email is in the user's language
- **WHEN** the user whose stored language is `sv` requests a code from a browser whose language is Finnish
- **THEN** the email's subject and text are the Swedish messages

