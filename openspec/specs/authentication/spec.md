# authentication Specification

## Purpose
Who the user is: signing in with a one-time code sent by email (which also creates the account), limits that protect the email quota, sessions and signing out, pages for signed-in users only, and the language stored on the account. Passkeys come later (#58).
## Requirements
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

### Requirement: Rejecting wrong and expired codes
A code SHALL be valid for 10 minutes and for one successful sign-in. A wrong code SHALL show an error and keep the user on the code step. After 5 wrong attempts the code SHALL stop working, and the user SHALL request a new one. Requesting a new code SHALL make the previous code invalid.

#### Scenario: A wrong code shows an error
- **WHEN** a user enters `000000` and that is not the code sent to them
- **THEN** they stay on the code step, are not signed in, and see a message that the code is wrong

#### Scenario: An expired code is rejected
- **WHEN** a user enters the right code 10 minutes and 1 second after it was sent
- **THEN** they are not signed in and see a message that the code has expired and to request a new one

#### Scenario: Five wrong attempts use up the code
- **WHEN** a user enters a wrong code 5 times and then the right code
- **THEN** they are not signed in and see a message to request a new code

#### Scenario: A used code does not work twice
- **WHEN** a user signs in with a code, signs out and enters the same code again
- **THEN** they are not signed in

#### Scenario: A new code replaces the previous one
- **WHEN** a user requests a code, requests another and enters the first one
- **THEN** they are not signed in, and the second code still signs them in

### Requirement: Requesting a new code
On the code step, the user SHALL be able to request a new code for the same address 30 seconds after the previous one was sent; until then the action SHALL be disabled and show the time left. When the code has expired or its attempts are used up, the action SHALL be available at once. The user SHALL also be able to go back and change the email address.

#### Scenario: A new code can be requested after 30 seconds
- **WHEN** a code was sent 10 seconds ago
- **THEN** "request a new code" is disabled and shows 0:20 left, and after 20 more seconds it is enabled and sends a new code to the same address

#### Scenario: An expired code offers a new one at once
- **WHEN** the user enters a code that has expired
- **THEN** "request a new code" is enabled straight away

#### Scenario: Changing the address goes back to the email step
- **WHEN** the user on the code step selects to change the email address
- **THEN** the email step shows with the address they entered, ready to edit

### Requirement: Choosing the language before sign-in
The sign-in page SHALL offer Suomi, Svenska and English. Choosing one SHALL switch the page to that language at once and set the `kotivalo_locale` cookie, so the code email and a new account use it.

#### Scenario: Choosing Swedish on the sign-in page
- **WHEN** a visitor on `/sign-in` with a Finnish browser chooses Svenska, then signs in as a new address
- **THEN** the page is in Swedish, the code email is in Swedish and the new account's language is `sv`

### Requirement: Limiting code requests
Requests for a code SHALL be limited, because each one sends an email and the email provider's free plan allows 100 a day: at most 3 per minute from one IP address and at most 5 per hour for one email address, from any IP address. A refused request SHALL send no email and SHALL tell the user to try again later.

**No Playwright test:** the limits are counters shared across the whole test run, so browser tests reaching them would make other tests fail; Workers tests cover them against D1.

#### Scenario: A fourth request from one IP address within a minute is refused
- **WHEN** one IP address requests codes for `a@example.com`, `b@example.com`, `c@example.com` and `d@example.com` within 60 seconds
- **THEN** the first three are sent and the fourth is refused without an email

#### Scenario: A sixth code for one address within an hour is refused
- **WHEN** codes for `omistaja@example.com` are requested 6 times within an hour, from 6 different IP addresses
- **THEN** the first five are sent and the sixth is refused without an email

#### Scenario: The address limit frees up after an hour
- **WHEN** 5 codes for `omistaja@example.com` were requested and one hour has passed since the first
- **THEN** a new request for that address is sent

### Requirement: Telling the user when the code email cannot be sent
When the code email cannot be sent, the user SHALL stay on the email step and see a message that matches the reason: the daily or monthly email quota is used up, sending is briefly busy, or sending failed for another reason. The message SHALL NOT claim that a code was sent.

**No Playwright test:** the end-to-end build sends through the capture transport, which cannot be made to fail on demand; Workers tests drive the failures through a failing sender.

#### Scenario: The email quota is used up
- **WHEN** a user requests a code and sending fails with `EmailError` `quota`
- **THEN** they see a message that sign-in emails are not available until tomorrow

#### Scenario: Sending is briefly limited
- **WHEN** a user requests a code and sending fails with `EmailError` `rate_limited`
- **THEN** they see a message to try again in a moment

#### Scenario: Sending fails for another reason
- **WHEN** a user requests a code and sending fails with `EmailError` `unavailable` or `rejected`
- **THEN** they see a message that the email could not be sent and to try again later

### Requirement: Pages for signed-in users only
The app's pages SHALL require a signed-in user, except `/sign-in`. A visitor who is not signed in SHALL be redirected to `/sign-in`. A signed-in user who opens `/sign-in` SHALL be redirected to `/`.

#### Scenario: A visitor is sent to sign in
- **WHEN** a visitor who is not signed in opens `/`
- **THEN** they are redirected to `/sign-in`

#### Scenario: A signed-in user skips the sign-in page
- **WHEN** a signed-in user opens `/sign-in`
- **THEN** they are redirected to `/`

### Requirement: Signing out
A signed-in user SHALL be able to sign out. Signing out SHALL end the session on the server, not only in the browser.

#### Scenario: Signing out ends the session
- **WHEN** a signed-in user selects sign out on `/`
- **THEN** they land on `/sign-in`, and opening `/` again redirects to `/sign-in`

#### Scenario: A signed-out session cookie no longer works
- **WHEN** a user signs out and a request is then made with their earlier session cookie
- **THEN** the request is treated as not signed in

### Requirement: Staying signed in
A session SHALL last 30 days from the last time it was refreshed. A session used at least a day after it was last refreshed SHALL be extended to 30 days from that use.

**No Playwright test:** the scenarios depend on the passage of days; Workers tests set the session's expiry directly.

#### Scenario: A session expires after 30 days without use
- **WHEN** a request is made with a session that was last refreshed 30 days and 1 second ago
- **THEN** the request is treated as not signed in

#### Scenario: Using the app extends the session
- **WHEN** a request is made with a session that was last refreshed 2 days ago
- **THEN** the session's expiry moves to 30 days from that request

### Requirement: The user's language is stored on the account
A new account SHALL store the language the sign-in request resolved to (`fi`, `sv` or `en`). After signing in, the app SHALL use the stored language, also in a browser whose language is different, and SHALL set the `kotivalo_locale` cookie to it.

#### Scenario: A new account keeps the sign-in language
- **WHEN** a visitor whose browser language is Swedish creates an account by signing in
- **THEN** the account's language is `sv`

#### Scenario: Signing in on another device uses the stored language
- **WHEN** the user whose stored language is `sv` signs in from a browser whose language is Finnish and that has no `kotivalo_locale` cookie
- **THEN** after sign-in the app is in Swedish, and the `kotivalo_locale` cookie is `sv`

### Requirement: Test inbox for end-to-end tests
When `EMAIL_TRANSPORT` is `capture`, the app SHALL expose a route that returns the emails captured for an address, so browser tests can read sign-in codes. With any other transport the route SHALL respond 404. The production environment SHALL NOT use the `capture` transport.

**No Playwright test:** it is test infrastructure; every Playwright sign-in uses it, and Vitest checks that it is closed outside `capture` and that production sends through Resend.

#### Scenario: The test inbox returns captured emails
- **WHEN** `EMAIL_TRANSPORT` is `capture` and a code was sent to `uusi@example.com`
- **THEN** the test inbox for `uusi@example.com` returns that email

#### Scenario: The test inbox is closed with a real transport
- **WHEN** `EMAIL_TRANSPORT` is `resend`
- **THEN** the test inbox responds 404

#### Scenario: Production does not capture emails
- **WHEN** the production environment's configuration in `wrangler.jsonc` is read
- **THEN** its `EMAIL_TRANSPORT` is `resend`

