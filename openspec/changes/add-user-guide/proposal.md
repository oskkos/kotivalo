## Why

Kotivalo has no user guide. A landlord who wonders how to end a tenancy, record a deposit return or copy the form 7H figures can only try the app or email support. #67 asks for a task-oriented guide with screenshots of the real app, written from the OpenSpec specs and kept current by CI rather than by hand.

Decided with the user on 28.11.2026:
- **Scope:** the guide's machinery and the full Finnish guide in this change. Swedish and English follow in their own changes.
- **Hosting:** a Worker of its own on a subdomain.
- **#62:** the manifest screenshots come later in their own change, reusing this change's demo data and capture.

## What Changes

- **The guide's script, committed:**
  - **Pages:** one MDX page per task in Finnish, under `docs/guide/`. A page refers to screenshots by id (`<Shot id="flat-form-filled" />`) and to UI names by message key (`<Ui key="properties_add" />`), so the guide uses the app's own words.
  - **Capture scripts:** one Playwright file per page, which walks the page's steps in the app and saves each screenshot with `shot('<id>')`. They reuse the e2e helpers in `e2e/support/`.
  - **Requirements on each page:** a page lists the requirements it covers, each with a hash of the requirement's text, in its frontmatter.
- **Demo data:** a capture setup signs in demo accounts through the test inbox and fills in presentable flats, a co-owner, tenancies, charges, rent payments and entries through the app's own forms. Dates are computed from today, not frozen (design.md, decision 4).
- **The site:** Starlight, in its own pnpm workspace package `docs/guide/`, so Astro stays out of the app's dependencies. Kotivalo's colours and logo, Pagefind search, and a language structure ready for sv and en.
- **CI:** a `guide` workflow builds the app, captures the screenshots at 390 × 844, builds the site and, on `develop`, deploys it to its own Worker at `ohje.kotivalo.app`.
  - It runs only when the app, the messages, the specs or the guide change.
  - It is not a required check. A capture script that breaks still fails the workflow, so a broken guide is seen at once.
- **The drift check `pnpm guide:check`:**
  - It compares each page's requirement hashes with the specs, counting active changes' deltas as current.
  - It reports user-facing requirements that no page covers. Plumbing requirements (limits, logging, access checks) are listed in an exclusions file with a reason each.
  - It runs in CI's existing `traceability` job, so the ruleset doesn't change.
- **A link to the guide** in the account page's *Ohje ja tuki* section, in the user's language.
- **A skill `generate-user-guides`**, adapted from Saldo's, for writing and updating pages and capture scripts and refreshing the hashes. Screenshots come from CI, not from the skill.
- **The change workflow:** when a change alters user-facing behaviour, updating its guide pages is a task in its `tasks.md`, like its tests (`openspec/config.yaml`, CLAUDE.md).
- **Not included:** a statistics page, since the app has no statistics. The sv and en pages, the manifest screenshots (#62) and offline reading of the guide are also not part of this change.

## Capabilities

### New Capabilities

- `user-guide`: the guide's pages and their requirement hashes, the drift check, UI names resolved from the messages, screenshots referenced by id, and the published site.

### Modified Capabilities

- `support`: "Help and support on the account page" gains a link to the user guide.

## Impact

- **Tables:** none.
- **App code:**
  - the account page's *Ohje ja tuki* section, with the guide's address from one constant (`src/lib/guide.ts`)
  - a message for the link in fi, sv and en
  - nothing else in the app changes
- **UI screens:**
  - **The account page:** the link. Canvas: the account screen's *Ohje ja tuki* section; the link is new, with no canvas drawing.
  - **The guide site:** no canvas screen. It uses Starlight's layout with the theme's colours.
- **New code outside the app:**
  - `docs/guide/` (Starlight, the `Shot` and `Ui` components, the pages and the capture scripts)
  - `scripts/guide/` (the drift check, reusing the spec parser in `scripts/traceability/`)
  - `.claude/skills/generate-user-guides/`
- **Dependencies:** `astro`, `@astrojs/starlight` and `sharp` (Astro's image service), only in the `docs/guide` workspace package.
- **CI:**
  - a new workflow `.github/workflows/guide.yml`
  - `pnpm guide:check` added to the `traceability` job
  - the guide's deploy uses the existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
- **The user's part:** the custom domain `ohje.kotivalo.app` on the guide's Worker, unless the Wrangler route creates it on the first deploy (design.md, decision 7).
- **Free plans:** a static-assets Worker serves files without running a script, and static asset requests are free and unlimited on the Workers Free plan. The CI minutes come from GitHub's free tier for a public repository.
