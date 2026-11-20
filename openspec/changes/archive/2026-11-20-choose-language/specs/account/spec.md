## ADDED Requirements

### Requirement: The account page
A signed-in user SHALL have an account page at `/account` that shows their display name, their email address, the language choice and a Sign out button. The flats list header SHALL have an account button, labelled for screen readers and showing the first letter of the display name, that opens the page. The page SHALL have a back button to the flats list. The flats list SHALL NOT show the signed-in address or the Sign out button any more.

#### Scenario: Opening the account page from the flats list
- **WHEN** the signed-in user named `Annika` with the address `annika@example.com` selects the account button on `/`
- **THEN** `/account` shows `Annika` and `annika@example.com`, and the back button returns to `/`

#### Scenario: The account page needs a signed-in user
- **WHEN** a visitor who is not signed in opens `/account`
- **THEN** they are redirected to `/sign-in`

### Requirement: Changing the display name
On the account page the user SHALL be able to change their display name in a dialog. The name SHALL follow the same rules as when it is first asked ("Asking for a display name"): 1–50 characters after trimming, without `@`, `/`, `:`, `<` or `>`. After saving, the dialog SHALL close and the page SHALL show the new name. A refused name SHALL show its reason under the field and SHALL NOT be saved. Cancelling SHALL keep the old name.

#### Scenario: Saving a new name
- **WHEN** the user named `Annika` changes the name to `Anni` and saves
- **THEN** the account page shows `Anni`, and the people they share flats with see `Anni`

#### Scenario: An empty new name is not saved
- **WHEN** the user clears the name field in the dialog and saves
- **THEN** the field shows that a name is required, the dialog stays open, and the stored name is unchanged

#### Scenario: Cancelling keeps the old name
- **WHEN** the user named `Annika` types `Anni` in the dialog and selects Cancel
- **THEN** the dialog closes and the page still shows `Annika`

### Requirement: Choosing the language on the account page
The account page SHALL offer Suomi, Svenska and English, with the current language selected. Choosing another language SHALL store it on the account at once, set the `kotivalo_locale` cookie to it and load the page again in that language. The chosen language SHALL then be used on the user's other devices and for the emails Kotivalo sends to the user. Choosing the current language SHALL change nothing.

#### Scenario: Switching from Finnish to Swedish
- **WHEN** the user whose stored language is `fi` chooses Svenska on `/account`
- **THEN** the page reloads in Swedish, the account's language is `sv`, and the `kotivalo_locale` cookie is `sv`

#### Scenario: The new language follows the user to another device
- **WHEN** the user has switched to English on one device and then signs in on another, whose browser language is Finnish
- **THEN** the app is in English after sign-in, and the sign-in code email is in English

#### Scenario: Switching back to Finnish
- **WHEN** the user whose stored language is `en` chooses Suomi on `/account`
- **THEN** the page reloads in Finnish and the account's language is `fi`
