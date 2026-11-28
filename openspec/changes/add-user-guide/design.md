## Context

Kotivalo has 16 specs with about 160 requirements and no user documentation. #67 asks for a guide that is:
- written by Claude as a **script**: prose with references to screenshots and UI names
- turned into the published guide by CI
- kept current: screenshots without a Claude run, and the prose flagged when a requirement it describes changes

Saldo has a skill for this, `generate-user-guides` (`~/dev/saldo/.claude/skills/generate-user-guides/`). Its parts:
- per-requirement hashes in a footer of each page
- `check.mjs`, which reports stale, orphaned and uncovered requirements
- screenshots taken by hand through the Playwright MCP and committed, and an MkDocs site

Kotivalo already has most of what the capture needs:
- the built Worker under `vite preview` with local bindings
- sign-in through the test inbox
- e2e helpers that fill in flats, tenants, charges, payments and entries through the app's own forms (`e2e/support/`)
- a spec parser that applies active changes' deltas (`scripts/traceability/spec.ts`)

The user decided (proposal.md):
- the machinery and the full Finnish guide in this change
- a Worker of its own on a subdomain
- #62 later

## Goals / Non-Goals

**Goals:**
- **One fixed script:** the same script always gives the same guide, and CI needs no Claude and no API keys.
- **Real screenshots:** taken from the real app at the phone size, in CI, and never committed.
- **The app's words:** UI names come from the messages, so the guide can't drift from the app's labels.
- **A drift check:** fast, without a build, in an existing CI job.
- **The full Finnish guide:** every user-facing requirement in the main specs covered.
- **Ready for sv and en:** adding them needs only pages and a capture run per language.

**Non-Goals:**
- **Other languages:** the sv and en pages; a later change, through the translate skill.
- **#62:** the manifest screenshots. They reuse the demo data and the capture.
- **Offline:** offline reading of the guide, or caching it in the app's service worker.
- **Statistics:** the app has none, so there is no page.
- **Desktop screenshots:** only 390 × 844.

## Decisions

### 1. A pnpm workspace package `docs/guide/` for the site

- **The package:** Starlight (Astro) and `sharp` are dependencies of `docs/guide/package.json` only. `pnpm-workspace.yaml` gains `packages: ['.', 'docs/guide']`. The app's dependency tree, the Worker bundle and the root `pnpm install` time for the app stay as they are; CI installs the workspace as a whole.
- **Root scripts:**
  - `guide:dev` and `guide:build`: Starlight's dev server and build
  - `guide:capture`: the capture run
  - `guide:check`: the drift check
- **What the root checks see:**
  - `.astro` files and the site's config are outside the root ESLint and `tsc`. Astro checks them with `astro check` in the `guide` workflow.
  - The capture scripts (`docs/guide/capture/*.capture.ts`) and the pure helpers (`docs/guide/lib/*.ts`) are TypeScript under the root ESLint and `tsc`, because they import `e2e/support/`.
  - The Vitest `unit` project includes `docs/guide/lib/**/*.test.ts`.

**Alternative considered:** Starlight as root dev dependencies. That adds Astro's tree to every install and update of the app.

### 2. Requirements in the frontmatter, not a footer

A page's frontmatter has:

```yaml
requirements:
  - spec: tenancies
    name: Ending a tenancy
    hash: 3f9c0a1b2d4e
```

Starlight's content schema is extended with this field (`docsSchema({ extend })`), so a malformed list fails the build, and the field is never rendered. This replaces Saldo's Markdown footer and the hook #67 mentioned for stripping it from the published pages.

**The hash:** the first 12 hex digits of SHA-256 over the requirement's block (heading through its last scenario), with whitespace runs collapsed. It is computed in `scripts/guide/hash.ts` by Node's `crypto`. `scripts/traceability/spec.ts` gains each requirement's block text, so both checks read specs one way.

### 3. The drift check reads files only

`scripts/guide/check.ts`, run as `pnpm guide:check` (or `--json` for the skill), does five things:
- reads the main specs and applies active changes' deltas with the traceability code
- parses each page's frontmatter with `yaml`, a new root dev dependency
- reads `docs/guide/not-in-guide.json`: `[{ spec, name, reason }]`
- reports what the spec lists: stale, unknown, uncovered, missing reasons and contradictions fail the check; pending is only reported (spec: "Guide pages cite their requirements", "User-facing requirements covered by the guide")
- also reports a `<Shot id>` on a page with no `shot('<id>')` in the capture scripts, by a static scan, so a missing screenshot is caught before a build

The check's logic is pure functions over parsed input, tested in `scripts/guide/check.test.ts`. The file reading is a thin shell around them.

**Where it runs:** in CI as a second step of the `traceability` job, so no ruleset change is needed.

