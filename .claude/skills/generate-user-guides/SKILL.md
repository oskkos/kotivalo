---
name: generate-user-guides
description: Write or update Kotivalo's Finnish user guide (docs/guide) from the OpenSpec specs. A page is MDX with `<Ui key>` names from the messages and `<Shot id>` screenshots, with a Playwright capture script beside it, and cites the requirements it describes with hashes. Use when a change alters user-facing behaviour, when `pnpm guide:check` reports stale or uncovered requirements, or when the user asks for a guide page.
---

Kotivalo's user guide is **a script**: MDX pages in Finnish and Playwright capture scripts. CI turns it into the site (`ohje.kotivalo.app`) and takes the screenshots from the real app, so this skill never takes or commits screenshots. The specs are the source of truth: a page never claims what no requirement says.

The machinery is described in `openspec/specs/user-guide/spec.md` (or, while the change is active, `openspec/changes/add-user-guide/design.md`).

## Commands

- `pnpm guide:check` (`--json` for a machine summary): the pages' requirement hashes against the specs, and the requirements no page covers. Fails on stale, unknown, uncovered, contradictory and reason-less entries; reports requirements added by active changes as pending.
- `pnpm guide:hash [spec]`: the frontmatter entries (`spec`, `name`, `hash`) for a spec's requirements, as the check computes them (active changes' texts included).
- `pnpm guide:capture`: builds the app and walks the capture scripts, saving `docs/guide/src/assets/shots/fi/<id>.png` (gitignored). Run it to look at the screens you write about; `pnpm guide:capture --project=fi` skips nothing, because the demo project runs first. Read a PNG with the Read tool.
- `GUIDE_STRICT=1 pnpm guide:build`: the site as CI builds it. A missing screenshot, an unknown `<Ui key>` or a malformed `requirements` list fails it. `pnpm guide:dev` serves it.

## Arguments

`/generate-user-guides [scope] [--check]`

- **scope** (optional): a spec, a requirement name or a page. Omitted: the delta, from `pnpm guide:check --json`.
- **--check**: report only. Run `pnpm guide:check`, triage, write nothing.

## What to do

1. **Find the work.** Run `pnpm guide:check --json`.
   - `stale`: a cited requirement changed. Reread the requirement, then rewrite what the page says about it.
   - `uncovered`: no page cites it and `docs/guide/not-in-guide.json` doesn't list it. Add it to a page, or list it with a reason if a user can't act on it (a limit, an access check, logging, a migration).
   - `pending`: an active change adds it. Document it in the change's own commits, before the archive.
   - **A clean delta is not "done".** It only covers requirements a page already cites; a new feature is `uncovered` or `pending`. Say which you triaged.
2. **Write the page and its capture script together.**
   - Page: `docs/guide/src/content/docs/<slug>.mdx`, from `templates/page.mdx`. Finnish, task-oriented, one page per task (see the table in design.md, decision 9).
   - Script: `docs/guide/capture/<slug>.capture.ts`, one file per page. It starts from the demo accounts (`ANNIKA`, `JUSSI` in `capture/paths.ts`, with `test.use({ storageState })`), walks the page's steps with the helpers in `e2e/support/` or its own locators in Finnish, and saves each screenshot once with `await shot(page, '<id>')`. An id is unique across all scripts.
   - A page that deletes, ends or archives something does it to data of its own (a flat or tenancy the script adds), never to the demo data other pages show.
3. **Cite the requirements.** Put each in the page's frontmatter `requirements` with the hash from `pnpm guide:hash <spec>`. Never write a hash by hand.
4. **Use the app's words.** Name buttons, fields, headings and menus with `<Ui key="message_key" />`; find the key in `messages/fi.json`. A message with a variable or plural forms can't be a `<Ui>`; write the name out or use a similar fixed message.
5. **Check.** `pnpm guide:check`, `pnpm guide:capture`, then `GUIDE_STRICT=1 pnpm guide:build`. Look at the screenshots you wrote about; an empty or odd screen is a fault in the script or the demo data.
6. **Commit** with the change's code: `docs(guide): …`, in the group that alters the behaviour.

## Writing rules

- **Say no date, amount or name that depends on the day or the demo data.** The demo data is relative to today and changes between runs.
- **Describe what a requirement says, not more.** If the UI does something no requirement states, say nothing or raise the gap.
- **Short and in order.** Numbered steps for a task, a sentence for what happens after, a screenshot where seeing helps.
- **Fictional names only** in anything the capture types: the demo people, addresses and Business ID are not real.
- **Finnish only for now.** Swedish and English pages are a later change, through the translate skill.

## Leaving requirements out

`docs/guide/not-in-guide.json` is `[{ "spec", "name", "reason" }]`. A reason says why a user can't act on it. A requirement may not be both cited and listed. When in doubt, cite it: an undocumented user-facing behaviour is the worse mistake.
