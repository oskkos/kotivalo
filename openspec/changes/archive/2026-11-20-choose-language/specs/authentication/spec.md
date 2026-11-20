## MODIFIED Requirements

### Requirement: Choosing the language before sign-in
The sign-in page SHALL offer Suomi, Svenska and English. Choosing one SHALL switch the page to that language at once and set the `kotivalo_locale` cookie, so the code email and a new account use it. A language chosen from the menu in the same browser tab SHALL be sent with the code request and the sign-in: the code email SHALL be in that language, and signing in SHALL store it as the account's language, also for an existing account. A language that only comes from the cookie or the browser, without a choice in that tab, SHALL NOT change an existing account's language: the cookie may have been left by another user of a shared device.

#### Scenario: Choosing Swedish on the sign-in page
- **WHEN** a visitor on `/sign-in` with a Finnish browser chooses Svenska, then signs in as a new address
- **THEN** the page is in Swedish, the code email is in Swedish and the new account's language is `sv`

#### Scenario: Choosing a language changes an existing account's language
- **WHEN** the user whose stored language is `en` chooses Suomi on `/sign-in` and signs in
- **THEN** the code email is in Finnish, the app is in Finnish after sign-in, and the account's language is `fi`

#### Scenario: A cookie left on the device does not change the account's language
- **WHEN** the browser has the `kotivalo_locale` cookie `fi` from an earlier visit, and the user whose stored language is `en` opens `/sign-in` and signs in without choosing a language
- **THEN** the code email is in English, the app is in English after sign-in, and the account's language stays `en`

### Requirement: Signing out
A signed-in user SHALL be able to sign out from the account page. Signing out SHALL end the session on the server, not only in the browser.

#### Scenario: Signing out ends the session
- **WHEN** a signed-in user selects Sign out on `/account`
- **THEN** they land on `/sign-in`, and opening `/` again redirects to `/sign-in`

#### Scenario: A signed-out session cookie no longer works
- **WHEN** a user signs out and a request is then made with their earlier session cookie
- **THEN** the request is treated as not signed in

### Requirement: The user's language is stored on the account
A new account SHALL store the language the sign-in request resolved to (`fi`, `sv` or `en`). The stored language SHALL change only when the user chooses a language, on the account page ("Choosing the language on the account page") or on the sign-in page ("Choosing the language before sign-in"). After signing in, the app SHALL use the stored language, also in a browser whose language is different, and SHALL set the `kotivalo_locale` cookie to it. When the cookie differs from the stored language, the app SHALL put it back and render the page in the stored language.

#### Scenario: A new account keeps the sign-in language
- **WHEN** a visitor whose browser language is Swedish creates an account by signing in
- **THEN** the account's language is `sv`

#### Scenario: Signing in on another device uses the stored language
- **WHEN** the user whose stored language is `sv` signs in from a browser whose language is Finnish and that has no `kotivalo_locale` cookie
- **THEN** after sign-in the app is in Swedish, and the `kotivalo_locale` cookie is `sv`

#### Scenario: A changed language cookie is put back
- **WHEN** the user whose stored language is `en` has the `kotivalo_locale` cookie set to `fi` and opens `/`
- **THEN** the page is in English from its first render, without a hydration error, and the cookie is `en` again
