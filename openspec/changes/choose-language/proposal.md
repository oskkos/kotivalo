## Why

Each user should be able to choose Finnish, Swedish or English and have the app and Kotivalo's emails follow that choice (#27). Today the language is fixed when the account is created. A signed-in user can't change it. Choosing a language on the sign-in page doesn't change an existing account's language either: someone whose account is in English chooses Suomi, signs in and gets English. That reads as a bug. The display name is also asked only once and can't be changed afterwards.

## What Changes

- **A light account page, `/account`.** It shows the user's name and email address, a language choice (Suomi / Svenska / English) and a Sign out button. The flats list header gets an account button showing the name's initial, next to Add flat. The footer with "Signed in as … / Sign out" moves to this page.
- **Changing the language.** The choice is saved on the account at once and the page reloads in the new language. The stored language already decides the app's language on every device and the language of the emails sent to the user. This change only makes it changeable.
- **Changing the display name.** "Change name" on the account page opens a dialog with the same rules as the first-time name.
- **The sign-in page's choice counts.** A language the user chooses from the sign-in page's menu is sent with the sign-in, and the account's language becomes that language, for existing accounts too. Only an explicit choice in that browser tab counts. A `kotivalo_locale` cookie that a previous user left on a shared device does not count.

Not in this change:
- the rest of the Account sketch: subscription, notifications, tax rate, bank connection, export and help
- changing the email address
- a bottom navigation bar
- translation review and the tax-term glossary (#22). The existing Swedish and English messages are used as they are.

## Capabilities

### New Capabilities

- `account`: the account page and how to reach it, changing the display name, and changing the language.

### Modified Capabilities

- `authentication`:
  - "Choosing the language before sign-in": an explicit choice also updates an existing account's language. A cookie alone does not.
  - "Signing out": the button moves from the flats list to the account page.
  - "The user's language is stored on the account": the stored language can now be changed (by the account page or an explicit sign-in choice).

## Impact

- **Tables:** none. `user.locale` and `user.name` already exist.
- **Code:**
  - `features/account/`: the account page, the name dialog and the language choice, plus a server function that saves the language and sets the cookie.
  - `features/authentication/`: `verifySignInCode` takes an optional chosen language, and the sign-in code step sends it. `LanguageMenu` remembers the explicit choice for the tab. The user repository gets `setLocale`. The display name is changed through the existing `setDisplayName`.
  - `features/properties/PropertyList.tsx`: an account button in the header instead of the footer.
  - New route `src/routes/_authed/account.tsx`.
- **Screens** on the Design canvas, "Tili ja kieli" row:
  - `AsunnotTili`: the flats list with the account button.
  - `TiliKevyt`, `TiliNimi`, `TiliNimiVirhe` and `TiliSv`: the account page, the name dialog, an empty name, and the page in Swedish.
  - The fuller Account sketch (`Tili`) stays the target for later.
- **Messages:** fi, sv and en for the account page and the name dialog.
- **Logs:** `authentication.locale_changed` (with the new locale and `source`: `account` or `sign_in`) and `authentication.name_set`.
