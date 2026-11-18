## Why

Every feature after M0 (flats, access, entries, the year summary) needs to know who the user is, and access is per flat and per user. Kotivalo has no users yet. This change adds accounts and sign-in, so features have a signed-in user and the language stored on the user record (CONCEPT.md §5).

## What Changes

- Better Auth with the Drizzle adapter on our own D1 database. It is created per request in `src/server/platform/`, because the D1 binding exists only while a request is handled. The request context gains `auth`.
- **Sign-in with a one-time code by email** (Better Auth `emailOTP`). The user enters their email address and receives a 6-digit code, which they type in the same tab. Signing in with a new address creates the account, so there is no separate sign-up. There is no magic link: on phones a link often opens in another browser or the mail app's in-app browser, and the session then lands in the wrong place.
  - The code email uses `renderEmail()` in the recipient's language and goes through the context's `sendEmail()`.
- **Abuse limits** on code requests, because each request sends an email and Resend's free plan allows 100 a day:
  - per IP address
  - per email address
  - wrong-code attempts per code
  - When sending fails (`EmailError` `quota`, `rate_limited`, …), the user sees a message saying what happened and what to do.
- **Sessions:** an http-only session cookie through TanStack Start (`tanstackStartCookies`). Signing out ends the session.
- **Language on the user record:** a new account takes the language the request resolved to. At sign-in, the `kotivalo_locale` cookie is set from the user record, so the signed-in app uses the user's language on any device.
- **Language choice before sign-in:** the sign-in page has a language menu (Suomi, Svenska, English), as on the Design canvas. It sets the `kotivalo_locale` cookie, so a new account gets the chosen language.
- **Signed-in routes:** the home page requires a signed-in user and redirects to `/sign-in` otherwise.
  - The home page is still a placeholder, now with the user's email and a sign-out button.
- **Test inbox for end-to-end tests:** a route that returns captured emails. It exists only when `EMAIL_TRANSPORT` is `capture`, so Playwright can read the sign-in code. A test checks that production does not use `capture`.
- **The first real migration:** the Better Auth tables. It also proves the migration flow end to end: local D1, Vitest Workers tests, CI and the production deploy.
- **Not in this change:**
  - Passkeys get their own issue once Kotivalo has its final domain, because a passkey is bound to the domain it was registered on.
  - Google and Apple sign-in.
  - A language switcher inside the signed-in app; the sign-in page's menu is the only one for now.
  - Account deletion and a change-email flow.

## Capabilities

### New Capabilities

- `authentication`: signing in with an emailed one-time code (which also creates the account), limits on code requests and attempts, sessions and signing out, signed-in-only pages, and the user's stored language.

### Modified Capabilities

None. There are no specs yet.

## Impact

- **New tables** (Better Auth's models, in `src/server/db/schema.ts`, with a generated migration):
  - `user`: with `locale`
  - `session`
  - `account`: required by Better Auth for linked sign-in methods (passwords, social providers); unused by email codes for now
  - `verification`: one-time codes, stored hashed
  - `rate_limit`: Better Auth's rate-limit counters, kept in D1 because Worker isolates don't share memory
- **UI screens:**
  - `/sign-in`, with an email step and a code step, as drawn on the Design canvas:
    - email step: `SignInEmail` and its states `SignInEmailLoading`, `SignInEmailInvalid`, `SignInEmailLimit`
    - code step: `SignInCode` and its states `SignInCodeWrong`, `SignInCodeExpired`
    - error texts: `SignInErrors`
    - the code email: `SignInCodeEmail`
  - The home placeholder gains the user's email and sign-out.
- **Code:**
  - `src/server/platform/auth.server.ts` (new): the per-request Better Auth instance.
  - `context.server.ts`: adds `auth`.
  - `src/features/authentication/`: the sign-in email template, server functions and components.
  - `src/routes/api/auth/$.ts`: Better Auth's handler.
  - `src/routes/sign-in.tsx`.
  - The capture-only test inbox route.
  - Messages in `messages/{fi,sv,en}.json`.
- **Config:**
  - New secret `BETTER_AUTH_SECRET`: a Worker secret in production, a development value for local use and tests.
  - Better Auth reads the client IP from `cf-connecting-ip`.
- **Dependencies:** `better-auth` (1.7.x), `zod` (4.x) and `@tanstack/react-form` (1.x). Zod and TanStack Form set the validation and form pattern for later features: schemas return reason codes, and Paraglide turns them into text.
- **Docs:** CLAUDE.md (current state, auth in the context, the test inbox) and `.dev.vars.example`.
- **Follow-ups:** a passkeys issue for after the domain move.