**When an active change counts:** a hash counts as current when it matches the requirement in the main specs or as an active change adds or modifies it. A change can then update its pages before the archive commit, and the archive commit itself never fails the check.

### 4. Demo data relative to today, no frozen clock

#67 asked for a fixed date. The server reads the time as `now: () => new Date()` in each feature's `functions.ts` (about 18 files). A frozen date would need one of two things:
- a test-only clock in the request context, read by every server function: a test hook in production code paths
- Playwright's `page.clock`, which moves only the browser, so the server and the browser disagree about today

Instead, the demo data is computed from today:
- the flats owned since 1 January of last year
- a tenancy since last spring, the charges and payments of the past months
- a tenancy that ended last year, with its deposit returned

The capture scripts open the year summary with an explicit `?year=`. The pages never say a date or an amount that depends on the day, as in Saldo ("date-agnostic").

What this costs: two runs on different days give slightly different screenshots. They are not committed, so nothing churns in Git.

### 5. The demo data is filled in through the app, once per run

A Playwright setup project, `docs/guide/capture/demo.setup.ts`, signs in two demo accounts through the test inbox: Annika Kotivalo and her co-owner Jussi Laine. It fills in the data with the e2e helpers and the app's forms, then saves each account's `storageState`. The capture scripts start from those states and read only what they need, and a page that shows a form fills in its own example values.

**The data:**
- fictional names and addresses only
- the Business ID is a valid but fictional one, checked in YTJ not to belong to a company before the first publish (tasks.md). The e2e tests' `0112038-9` is a real company's ID and is not used in the published guide.

**Alternative considered:** seeding D1 directly with SQL. It is faster, but it bypasses the rules that the forms enforce, and it would need a second copy of the data model to maintain.

### 6. Capture: one Playwright file per page, screenshots by id

- **The config:** `docs/guide/playwright.config.ts` reuses the root config's `webServer` (`vite preview` on port 4173), at 390 × 844 with `locale: 'fi-FI'`. One project per language; only `fi` for now.
- **`shot(page, id)`** (`docs/guide/capture/shot.ts`):
  - waits for hydration and for no pending network requests
  - writes `docs/guide/src/assets/shots/<language>/<id>.png`, with animations disabled and the caret hidden
- **The output folder:** gitignored and emptied at the start of a run.
- **Duplicate ids:** a global setup scans the capture scripts for `shot(…, '<id>')` and fails on an id used twice (spec: "Screenshots in the guide"). The duplicate check and the id scan are pure functions in `docs/guide/lib/shots.ts`.
- **Failures:** a capture script fails like an e2e test when a button or field is gone.

### 7. The site and its deploy

- **Starlight's locales:** Finnish is the root locale (`/`), Swedish `/sv/` and English `/en/`. A page missing in a language shows the Finnish page with Starlight's notice.
- **Search:** Pagefind, built in, with no outside service.
- **`<Ui key>`** (`docs/guide/src/components/Ui.astro`):
  - calls `uiText(messages, key)` from `docs/guide/lib/ui-text.ts`
  - the function throws on an unknown key, a variable (`{…}`) or a plural (array) message
  - renders the text in a `<span class="ui">`, styled as a UI name
- **`<Shot id alt>`** (`Shot.astro`):
  - resolves the image with `import.meta.glob` through `shotFor(id, language, strict)` in `lib/shots.ts`
  - renders it with Astro's `<Image>`, as WebP at the phone's width
  - a missing shot throws with `GUIDE_STRICT=1`, or renders a placeholder
- **The theme:**
  - Starlight's CSS custom properties are set from `src/theme/tokens.ts` in `docs/guide/src/styles/theme.css`, with a unit test that checks the CSS against the tokens
  - the logo is `public/favicon.svg`'s mark
  - the font is Nunito from `@fontsource-variable/nunito`, self-hosted as in the app
