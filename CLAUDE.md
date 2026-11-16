# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Kotivalo ("Valoa vuokranantajan arkeen", roughly "light for a landlord's everyday work") is a mobile-first app for Finnish private landlords with 1–10 rental flats, often co-owned. It tracks flats, tenancies, income, expenses and receipts, and produces each owner's tax return figures (Finnish form 7H). MIT licensed.

`CONCEPT.md` is the source of truth for the product, the domain rules, the chosen stack and the data model draft. Read it before designing or changing features. The UI design (logo, splash and 13 phone screens, 390 × 844) is on the [Design canvas](https://claude.ai/code/artifact/16231de4-89b5-4369-aabc-610e9c6893e6); read it with the Artifact tool, not WebFetch. Where the canvas and CONCEPT.md disagree, CONCEPT.md wins and the gap should be raised.

## Current state

There's no code yet. The stack is chosen (below), but nothing has been scaffolded. Don't invent build, lint or test commands. Once the project is scaffolded, add the real commands here, including how to run a single Vitest test and a single Playwright test.

## Stack (planned, per CONCEPT.md §5)

TanStack Start (React, SSR, server functions) · MUI · Paraglide JS (i18n) · Cloudflare Workers + D1 (via Drizzle) + R2 · Better Auth · Cloudflare Email Service · Vitest + Testing Library · `@cloudflare/vitest-plugin` (Miniflare) · Playwright.

Constraints that are easy to get wrong:
- **Workers is not Node.** Avoid Node-specific dependencies.
- D1 and R2 are bindings (`env.DB`, etc.) that exist only while a request is being handled, so Better Auth is created **per request**.
- R2 files are private and are served only through the Worker, after an access check. D1 stores only the key and metadata.
- Email sending goes through a single function so the provider can be swapped.

## Domain rules that shape the code

- **Everything is time-bound.** Rent, charges, financing-charge treatment, ownership shares and tenancies are validity periods (`valid_from` / `valid_to`). Never overwrite them.
- Money is stored as **integer cents**. Dates are ISO `YYYY-MM-DD`. Ownership shares are integers in basis points (5000 = 50.00 %) and add up to exactly 10000. A 0 % share means visibility only.
- Access and ownership are **per flat**. There is no household concept. Former owners keep read access to their own ownership period.
- The year summary is **computed from transactions and periods**, never stored. The calculations (shares, mid-year changes, income-recognised vs. capitalised financing charge, notice periods, deposit returns) should be pure functions with Vitest coverage.
- Ending a tenancy and adding a new tenant are separate actions.

## i18n

- Finnish (primary), Swedish and English from day one. Write the Finnish copy first. Translations live in `fi.json`, `sv.json` and `en.json` (Paraglide).
- **No hard-coded text**: all UI copy, errors and emails come from messages, in the recipient's language. The language is stored per user and is not part of the URL in the signed-in app.
- Formatting uses `Intl` with `fi-FI`, `sv-FI` and `en-FI`. Format inside a sentence in the Paraglide message, and format standalone values through a single helper module (`formatMoney(cents)`, `formatDate(iso)`).

## Specs and tests (OpenSpec)

- Requirements live in OpenSpec, one spec per capability. Changes are made as OpenSpec change proposals, and specs are updated in the same change as the code.
- **Every scenario needs a passing test. Every requirement needs a Playwright test**, unless it can't be tested in a browser. Then Vitest covers it, and the reason is recorded with the requirement.
- Test names trace to the spec: `test.describe('<Requirement>')` with one `test('<Scenario>')` per scenario. Use the same naming in Vitest. CI blocks merges when this mapping is incomplete.

## Git

- `develop` is the main branch and the PR target.
