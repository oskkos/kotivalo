## Context

Kotivalo has no users. M0 built the pieces auth needs:

- D1 with Drizzle and no tables yet (#8).
- Paraglide language resolution in `src/server.ts` (#10).
- `sendEmail()` with Resend in production and `capture` everywhere else (#12).
- A production deploy that migrates before the code goes live (#14).

Better Auth is the chosen library (CONCEPT.md §5). D1 bindings exist only during a request, so Better Auth cannot be a module-level singleton. Requirements are in `specs/authentication/spec.md`.

The app is on `kotivalo.o-kosonen.workers.dev` until it has its own domain. That is why passkeys wait (proposal).

## Goals / Non-Goals

**Goals:**
- Sign in with an emailed 6-digit code, with abuse limits that protect Resend's free quota (100 emails a day).
- Make users and sessions available to every later feature through the request context.
- Store each user's language on their record.
- Set the form and validation pattern for the app: TanStack Form, Zod and errors localised with Paraglide.
- Run the first real migration through local D1, the Workers tests, CI and production.

**Non-Goals:**
- Passkeys, Google or Apple sign-in, magic links.
- A language switcher, account deletion, a change-email flow.
- Roles or per-flat access. Those come with the flats feature.

## Decisions

### 1. Better Auth created per request in `platform/`, used only through server functions
`src/server/platform/auth.server.ts` exports `createAuth({ db, sendEmail, secret, baseURL })`. `getRequestContext()` adds `auth`. The instance uses:
- the Drizzle adapter (`provider: 'sqlite'`) with our schema
- `emailOTP`
- `tanstackStartCookies()`

The app calls `auth.api.*` from TanStack Start server functions in `src/features/authentication/functions.ts`. **Better Auth's HTTP handler (`/api/auth/*`) is not mounted.**

- *Why not mounting it:* every Better Auth endpoint would be reachable directly, including `/email-otp/send-verification-otp`. That would bypass our per-address limit (decision 4) and our error handling. Server functions give one validated entry point per action.
- *Alternative:* mount the handler and use `better-auth/react`'s client. This is rejected for now. Passkeys will need the client and the handler, and then the limits must cover the handler too. That is noted for the passkeys issue.
- `baseURL` is the request's origin. That is enough while no endpoint is served over HTTP, and it works unchanged on localhost, preview and `workers.dev`.
- `secret` comes from `BETTER_AUTH_SECRET`:
  - top-level `vars`: a clearly marked development value for local runs and tests
  - production: a Worker secret (`wrangler secret put`), because `env.production` inherits no vars

### 2. Email codes with `emailOTP`
- **Code:** 6 digits, valid 10 minutes (`expiresIn: 600`), 5 attempts (`allowedAttempts: 5`).
- **Storage and reissue:** codes are stored hashed (`storeOTP: 'hashed'`). A new request replaces the old code (`resendStrategy: 'rotate'`). Sign-up stays enabled, so signing in with a new address creates the account.
- **Sending:** `sendVerificationOTP` renders the email with `renderEmail()` and **awaits** `sendEmail()`.
  - Better Auth recommends not awaiting, to hide whether an account exists. Here every address gets a code whether or not it has an account, so timing reveals nothing.
  - Awaiting lets an `EmailError` reach the server function, which maps it to a reason (decision 6).
  - If Better Auth swallows errors thrown in `sendVerificationOTP`, the fallback is to remember the failure in a per-request variable and check it after the call. Verify this first (tasks 3.x).
- **Email language:** the stored `locale` for an existing user, otherwise `getLocale()` of the request.
- **Email layout:** `renderEmail()` gets an optional `code` that it shows large and easy to copy in HTML, and on its own line in the text part.
- **Address normalisation:** the Zod schema trims and lowercases the address before Better Auth sees it.

### 3. Schema: Better Auth's models in our Drizzle schema
- **Tables:** `user`, `session`, `account` and `verification` go in `src/server/db/schema.ts`, with snake_case columns and camelCase fields. Better Auth's field names stay the same, so the adapter maps them without renames.
  - IDs use `id()` (UUID). Better Auth is set to `advanced.database.generateId: 'uuid'` so both sides agree.
- **Timestamps:** Better Auth's timestamps (`createdAt`, `expiresAt`, …) are instants, not calendar dates. They are stored by a new column helper, `instant(name)`, as integer epoch milliseconds (`integer(name, { mode: 'timestamp_ms' })`). This keeps the "integer and text columns only" portability rule.
- **`user.locale`:** text, not null, one of `fi` | `sv` | `en`. It is declared in Better Auth's `user.additionalFields` with `input: false`, so clients can't set it. A `databaseHooks.user.create.before` hook fills it from `getLocale()`.
- **`rate_limit`** (decision 4): `key` text primary key, `count` integer, `window_start` instant.
- `pnpm db:generate` creates the migration. Migrations only add tables, so the deploy order (migrate, then code) is safe.

### 4. Limits on code requests: our own D1 counter, not Better Auth's
Better Auth's rate limiter runs only on its HTTP handler, which isn't mounted, and it keys by IP address only. The spec needs both an IP limit and an address limit.

**Helper:** `consumeLimit(db, key, { window, max })` in `platform/limits.server.ts` does a single-statement upsert on `rate_limit`. If the window has passed, it resets to 1; otherwise it adds 1. It returns the new count, and the request is allowed when the count is at most `max`.
- One statement keeps it atomic without interactive transactions.
- `INSERT … ON CONFLICT … DO UPDATE … RETURNING` works in SQLite and PostgreSQL, so it stays a named helper as CLAUDE.md requires.

**Keys:**
- `otp-ip:<ip>`: 3 per 60 s.
- `otp-email:<sha-256 of the address>`: 5 per 3600 s. It is hashed so the table holds no addresses.
- Both keys are consumed before the email is sent. A refused request sends nothing.

**Client IP:**
- In production it comes from `cf-connecting-ip`, set by Cloudflare.
- Locally and in tests, when `EMAIL_TRANSPORT` is `capture`, an `x-test-client-ip` header may override it, so each Playwright test gets its own IP key. The same transport check guards the test inbox, and a test asserts that production is `resend`.
- Without either header the key is `unknown`.

**Wrong-code attempts** are limited by `emailOTP` itself (`allowedAttempts`).

**Retention:** the limit keys are left in the table; at most one row per IP or address. Cleaning them up with a Cron Trigger can come later if the table grows.

### 5. Sessions and signed-in routes
- **Lifetime:** `session.expiresIn` is 30 days and `updateAge` is 1 day. A landlord opens the app now and then, so a short session would mean an email code most times.
- **Cookie cache:** `session.cookieCache` (5 minutes) keeps most page loads from reading D1. The cached data includes the user's `locale`.
- **Routes:**
  - A pathless layout route `src/routes/_authed.tsx` runs a `getSession` server function in `beforeLoad` and redirects to `/sign-in` without a session.
  - The home page moves under it, to `src/routes/_authed/index.tsx`.
  - `src/routes/sign-in.tsx` redirects to `/` when a session exists.
- **Sign-out:** `auth.api.signOut` deletes the session row, then the page navigates to `/sign-in`.

### 6. Validation and forms: Zod, TanStack Form and reason codes
- **Libraries:** `zod` (4.x, already in the tree through Better Auth) and `@tanstack/react-form`, both pinned exactly.
- **Schemas** live in the feature (`features/authentication/schemas.ts`) and are shared by the form and the server function's `inputValidator`.
  - Their errors are **reason codes**, not text, e.g. `z.email({ error: 'email_invalid' })`. Zod's default English messages never reach the UI.
- **Server function results:** server functions return `{ ok: true, … } | { ok: false, reason }` for expected failures, e.g. `code_wrong`, `code_expired`, `code_attempts_used`, `limit_reached`, `email_quota`, `email_busy` and `email_failed`. They throw only on bugs.
  - `EmailError.failure` maps to `email_quota`, `email_busy` and `email_failed`.
  - Better Auth's error codes map to the `code_*` reasons.
- **Translation:** `src/lib/reasons.ts` holds a `Reason` union and a static `reasonMessage(reason)` that maps each reason to a Paraglide message (`m.reason_email_invalid()`, …). Keys are static, so ESLint's `no-dynamic-message-access` holds, and `messages.test.ts` guarantees every language has them.
- **Form fields:** `src/components/form/TextField.tsx` connects a TanStack Form field to MUI's `TextField`. It shows `reasonMessage()` for the field's error, sets `aria-invalid` and disables the field while the form submits.
  - Form-level reasons from the server show in an `Alert` above the button.
- **Code input:** the code field is a single `inputMode="numeric"`, `autoComplete="one-time-code"` input, so iOS and Android can fill the code from the email. It submits automatically when the sixth digit is entered.

### 7. The user's language
At sign-in, the `verifyCode` server function sets the `kotivalo_locale` cookie to the user's stored `locale`. The existing `cookie` strategy then serves the signed-in app in that language on any device. The `_authed` layout resets the cookie if it ever differs from the session's `locale`.

- *Alternative:* a Paraglide custom server strategy (`custom-user`) that reads the session in `src/server.ts` on every request. This is rejected for now. It adds a session lookup to every request, including assets and sign-in, to cover only a cookie removed while the session lives. In that case the next authed navigation restores the cookie. This deviates from the wording of #13; revisit it when a language switcher lands.

### 8. Test inbox
- **Route:** `src/routes/api/test/inbox.ts` is a server route. With `?to=<address>` it returns that address's captured emails (subject, text) as JSON, newest last.
- **Guard:** when `EMAIL_TRANSPORT` is not `capture`, it responds 404. The check is in `platform/mailer.server.ts` (`isCapturing(env)`), so the route never reads `env`.
- **Playwright:** a helper `signIn(page, email)` reads the code from the inbox. Each test uses a unique address and a unique `x-test-client-ip`.
- **Production guard:** a unit test parses `wrangler.jsonc` and asserts that `env.production.vars.EMAIL_TRANSPORT` is `resend`.

### 9. Sign-in screen, from the Design canvas
`/sign-in` is one route with two steps, as drawn on the Design canvas:
- the email step (`SignInEmail`) and the code step (`SignInCode`), with their state boards
- the error table (`SignInErrors`)
- the code email (`SignInCodeEmail`)

The canvas copy is the Finnish source for the messages.

- **Errors:**
  - A field's own error (invalid address, wrong code) shows under the field with an icon. The field gets `aria-invalid` and `aria-describedby`.
  - Service errors (limits, quota, sending, expired code, attempts used) show as an `Alert` with `role="alert"` above the button.
- **New colours:** the canvas adds an error red (`#B42318`) and an alert surface (`#FBE9E7`, border `#E7B4AE`). They become `palette.error` and tokens, with contrast pairs added to `theme.test.ts`.
- **Code field:** six boxes drawn over one transparent `inputMode="numeric"` input (decision 6), so autofill and paste work.
  - "Kirjaudu" stays disabled until six digits are in, and the form submits on the sixth.
- **Resend:** "Lähetä uusi koodi" waits 30 s after a send, with a countdown. When the code has expired or its attempts are used up, it is enabled at once and highlighted.
  - The countdown is a client timer. The server's limits (decision 4) still apply, so a page reload doesn't bypass anything that matters.
- **Language menu:** the email step's header has a language menu (Suomi / Svenska / English). It calls Paraglide's `setLocale()`, which sets the `kotivalo_locale` cookie and reloads in that language.
  - This is the only language control until a switcher lands in the signed-in app.
- **Decoration:** the decorative sun-and-roof mark in the corner is hidden while the keyboard is open, as drawn. In the app it is `aria-hidden` and simply sits behind the content.
- **Code email:** `SignInCodeEmail` shows the code in its subject (`482913 on Kotivalo-kirjautumiskoodisi`), so it shows in notifications. The body has the code in a large monospaced box, the 10-minute validity and an "ignore if you didn't ask" line.
  - `renderEmail()` gains the `code` block (decision 2).

## Risks / Trade-offs

- [`sendVerificationOTP` errors may be caught inside Better Auth] → Verify first. Fallback in decision 2.
- [D1 adapter differences, e.g. Date handling, `returning`] → Workers tests exercise sign-in end to end against Miniflare D1 before the UI is built.
- [Rate-limit rows grow with distinct IPs and addresses] → One small row each. Add a Cron Trigger cleanup if it ever matters.
- [The `x-test-client-ip` override is a bypass if `capture` were ever enabled in production] → The production config test, and `capture` sends no real email, so nothing in production would work anyway.
- [Bundle size: Zod and TanStack Form in the client] → Check the client bundle after the sign-in route lands. Switch the client to `zod/mini` if Zod dominates.
- [Better Auth version churn (1.x minor releases are frequent)] → Pin the exact version. Upgrades are deliberate PRs.
- [The cookie-cached session may be up to 5 minutes stale after sign-out on another device] → Acceptable. Sign-out on the same device clears the cookie.

## Migration Plan

1. Before merging, set the production secret in your own terminal: `openssl rand -base64 32 | pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production`.
2. Merge. CI applies the migration (new tables only), then deploys.
3. Check `/sign-in` on `workers.dev` with a real address. This is the first real Resend send from the Worker.

Rollback: redeploy the previous version. The new tables are unused by it and can stay.

## Open Questions

- Swedish and English copy for the canvas texts, translated from the Finnish.
