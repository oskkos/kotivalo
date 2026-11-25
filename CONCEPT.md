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
| Typeface | Nunito (700 / 800 / 900)                                         |

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

All screens are sketched on the [Design canvas](https://claude.ai/artifact/DGX1pDjibhPqZjLUjm8jTb) (390 × 844, phone). The app UI is in Finnish; the Finnish screen names are in parentheses.

| Screen                                                | Content                                                                                                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Splash** (Käynnistysnäkymä)                         | Plum background, the sun rises and the roof draws in, loading bar. Motion off when the device has reduced motion on.                                                                                            |
| **Flats** (Asunnot)                                   | Monthly rent summary (received / expected), flat cards: status (paid / late / vacant), ownership split, rent. A vacant flat has a + button for a new tenant.                                                    |
| **New flat / edit** (Uusi asunto)                     | Address, room count, floor area, owners and shares (+ invite), rent, maintenance charge, financing charge (income-recognised / capitalised), tenant.                                                            |
| **Flat details** (Asunnon tiedot)                     | Basics, ownership, this month's rent status, charges, deposit, contract, accumulated capitalised charge, latest transactions. Menu: edit, end tenancy, add tenant, change rent / charge, ownership and sharing. |
| **End tenancy** (Päätä vuokrasuhde)                   | Who gave notice, notice date, last rent day, notice-period hint, deposit return (later / in full / with deductions).                                                                                            |
| **New tenant** (Uusi vuokralainen)                    | Contact details, contract type (open-ended / fixed-term), start date, rent, deposit, due day, contract (a lease document, see #93).                                                                             |
| **Change rent / charge** (Muuta vuokraa / vastiketta) | Rent, maintenance charge or financing charge: new amount and effective date, effect on next year, change history.                                                                                               |
| **Ownership and sharing** (Omistus ja jakaminen)      | Current owners, change form (shares, date, reason), access removal, ownership history.                                                                                                                          |
| **New entry** (Uusi kirjaus)                          | Income / expense, amount, category + tax hint, flat, date, note, recurrence, receipt.                                                                                                                           |
| **Expense details** (Menon tiedot)                    | Amount, category, deductibility, receipt preview and full-screen view.                                                                                                                                          |
| **Statistics** (Tilasto)                              | Net income curve monthly / yearly, change vs. previous period, occupancy rate, expenses as a share of income.                                                                                                   |
| **Year summary** (Vuosiyhteenveto)                    | Menus: flat and person (own share / other owners / whole flats). Form 7H breakdown, loan interest, capitalised charges, capital income tax estimate, PDF and copy.                                              |
| **Account** (Tili)                                    | Profile, subscription, notifications, tax settings, bank connection, data export.                                                                                                                               |

Navigation: bottom bar _Flats · Statistics · [new entry] · Taxes · Account_. The receipt icon in the middle opens a new entry. Built so far: _Flats · [new entry] · Account_ on the flats list and the account page (#32); Statistics and Taxes join it with their pages.

## 4. Logic and decisions

### 4.1 Every change is time-bound

Rent, charges, ownership shares and tenancies are stored as **validity periods** (from–to), not as values that get overwritten. That way the year summary handles mid-year changes correctly, and the history is kept for tax purposes.

### 4.2 Tenancy: ending one and adding a new tenant are separate actions

In practice there is rarely a new tenant ready when notice is given, so "change tenant" was split into two actions:

1. **End tenancy.** The flat's status is _Notice given_ until the last rent day and _Vacant_ after that. The deposit return is logged later by default, once the final inspection is done.
2. **Add tenant.** Possible at any time; the previous tenancy stays in the history.

**Notice periods** ([Act on Residential Leases 481/1995](https://www.finlex.fi/fi/lainsaadanto/1995/481), as amended by 531/2026 in force 1.10.2026; #18). The app suggests the earliest legal end date; the user can choose a later one.

- **Counting:** the notice period runs from the last day of the calendar month in which notice was given (§52), so an open-ended tenancy ends on the last day of a month. Tenant gives notice on 15.3. → the tenancy ends on 30.4.
- **Tenant:** 1 month.
- **Landlord**, depending on when the contract was made, because the amendment keeps the old §52(2) and (4) for contracts made before 1.10.2026 unless the parties agree otherwise:
  - contract made on or after 1.10.2026: 4 months if the tenancy has lasted without a break for at least 2 years immediately before the notice, otherwise 3 months;
  - contract made before 1.10.2026: 6 months if it has lasted at least 1 year, otherwise 3 months.
- So a tenancy records the date the contract was made (_Contract made_, defaulting to the start date). Deriving the rule from the start date would be wrong for a contract signed before 1.10.2026 that starts after it.
- The periods are minimums: a longer landlord's or shorter tenant's period may be agreed, the opposite is void (§52). The suggestion is therefore a lower bound, never a fixed value.
- **Fixed-term** tenancies end when the term runs out and can't be ended by notice (§4, §51); earlier only by agreement or with a court's permission (§55). The End tenancy screen shows no notice-period hint for them. If the contract is first fixed-term and then open-ended, notice can end it at the earliest at the end of the fixed term (§4, contracts made on or after 1.10.2026).
- **Notice date** means the date notice was received: notice is always in writing; the landlord's states the end date and the grounds and is delivered verifiably (§54, §13 a), and an electronic notice counts as received on the third day after the alert message.
- **Moving day** (§68): the end date for contracts made on or after 1.10.2026; the next weekday after it for older contracts. Rent runs to the end date either way.
- The app shows these as hints, not legal advice.

**Rent payments** (#25). Rental income is taxed in the year it is received: "Tulo katsotaan sen verovuoden tuloksi, jona se on nostettu, merkitty verovelvollisen tilille tai muutoin saatu vallintaan." ([Income Tax Act 1535/1992](https://www.finlex.fi/fi/lainsaadanto/1992/1535) §110). December's rent paid in January is next year's income, and rent never paid is no income. So payments are recorded, not assumed:

- The owner marks a month's rent as paid with one tap. The amount defaults to the expected rent and the date to today; both can be changed.
- A month can have several payments. Less than the expected rent shows as _Partly paid_ with the amount missing.
- _Late_ is counted from the tenancy's due day, e.g. "10 days late".
- The expected rent of a month that a tenancy starts or ends in is the month's rent in proportion to the days the tenancy runs, rounded to the cent (15.–30.11. is 16 of 30 days: 474,67 € of 890 €). It only drives the status; the owner records the amount actually paid. In a tenancy's first month the due date is no earlier than its start.
- A month's payments are deleted and recorded again, not edited. Only owners record and delete them.
- The year summary (#34) takes gross rent from the payments received in the year, by payment date. Months without a payment are shown as a warning ("rent for 3 months not marked"), never assumed paid.
- A deposit is not income: it is a debt to the tenant. The part kept for unpaid rent (or used as the last months' rent) is rental income in the year it is kept. The part kept for damage is tax-free compensation, and the repair costs are deductible only where they exceed it and any other compensation (Tax Administration, [Vuokratulojen verotus](https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/49336/vuokratulojen-verotus8/) §2.1.3, example 1). The deposit return (#93) records which is which.
- Rent is still not an entry (#32): the expected amount comes from the rent periods, and payments are their own records.
- No action marks several months as paid at once; a new issue if it is ever needed.

### 4.3 Financing charge: income-recognised or capitalised

Each flat stores whether the housing company recognises the financing charge (rahoitusvastike) as income or capitalises it, as periods (one treatment for all of the flat's financing charges, #90). The property manager (isännöitsijä) can tell you. Checked against the Tax Administration's detailed guidance [Vuokratulojen verotus](https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/49336/vuokratulojen-verotus8/) (12.1.2026, §3.8) and the [7H instructions](https://www.vero.fi/en/About-us/contact-us/forms/filling-instructions/7h-rental-income-rental-apartments--instructions/) (#17):

- **Income-recognised:** deducted from rental income in row 2.3, in the year paid. Only the company's bookkeeping decides, not what the money is for or whether it is paid monthly or as a lump sum. A charge once deducted can't later be added to the acquisition cost.
- **Capitalised:** not deducted and not reported on 7H; added to the flat's acquisition cost instead. The app tracks the accumulated amount for when the flat is sold.
- **Partly both:** a company may recognise part of the charges as income and capitalise the rest (e.g. 60 % / 40 %, the same for every shareholder); only the income-recognised part is deductible. The app supports only all-or-nothing today (open, §6).
- **A change of treatment:** the guidance says nothing about a change during the year or a capitalisation decision made after the year. The periods cover both: a month's charge follows the treatment in effect on its first day, and a later decision is entered by correcting the treatment period.
- **Only while rented:** like the other charges, deductible only for the time the flat is let or offered for rent (§4.5).
- **Case law:** deducting income-recognised capital charges has not always been accepted and has in some cases been treated as tax avoidance (§3.8). The year summary says so next to row 2.3 instead of judging the case.

### 4.4 Ownership and sharing are per flat

- Each flat has owners and percentage shares that add up to 100 %.
- **No separate "household" concept.** Access is always granted one flat at a time, by invitation.
- A share can be **0 %**, which means visibility only. For example, a spouse can see flats the other owns alone.
- The year summary's person menu lists everyone the user co-owns something with.
- Ownership changes (sale, gift, inheritance, division of property / divorce) are kept in the history. When an owner leaves, their access can be removed, but they still see the data for their period of ownership for their own taxes.
- An **estate of a deceased person** is treated as a single owner until the estate is distributed.

### 4.5 Year summary and taxes

Checked against the [7H instructions](https://www.vero.fi/en/About-us/contact-us/forms/filling-instructions/7h-rental-income-rental-apartments--instructions/) (updated 4.2.2026) and the detailed guidance [Vuokratulojen verotus](https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/49336/vuokratulojen-verotus8/) (12.1.2026) (#16):

- **Form 7H, per flat.** Each flat gets its own itemisation (one paper form fits two flats; MyTax asks for the same data per flat). The flat's details: the housing company's name and Business ID, the apartment number, the tenant (name and personal identity code or Business ID; with several tenants the name is "several" and the ID left empty), the tenancy period (the whole year when the flat was let in several periods) and the owner's share (%). Then the rows, each the owner's own share for the year:
  - **2.1** gross rent, nothing deducted
  - **2.2** maintenance charges and water charges
  - **2.3** capital charges the housing company recognised as income (§4.3)
  - **2.4** annual repairs
  - **2.5** other costs
  - No profit or loss: the Tax Administration calculates it.
- **Cash basis.** Rent is income in the year it is received (Income Tax Act §110; guidance §2.1.2) and costs are deducted in the year paid (§113; guidance §3.1). Gross rent is the sum of the rent payments received, never the rent computed from the periods (#25).
- **Co-owners split everything by ownership share, not by who paid** (guidance §2.2, §3.1: a 50/50 owner deducts half even if the other owner paid all of it). Each co-owner files their own form. A share that changes during the year is not covered by the instructions; the app applies the share in effect on each payment date (a charge month's first day for charges), which follows from the cash basis, and the form's share field shows the share at the end of the owner's period with a note of the change.
- **Only while let or offered for rent.** Charges and other costs are deductible for the time the flat earns rental income, including vacancies between tenancies when the flat is offered for rent (rental ads, an agent). A long vacancy may not count (guidance §3.1). The year summary deducts the charges for vacant months too, but lists those months so the owner can check them.
- **Annual repairs vs. improvements** (guidance §3.7): an annual repair restores the original level and is deducted in full in the year paid (row 2.4). An improvement is added to the acquisition cost, or, on the owner's request, deducted as equal tenths over ten tax years starting from the year paid (row 2.5); what remains on sale or when letting stops is added to the acquisition cost. Costs of renovating a flat bought for letting before the first tenant moves in go to the acquisition cost.
- **Not on form 7H:** loan interest (deducted separately from all capital income, forms 50B / 5010e; loans come after go-live, #35) and capitalised charges.
- **Usage charges.** Water is named in row 2.2. Parking, sauna and other usage charges paid to the housing company are not named anywhere; the app puts them in row 2.5 as costs of earning the rent (an inference, not stated by the Tax Administration).
- **A rental loss** (costs above the rent) is deducted from other capital income, and a deficit credit can reduce the tax on earned income (guidance §3.12). The year summary shows the net result as negative; the Tax Administration does the rest.
- Figures are calculated per person, using ownership shares and validity periods.
- **Loans** belong to a flat and have one or more borrowers: an owner's own loan, or a joint loan such as one taken by the co-owners of a 50/50 flat. Each borrower has a debt share (basis points, a validity period), which is not assumed to equal their ownership share.
- Each year's loan payment records **interest** and **principal** separately. Interest is deductible and goes into the year summary; principal is not deductible and stays out of the form 7H figures (cash flow and statistics only).
- How a joint loan's interest is split between borrowers for tax is open (see §6).
- The capital income tax estimate uses 30 % and is clearly labelled as an estimate.

## 5. Technical choices

| Part                     | Choice                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App framework            | **TanStack Start**                                         | React-based full-stack framework: SSR, typed routing and server functions.                                                                                                                                                                                                                                                                                                                           |
| UI library               | **MUI**                                                    | Kotivalo's colors, Nunito and corner radii in the MUI theme. Components such as the tab bar, sheets, chips and segmented control are built on MUI. MUI's own component text follows the language (`fiFI`, `svSE`, `enUS`), with separate localisation for date pickers. Nunito is self-hosted from npm, so no request goes to Google Fonts.                                                          |
| Languages (i18n)         | **Paraglide JS** (inlang)                                  | Translations are compiled at build time into typed functions (`m.rent_paid()`), so a missing or misspelt key is a compile error, not blank text. Only the messages in use end up in the bundle, which suits Workers. TanStack has an official Paraglide example, and its server middleware detects the language from the request. Translations live in JSON files (`fi.json`, `sv.json`, `en.json`). |
| Hosting                  | **Cloudflare Workers**                                     | TanStack Start runs on Workers with Cloudflare's Vite plugin and Wrangler. Workers does not run a Node environment, so Node-specific dependencies must be avoided. The aim is to stay on Cloudflare's free plans at first, so nothing in the stack should require Workers Paid.                                                                                                                      |
| Database                 | **Cloudflare D1**                                          | SQLite-based. Bound in the Wrangler config (`d1_databases`); server code reads it from the environment (e.g. `env.DB`).                                                                                                                                                                                                                                                                              |
| ORM                      | **Drizzle**                                                | Typed schema and queries on top of D1 (`drizzle(env.DB)`). Migrations are generated with drizzle-kit and applied to D1 with Wrangler.                                                                                                                                                                                                                                                                |
| Authentication           | **Better Auth**                                            | Users and sessions in our own D1 database via the Drizzle adapter. TanStack Start support through its cookies plugin. Sign-in with an email link or one-time code and passkeys; Google and Apple later if needed. On Workers, Better Auth is created per request, because the D1 binding is only available while handling a request.                                                                 |
| Email                    | **Resend**                                                 | Sign-in links, flat invitations and reminders. The free plan (3,000 emails a month, at most 100 a day) covers the start. Called from the Worker over Resend's HTTPS API, with the API key stored as a Worker secret. Sending sits behind a single function so the service can be swapped, for example to Cloudflare Email Service, which needs the Workers Paid plan.                                |
| Files                    | **Cloudflare R2**                                          | Receipts and a flat's documents (leases, financial statements and so on). Bound in the Wrangler config (`r2_buckets`). D1 stores only the file key and metadata. Files are private and are read only through the Worker, with an access check.                                                                                                                                                       |
| Unit and component tests | **Vitest** + **Testing Library**                           | Vitest uses the same Vite config as TanStack Start. The most important things to test are the calculations, as pure functions: the year summary with shares and periods, charges and ownership changing mid-year, income-recognised vs. capitalised financing charges, notice periods and deposit returns.                                                                                           |
| Server-side tests        | **Cloudflare Vitest plugin** (`@cloudflare/vitest-plugin`) | Tests run in the Workers runtime, fully locally (Miniflare): D1 and R2 local, D1 migrations applied to the test database, isolated storage per test file. Works without a Cloudflare account, in CI too. Covers server functions, Drizzle queries, access control and file storage.                                                                                                                  |
| End-to-end tests         | **Playwright**                                             | Key flows in a real browser: email-link sign-in, adding a flat, an entry with a receipt, the year summary and switching language (fi / sv / en).                                                                                                                                                                                                                                                     |

**Implementation principles**

- **Cloudflare is encapsulated.** Everything Cloudflare-specific (bindings, secrets, D1/R2 APIs, Cron Triggers) lives in one platform module (`src/server/platform/`), which gives the rest of the app a per-request context: the Drizzle database, a file storage interface and the email function. Changing hosts then means rewriting that module and the deploy configuration, not the domain logic, UI or tests. An ESLint import rule enforces the boundary. Workers' web-standard APIs (`fetch`, `Request`, Web Crypto) help here, since code written for them runs almost anywhere. The biggest real lock-in is D1's own limits (no interactive transactions, 10 GB per database), handled inside the platform module.
- **Data access goes through repositories**, one per aggregate in each feature folder; nothing else imports the ORM. Changing the ORM then touches only the repositories, and avoiding database-specific SQL keeps a move from SQLite to PostgreSQL to a schema rewrite. Code uses English domain terms from the term bank `i18n/terms.json`; a flat (_asunto_) is a `property` in code, matching the `properties` table.
- **Language is chosen per user** and stored on the user record. Before sign-in it comes from a cookie or the browser language, defaulting to Finnish. In the signed-in app the language is not part of the URL.
- **No hard-coded text.** All UI copy, error messages and emails (sign-in links, invitations, reminders) come from translations, in the recipient's language.
- **Formatting follows the language as used in Finland** via `Intl` (`fi-FI`, `sv-FI`, `en-FI`). Currency is always euro. Finnish and Swedish give `1 234,56 €` and `12.11.2026`; English gives `€1,234.56` and `12/11/2026`. `en-FI` works the same in Node, on Workers and in Chromium.
  - **Amounts and dates** go through one helper module, `formatMoney(cents)` and `formatDate(iso)`, which reads the language from Paraglide (`getLocale()`) and converts cents to euros. Inside a sentence, the formatted value is passed to the message as a parameter: Paraglide's own `number` and `datetime` formatters use the bare language (`sv`, `en`), which gives Swedish ISO dates and US dates.
  - **Inside a sentence**, Paraglide handles `plural` (e.g. "1 flat / 3 flats") and `relativetime` ("10 days ago").
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

| Table                                        | Key fields                                                                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `session`, `account`, `verification` | Better Auth's own tables, part of the Drizzle schema and migrations                                                                                                                          |
| `properties`                                 | id, address, postcode, city, room count, floor area                                                                                                                                          |
| `property_access`                            | property_id, user_id, role (`owner`, `member`), archived_at (when this user archived the flat; hides it from their own views only)                                                           |
| `property_invitations`                       | property_id, email, invited_by, created, expires (pending only; accepting adds `property_access`)                                                                                            |
| `ownership_periods`                          | property_id, user_id, share (basis points, > 0), valid_from, valid_to, reason (sale / gift / inheritance / division / other; none for the first period)                                      |
| `tenancies`                                  | property_id, tenant name, phone, email, contract type, contract made, valid_from, valid_to (the last day), term_end, due day, notice given by, notice date (#30; the deposit comes with #93) |
| `deposit_returns`                            | tenancy_id, amount returned, deduction, reason, date                                                                                                                                         |
| `rent_payments`                              | tenancy_id, month (the rent's month, `YYYY-MM`), amount, paid_on, created_by; several per month, never edited, always inside the tenancy's months (#33)                                      |
| `recurring_amounts`                          | property_id, kind (rent / maintenance charge / financing charge), amount, valid_from, valid_to                                                                                               |
| `financing_treatments`                       | property_id, treatment (income-recognised / capitalised), valid_from, valid_to                                                                                                               |
| `transactions`                               | property_id, type (income / expense), category (decides the form 7H row and deductibility), amount (positive cents), date, note, created_by, created_at, updated_at                          |
| `receipts`                                   | id, transaction_id (one per entry), R2 key, content type, size, file name, uploaded_by (counts against the storage quota), created_at                                                        |
| `property_documents`                         | id, property_id, tenancy_id (lease only, nullable), kind (lease, financial_statement, charge_notice, minutes, other), name, date, R2 key, mime, size, filename, uploaded_by                  |
| `loans`                                      | property_id, name                                                                                                                                                                            |
| `loan_borrowers`                             | loan_id, user_id, share (debt share, adding up to 10000), valid_from, valid_to                                                                                                               |
| `loan_payments`                              | loan_id, year, interest, principal                                                                                                                                                           |

## 6. Open questions

**Technical**

- [ ] Email limits and data: Resend's free plan allows 100 emails a day and 3,000 a month. Resend stores account data, logs and messages (30 days) in the US even when sending from its EU region, so recipient addresses leave the EU: record the transfer and Resend's DPA in the privacy notice. Revisit when usage grows or if EU data residency becomes a requirement. Alternatives behind the same function: Mailjet or Lettermint (EU-only data, free plans) or Cloudflare Email Service (Workers Paid).
- [x] ~~Image handling before storing in R2.~~ Images are resized and compressed **in the browser** before upload (long edge about 2000 px, JPEG or WebP), because server-side processing would need Cloudflare Images (paid) or an image library too large for the Workers Free script limit. The Worker accepts JPEG, PNG, WebP and PDF up to 10 MB, recognised by their first bytes, and stores them as they are. iOS converts HEIC photos to JPEG when a file input accepts `image/*`; check this on a device with the receipts feature.
- [x] ~~Generating recurring entries (rent, charges).~~ Computed on the fly from the validity periods, never generated (#31): correcting an amount afterwards also corrects past months, and no scheduled job is needed. Periods start on the first of a month, and a month's amount is the one in effect on its first day. If the entries list (#32) shows charges, it shows the computed ones next to logged entries without storing them.
- [x] ~~Font weights.~~ Nunito 700 (body text), 800 (labels, buttons) and 900 (headings, amounts), as in the sketches. The one 600 (logo tagline) becomes 700.
- [ ] Input borders (`#E6D8C2`, 1.4:1 on white) are below WCAG's 3:1 for the boundary of a form field. Every field in the sketches has a visible label, which helps, but a darker border should be considered when the first form is built.

**Product**

- [ ] The Statistics screen does not yet account for ownership shares. It needs the same person selector as the year summary.
- [x] ~~The ownership change form in the sketch supports only two owners; it needs to become a free list.~~ It lists everyone with access to the flat (Design canvas: "Omistus ja omistusmuutokset").
- [ ] Bank connection and the Kotivalo Plus subscription are suggestions, not decisions. Pricing is open.
- [x] ~~Swedish and English translations: who translates, and a glossary for tax terms.~~ The term bank `i18n/terms.json` with its sources, the `translate` skill and the `term-critic` agent (#57). Tax terms come from the Tax Administration's Swedish and English pages and the 7H form. No native reviewer is available, so the skill and the critic are the review.
- [x] ~~Confirm `en-FI` locale support in browsers and on Workers.~~ Supported in Node, workerd and Chromium. English uses the `en-FI` format (`€1,234.56`, `05/03/2026`), not Finnish style.
- [x] ~~Language selection has no screen.~~ A light Account page (`/account`: name, email, language, sign out) chooses the language, and a language chosen on the sign-in page also updates an existing account (#27, Design canvas row "Tili ja kieli"). The rest of the Account sketch comes later.
- [ ] Loans have no input screen. The year summary shows loan interest and the data model has `loans`, `loan_borrowers` and `loan_payments`, but no sketch collects them.
- [ ] How a joint loan's deductible interest is split between borrowers: by debt shares, by who actually paid, or equally by default. Check against Vero.fi guidance before the loans proposal. If the rule is "by who paid", the split moves from `loan_borrowers` to each payment.
- [x] ~~How rent is marked as paid.~~ Payments are recorded per month and give the year summary its gross rent, because rent is taxed when received (§4.2, #25).
- [ ] Logging the deposit return later has no screen. End tenancy says to log it after the final inspection, but nothing shows where.
- [x] ~~Missing screens: accepting a flat invitation, and the first-run empty state with no flats.~~ Both are on the Design canvas ("Jakaminen ja kutsut") and built; so are the sign-in screens. A passkey option comes with its own issue.
- [ ] The former owner's read-only view of their ownership period is not sketched.
- [x] ~~Expense details shows _Payee_ (Saaja) and _Deductible_ (Vähennyskelpoinen), but `transactions` has neither field.~~ No Payee field (the note covers it); deductibility follows from the category (#23, #32).

**Tax and legal** (to be checked with an expert / the Finnish Tax Administration)

- [x] ~~Structure of form 7H and the per-flat breakdown~~ See §4.5 (#16).
- [x] ~~Treatment of the financing charge (income-recognised / capitalised)~~ See §4.3 (#17).
- [ ] A financing charge partly income-recognised and partly capitalised (a percentage) is allowed but not supported (§4.3).
- [x] ~~Form 7H asks for the housing company's name and Business ID and the apartment number, which flats don't store yet.~~ Flats store them (#118), and the form 7H page shows each, or Add when it is missing (#34).
- [ ] An ownership share that changes during the year: the 7H instructions have one share field per flat, and the app's rule (the share on each payment date) is an inference.
- [x] ~~Notice periods. In the sketch: tenant 1 month, landlord 3 months, or 6 months if the tenancy has lasted over a year.~~ Checked against the Act on Residential Leases, which changed on 1.10.2026: see §4.2 (#18). The End tenancy sketch's hint follows the old law and is updated with #30.
- [ ] Capital income tax rate: 30 % applies only up to 30 000 € of capital income and 34 % above it. The flat 30 % in the year summary and the editable rate in Account understate the tax on larger income; decide whether to model the bracket.
- [ ] Taxation of an estate of a deceased person
- [ ] Tax consequences of ownership changes (transfer tax, capital gains)

## 7. Materials

- **[Design canvas](https://claude.ai/artifact/DGX1pDjibhPqZjLUjm8jTb):** logo, splash screen and 13 app screens
- **[Concept film](https://claude.ai/artifact/3R4BejS1VPHvLBa9Lgp3ky)** (motion, 30 s): logo → flats → new entry → statistics → taxes → end card
- **[App showcase](https://claude.ai/artifact/L8WxhFFC52kbtHuD4EGmy4)** (motion, 60 s): screens and transitions with taps

The artifacts are private claude.ai pages; only people they are shared with can open them.

_All names, addresses and amounts in the sketches are made-up examples._
