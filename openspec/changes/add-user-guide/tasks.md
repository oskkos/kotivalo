## 1. The drift check

- [ ] 1.1 `scripts/traceability/spec.ts`: keep each requirement's block text (heading through its last scenario). Extend `spec.test.ts`; the traceability tests keep passing.
- [ ] 1.2 `scripts/guide/hash.ts`: `requirementHash(block)` (design.md, decision 2). `pnpm guide:hash [spec]` prints the hashes.
- [ ] 1.3 `scripts/guide/check.ts`: the pure checks over parsed input, with a thin shell reading `openspec/`, the pages' frontmatter (`yaml`, a new root dev dependency) and `docs/guide/not-in-guide.json`. `pnpm guide:check` and `--json`. Not in CI yet.
- [ ] 1.4 Vitest in `scripts/guide/check.test.ts`:
  - describe "Guide pages cite their requirements": "A page with current hashes", "A changed requirement", "Whitespace alone is not a change", "A renamed requirement", "A hash from an active change"
  - describe "User-facing requirements covered by the guide": "An uncovered requirement", "A requirement left out with a reason", "A left-out requirement without a reason", "A left-out requirement that no longer exists", "Cited and left out", "A requirement added by an active change"
  - a `<Shot id>` with no `shot()` in the capture scripts is reported

## 2. The Starlight site

- [ ] 2.1 `pnpm-workspace.yaml`: the `docs/guide` package. `docs/guide/package.json` with `astro`, `@astrojs/starlight`, `sharp` and `@fontsource-variable/nunito`. Root scripts `guide:dev` and `guide:build`. ESLint and `tsc` scopes as in design.md, decision 1.
- [ ] 2.2 `astro.config.mjs`:
  - Starlight with Finnish as the root locale and `sv` and `en` ready
  - Pagefind, the logo and the site's title
  - the content schema with `requirements` (decision 2)
