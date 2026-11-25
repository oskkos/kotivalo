# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Kotivalo ("Valoa vuokranantajan arkeen", roughly "light for a landlord's everyday work") is a mobile-first app for Finnish private landlords with 1–10 rental flats, often co-owned. It tracks flats, tenancies, income, expenses and receipts, and produces each owner's tax return figures (Finnish form 7H). MIT licensed.

`CONCEPT.md` is the source of truth for the product, the domain rules, the chosen stack and the data model draft. Read it before designing or changing features. The UI design (logo, splash and 13 phone screens, 390 × 844) is on the [Design canvas](https://claude.ai/artifact/DGX1pDjibhPqZjLUjm8jTb); read it with the Artifact tool, not WebFetch. Where the canvas and CONCEPT.md disagree, CONCEPT.md wins and the gap should be raised.

## Current state

The app is scaffolded (TanStack Start on Cloudflare Workers) with the flats list as the home page behind sign-in (add, edit and list flats; `features/properties/`, the first repository and the pattern for the next features; this month's rent summary across the flats and a rent status chip on each card, from `listRentThisMonth` and `rentThisMonth()` in `features/rent-payments/`), the flat details page as each flat's main page (`features/properties/FlatDetailsPage.tsx`, read in one server function `getFlatDetails`: owners, this month's rent card, months not fully paid, the tenancy card with its rent, charges, latest entries; the flats list card opens it, and the subpages return to it), sharing a flat by email invitation (`features/sharing/`), ownership shares as validity periods with roles that follow them (`features/ownership/`: changing, undoing and correcting ownership; period rules in `periods.ts`), charges as monthly validity periods (`features/recurring-amounts/`: the charge amounts page _Vastikkeet_ opened from the details page, setting and undoing amounts, several named financing charges per flat (`financing_charges`, each its own sequence of periods: adding, renaming, ending at 0 €, and removing one by undoing its only amount), the financing charge treatment, one per flat for all its charges; the charges page by year (_Vastikkeet kuukausittain_), `ChargesPage.tsx`, opened from the details page's charges card, with a year's charges month by month in `charges.ts`; monthly amounts and the capitalised total are computed from the periods in `periods.ts`, never stored), income and expense entries with receipts (`features/transactions/`: the Entries page opened from the details page, the entry form also opened from the bottom bar, details, editing and deleting; categories map to form 7H rows in `categories.ts`; receipt images are resized in the browser, stored in R2 with the save and served by `/api/receipts/$receiptId` after an access check; a storage quota per user in `server/files/quota.ts`), tenancies (`features/tenancies/`: the Tenancy page opened from a card on the details page, each tenancy's own rent as periods in `tenancy_rents` (the first from the tenancy's start day, changes from the first of a month; `rent.ts`), changed and undone from the rent card on the Tenancy page (`RentCard.tsx`, `TenancyRentForm.tsx`) and always asked for a new tenant, suggested from the previous tenancy, adding and correcting a tenant, an earlier tenancy added with its ending, removing a tenancy that hasn't started, ending and cancelling an ending, statuses on the flats list; notice periods by contract date in `notice.ts`, statuses in `status.ts`, the parts of an ending shared by the forms in `ending.tsx`; correcting, ending or removing a tenancy can't leave rent payments or rent changes outside it, and a corrected start moves the first rent period; each tenancy's occupants (`tenancy_occupants`, the occupants card and its change dialog on the Tenancy page) and tenant fees (`tenant_fees` and `tenant_fee_amounts`, _Maksut vuokran lisäksi_: the fees card, `TenantFeeForm.tsx` at `…/tenancy/$tenancyId/fees/new` and `/fees/$feeId`, a month's fee in `fees.ts`) are periods inside the tenancy, the new tenant form asks for the occupants and offers the previous tenancy's fees (`offeredFees`), and the three new period tables share one statement builder, `src/server/db/periods.ts`), usage charges (`features/usage-charges/`: the housing company's monthly charges for water, parking, sauna or other, fixed or per occupant, apart from the _Vastikkeet_: the usage charges page, its forms, the usage charges by month page and the _Käyttömaksut_ section on the details page; a month's and a year's amounts with the occupants of the tenancy running on the month's first day, or one while vacant, in `months.ts`, the form 7H row per kind in `rows.ts`; the forms warn about water charge entries from the start date, `entriesSince`), rent payments (`features/rent-payments/`: recorded per tenancy and month, several per month, deleted and recorded again rather than edited, owners only; a month's expected rent, the tenancy's own rent and its tenant fees, each by days in a partial month, with its breakdown (`parts`), and its status are computed in `status.ts`, never stored; the month's payments page with the breakdown and the rent payments page by year), the bottom navigation bar (`components/BottomNav.tsx`: Flats · New entry · Account, on the flats list and the account page only), a display name asked once after the first sign-in, an account page (`features/account/`: name, language, sign out; opened from the bottom bar), ESLint, Prettier, Vitest, Playwright, CI, commitlint, Git hooks, a D1 database with Drizzle, i18n with Paraglide (fi / sv / en; a language menu on the sign-in page and a language choice on the account page), the MUI theme, email sending (Resend), R2 file storage, a production deploy from `develop`, an installable app (PWA) with an offline page, and sign-in with an emailed one-time code (Better Auth; passkeys come later). Don't invent commands that aren't listed below; add them here as each tool lands, including how to run a single Vitest test and a single Playwright test.

## Commands

Package manager is **pnpm** (pinned in `package.json` via `packageManager`; enable with `corepack enable`). Node 24+.

- `pnpm dev`: dev server on http://localhost:3000, running server code in workerd through the Cloudflare Vite plugin
- `pnpm build`: production build into `dist/`
- `pnpm preview`: build, then serve the built Worker locally
- `pnpm typecheck`: `tsc --noEmit`
- `pnpm lint` / `pnpm lint:fix`: ESLint (typed rules, React, TanStack Router, import boundaries, no hard-coded UI text, translation keys in alphabetical order)
- `pnpm test`: all Vitest projects once; `pnpm test:watch` for watch mode
  - one file: `pnpm test src/router.test.ts`
  - one test by name: `pnpm test -t "registers the home route"`
  - one project: `pnpm test --project unit` (or `component`, `workers`)
- `pnpm test:e2e`: Playwright tests in `e2e/` (builds the app and serves it with `vite preview` on port 4173, or reuses a server already running there); `pnpm test:e2e:ui` for the UI mode
  - one file: `pnpm test:e2e e2e/home.spec.ts`
  - one test by name: `pnpm test:e2e -g "shows the app name"`
  - e2e helpers are in `e2e/support/`: `flats.ts` (`addFlat`, `flatId`), `transactions.ts` (`logEntry` through the form, `jpegPhoto` and `pdfReceipt` receipt files), `tenancies.ts` (`addTenant` through the form, 890 € when no rent is suggested, with `occupants` and `keepFees`, `aino` as a tenant, `changeRent` on the rent card, `setOccupants` on the occupants card, `addFee` and `openFee` on the fees card), `usage-charges.ts` (`addUsageCharge`, `openUsageCharges`, `openUsageCharge`), `amounts.ts` (`openAmounts`, `setAmount`, `setTreatment` on the charge amounts page), `rent-payments.ts` (`currentTenancyId`, `openRentMonth`, `recordPayment` through the dialog) and `sign-in.ts`: `signIn(page, email, name?)` signs in and gives a name to a new account; `waitForHydration(page)` before submitting a form on a freshly loaded page, or the browser submits it without the app
  - first time on a machine: `pnpm exec playwright install chromium`
- `pnpm check:traceability`: checks that every OpenSpec scenario in the main specs has a test and every requirement has a Playwright test or a recorded reason; active changes are reported as pending (see "Specs and tests")
- `pnpm terms:report`: how sure the term bank is of its translations: terms per status and language, then every term not yet verified (the list for a fluent speaker to check)
- `pnpm format` / `pnpm format:check`: Prettier (no semicolons, single quotes, trailing commas)
- `pnpm db:generate`: generate a SQL migration in `migrations/` from changes to `src/server/db/schema.ts` (drizzle-kit). Commit it; never edit an applied migration
- `pnpm db:migrate:local`: apply migrations to the local D1 database (`.wrangler/state`, shared with `pnpm dev`). Vitest Workers tests apply them to their own database automatically
- `pnpm i18n:compile`: compile `messages/*.json` into `src/paraglide/` (typed message functions). Runs on `pnpm install`, and `dev`, `build` and Vitest recompile on their own; run it by hand only if `tsc` or ESLint can't find `#/paraglide/*`
- `pnpm icons:generate`: redraw the app icons, favicon and email logo in `public/` from the logo mark and theme colours (Playwright's Chromium). Commit the output; run it only when the mark or colours change
- `pnpm cf-typegen`: regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` (bindings, compatibility date)
- `pnpm run deploy`: build for the `production` environment and deploy with Wrangler. CI does this after every push to `develop`; by hand it needs `wrangler login` or `CLOUDFLARE_API_TOKEN`
- `pnpm db:migrate:production`: apply migrations to the production D1 database (CI runs it before each deploy)

Generated files that are committed: `src/routeTree.gen.ts` (TanStack Router, regenerated by `dev` / `build`; don't edit), `worker-configuration.d.ts` (Wrangler types) and `migrations/` (drizzle-kit). `src/paraglide/` is generated but not committed.

`wrangler.jsonc` enables `nodejs_compat` because TanStack Start needs it. It is a partial polyfill, so the "Workers is not Node" rule below still applies.

## Stack (planned, per CONCEPT.md §5)

TanStack Start (React, SSR, server functions) · MUI · Paraglide JS (i18n) · Cloudflare Workers + D1 (via Drizzle) + R2 · Better Auth · Resend (email) · Vitest + Testing Library · `@cloudflare/vitest-plugin` (Miniflare) · Playwright.

Constraints that are easy to get wrong:

- **Workers is not Node.** Avoid Node-specific dependencies.
- **Free plans first.** Stay on Cloudflare's Workers Free plan and free tiers (D1, R2, Resend) at first. Raise it before choosing anything that needs Workers Paid.
- D1 and R2 are bindings (`env.DB`, etc.) that exist only while a request is being handled, so Better Auth is created **per request**.
- R2 files are private and are served only through the Worker, after an access check. D1 stores only the key and metadata.
  - The context's `storage` is a `FileStorage` (`src/server/files/storage.ts`, R2 in `platform/storage.server.ts`, binding `FILES`). Keys come from `newFileKey('receipts' | 'attachments')`, never from file names.
  - Check every upload with `checkUpload(bytes)` (`src/server/files/upload.ts`): JPEG, PNG, WebP or PDF, recognised by the first bytes, up to 10 MB. Images are redrawn in the browser before upload (resized, EXIF dropped); the Worker does not process them.
  - Request bodies over `MAX_REQUEST_BYTES` (the upload limit plus 64 KB) are refused with 413 in `src/server.ts` (`withBodyLimit`, `platform/body.server.ts`) before the app reads them, because a server function parses its FormData whole.
  - Serve a file with `fileResponse()` (`src/server/files/response.ts`) after the access check: it sets the type, a safe `Content-Disposition`, `no-store`, `nosniff` and a sandboxing CSP.
- Email goes through one function, `sendEmail(message)` from the request context, so the provider can be swapped:
  - Build the message with `renderEmail()` (`src/server/email/layout.ts`): the logo and tagline at the top, heading, paragraphs, codes (`{ code }`, shown large) and an optional button, as HTML and plain text, escaped. It needs the app's origin (`appUrl`, from the request) for the logo, `public/email/logo.png`, a PNG because email clients show neither SVG nor web fonts; `pnpm icons:generate` draws it. Feature templates pass their own Paraglide messages rendered with `{ locale }` for the recipient, not the current request's language.
  - Providers are in `platform/mailer.server.ts`, chosen by `EMAIL_TRANSPORT` in `wrangler.jsonc`: `capture` (default; keeps messages in memory and logs them, so local development, tests and CI never call Resend) or `resend` (HTTPS API; needs `EMAIL_FROM` on a verified domain and the `RESEND_API_KEY` secret, `.dev.vars` locally).
  - A failed send throws `EmailError` with `failure`: `quota` (Resend free plan: 100 a day, 3,000 a month; not retried), `rate_limited`, `rejected` or `unavailable`. Features decide what the user sees.
  - Workers tests read sent messages with `capturedEmails` from `platform/mailer.server.ts`.

### Cloudflare stays inside `src/server/platform/`

Switching hosts should mean rewriting `src/server/platform/` and the deploy config, not the domain logic, UI or tests.

- Only `src/server/platform/` may import `cloudflare:*`, read bindings and secrets (`env.DB`, R2, the Resend API key) or call D1/R2-specific APIs (`env.DB.prepare`, D1 `batch`, R2 object methods).
- It builds a **per-request context** (`db`, `storage`, `mailer`, `auth`) that the rest of the app receives; nothing else reaches for `env`.
- The rest of the app depends on portable interfaces: the Drizzle `db` instance, a `FileStorage` interface (`put` / `get` / `delete`), `sendEmail()`.
- D1's lack of interactive transactions is handled by one helper in `platform/`, `atomically(db, [statements])`, not by calling `batch` or `db.transaction()` from features. Build all statements first; there are no reads between the writes.
- **Signing in** goes through the context's `auth` (`Auth` in `src/server/auth/auth.ts`).
  - Better Auth implements it in `platform/auth.server.ts` and may be imported only there (ESLint).
  - Its HTTP handler (`/api/auth/*`) is not mounted. The server functions in `features/authentication/functions.ts` call `auth` and apply the limits: code requests 3 per minute per IP address and 5 per hour per email address (`CODE_REQUEST_LIMITS`).
  - Better Auth's own code email swallows send errors, so the server function creates the code with `createSignInCode()` and emails it itself.
  - Secret: `BETTER_AUTH_SECRET`. The top-level `vars` hold a public development value; production has its own Worker secret.
- **The test inbox** `GET /api/test/inbox?to=<address>` (`platform/test-inbox.server.ts`) returns the captured emails for an address, so Playwright can read sign-in codes. It responds 404 unless `EMAIL_TRANSPORT` is `capture`, and `src/wrangler-config.test.ts` checks that production uses `resend`. While capturing, an `x-test-client-ip` header sets the client IP for the limits, so each test gets its own.
- **Logging** goes through the context's `log` (`Logger` in `src/server/log/log.ts`; JSON lines through `platform/logger.server.ts`, which Workers Logs indexes field by field).
  - Event names are `<capability>.<what_happened>` in snake_case (`authentication.code_requested`), so a line maps to its spec.
  - Levels: `info` for what happened, `warn` for refused or unusual requests (limits), `error` for failures someone should look at. Every `error` line becomes a Cloudflare Workers Issue and so an alert, so don't use `error` for expected outcomes. Pass an error as the third argument of `log.error()`.
  - How to read the logs in production: README, "Production logs and errors".
  - **What every feature logs:** each data change at `info` once it succeeded (`property.created`, `tenancy.ended`), with ids, not values, and each failure at its level. Don't log reads, page views or session checks.
  - `LOG_LEVEL` in `wrangler.jsonc` drops lines below it: `debug` locally, `info` in production, because each line counts against the free plan's daily log events. Add `debug` lines only while investigating something.
  - **No personal data in logs:** no email addresses, codes, tokens, names or amounts. Log ids (the user id) or nothing.
  - ESLint forbids `console` in server code; the capture mailer's local email printout is the one exception.
  - Tests use `createCaptureLogger()` and assert on the lines.
  - **Every line of a request carries** `traceId`, `versionId` and `commit` (the deployed git commit, `wrangler deploy --tag`), and `userId` once the session is known. The `userId` is added by `auth.getSession()` and sign-in through `addLogContext()` (`platform/log-context.server.ts`, AsyncLocalStorage), so code never passes these fields itself.
- **Logging in the browser** uses `clientLog` from `src/lib/client-log.ts` (same event names and no-personal-data rule).
  - Errors are sent at once, other lines in batches, and the buffer is flushed with `sendBeacon` when the page is hidden.
  - Uncaught errors, unhandled rejections and render errors (the root route's `errorComponent`) are logged automatically.
  - A connection failure (the request never reached the server: offline, or cancelled by a reload) is not a bug: `clientLog.error` sends it as `warn` with `network: true`, so it raises no alert. `isNetworkError()` (`src/lib/network-error.ts`) recognises it; catch blocks show `failureReason(error)` (`network` or `unexpected`), not `unexpected` directly.
  - The Worker receives them at `POST /api/log` (`platform/client-log.server.ts`) and writes them with `source: "client"`, the page's trace id and the signed-in user's id, taken from the session and never from the request body.
  - The endpoint allows 30 requests a minute per IP address, 16 KB (read with a cap, not whole) and 20 events per request, well-formed event names only, and replaces anything that looks like an email address. The browser's own fields are written with a `client_` prefix, and the logger lets the version and the request's context (trace, user) win over any call's fields, so neither a browser nor a caller can forge them.
  - ESLint forbids `console` in all app code.
- **Tracing** (W3C trace context, `src/lib/trace.ts`):
  - The browser keeps one trace id per page load and sends it as `traceparent` with every server function call (`src/start.ts`, a global function middleware).
  - The server (`platform/request.server.ts`, wrapped around the app in `src/server.ts`) continues that trace or starts one, logs 5xx responses and uncaught errors, and returns the id as `x-trace-id`.
  - Resend emails are tagged `trace_id`, and `email.sent` logs Resend's email id.
  - Cloudflare's automatic tracing (D1, `fetch`) is on in `wrangler.jsonc` (`observability.traces`). Free plan: 200,000 log and trace events a day, kept 3 days.
- Abuse limits (requests per IP address, per email address, …) use `consumeLimit(db, key, { windowSeconds, max })` from `platform/limits.server.ts`: a counter per key in D1, because Worker isolates share no memory. Hash personal data such as email addresses before using them in a key.
- Server code gets the context from `getRequestContext()` (`platform/context.server.ts`), per request, never at module scope.
- **Installable app (PWA):** `public/manifest.webmanifest` and the icons, linked from `__root.tsx`, and the service worker `public/sw.js`, plain JavaScript served without a build and registered only in a build (`src/lib/service-worker.ts`).
  - The service worker caches only the build's hashed files (`/assets/*`) and the offline page (`/offline`, `src/server/pwa/offline-page.server.ts`, every language in one page, picked in the browser). It never caches pages, server function responses, `/api/*` or files, because they may hold a signed-in user's data. Keep it that way.
  - Offline data and sync are not built; the app needs a connection.
- Scheduled jobs (Cron Triggers): a thin `scheduled` handler in `platform/` that calls a pure function.
- Enforced by ESLint `no-restricted-imports` in `eslint.config.js`.

## Code structure

TanStack Start only fixes `src/routes/` (file-based routing). The rest is ours:

```
src/
  routes/                 # TanStack file routes; thin, call into features
  features/<capability>/  # one folder per capability, matching the OpenSpec spec
    <entity>.repository.server.ts   # data access (Drizzle)
    functions.ts                    # createServerFn endpoints used by the UI
    *.tsx                           # components for this capability
  server/platform/        # Cloudflare adapters and the per-request context
  server/email/           # sendEmail types and the email layout
  server/files/           # FileStorage, upload checks, file responses
  server/db/              # Drizzle schema (schema.ts) and column helpers (columns.ts)
  server/auth/            # the Auth interface (Better Auth is behind it in platform/)
  components/             # shared UI components, e.g. form/TextField.tsx
  lib/                    # pure helpers: formatting, domain calculations
```

- Files named `*.server.*` are server-only: TanStack Start's import protection keeps them out of the client bundle. Database and platform code uses this suffix.
- Domain calculations (shares, periods, notice, deposits, year summary) are pure functions in `lib/` or the feature folder, with no database access, so they can be unit-tested without fixtures.

### Signed-in pages

- Pages that need a signed-in user go under the pathless layout `src/routes/_authed.tsx`, e.g. `src/routes/_authed/flats.tsx`. Its `beforeLoad` checks the session with `getSignedInUser()` and redirects to `/sign-in`; the page reads the user with `Route.useRouteContext()`.
- A signed-in user without a display name is sent to `/welcome?redirect=<path>` from every page under `_authed` until they give one; the name is shown to the people they share flats with. `safeRedirect()` (`src/lib/redirect.ts`) keeps the return path inside the app.
- Server functions that change data check the session themselves (`getRequestContext().auth.getSession()`): the layout protects pages, not endpoints.
- Server functions accept same-origin calls only: `createCsrfMiddleware` in `src/start.ts` answers 403 to a call from another site (`Sec-Fetch-Site`, then `Origin`, then `Referer`). Server routes (`/api/*`) are not covered; each checks what it needs.

### Repositories

- All database access goes through repositories: `features/<capability>/<entity>.repository.server.ts`. Routes, server functions and components never import Drizzle.
- A repository is a factory function that takes `db` and returns its methods: `propertyRepository(db).findForUser(userId, on)`. No interface/implementation split (`PropertyRepository` + `DrizzlePropertyRepository`): tests run against local D1 in Miniflare, so there is nothing to mock.
- Repositories are aggregate-oriented, not one per table: a property is usually read together with its ownership periods and recurring amounts.
- Tables land with the OpenSpec change of the feature that needs them, with their migration and repository. Build columns with the helpers in `src/server/db/columns.ts`: `id()` (UUID text), `cents()`, `basisPoints()`, `isoDate()`, `validity()` (`valid_from` / `valid_to`), `instant()` (a point in time as epoch milliseconds, e.g. an expiry; not for calendar dates).
- `drizzle-orm` may be imported only in repositories, the schema (`server/db/`) and `server/platform/` (ESLint rule in `eslint.config.js`). Changing the ORM then touches only those files.
- No database-specific SQL (`sql` templates with SQLite functions such as `strftime` or JSON functions) outside a clearly named helper. Together with integer cents, ISO date strings and integer basis points, this keeps a later SQLite → PostgreSQL move to rewriting the schema and regenerating migrations.

### Tests

Vitest projects are chosen by file name (`vitest.config.ts`):

| File               | Project     | Runs in                                                        |
| ------------------ | ----------- | -------------------------------------------------------------- |
| `*.test.ts`        | `unit`      | Node. Pure functions: domain calculations, formatting          |
| `*.test.tsx`       | `component` | jsdom, with Testing Library and jest-dom matchers              |
| `*.server.test.ts` | `workers`   | workerd via Miniflare, with the bindings from `wrangler.jsonc` |

- Tests sit next to the code they test, also in `src/routes/`: `vite.config.ts` sets `routeFileIgnorePattern` so TanStack Router ignores `*.test.*` files.
- Workers tests import the modules they test directly; the app's real entry only exists after a build, so the pool uses `src/test/worker-entry.ts`. Tests may import `cloudflare:test` and `env` from `cloudflare:workers`; app code may not.
- `@tanstack/react-start/server` works only in a build, so the Workers project aliases it to `src/test/tanstack-start-server.ts`: set the current request with `setTestRequest()` and read cookies with `testCookies()`.
- Workers tests run against a local D1 with every migration in `migrations/` applied (`src/test/apply-migrations.server.ts`). Repository tests use it as is: there is nothing to mock.
- Test files are exempt from the no-hard-coded-text rule.
- Playwright tests live in `e2e/*.spec.ts` and run against the built Worker (`vite preview`, local bindings from `wrangler.jsonc`). The only project is `mobile`: Chromium at 390 × 844, the size the UI is designed for.

## UI and theme

- MUI with Emotion. The theme is in `src/theme/theme.ts`, built from the design canvas; `src/theme/tokens.ts` holds the colors, radii and shadows. Style components through the theme (palette, typography variants, `components` overrides); reach for a token only where the theme has no slot. No hard-coded hex values in components.
- Palette: `primary` plum, `secondary` lavender, `accent` yellow (custom; `color="accent"` on Button, Fab and Chip), `background.default` cream. Typography: Nunito Variable, weights 700 (body), 800 (labels, buttons), 900 (headings, amounts).
- Text contrast at least 4.5:1 and touch targets at least 44 px (`TOUCH_TARGET`); `src/theme/theme.test.ts` checks the color pairs. Add a pair there when a new text color or surface comes in.
- `__root.tsx` picks the theme for the request's language with `themeFor(getLocale())`, so MUI's own component text is localised (`fiFI`, `svSE`, `enUS`). Date pickers (`@mui/x-date-pickers`) are not installed yet; when the first date input needs one, localise it the same way.
- Nunito is self-hosted from `@fontsource-variable/nunito` (no Google Fonts request).

## Forms and validation

- **Zod schemas** live in the feature (`features/<capability>/schemas.ts`). The form and the server function's `inputValidator` use the same schema.
- **Errors are reason codes, not text:** `z.email({ error: 'email_invalid' })`. Zod's default English messages never reach the UI.
  - Codes are listed in `src/lib/reasons.ts`:
    - `FieldReason`: shown under the field
    - `AlertReason`: shown as an `Alert` with a title
  - `reasonText(reason)` turns a code into Paraglide messages (`reason_<code>`, plus `reason_<code>_title` for alerts).
  - Add a code there and its messages in every language; `messages.test.ts` checks them.
- **Server functions** return `{ ok: true, … } | { ok: false, reason }` for expected failures and throw only on bugs.
- **Forms use TanStack Form.**
  - Bind text inputs with `TextField` from `src/components/form/TextField.tsx`. It shows the field's reason under it once the user has left the field or submitted, sets `aria-invalid` and the description, and disables the field while the form submits.
  - Bind a choice among a few options (room count, contract type) with `ChoiceField` from `src/components/form/ChoiceField.tsx`: toggle buttons with `aria-pressed`, the reason under the group after submitting.
  - Pass a server's field-level reason as `reason`.
  - Numbers people type go through `parseDecimal(text, decimals)` (`src/lib/decimal.ts`; `48,5` and `48.5`) in the schema, and are stored scaled to integers (`tenths()`, `cents()`).

## Domain glossary

The term bank `i18n/terms.json` is the glossary: one entry per domain term, with the Finnish, Swedish and English words, the name used in code, the database and tests (`code`, with `codeNotes` on tables, columns and units) and a definition. Read it before naming domain code or writing messages.

- Code names stay English and follow `code` (`property`, `tenancy`, `share`, `recurringAmount`, `transaction`, …). The English UI copy may use a friendlier word; the bank's `en.term` decides it (`property` is a "flat" in the UI).
- `transaction` means an income or expense entry, not a database transaction.
- Messages follow the bank: when a Finnish message uses a term, the Swedish and English ones use that term's translation, and no message uses a word in a term's `avoid` list. Each term's `match` patterns recognise it in all its inflections; a message that may leave the term out is listed in the language's `except` with the reason. `scripts/terms/usage.test.ts` checks this in `pnpm test`.
- Each language's term has a `status` that says how sure we are, from the sources behind it: `proposed` (no source yet), `derived`, `verified` (an authoritative source, listed in `i18n/sources.json`) or `reviewed` (accepted by a fluent speaker). Tests in `scripts/terms/` check the rules.
- Translate messages and add or change terms with the `translate` skill (`.claude/skills/translate/`). It researches each word in the sources and records them, and every term bank change ends with a review by the `term-critic` agent (`.claude/agents/term-critic.md`), which gets only the diff. A hook in `.claude/settings.json` reminds about the review when `i18n/terms.json` is edited with Edit or Write; edits made otherwise get no reminder.

## Domain rules that shape the code

- **Everything is time-bound.** Rent, charges, financing-charge treatment, ownership shares and tenancies are validity periods (`valid_from` / `valid_to`). Never overwrite them.
- Money is stored as **integer cents**. Dates are ISO `YYYY-MM-DD`. Ownership shares are integers in basis points (5000 = 50.00 %) and add up to exactly 10000. A 0 % share means visibility only.
- Access and ownership are **per flat**. There is no household concept. Former owners keep read access to their own ownership period.
- The year summary is **computed from transactions and periods**, never stored. The calculations (shares, mid-year changes, income-recognised vs. capitalised financing charge, notice periods, deposit returns) should be pure functions with Vitest coverage.
- Ending a tenancy and adding a new tenant are separate actions.

## i18n

- Finnish (primary), Swedish and English from day one. Write the Finnish copy first, with the words from the term bank (`i18n/terms.json`, see "Domain glossary"). Translations live in `messages/fi.json`, `sv.json` and `en.json` (Paraglide; project in `project.inlang/`, compiler options in `project.inlang/paraglide.config.ts`). Keys are in alphabetical order (ESLint `jsonc/sort-keys`; `pnpm lint:fix` and the pre-commit hook sort them). Use them as `m.key()` from `#/paraglide/messages.js`; message keys are static (ESLint `paraglide/no-dynamic-message-access`). Paraglide silently falls back to Finnish for a message missing in another language, so `src/messages.test.ts` checks that every language has the same keys and variables and no empty messages.
- **No hard-coded text**: all UI copy, errors and emails come from messages, in the recipient's language. ESLint flags JSX text, string literals in JSX and user-facing attributes (`title`, `aria-label`, `alt`, `placeholder`, …) in `.tsx` files. Strings that are never translated (the brand name) go in `UNTRANSLATED` in `eslint.config.js`.
- **Language resolution**: the server entry `src/server.ts` wraps TanStack Start in Paraglide's middleware, so `getLocale()` and messages follow the request during SSR. Before sign-in the language comes from the `kotivalo_locale` cookie, then the browser language, then Finnish. Signed-in users get the language stored on their account (`user.locale`): signing in sets the cookie to it, and the signed-in layout puts it back if it drifts and reloads the page (a redirect during SSR), so the page never renders in one language on the server and another in the browser. The stored language changes only by the user's choice: on the account page (`setAccountLanguage`, then a full reload, not Paraglide's `setLocale()`, which sees the new cookie and skips the reload), or from the sign-in page's menu, which remembers the choice for the tab (`src/lib/chosen-locale.ts`, `sessionStorage`) and sends it with the sign-in; the cookie alone never changes an account's language. The language is not part of the URL.
- **Formatting** uses each language as used in Finland: `fi-FI`, `sv-FI`, `en-FI` (`1 234,56 €` and `5.3.2026` in Finnish and Swedish, `€1,234.56` and `05/03/2026` in English). Format amounts, dates and floor areas with `formatMoney(cents)`, `formatDate(iso)` and `formatArea(tenths)` in `src/lib/format.ts`, also when they appear inside a message: pass the formatted string as a parameter. Don't use Paraglide's `number` or `datetime` formatters in messages, because they format with the bare language (`sv` gives Swedish ISO dates, `en` gives US dates). `plural` in messages is fine.

## Specs and tests (OpenSpec)

- Requirements live in OpenSpec, one spec per capability. Changes are made as OpenSpec change proposals, and specs are updated in the same change as the code.
- **Every scenario needs a passing test. Every requirement needs a Playwright test**, unless it can't be tested in a browser. Then Vitest covers it, and the reason is recorded with the requirement.
- Test names trace to the spec: `test.describe('<Requirement>')` with one `test('<Scenario>')` per scenario. Use the same naming in Vitest. CI blocks merges when this mapping is incomplete.
- A requirement that can't be tested in a browser records the reason on its own line in the requirement text: `**No Playwright test:** <reason>`. Its scenarios still need Vitest tests.
- `pnpm check:traceability` (`scripts/check-traceability.ts`) enforces this. It lists tests with `vitest list` and `playwright test --list` without running them. Skipped and todo tests don't count. The scenario test can be in Vitest or Playwright, nested describes are fine, and tests without a spec counterpart (harness and smoke tests) are allowed.
  - The main specs (`openspec/specs/`) block.
  - Active changes in `openspec/changes/` are checked with their delta specs applied, but their gaps are only reported as pending.
  - A main-spec scenario that an active change removes or renames doesn't block, so its test can go in the implementation commit that changes the behaviour.
  - A change whose `tasks.md` is fully checked but not archived blocks.
- **One PR per change, in this commit order:**
  1. The proposal, alone, once the user has reviewed it: `docs(openspec): propose <change>`.
  2. The implementation commits.
  3. `openspec archive <change>` as the last commit (`docs(openspec): archive <change>`). This moves the specs into `openspec/specs/`, where the check blocks.

  Every commit passes CI on its own.

- **Commits within a change:**
  - Each `## N.` group in `tasks.md` is one commit, so the commit plan is reviewed with the proposal.
  - Every commit passes all CI checks on its own, and everything it adds is tested in that commit.
  - Order:
    1. schema and migration
    2. platform and server code
    3. shared patterns (components, helpers)
    4. server functions with Workers tests
    5. UI with Playwright tests
    6. turning the behaviour on (protected routes, navigation)
    7. the archive commit

    Nothing that already works breaks between commits: a change that would break an existing test lands together with or after what replaces it.

  - A dependency lands in the commit that first uses it. Docs (CLAUDE.md, README) change in the commit that changes what they describe.
  - Size: one commit is reviewable in one sitting, roughly under 500 changed lines, not counting migrations, lockfiles or generated files. Split a bigger group.
  - Workflow: `/opsx:apply` runs on its own to the end: commit each group and push it to the change's draft PR without asking, and don't wait for CI between commits. CI has to be green after the last push.
  - **Run tests targeted, the full suites once.** With each commit run only what it touches: `pnpm lint`, `pnpm typecheck`, the Vitest files of the changed code (`pnpm test <path>`), the Playwright specs of the changed pages (`pnpm test:e2e e2e/<file>.spec.ts`), and `pnpm check:traceability` when the commit adds, removes or renames tests or changes specs. Run the whole `pnpm test` and `pnpm test:e2e` once, after the last implementation group and before the review, and again only if a later fix touches shared code. Don't rerun a suite that already passed on the same code.
  - **Review before the archive:** once the last implementation group is pushed, run the `pr-review` skill (`.claude/skills/pr-review/`). It has the `pr-reviewer` agent review the PR without knowing the implementer's reasoning, the `pr-fixer` agent check and fix the findings as `fix(...)` commits, and one re-review of the fixes. Questions and spec decisions go to the user. Then archive.
- **Never start implementing after `/opsx:propose`.** Stop once the spec artifacts are written, and tell the user to run `/clear` before `/opsx:apply`, so the implementation starts from the artifacts in a fresh context.
- **Before implementing a change** (`/opsx:apply`), check `git status`. If the change's artifacts (`openspec/changes/<change>/`) are not committed yet, commit them first as the proposal commit, after the user has reviewed them, so the implementation starts from the agreed version.
- Requirement names must be unique across all specs, because tests are matched by name. Avoid `>` in requirement and scenario names: Vitest joins titles with it.
- `openspec/config.yaml` gives OpenSpec a short project context and per-artifact rules (proposal, specs, design, tasks). It summarises this file and CONCEPT.md, so update it when the rules here change.

## Git and CI

- `develop` is the main branch and the PR target. The `protect-develop` ruleset allows changes only through PRs, rebase merges only.
- Commit messages follow Conventional Commits (`commitlint.config.js`). Rebase merges land every commit as-is, so each commit in a PR must pass, not just the PR title.
- Git hooks (Lefthook, `lefthook.yml`) are installed by `pnpm install` through the `prepare` script:
  - `commit-msg`: commitlint
  - `pre-commit`: ESLint `--fix` and Prettier on staged files only (about 3 s, mostly typed ESLint startup)
  - `pre-push`: `pnpm typecheck` and the Vitest `unit` project
  - `--no-verify` skips them; CI stays the authority. Under WSL, hooks run only with the Linux-side Git and Node: a Windows-side Git client (Git for Windows, an IDE using it) can't run them and either skips or fails.
- CI (`.github/workflows/ci.yml`) runs on every PR to `develop` and on pushes to it. Jobs: `commitlint` (every commit in the PR; PRs only), `lint` (ESLint and Prettier), `typecheck`, `test` (all Vitest projects), `traceability` (spec-to-test check) and `e2e` (Playwright). All six are required status checks, and the branch must be up to date with `develop` before merging. Renaming a job means updating the ruleset.
- Shared job setup (pnpm, Node, install) is in `.github/actions/setup`. Actions are pinned to commit SHAs with the version in a comment.
- When e2e fails, the Playwright report and traces are uploaded as the `playwright-report` artifact.
- **Deploy**: the `deploy` job runs after every push to `develop` once all checks pass: `pnpm db:migrate:production`, then `pnpm run deploy`. One deploy runs at a time. It uses the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` and the GitHub environment `production`.
- **Environments** (`wrangler.jsonc`): the top level is local development and tests; `env.production` is the deployed Worker `kotivalo`, with its own D1 database and R2 bucket in the EU jurisdiction. An environment inherits no bindings or vars, so a new binding goes in both places. Production secrets are set with `wrangler secret put <NAME> --env production`.
- **Migrations run before the new code is live**, so a migration must keep the previous version working: add columns and tables, and rename or drop only in a later deploy.
