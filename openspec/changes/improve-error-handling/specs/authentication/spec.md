## MODIFIED Requirements

### Requirement: The user's language is stored on the account
A new account SHALL store the language the sign-in request resolved to (`fi`, `sv` or `en`). After signing in, the app SHALL use the stored language, also in a browser whose language is different, and SHALL set the `kotivalo_locale` cookie to it. When the cookie differs from the stored language, the app SHALL put it back and render the page in the stored language.

#### Scenario: A new account keeps the sign-in language
- **WHEN** a visitor whose browser language is Swedish creates an account by signing in
- **THEN** the account's language is `sv`

#### Scenario: Signing in on another device uses the stored language
- **WHEN** the user whose stored language is `sv` signs in from a browser whose language is Finnish and that has no `kotivalo_locale` cookie
- **THEN** after sign-in the app is in Swedish, and the `kotivalo_locale` cookie is `sv`

#### Scenario: A changed language cookie is put back
- **WHEN** the user whose stored language is `en` has the `kotivalo_locale` cookie set to `fi` and opens `/`
- **THEN** the page is in English from its first render, without a hydration error, and the cookie is `en` again