- **The deploy:**
  - **The Worker:** `docs/guide/wrangler.jsonc` defines a static-assets Worker `kotivalo-guide` with `assets.directory: "./dist"`, `not_found_handling: "404-page"` and the route `{ pattern: "ohje.kotivalo.app", custom_domain: true }`.
  - **The domain:** Wrangler creates the custom domain on the first deploy when the zone is in the same account and the API token may edit Workers routes. If the current token can't, the user adds the domain once in the dashboard (tasks.md).
  - **Headers:** a `_headers` file sets `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `frame-ancestors 'none'`.

### 8. The `guide` workflow

`.github/workflows/guide.yml` runs on pull requests to `develop` and on pushes to it, with a `paths` filter:
- `src/**`, `messages/**` and `public/**`
- `openspec/specs/**`, `docs/guide/**` and `e2e/support/**`
- `package.json`, `pnpm-lock.yaml` and the workflow file itself

**Steps:**
1. the shared setup and the Playwright Chromium install
2. `pnpm build`, then `pnpm guide:capture`
3. `astro check`, then `GUIDE_STRICT=1 pnpm guide:build`
4. on a PR, the site uploaded as an artifact
5. on `develop`, `wrangler deploy` from `docs/guide/`

**Other settings:**
- one deploy at a time, and a 20-minute timeout
- it is not a required check, because a path-filtered workflow that doesn't run would block merges as a required one

### 9. The pages (information architecture)

The guide is task-oriented, in Finnish, with Finnish slugs:

| Page | Specs |
| --- | --- |
| `index` (Kotivalon käyttöohje: what the app does, installing it on a phone) | navigation |
| `aloitus` (kirjautuminen, nimi, kieli, tili, ohje ja tuki) | authentication, account, support |
| `asunnot` (adding, editing, housing company, the details page, archiving, deleting) | properties |
| `jakaminen` (inviting, accepting, access) | sharing |
| `omistusosuudet` | ownership |
| `vastikkeet` | recurring-amounts |
| `kayttomaksut` | usage-charges |
| `vuokralainen` (the new tenant, rent, occupants, fees, lease) | tenancies, documents |
| `vuokrasuhteen-paattyminen` (notice, ending, cancelling, correcting) | tenancies |
| `vuokranmaksut` | rent-payments |
| `vakuus` | deposits |
| `tulot-ja-menot` (entries and receipts) | transactions |
| `dokumentit` | documents |
| `vuosiyhteenveto` (cards, the estimate, whose figures, former owners) | year-summary |
| `lomake-7h` (the form 7H page, copying, the PDF) | year-summary |

Every main-spec requirement is cited by one of these pages or listed in `not-in-guide.json`, for example:
- the limits
- the test inbox
- logging and client error reporting
- the data migrations ("Existing rents move to their tenancies")
- server-side access checks

### 10. The skill `generate-user-guides`

`.claude/skills/generate-user-guides/SKILL.md`, adapted from Saldo's:
- **Runs:** a scope (a spec, a requirement or a page) or the delta (`pnpm guide:check --json`), with `--prose` or `--check`.
- **Writing:** it writes or updates the page and its capture script together, and refreshes the frontmatter hashes with `pnpm guide:hash <spec>`.
- **Looking at the screens:** it runs `pnpm guide:capture` locally to see the screenshots it writes about. They are never committed.
- **Leaving requirements out:** it treats `uncovered` as gaps to fill or as plumbing to list with a reason, and never reads a check with no stale pages as "done" (Saldo's lesson).
- **Finnish only for now:** a later change adds the translate skill step for sv and en.

`openspec/config.yaml`'s `tasks` rules and CLAUDE.md's "Specs and tests" gain one line: a change that alters user-facing behaviour updates its guide pages with the skill.

### 11. The guide link in the app

`src/lib/guide.ts` exports `guideUrl(locale)`:
- `https://ohje.kotivalo.app/` for `fi`
- `…/sv/` and `…/en/` for the others

The account page's *Ohje ja tuki* section shows *Käyttöohje* as an external link (`target="_blank"`, `rel="noopener"`) above the support sentence. One message, `account_guide_link`, in fi, sv and en.

## Risks / Trade-offs

- **[Every requirement change now touches the guide]** → A reworded requirement fails `guide:check` until its page's hash is refreshed. That is the point, and the skill makes it one command, but it adds a step to every change. Whitespace changes don't count.
- **[CI time]** → The capture fills in data through the UI and takes several minutes. It is path-filtered and not required, so PRs aren't held up.
- **[Flaky captures]** → They use the same helpers and hydration waits as the e2e suite, with one retry in CI.
- **[Screenshots of a specific day]** → The pages say no dates or amounts, and the year summary is opened with an explicit year.
- **[Demo data that looks real]** → Only fictional names, addresses and a Business ID checked against YTJ.
- **[The API token can't create the custom domain]** → It is a one-time dashboard step for the user, listed in tasks.md.
- **[The Finnish guide's size]** → About 15 pages of prose. They are split into several commit groups by topic.
- **[Starlight or Astro updates]** → They are isolated in their own workspace package. The script (MDX with two components, and Playwright files) is easy to move to another generator.

## Migration Plan

- No data changes.
- **The first deploy:** the guide Worker's first deploy from `develop` publishes `ohje.kotivalo.app`, and the user adds the custom domain if Wrangler can't.
- **The link:** the account page's guide link lands in the same push, so it may point at a domain that is not up for the minutes until the guide workflow finishes.
- **Rollback:** revert the commits and delete the `kotivalo-guide` Worker.

## Open Questions

- **The subdomain's name:** `ohje.kotivalo.app` is used here. Change it in review if another name is wanted (e.g. `guide.`); only `wrangler.jsonc` and `src/lib/guide.ts` hold it.
