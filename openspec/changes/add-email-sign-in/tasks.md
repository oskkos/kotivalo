## 1. Better Auth tables as the first migration

`feat(db): add the Better Auth tables as the first migration`

- [ ] 1.1 Add `better-auth` with an exact version
- [ ] 1.2 Add `BETTER_AUTH_SECRET` to the top-level `vars` in `wrangler.jsonc` as a marked development value, document the production secret in a comment, update `.dev.vars.example`, run `pnpm cf-typegen`
- [ ] 1.3 Add the `instant(name)` column helper (epoch milliseconds) to `src/server/db/columns.ts`, with a unit test
- [ ] 1.4 Add `user` (with `locale`), `session`, `account`, `verification` and `rate_limit` to `src/server/db/schema.ts`, with field names matching Better Auth's models
- [ ] 1.5 Run `pnpm db:generate`, review the SQL and commit the migration; a Workers test checks that the tables exist after the migrations are applied, and `pnpm db:migrate:local` applies it

## 2. Request limits

`feat(platform): limit requests with a D1 counter`

- [ ] 2.1 Write `consumeLimit(db, key, rule)` in `src/server/platform/limits.server.ts` as one upsert statement
- [ ] 2.2 Workers tests: within the window, at the limit, and after the window resets

## 3. Better Auth per request

`feat(platform): create Better Auth per request`

- [ ] 3.1 First verify that an `EmailError` thrown in `sendVerificationOTP` reaches the `auth.api.sendVerificationOTP` caller; if Better Auth swallows it, apply the design's fallback
- [ ] 3.2 Write `src/server/platform/auth.server.ts` with `createAuth()`:
  - Drizzle adapter (`sqlite`), UUID ids, `emailOTP` (6 digits, 600 s, 5 attempts, hashed, rotate)
  - `tanstackStartCookies()`
  - sessions of 30 days with `updateAge` of 1 day and a 5-minute cookie cache
  - `user.locale` as an additional field filled by a create hook
- [ ] 3.3 Add `auth` to `getRequestContext()`; `baseURL` from the request origin, `secret` from `BETTER_AUTH_SECRET`
- [ ] 3.4 Add `isCapturing(env)` to `platform/mailer.server.ts` and read the client IP (`cf-connecting-ip`, or `x-test-client-ip` only when capturing)
- [ ] 3.5 Workers tests through `auth.api`: a code signs in and creates the user with a locale; a session is returned and can be signed out

## 4. Sign-in code email

`feat(email): add the sign-in code email`

- [ ] 4.1 Add an optional `code` block to `renderEmail()` (large monospaced in HTML, its own line in text), with tests including escaping
- [ ] 4.2 Write the sign-in code email template in `src/features/authentication/` from the `SignInCodeEmail` canvas board: the code in the subject, the 10-minute validity, the ignore line; rendered in the given locale, with tests
- [ ] 4.3 Add the Finnish messages from the canvas, then Swedish and English

## 5. Validation and form pattern

`feat(forms): validate with Zod and show reasons through Paraglide`

- [ ] 5.1 Add `zod` and `@tanstack/react-form` with exact versions
- [ ] 5.2 Write `src/lib/reasons.ts`: the `Reason` union and a static `reasonMessage()` to Paraglide messages; `messages.test.ts` covers the new keys
- [ ] 5.3 Write `features/authentication/schemas.ts` (email: trimmed, lowercased; code: 6 digits) with reason codes as errors, and unit tests
- [ ] 5.4 Write `src/components/form/TextField.tsx`, which connects TanStack Form to MUI `TextField` (error via `reasonMessage`, `aria-invalid`, `aria-describedby`, disabled while submitting), with component tests
- [ ] 5.5 Add the error colours from the canvas to tokens and `palette.error`, and their contrast pairs to `theme.test.ts`
- [ ] 5.6 Document the pattern in CLAUDE.md (Zod schemas in the feature, reason codes, TanStack Form, `TextField`)

