## Context

The language mechanism already exists:
- `user.locale` stores the language: a Better Auth additional field, set for new accounts in `platform/auth.server.ts`.
- The `kotivalo_locale` cookie is set by Paraglide's `setLocale()` from the sign-in page's `LanguageMenu`.
- `verifySignInCode` sets the cookie to the stored language.
- `getSignedInUser` puts the cookie back when it drifts, and the `_authed` layout reloads.
- The code email uses the stored language (`auth.findLocale`).

What is missing:
- a way for a signed-in user to change the language
- a way to change the display name after `/welcome`
- respect for an explicit choice on the sign-in page

The canvas has a full Account sketch (`Tili`). Most of its rows (subscription, notifications, tax rate, bank, export) belong to later issues. This change builds a light version, drawn as `TiliKevyt` in the "Tili ja kieli" row.

## Goals / Non-Goals

**Goals:**
- `/account` with name, email, language and Sign out, reached from an account button in the flats list header
- language changes stored at once, followed on every device and in emails
- an explicit sign-in-page choice updates an existing account. A stale cookie does not.

**Non-Goals:**
- changing the email address
- bottom navigation
- the rest of the Account sketch
- translation quality (#22)

## Decisions

### A new `account` capability and `features/account/`
The account page is a place users go, not part of signing in. It gets its own spec and folder. The name and language data stay in `features/authentication/user.repository.server.ts`, the one repository for the app's own user columns. `account` imports it, as `sharing` imports from `properties`. The existing requirements ("Asking for a display name", "The user's language is stored on the account") stay in `authentication`. The new requirements refer to them by name.

*Alternative:* add the account requirements to `authentication`. Rejected: the spec would grow into "everything about the user", and later Account rows (notifications, export) would not fit there either.

### Changing the language: a server function, then a full reload
`setAccountLanguage({ locale })` in `features/account/functions.ts`:
1. checks the session
2. validates `locale` with a `z.enum(locales)` schema
3. calls `users.setLocale(userId, locale, now)`
4. sets the `kotivalo_locale` cookie
5. logs `authentication.locale_changed` with `{ locale, source: 'account' }`

The client then calls Paraglide's `setLocale(locale)`, which writes the same cookie and reloads. The server renders the next page in the new language, including MUI's own texts (`themeFor(getLocale())`).

*Alternative:* switch the language in the browser without a reload. Rejected: the theme locale, the `<html lang>` and every loader's data are resolved on the server. A partial switch would mix languages until the next navigation.

The cookie helper `setLocaleCookie()` in `features/authentication/functions.ts` moves to `features/authentication/locale-cookie.ts` so both features use one implementation.

### An explicit sign-in choice: remembered per tab in `sessionStorage`
When the user picks a language in `LanguageMenu`, it writes the key `kotivalo_locale_chosen` to `sessionStorage` before calling `setLocale()`. The value survives the reload in the same tab. The sign-in steps read it and pass it as the optional `locale` to:
- `requestSignInCode`: the code email is in that language
- `verifySignInCode`: `verifyCode` stores it on the account when it differs from the stored language, logs `authentication.locale_changed` with `source: 'sign_in'`, and returns it as the locale for the cookie

A new account is created with the chosen language (it equals the request's language anyway). After a successful sign-in the key is removed.

Why `sessionStorage`: it is scoped to one tab and gone when the tab closes. A choice made by the previous user of a shared device does not carry over, and the persistent cookie alone never counts as a choice.

*Alternatives:*
- **A second cookie:** it outlives the tab, so the shared-device problem comes back.
- **A `?lang=` query parameter:** Paraglide's `setLocale()` reloads the current URL. Keeping the parameter through the reload and the email → code steps adds routing code for no gain.

The value is validated with the same `z.enum(locales)` on the server. It can only change the signing-in user's own account, so a forged value harms nobody else.

### Changing the name reuses `setDisplayName`
The dialog uses the `displayNameInput` schema, `TextField` and the existing `setDisplayName` server function, and logs `authentication.name_set` as before. After saving, `router.invalidate()` reloads the `_authed` context, so the page and the header initial show the new name.

### The account button and the language choice
- **Account button:** a 44 px round `IconButton` link to `/account`, in the theme's `accent` colour. It shows the first character of the display name (`Array.from(name)[0]`, uppercased; `/welcome` makes sure a name exists). Its `aria-label` is "Account".
- **Footer:** the flats list footer ("Signed in as …" and Sign out) is removed. `PropertyList` loses its `email` and `onSignOut` props.
- **Language choice:** a `ToggleButtonGroup` (exclusive, three equal buttons, each with its own `lang` attribute), styled like `ChoiceField`. It doesn't use `ChoiceField` itself, because that is bound to TanStack Form and this choice saves at once, with no submit. While saving, the buttons are disabled. A failure shows `failureReason(error)` as an alert.

## Risks / Trade-offs

- **[Risk]** A user switches language by mistake and can't read the new one. → The buttons always show each language's name in that language (Suomi, Svenska, English), at the same place on the page.
- **[Risk]** `sessionStorage` is unavailable (some private modes throw). → Reads and writes are wrapped in try/catch. Without it, the sign-in behaves as today: the choice affects the page and a new account only.
- **[Trade-off]** The sign-in steps send a `locale` that the server trusts as the user's preference. This is acceptable: it can only change the user's own account, and only to one of three valid values.
- **[Trade-off]** Removing the footer drops the visible "Signed in as" from the home page. The address is now one tap away on `/account`. The e2e test "Signing out ends the session" moves there.

## Migration Plan

No schema change. The deploy is code only, and rolling it back needs nothing else.
