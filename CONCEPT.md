# Kotivalo – concept and technical choices

> **Valoa vuokranantajan arkeen.** _(Light for a landlord's everyday life.)_
> Concept draft · November 2026

## 1. What Kotivalo is

Kotivalo is a mobile app for private landlords with one or more rental flats. It replaces piles of receipts and spreadsheets: flats, tenants, income, expenses and receipts live in one place, and at year end the figures for the tax return (Finnish form 7H) are ready per owner.

**Target group:** individuals and couples with 1–10 investment flats, often co-owned.

**Languages: Finnish, Swedish and English from day one.** Finnish is the primary language: the app is built for the Finnish rental market and Finnish taxation, and copy is written in Finnish first. Swedish (as used in Finland) and English ship with the first release. Tax terms (e.g. form 7H, rahoitusvastike) also show the original Finnish term, because the Tax Administration's forms and guidance use them.

**Core promise:**

- All flats and tenancies at a glance
- Log income or an expense in seconds, with the receipt attached as a photo
- See how net income develops, monthly and yearly
- Tax return figures ready for **your own share**

## 2. Name and brand

|          |                                                                  |
| -------- | ---------------------------------------------------------------- |
| Name     | **Kotivalo**                                                     |
| Tagline  | _Valoa vuokranantajan arkeen._                                   |
| Logo     | A sun under a roof: a yellow circle with a roof chevron above it |
| Typeface | Nunito (700 / 900)                                               |

**Colors**

| Role          | Color         | Hex       |
| ------------- | ------------- | --------- |
| Primary, text | Dark plum     | `#2B1B3D` |
| Accent        | Yellow        | `#FFB020` |
| Background    | Cream         | `#FFF7EA` |
| Secondary     | Pale lavender | `#CDBEDD` |

**Name background.** The first candidate, _Voura_, was dropped because a US investment app of the same name exists (voura.com). _Vuokrio_ and _Kotilo_ were also taken. Kotivalo was chosen. A quick web search found no app or company with the same name.

> ⚠️ **Check before launch:** the Finnish Patent and Registration Office (PRH) trademark search and EUIPO TMview (class 36), the Finnish business register (YTJ), domains (.fi / .app / .com), and the App Store and Google Play. The name combines common words, so it is weaker as a trademark than an invented word.

## 3. Screens

All screens are sketched on the [Design canvas](https://claude.ai/code/artifact/16231de4-89b5-4369-aabc-610e9c6893e6) (390 × 844, phone). The app UI is in Finnish; the Finnish screen names are in parentheses.

| Screen                                                | Content                                                                                                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Splash** (Käynnistysnäkymä)                         | Plum background, the sun rises and the roof draws in, loading bar. Motion off when the device has reduced motion on.                                                                                            |
| **Flats** (Asunnot)                                   | Monthly rent summary (received / expected), flat cards: status (paid / late / vacant), ownership split, rent. A vacant flat has a + button for a new tenant.                                                    |
| **New flat / edit** (Uusi asunto)                     | Address, room count, floor area, owners and shares (+ invite), rent, maintenance charge, financing charge (income-recognised / capitalised), tenant.                                                            |
| **Flat details** (Asunnon tiedot)                     | Basics, ownership, this month's rent status, charges, deposit, contract, accumulated capitalised charge, latest transactions. Menu: edit, end tenancy, add tenant, change rent / charge, ownership and sharing. |
| **End tenancy** (Päätä vuokrasuhde)                   | Who gave notice, notice date, last rent day, notice-period hint, deposit return (later / in full / with deductions).                                                                                            |
| **New tenant** (Uusi vuokralainen)                    | Contact details, contract type (open-ended / fixed-term), start date, rent, deposit, due day, contract attachment.                                                                                              |
| **Change rent / charge** (Muuta vuokraa / vastiketta) | Rent, maintenance charge or financing charge: new amount and effective date, effect on next year, change history.                                                                                               |
| **Ownership and sharing** (Omistus ja jakaminen)      | Current owners, change form (shares, date, reason), access removal, ownership history.                                                                                                                          |
| **New entry** (Uusi kirjaus)                          | Income / expense, amount, category + tax hint, flat, date, note, recurrence, receipt.                                                                                                                           |
| **Expense details** (Menon tiedot)                    | Amount, category, deductibility, receipt preview and full-screen view.                                                                                                                                          |
| **Statistics** (Tilasto)                              | Net income curve monthly / yearly, change vs. previous period, occupancy rate, expenses as a share of income.                                                                                                   |
| **Year summary** (Vuosiyhteenveto)                    | Menus: flat and person (own share / other owners / whole flats). Form 7H breakdown, loan interest, capitalised charges, capital income tax estimate, PDF and copy.                                              |
| **Account** (Tili)                                    | Profile, subscription, notifications, tax settings, bank connection, data export.                                                                                                                               |

Navigation: bottom bar _Flats · Statistics · [new entry] · Taxes · Account_. The receipt icon in the middle opens a new entry.

## 4. Logic and decisions

### 4.1 Every change is time-bound

Rent, charges, ownership shares and tenancies are stored as **validity periods** (from–to), not as values that get overwritten. That way the year summary handles mid-year changes correctly, and the history is kept for tax purposes.

### 4.2 Tenancy: ending one and adding a new tenant are separate actions

In practice there is rarely a new tenant ready when notice is given, so "change tenant" was split into two actions:

1. **End tenancy.** The flat's status is _Notice given_ until the last rent day and _Vacant_ after that. The deposit return is logged later by default, once the final inspection is done.
2. **Add tenant.** Possible at any time; the previous tenancy stays in the history.

### 4.3 Financing charge: income-recognised or capitalised

Each flat stores whether the housing company recognises the financing charge (rahoitusvastike) as income or capitalises it. The property manager can tell you.

- **Income-recognised:** deducted from rental income, like the maintenance charge.
- **Capitalised:** not deducted; added to the flat's acquisition cost instead. The app tracks the accumulated amount for when the flat is sold.

### 4.4 Ownership and sharing are per flat

- Each flat has owners and percentage shares that add up to 100 %.
- **No separate "household" concept.** Access is always granted one flat at a time, by invitation.
- A share can be **0 %**, which means visibility only. For example, a spouse can see flats the other owns alone.
- The year summary's person menu lists everyone the user co-owns something with.
- Ownership changes (sale, gift, inheritance, division of property / divorce) are kept in the history. When an owner leaves, their access can be removed, but they still see the data for their period of ownership for their own taxes.
- An **estate of a deceased person** is treated as a single owner until the estate is distributed.

### 4.5 Year summary and taxes

- Figures are calculated per person, using ownership shares and validity periods.
- The form 7H breakdown is made flat by flat.
- Loan interest is reported as its own item.
- The capital income tax estimate uses 30 % and is clearly labelled as an estimate.

## 5. Technical choices

| Part                     | Choice                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App framework            | **TanStack Start**                                         | React-based full-stack framework: SSR, typed routing and server functions.                                                                                                                                                                                                                                                                                                                           |
| UI library               | **MUI**                                                    | Kotivalo's colors, Nunito and corner radii in the MUI theme. Components such as the tab bar, sheets, chips and segmented control are built on MUI. MUI's own component text follows the language (`fiFI`, `svSE`, `enUS`), with separate localisation for date pickers.                                                                                                                              |
| Languages (i18n)         | **Paraglide JS** (inlang)                                  | Translations are compiled at build time into typed functions (`m.rent_paid()`), so a missing or misspelt key is a compile error, not blank text. Only the messages in use end up in the bundle, which suits Workers. TanStack has an official Paraglide example, and its server middleware detects the language from the request. Translations live in JSON files (`fi.json`, `sv.json`, `en.json`). |
| Hosting                  | **Cloudflare Workers**                                     | TanStack Start runs on Workers with Cloudflare's Vite plugin and Wrangler. Workers does not run a Node environment, so Node-specific dependencies must be avoided.                                                                                                                                                                                                                                   |
| Database                 | **Cloudflare D1**                                          | SQLite-based. Bound in the Wrangler config (`d1_databases`); server code reads it from the environment (e.g. `env.DB`).                                                                                                                                                                                                                                                                              |
| ORM                      | **Drizzle**                                                | Typed schema and queries on top of D1 (`drizzle(env.DB)`). Migrations are generated with drizzle-kit and applied to D1 with Wrangler.                                                                                                                                                                                                                                                                |
| Authentication           | **Better Auth**                                            | Users and sessions in our own D1 database via the Drizzle adapter. TanStack Start support through its cookies plugin. Sign-in with an email link or one-time code and passkeys; Google and Apple later if needed. On Workers, Better Auth is created per request, because the D1 binding is only available while handling a request.                                                                 |
| Email                    | **Cloudflare Email Service**                               | Sign-in links, flat invitations and reminders. Sent straight from the Worker through a binding, no API keys. Sending sits behind a single function so the service can be swapped if needed.                                                                                                                                                                                                          |
| Files                    | **Cloudflare R2**                                          | Receipts and tenancy contract attachments. Bound in the Wrangler config (`r2_buckets`). D1 stores only the file key and metadata. Files are private and are read only through the Worker, with an access check.                                                                                                                                                                                      |
| Unit and component tests | **Vitest** + **Testing Library**                           | Vitest uses the same Vite config as TanStack Start. The most important things to test are the calculations, as pure functions: the year summary with shares and periods, charges and ownership changing mid-year, income-recognised vs. capitalised financing charges, notice periods and deposit returns.                                                                                           |
| Server-side tests        | **Cloudflare Vitest plugin** (`@cloudflare/vitest-plugin`) | Tests run in the Workers runtime, fully locally (Miniflare): D1 and R2 local, D1 migrations applied to the test database, isolated storage per test file. Works without a Cloudflare account, in CI too. Covers server functions, Drizzle queries, access control and file storage.                                                                                                                  |
| End-to-end tests         | **Playwright**                                             | Key flows in a real browser: email-link sign-in, adding a flat, an entry with a receipt, the year summary and switching language (fi / sv / en).                                                                                                                                                                                                                                                     |

**Implementation principles**

- **Cloudflare is encapsulated.** Everything Cloudflare-specific (bindings, D1/R2/Email APIs, Cron Triggers) lives in one platform module (`src/server/platform/`), which gives the rest of the app a per-request context: the Drizzle database, a file storage interface and the email function. Changing hosts then means rewriting that module and the deploy configuration, not the domain logic, UI or tests. An ESLint import rule enforces the boundary. Workers' web-standard APIs (`fetch`, `Request`, Web Crypto) help here, since code written for them runs almost anywhere. The biggest real lock-in is D1's own limits (no interactive transactions, 10 GB per database), handled inside the platform module.
- **Data access goes through repositories**, one per aggregate in each feature folder; nothing else imports the ORM. Changing the ORM then touches only the repositories, and avoiding database-specific SQL keeps a move from SQLite to PostgreSQL to a schema rewrite. Code uses English domain terms from the glossary in `CLAUDE.md`; a flat (_asunto_) is a `property` in code, matching the `properties` table.
- **Language is chosen per user** and stored on the user record. Before sign-in it comes from a cookie or the browser language, defaulting to Finnish. In the signed-in app the language is not part of the URL.
- **No hard-coded text.** All UI copy, error messages and emails (sign-in links, invitations, reminders) come from translations, in the recipient's language.
- **Formatting follows the language** via `Intl` (`fi-FI`, `sv-FI`, `en-FI`): currency is always euro, dates and numbers in Finnish style (`1 234,56 €`, `12.11.2026`).
  - **Inside a sentence**, formatting is done in the Paraglide message: `number` (numbers, currency), `datetime`, `plural` (e.g. "1 flat / 3 flats") and `relativetime` ("10 days ago").
  - **Standalone values** (amounts in tables and cards, dates in lists) go through one helper module, e.g. `formatMoney(cents)` and `formatDate(iso)`. It reads the language from Paraglide (`getLocale()`) and converts cents to euros.
  - No separate library is needed for formatting. For date arithmetic (validity periods, notice periods), something like date-fns can be used.
- Amounts are stored as **integers in cents**.
- Dates in ISO format (`YYYY-MM-DD`). Validity periods as `valid_from` / `valid_to`.
- Percentage shares are stored as integers (e.g. 5000 = 50.00 %) so the total is exactly 100 %.
- The year summary is computed by querying transactions and periods, not stored as precomputed figures.

### 5.1 Way of working: OpenSpec and test coverage

Requirements are written in **OpenSpec**: each capability (e.g. flats, tenancies, entries, ownership, year summary, languages) is its own spec, made of requirements (_Requirement_) and their scenarios (_Scenario_). Changes are made as OpenSpec change proposals, and specs are updated in the same change as the code.

**Test rules**

- **Every scenario has a test.** A scenario is not done until a matching test exists and passes.
- **Every requirement has a Playwright test where feasible.** When a requirement can't sensibly be tested in a browser (e.g. a pure calculation rule or a scheduled job), its scenarios are covered with Vitest, and the reason is noted with the requirement.
- **Traceability:** test names refer to the requirement and scenario, e.g. in Playwright `test.describe('<Requirement>')` with one `test('<Scenario>')` per scenario. Vitest tests use the same naming.
- **Mandatory CI check:** CI compares the requirements and scenarios in the specs with test names. A change cannot be merged if any scenario has no test, or any requirement has no Playwright test and no recorded reason.

### 5.2 Data model draft (D1 + Drizzle)

| Table                                        | Key fields                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `user`, `session`, `account`, `verification` | Better Auth's own tables, part of the Drizzle schema and migrations                                    |
| `properties`                                 | id, address, postcode, city, room count, floor area                                                    |
| `property_access`                            | property_id, user_id, role, invitation status                                                          |
| `ownership_periods`                          | property_id, user_id, share, valid_from, valid_to, reason                                              |
| `tenancies`                                  | property_id, tenant, contact details, type, start, end, deposit, due day, notice given by, notice date |
| `deposit_returns`                            | tenancy_id, amount returned, deduction, reason, date                                                   |
| `recurring_amounts`                          | property_id, kind (rent / maintenance charge / financing charge), amount, valid_from                   |
| `financing_treatment`                        | property_id, treatment (income-recognised / capitalised), valid_from                                   |
| `transactions`                               | property_id, type (income / expense), category, amount, date, note, receipt, recurrence                |
| `receipts`                                   | id, transaction_id, R2 key, mime, size                                                                 |
| `attachments`                                | id, tenancy_id, R2 key, type (e.g. tenancy contract), mime, size                                       |
| `loan_interest`                              | property_id, user_id, year, amount                                                                     |

## 6. Open questions

**Technical**

- [ ] Cloudflare Email Service is in public beta (April 2026). Watch for general availability. Fallback: Resend or an EU-based service.
- [ ] Image handling before storing in R2 (resizing, compression, possible PDF support)
- [ ] Generating recurring entries (rent, charges): scheduled Worker (Cron Trigger) or computed on the fly? The New flat sketch already promises that charges are logged as expenses automatically every month, which implies generated transactions.
- [ ] Font weights: this document says Nunito 700 / 900, but the sketches also use 600 and 800. Settle the set before building the MUI theme.

**Product**

- [ ] The Statistics screen does not yet account for ownership shares. It needs the same person selector as the year summary.
- [ ] The ownership change form in the sketch supports only two owners; it needs to become a free list.
- [ ] Bank connection and the Kotivalo Plus subscription are suggestions, not decisions. Pricing is open.
- [ ] Swedish and English translations: who translates, and a glossary for tax terms. Swedish tax terms should come from the Tax Administration's Swedish-language guidance and forms.
- [ ] Confirm `en-FI` locale support in browsers and on Workers. Fallback: `en` with Finnish formatting set by hand.
- [ ] Language selection has no screen. The language is stored per user, but the Account sketch has no language setting.
- [ ] Loan interest has no input screen. The year summary shows it and the data model has `loan_interest`, but no sketch collects it.
- [ ] Logging the deposit return later has no screen. End tenancy says to log it after the final inspection, but nothing shows where.
- [ ] Missing screens: sign-in (email link / one-time code, passkey), accepting a flat invitation, and the first-run empty state with no flats.
- [ ] The former owner's read-only view of their ownership period is not sketched.
- [ ] Expense details shows _Payee_ (Saaja) and _Deductible_ (Vähennyskelpoinen), but `transactions` has neither field. Add them to the data model or drop them from the screen.

**Tax and legal** (to be checked with an expert / the Finnish Tax Administration)

- [ ] Structure of form 7H and the per-flat breakdown
- [ ] Treatment of the financing charge (income-recognised / capitalised)
- [ ] Notice periods. In the sketch: tenant 1 month, landlord 3 months, or 6 months if the tenancy has lasted over a year.
- [ ] Capital income tax rate: 30 % applies only up to 30 000 € of capital income and 34 % above it. The flat 30 % in the year summary and the editable rate in Account understate the tax on larger income; decide whether to model the bracket.
- [ ] Taxation of an estate of a deceased person
- [ ] Tax consequences of ownership changes (transfer tax, capital gains)

## 7. Materials

- **[Design canvas](https://claude.ai/code/artifact/16231de4-89b5-4369-aabc-610e9c6893e6):** logo, splash screen and 13 app screens
- **[Concept film](https://claude.ai/artifact/3R4BejS1VPHvLBa9Lgp3ky)** (motion, 30 s): logo → flats → new entry → statistics → taxes → end card
- **[App showcase](https://claude.ai/artifact/L8WxhFFC52kbtHuD4EGmy4)** (motion, 60 s): screens and transitions with taps

The artifacts are private claude.ai pages; only people they are shared with can open them.

_All names, addresses and amounts in the sketches are made-up examples._
