## ADDED Requirements

### Requirement: Guide pages cite their requirements
Every page of the user guide (`docs/guide/src/content/docs/**/*.mdx`) SHALL list in its frontmatter, under `requirements`, the spec requirements it describes, each with its capability, its name and a hash of its text. The hash SHALL be the first 12 hexadecimal digits of the SHA-256 of the requirement's block (its heading line through its last scenario) with every run of whitespace turned into one space and the ends trimmed. `pnpm guide:check` SHALL report each cited requirement whose hash differs from the current one as stale, and each cited requirement that no longer exists as unknown, and SHALL exit with a failure when it reports either.

A cited hash SHALL also count as current when it matches the requirement as an active change (`openspec/changes/<change>/`, not archived) adds or modifies it, so a change can update its guide pages before it is archived. The hashes SHALL be computed by the same code that `pnpm guide:check` and the `generate-user-guides` skill use.

**No Playwright test:** the check reads committed files in Node and runs no app; its scenarios are covered by Vitest on the check's functions.

#### Scenario: A page with current hashes
- **WHEN** `kirjautuminen.mdx` cites `authentication` "Sign in with an emailed code" with the hash of its current text
- **THEN** `pnpm guide:check` reports nothing for that page and exits successfully

#### Scenario: A changed requirement
- **WHEN** the scenario "The code step shows the support address" of `support` "Help when the sign-in code does not arrive" is reworded in the main spec, and `kirjautuminen.mdx` still cites the old hash
- **THEN** `pnpm guide:check` reports `kirjautuminen.mdx` as stale for that requirement and fails

#### Scenario: Whitespace alone is not a change
- **WHEN** a requirement's text is rewrapped onto more lines, with the same words
- **THEN** its hash stays the same and no page is reported

#### Scenario: A renamed requirement
- **WHEN** a page cites `tenancies` "Ending a lease", a name the main spec once had, and the main spec no longer has a requirement with that name
- **THEN** `pnpm guide:check` reports the citation as unknown and fails

#### Scenario: A hash from an active change
- **WHEN** an active change modifies `deposits` "Recording a deposit return", and `vakuus.mdx` cites the hash of the modified text
- **THEN** `pnpm guide:check` counts the citation as current, while the main spec still has the old text

### Requirement: User-facing requirements covered by the guide
Every requirement in the main specs (`openspec/specs/`) SHALL either be cited by at least one guide page or be listed in `docs/guide/not-in-guide.json` with a reason: a limit, an access check, logging or another behaviour a user can't act on. `pnpm guide:check` SHALL report and fail on:
- a requirement that is neither cited nor listed
- a listed requirement without a reason
- a listed requirement that no longer exists
- a requirement that is both cited and listed

A requirement that an active change adds SHALL be reported as pending and SHALL NOT fail the check until the change is archived.

**No Playwright test:** the check reads committed files in Node and runs no app; its scenarios are covered by Vitest on the check's functions.

#### Scenario: An uncovered requirement
- **WHEN** the main spec `documents` has "The documents page", and no page cites it and `not-in-guide.json` does not list it
- **THEN** `pnpm guide:check` reports it as uncovered and fails

#### Scenario: A requirement left out with a reason
- **WHEN** `not-in-guide.json` lists `authentication` "Limiting code requests" with the reason "A limit; the user sees only its error message."
- **THEN** `pnpm guide:check` does not report it

#### Scenario: A left-out requirement without a reason
- **WHEN** `not-in-guide.json` lists `error-reporting` "Showing a reference with an unexpected error" with an empty reason
- **THEN** `pnpm guide:check` reports the missing reason and fails

#### Scenario: A left-out requirement that no longer exists
- **WHEN** `not-in-guide.json` lists a requirement that no main spec has
- **THEN** `pnpm guide:check` reports it as unknown and fails

#### Scenario: Cited and left out
- **WHEN** a requirement is cited by `asunnot.mdx` and also listed in `not-in-guide.json`
- **THEN** `pnpm guide:check` reports the contradiction and fails

#### Scenario: A requirement added by an active change
- **WHEN** an active change adds the requirement "Statistics of the year", and no page cites it
- **THEN** `pnpm guide:check` reports it as pending and exits successfully

### Requirement: UI names in the guide come from the messages
A guide page SHALL name the app's buttons, fields, headings and menus with `<Ui key="…" />`, which the site's build SHALL render as the message `key` from `messages/<language>.json` in the page's language, marked as a UI name. The build SHALL fail when:
- the key is not in the messages
- the message has variables or plural forms, because a UI name in the guide is one fixed text

**No Playwright test:** the name is resolved at the site's build time; the resolver is a pure function covered by Vitest.

#### Scenario: A button name in Finnish
- **WHEN** a Finnish page has `<Ui key="account_title" />`
- **THEN** the built page shows `Tili`

#### Scenario: An unknown key
- **WHEN** a page has `<Ui key="account_titel" />`
- **THEN** the site's build fails and names the page and the key

#### Scenario: A message with a variable
- **WHEN** a page has `<Ui key="year_summary_empty_title" />`, whose Finnish text is `Ei omistusosuutta vuonna {year}`
- **THEN** the site's build fails and names the key and its variable

### Requirement: Screenshots in the guide
A guide page SHALL show a screenshot with `<Shot id="…" alt="…" />`, which the site's build SHALL render as the image `<language>/<id>.png` that the capture scripts saved for the page's language, with the given alternative text. Screenshots SHALL be captured from the built app at 390 × 844 with the demo data, and SHALL NOT be committed. A screenshot id SHALL be saved by one capture step only: the capture SHALL fail when two steps save the same id. In a strict build (`GUIDE_STRICT=1`, as in CI) a missing screenshot SHALL fail the build. In a local build it SHALL be shown as a placeholder with its id.

**No Playwright test:** the screenshot is resolved at the site's build time, and the capture scripts are themselves Playwright runs; the resolver and the duplicate check are pure functions covered by Vitest.

#### Scenario: A captured screenshot
- **WHEN** a Finnish page has `<Shot id="flat-form-filled" alt="Täytetty asuntolomake" />`, and the capture saved `fi/flat-form-filled.png`
- **THEN** the built page shows that image with the alternative text `Täytetty asuntolomake`

#### Scenario: A missing screenshot in CI
- **WHEN** a page has `<Shot id="flat-form-filed" />` and no capture saved `fi/flat-form-filed.png`, and the build runs with `GUIDE_STRICT=1`
- **THEN** the build fails and names the page and the id

#### Scenario: A missing screenshot locally
- **WHEN** the same page is built without `GUIDE_STRICT`
- **THEN** the page shows a placeholder naming `flat-form-filed`

#### Scenario: The same id saved twice
- **WHEN** two capture steps save the id `flat-list`
- **THEN** the capture fails and names both scripts