## 6. Sign-in server functions

`feat(auth): add the sign-in server functions`

- [ ] 6.1 `requestCode({ email })`:
  - Zod-validated
  - consumes the IP and address limits
  - resolves the email locale (stored, else the request's)
  - calls `sendVerificationOTP`
  - returns `{ ok }` or a reason (`limit_reached`, `email_quota`, `email_busy`, `email_failed`)
- [ ] 6.2 `verifyCode({ email, code })`: signs in or creates the account, sets `kotivalo_locale` from the user's `locale`, and maps the Better Auth errors to `code_wrong`, `code_expired` or `code_attempts_used`
- [ ] 6.3 `getSession()` and `signOut()`
- [ ] 6.4 The test inbox server route (`/api/test/inbox?to=`), returning 404 unless capturing
- [ ] 6.5 A unit test that parses `wrangler.jsonc` and asserts `env.production.vars.EMAIL_TRANSPORT` is `resend`
- [ ] 6.6 Workers tests for every scenario in:
  - "Sign in with an emailed code"
  - "Rejecting wrong and expired codes" (expiry by moving the stored expiry)
  - "Limiting code requests"
  - "Telling the user when the code email cannot be sent" (with a failing sender)
  - "Staying signed in"
  - "The user's language is stored on the account"
  - "Test inbox for end-to-end tests"
- [ ] 6.7 Document `auth` in the context, the server-function-only rule (no `/api/auth` handler), the limits, the test inbox and the new secret in CLAUDE.md

## 7. Sign-in page

`feat(auth): add the sign-in page`

The page is public in this commit; the home page stays public until group 8.

- [ ] 7.1 Write `src/routes/sign-in.tsx` from `SignInEmail`: logo and tagline, language menu, email form, loading state, field error and alerts
- [ ] 7.2 Write the code step from `SignInCode`:
  - six boxes over one OTP input, submitting on the sixth digit
  - wrong-code error and expired / attempts alerts
  - the 30 s resend countdown, enabled at once after expiry
  - change address, spam hint
- [ ] 7.3 Component tests for "Requesting a new code" (fake timers) and the error states
- [ ] 7.4 A Playwright helper `signIn(page, email)` that reads the code from the test inbox, with a unique address and `x-test-client-ip` per test
- [ ] 7.5 Playwright tests:
  - "Sign in with an emailed code"
  - "Rejecting wrong and expired codes" (the wrong code)
  - "Requesting a new code"
  - "Choosing the language before sign-in"
- [ ] 7.6 Take screenshots of every canvas state at 390 × 844, compare them with the canvas, and have the user review them before the commit
- [ ] 7.7 Update README (the local sign-in code appears in the dev server log) and CONCEPT.md §6 (the sign-in screen is no longer missing)

## 8. Signed-in app and sign-out

`feat(auth): require sign-in for the app and add sign-out`

- [ ] 8.1 Add the `_authed` layout route with the session check and redirect, and move the home page under it; the home page shows the email and a sign-out button; `/sign-in` redirects to `/` when signed in
- [ ] 8.2 Update the existing home e2e test, which assumed `/` is public
- [ ] 8.3 Playwright tests:
  - "Pages for signed-in users only"
  - "Signing out"
  - "The user's language is stored on the account"
- [ ] 8.4 Update CLAUDE.md's current state: auth is done
- [ ] 8.5 `pnpm check:traceability` shows no pending gaps, and typecheck, lint, format, all Vitest projects and Playwright pass

## 9. Archive

`docs(openspec): archive email sign-in`

- [ ] 9.1 Open a follow-up issue for passkeys after the domain move, noting that the `/api/auth` handler and client then need the limits too
- [ ] 9.2 The user sets the production `BETTER_AUTH_SECRET` in their own terminal before merging
- [ ] 9.3 Run `openspec archive add-email-sign-in` and check that `pnpm check:traceability` passes with the specs in `openspec/specs/`
