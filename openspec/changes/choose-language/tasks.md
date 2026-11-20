## 1. Language on sign-in

`fix(auth): let a language chosen on the sign-in page update the account`

- [x] 1.1 Add `setLocale(userId, locale, now)` to `features/authentication/user.repository.server.ts`, with a Workers test
- [x] 1.2 Move `setLocaleCookie()` to `features/authentication/locale-cookie.server.ts`; add a `localeInput` schema (`z.enum(locales)`) and an optional `locale` to `requestCodeInput` and `verifyCodeInput`, with unit tests
- [x] 1.3 `requestCode` uses the chosen locale for the code email; `verifyCode` creates a new account with it, stores it on an existing account when it differs (`authentication.locale_changed`, `source: 'sign_in'`) and returns it for the cookie; Workers tests for the email language, the stored language, no change without a choice, and the log line
- [x] 1.4 `LanguageMenu` writes `kotivalo_locale_chosen` to `sessionStorage` before `setLocale()` (helpers in `src/lib/chosen-locale.ts`); the email and code steps send it; it is removed after a successful sign-in; all `sessionStorage` access in try/catch; component tests
- [x] 1.5 Playwright for "Choosing a language changes an existing account's language" and "A cookie left on the device does not change the account's language"; the existing "Choosing Swedish on the sign-in page" still passes

## 2. Account page

`feat(account): add the account page with name, language and sign-out`

- [ ] 2.1 Write `setAccountLanguage` in `features/account/functions.ts` (session check, `localeInput`, `users.setLocale`, the cookie, `authentication.locale_changed` with `source: 'account'`; the current language changes nothing and logs nothing), with Workers tests
- [ ] 2.2 Write `features/account/AccountPage.tsx` from the canvas's `TiliKevyt`: the back button, the name and address card with Change name, the language `ToggleButtonGroup` (saves, then `setLocale()` reloads; disabled while saving; `failureReason` alert on failure), and Sign out
- [ ] 2.3 Write the name dialog with `displayNameInput`, `TextField` and `setDisplayName`; Cancel keeps the old name; `router.invalidate()` after saving
- [ ] 2.4 Add the route `src/routes/_authed/account.tsx`
- [ ] 2.5 fi, sv and en messages (Finnish first, from the canvas)
- [ ] 2.6 Component tests for the page and the dialog (the name shown, an empty name refused, Cancel, the language buttons' `aria-pressed` and `lang`)
- [ ] 2.7 Playwright for "Changing the display name", "Choosing the language on the account page" and "The account page needs a signed-in user"
- [ ] 2.8 Screenshots of `/account` (fi and sv) and the name dialog at 390 × 844 for review before the commit

## 3. Account button on the flats list

`feat(properties): open the account page from the flats list header`

- [ ] 3.1 Add the account button (the name's initial, `aria-label` "Account", 44 px, `accent`) to the `PropertyList` header; remove the footer and the `email` and `onSignOut` props; update `src/routes/_authed/index.tsx`
- [ ] 3.2 Update `PropertyList` component tests; move the sign-out e2e test ("Signing out ends the session") to go through `/account`; Playwright for "Opening the account page from the flats list"
- [ ] 3.3 Remove the messages that are no longer used (`home_signed_in_as` if unused); update CLAUDE.md ("Current state": the account page, the language menu also on the account page) and CONCEPT.md where it describes the Account screen
- [ ] 3.4 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm check:traceability` pass

## 4. Archive

`docs(openspec): archive choose-language`

- [ ] 4.1 `openspec archive choose-language`; `pnpm check:traceability` passes with the specs in `openspec/specs/`
