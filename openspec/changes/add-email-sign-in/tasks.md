## 1. Dependencies and configuration

- [ ] 1.1 Add `better-auth`, `zod` and `@tanstack/react-form` with exact versions
- [ ] 1.2 Add `BETTER_AUTH_SECRET` to the top-level `vars` in `wrangler.jsonc` as a marked development value, document the production secret in a comment, update `.dev.vars.example`, run `pnpm cf-typegen`
- [ ] 1.3 Add a unit test that parses `wrangler.jsonc` and asserts `env.production.vars.EMAIL_TRANSPORT` is `resend` (scenario "Production does not capture emails")

## 2. Schema and migration

- [ ] 2.1 Add the `instant(name)` column helper (epoch milliseconds) to `src/server/db/columns.ts`, with a unit test
- [ ] 2.2 Add `user` (with `locale`), `session`, `account`, `verification` and `rate_limit` to `src/server/db/schema.ts`, with field names matching Better Auth's models
- [ ] 2.3 Run `pnpm db:generate`, review the SQL and commit the migration; check that `pnpm db:migrate:local` and the Workers tests apply it

## 3. Better Auth in the platform

- [ ] 3.1 Write `src/server/platform/auth.server.ts` with `createAuth()`:
  - Drizzle adapter (`sqlite`), UUID ids, `emailOTP` (6 digits, 600 s, 5 attempts, hashed, rotate)
  - `tanstackStartCookies()`
  - sessions of 30 days with `updateAge` of 1 day and a 5-minute cookie cache
  - `user.locale` as an additional field filled by a create hook
- [ ] 3.2 Add `auth` to `getRequestContext()`; `baseURL` from the request origin, `secret` from `BETTER_AUTH_SECRET`
- [ ] 3.3 Verify first that an `EmailError` thrown in `sendVerificationOTP` reaches the `auth.api.sendVerificationOTP` caller; if Better Auth swallows it, apply the design's fallback
- [ ] 3.4 Write `consumeLimit(db, key, rule)` in `src/server/platform/limits.server.ts` as one upsert statement, with Workers tests: within the window, at the limit, and after the window resets
- [ ] 3.5 Add `isCapturing(env)` to `platform/mailer.server.ts` and read the client IP (`cf-connecting-ip`, or `x-test-client-ip` only when capturing)

## 4. Email

- [ ] 4.1 Add an optional `code` block to `renderEmail()` (large monospaced in HTML, its own line in text), with tests including escaping
- [ ] 4.2 Write the sign-in code email template in `src/features/authentication/` from the `SignInCodeEmail` canvas board: the code in the subject, the 10-minute validity, the ignore line; rendered in the given locale
- [ ] 4.3 Add the Finnish messages from the canvas, then Swedish and English

## 5. Validation pattern

- [ ] 5.1 Write `src/lib/reasons.ts`: the `Reason` union and a static `reasonMessage()` to Paraglide messages; `messages.test.ts` covers the new keys
- [ ] 5.2 Write `features/authentication/schemas.ts` (email: trimmed, lowercased; code: 6 digits) with reason codes as errors, and unit tests
- [ ] 5.3 Write `src/components/form/TextField.tsx`, which connects TanStack Form to MUI `TextField` (error via `reasonMessage`, `aria-invalid`, `aria-describedby`, disabled while submitting), with component tests
- [ ] 5.4 Add the error colours from the canvas to tokens and `palette.error`, and their contrast pairs to `theme.test.ts`
- [ ] 5.5 Document the pattern in CLAUDE.md (Zod schemas in the feature, reason codes, TanStack Form, `TextField`), and add it to `openspec/config.yaml` if it affects specs or design

## 6. Server functions

- [ ] 6.1 `requestCode({ email })`:
  - Zod-validated
  - consumes the IP and address limits
  - resolves the email locale (stored, else the request's)
  - calls `sendVerificationOTP`
  - returns `{ ok }` or a reason (`limit_reached`, `email_quota`, `email_busy`, `email_failed`)
- [ ] 6.2 `verifyCode({ email, code })`: signs in or creates the account, sets `kotivalo_locale` from the user's `locale`, and maps the Better Auth errors to `code_wrong`, `code_expired` or `code_attempts_used`
- [ ] 6.3 `getSession()` and `signOut()`
- [ ] 6.4 Workers tests for each scenario in:
  - "Sign in with an emailed code"
  - "Rejecting wrong and expired codes" (expiry by moving the stored expiry)
  - "Limiting code requests"
  - "Telling the user when the code email cannot be sent" (with a failing sender)
  - "Staying signed in"
  - "The user's language is stored on the account"

## 7. Routes and UI

- [ ] 7.1 Add the `_authed` layout route with the session check and redirect, and move the home page under it; the home page shows the email and a sign-out button
- [ ] 7.2 Write `src/routes/sign-in.tsx` from `SignInEmail`: logo and tagline, language menu, email form, loading state, field error and alerts; redirect to `/` when signed in
- [ ] 7.3 Write the code step from `SignInCode`:
  - six boxes over one OTP input, submitting on the sixth digit
  - wrong-code error and expired / attempts alerts
  - the 30 s resend countdown, enabled at once after expiry
  - change address, spam hint
- [ ] 7.4 Write the test inbox server route (`/api/test/inbox?to=`), returning 404 unless capturing, with Workers tests for both scenarios
- [ ] 7.5 Component tests for "Requesting a new code" (fake timers) and the error states
- [ ] 7.6 Take screenshots of every canvas state at 390 × 844 and compare them with the canvas before the PR

## 8. End-to-end tests

- [ ] 8.1 Add a Playwright helper `signIn(page, email)` that reads the code from the test inbox, with a unique address and `x-test-client-ip` per test
- [ ] 8.2 Playwright tests named after the requirements:
  - sign in as a new and an existing user, case-insensitive address
  - wrong code
  - signed-in-only pages
  - sign out
  - language stored and used on another browser
  - choosing Swedish on the sign-in page
  - requesting a new code
- [ ] 8.3 Remove or update the existing home e2e test, which assumed `/` is public

## 9. Docs and checks

- [ ] 9.1 Update CLAUDE.md:
  - current state, with auth done
  - `auth` in the context, and the server-function-only rule (no `/api/auth` handler)
  - the test inbox
  - the limits
  - the new secret
- [ ] 9.2 Update README (the local sign-in code appears in the dev server log) and CONCEPT.md §6 (the sign-in screen is no longer missing)
- [ ] 9.3 Open a follow-up issue for passkeys after the domain move, noting that the `/api/auth` handler and client then need the limits too
- [ ] 9.4 Set the production `BETTER_AUTH_SECRET` before merging (the user runs it in their own terminal)
- [ ] 9.5 `pnpm check:traceability`, typecheck, lint, format, all Vitest projects and Playwright pass