- [ ] 2.3 `docs/guide/lib/ui-text.ts` (`uiText`) and `lib/shots.ts` (`shotFor`, the id scan, the duplicate check). `Ui.astro` and `Shot.astro` (decision 7).
- [ ] 2.4 `src/styles/theme.css` from the tokens. A unit test that compares it with `src/theme/tokens.ts`.
- [ ] 2.5 Vitest in `docs/guide/lib/*.test.ts` (the `unit` project's include gains them):
  - describe "UI names in the guide come from the messages": "A button name in Finnish", "An unknown key", "A message with a variable"
  - describe "Screenshots in the guide": "A captured screenshot", "A missing screenshot in CI", "A missing screenshot locally", "The same id saved twice"
- [ ] 2.6 A first `index.mdx` with its requirements, so the site builds. `pnpm guide:build` passes locally.

## 3. Capture and demo data

- [ ] 3.1 `docs/guide/playwright.config.ts`: the root `webServer`, 390 × 844, project `fi` with `locale: 'fi-FI'`, the global setup with the duplicate check, and the shots folder emptied and gitignored.
- [ ] 3.2 `capture/shot.ts`: `shot(page, id)` (decision 6).
- [ ] 3.3 `capture/demo.setup.ts`: Annika Kotivalo and Jussi Laine through the test inbox, with the data of decision 4, built with the e2e helpers and dates relative to today. Their `storageState` is saved. Fictional names, addresses and Business ID.
- [ ] 3.4 Root script `guide:capture`. The first capture script and page: `aloitus.mdx` and `capture/aloitus.capture.ts` (sign-in, name, language, account, help and support). `pnpm guide:capture` and `GUIDE_STRICT=1 pnpm guide:build` pass locally.

## 4. CI, deploy and the skill

- [ ] 4.1 `docs/guide/wrangler.jsonc` (`kotivalo-guide`, static assets, the `ohje.kotivalo.app` custom domain) and `public/_headers` (decision 7).
- [ ] 4.2 `.github/workflows/guide.yml` (decision 8): the path filter, the capture, `astro check`, the strict build, the artifact on PRs, and the deploy on `develop`. Actions pinned to commit SHAs.
- [ ] 4.3 `.claude/skills/generate-user-guides/SKILL.md` and a page template, adapted from Saldo's (decision 10).
- [ ] 4.4 Docs:
  - **README:** the guide, how to preview it locally, its deploy
  - **CLAUDE.md:** the commands `guide:dev`, `guide:build`, `guide:capture`, `guide:check` and `guide:hash`; the structure of `docs/guide/`; and in "Specs and tests", that a user-facing change updates its guide pages
  - **`openspec/config.yaml`:** the same rule in `tasks`

## 5. Guide pages: flats, sharing, ownership

- [ ] 5.1 `asunnot.mdx` with `capture/asunnot.capture.ts`: adding and editing a flat, the housing company, the details page, archiving and deleting.
- [ ] 5.2 `jakaminen.mdx` with its capture script: inviting, accepting, and what a co-owner sees.
- [ ] 5.3 `omistusosuudet.mdx` with its capture script: shares, changing, undoing and correcting.
- [ ] 5.4 `pnpm guide:check` lists these pages' requirements as current. The capture and the strict build pass locally.

## 6. Guide pages: charges, entries, documents

- [ ] 6.1 `vastikkeet.mdx` (amounts, financing charges, treatment, the charges by month) with its capture script.
- [ ] 6.2 `kayttomaksut.mdx` with its capture script.
- [ ] 6.3 `tulot-ja-menot.mdx` (entries, categories, receipts) with its capture script.
- [ ] 6.4 `dokumentit.mdx` with its capture script.
- [ ] 6.5 `pnpm guide:check`, the capture and the strict build pass locally.

## 7. Guide pages: tenancies and deposits

- [ ] 7.1 `vuokralainen.mdx`: the new tenant, rent and its changes, occupants, fees and the lease. With its capture script.
- [ ] 7.2 `vuokrasuhteen-paattyminen.mdx`: notice periods, ending, cancelling, correcting and removing. With its capture script.
- [ ] 7.3 `vakuus.mdx`: the deposit, its return and the reminder. With its capture script.
- [ ] 7.4 `pnpm guide:check`, the capture and the strict build pass locally.

## 8. Guide pages: rent payments and the year summary

- [ ] 8.1 `vuokranmaksut.mdx` with its capture script.
- [ ] 8.2 `vuosiyhteenveto.mdx`: the cards, the estimate, whose figures, a former owner. With its capture script.
- [ ] 8.3 `lomake-7h.mdx`: the form 7H page, copying to MyTax, the PDF. With its capture script.
- [ ] 8.4 `index.mdx` completed: what Kotivalo does, installing it on a phone, and links to every page.
- [ ] 8.5 `pnpm guide:check`, the capture and the strict build pass locally.

## 9. The guide link on the account page

- [ ] 9.1 `src/lib/guide.ts`: `guideUrl(locale)`, with a unit test.
- [ ] 9.2 `AccountPage.tsx`: the *Käyttöohje* link in *Ohje ja tuki*. The message `account_guide_link` in fi, sv and en (translate skill).
- [ ] 9.3 Playwright in `e2e/account.spec.ts` (or the support spec's file): describe "Help and support on the account page": "The link to the user guide" and "The user guide in Swedish". The existing scenario keeps passing.
- [ ] 9.4 `aloitus.mdx` cites the modified requirement's new hash.

## 10. Turning the check on

- [ ] 10.1 `docs/guide/not-in-guide.json`: every main-spec requirement no page cites, each with its reason (limits, the test inbox, logging and error reporting, migrations, server-side access checks).
- [ ] 10.2 `pnpm guide:check` in CI's `traceability` job, after `pnpm check:traceability`. It passes with no uncovered requirement.
- [ ] 10.3 The demo Business ID checked in YTJ not to belong to a company (an agent looks it up; the user confirms if the lookup fails).

## 11. Verification, review and archive

- [ ] 11.1 The full `pnpm test`, `pnpm test:e2e`, `pnpm check:traceability`, `pnpm guide:check`, `pnpm guide:capture` and `GUIDE_STRICT=1 pnpm guide:build`.
- [ ] 11.2 The `pr-review` skill, and its findings handled.
- [ ] 11.3 `openspec archive add-user-guide` as the PR's last commit. The archived `support` requirement's new hash is already on `aloitus.mdx` (decision 3), so `guide:check` passes on the archive commit.
- [ ] 11.4 After the merge: the user checks that `ohje.kotivalo.app` is up, adds the custom domain in the dashboard if the first deploy couldn't, and reads the Finnish guide on a phone.
