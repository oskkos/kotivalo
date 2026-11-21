---
name: translate
description: Translate Kotivalo's messages and maintain the term bank (i18n/terms.json). Use when adding or changing messages in messages/*.json, adding or changing a domain or tax term, checking how sure a translation is, or auditing the messages against the term bank. Researches terms in the reference sources, records each with a status and its sources, and has the term-critic agent review every term bank change.
---

# Translate

Kotivalo ships in Finnish, Swedish and English. Finnish is written first; Swedish is **Finland-Swedish** and English is British English for users in Finland. The term bank `i18n/terms.json` keeps one word per concept in each language, and the reference sources are listed in `i18n/sources.json`.

Read first: `i18n/terms.json`, `i18n/sources.json`, and the "Domain glossary" and "i18n" sections of `CLAUDE.md`.

## What this skill does

1. **Translates messages.** New or changed Finnish copy gets its Swedish and English, using the bank's words.
2. **Adds or changes terms.** It researches the word in each language, records the sources and sets the status.
3. **Audits.** It goes through the messages, finds concepts that deserve a term, and finds drift that the checks can't see. For example, a word that is used consistently but is wrong.

Every change to `i18n/terms.json` ends with the critic review (step 6).

## 1. Decide what needs a term

A concept gets a term when:
- it is a domain or tax concept (anything in CONCEPT.md's domain, form 7H, the tax rules), or
- the same thing is said in several messages and has competing words.

Generic UI words (save, cancel, back) don't get terms.

One concept is one term. A compound that means something of its own, like *omistusjakso* (ownership period), gets its own entry. The check lets the longer of two overlapping matches win, so the compound and its parts don't collide.

## 2. Research each language

Work through `i18n/sources.json`, authoritative sources first:

- **Finnish:** first how the Tax Administration (`vero_fi`) or the law (`finlex`) says it, then everyday usage. The UI may use the everyday word if the tax word is stiff. Record that choice in `notes`.
- **Swedish:** take the word from the Swedish text of the Finnish law (`finlex`) or the Tax Administration's Swedish pages (`vero_sv`), not from Sweden. Sweden's words often differ: *vederlag*, not *avgift*, for housing company charges, and *hyresvärd* and *hyresgäst* as in the Finnish Act on Residential Leases. Use `fsob` to check that a word is Finland-Swedish and not a finlandism to avoid. `svenska_se` and `iate` describe Sweden's Swedish, so they only support a choice.
- **English:** take the word from the Tax Administration's English pages (`vero_en`) for tax terms. For everyday words, use the plain British word: *flat*, *postcode*, *-ise* spellings. Finlex's English translations are unofficial (`finlex_en`).

**Never invent a URL or a quote.** Cite a source only if you opened the page in this session and saw the term on it in the meaning you need. Copy a short quote (up to 300 characters) that shows the term in context. If a page can't be fetched, say so and don't cite it.

## 3. Set the status

Status is about evidence, not confidence. Pick it from what you found:

| Status     | When                                                                                             | `sources`                           |
| ---------- | ------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `proposed` | Your own suggestion, or a source was not found or could not be opened                            | none                                |
| `derived`  | Built from sources but not found as such, e.g. a compound of two verified words, or a reference source only | at least one                        |
| `verified` | An authoritative source uses this word in this meaning                                           | at least one `authoritative` source |
| `reviewed` | A person fluent in the language accepted it. Set it only when the user says so, with `reviewed: { by, on }` | optional                            |

When unsure between two statuses, choose the lower one. A `proposed` term is honest. A `verified` term with a weak source is not.

The tests in `scripts/terms/term-bank.test.ts` enforce these rules.

## 4. Write the entry

```json
"maintenance_charge": {
  "code": "maintenanceCharge",
  "definition": "A monthly charge the housing company collects for upkeep; a deductible expense for the landlord.",
  "showOriginal": true,
  "fi": { "term": "hoitovastike", "match": ["hoitovastik\\p{L}*"], "status": "verified", "sources": [ … ] },
  "sv": { "term": "skötselvederlag", "match": ["skötselvederlag\\p{L}*"], "avoid": ["underhållsavgift\\p{L}*"], "status": "verified", "sources": [ … ] },
  "en": { "term": "maintenance charge", "match": ["maintenance charges?"], "status": "derived", "sources": [ … ] }
}
```

- **`id`:** snake_case English. **`code`:** the name in code if there is one (CLAUDE.md naming).
- **`match`:** regular expressions, matched case-insensitively against whole words, so nothing before or after them may be a letter.
  - Cover every inflection used in sentences. In Finnish that means the cases and plurals: *asunto, asunnon, asuntoa, asunnot, asuntoihin* → `asun[nt]o\p{L}*`. In Swedish, the definite and plural forms: `bost[aä]d\p{L}*`.
  - Use `\p{L}`, not `\w`, which misses å, ä and ö.
  - Check that a stem does not catch other words. Known traps: *vakuu-* catches *vakuutus* (insurance), *kirjau-* catches *kirjautua* (sign in), *kuit-* catches *kuitenkin*, and *lain* is also the genitive of *laki*. When that happens, list the forms explicitly.
  - Try the patterns against real sentences with `node -e` before saving.
- **`avoid`:** alternatives that were decided against. The check fails on any message that uses them. Add an avoid pattern only when the word cannot mean anything else in the app.
- **`except`:** message keys that may leave the term out, with a reason each, e.g. "The flat is named by its address." Keep them rare; the check reports exceptions that are no longer needed.
- **`showOriginal`:** for tax terms whose Swedish and English text should also show the Finnish word (CONCEPT.md §1).
- **`notes`:** why a word was chosen over another, and anything a reviewer should know.

## 5. Update the messages in the same change

When a term is added or its word changes, update every message that uses it, in all three languages. Then:

```bash
pnpm test scripts/terms src/messages.test.ts   # term bank rules and message checks
pnpm lint:fix                                  # sorts keys in messages/*.json and i18n/*.json
pnpm test:e2e -g "<affected test>"             # if a changed text is asserted in e2e/
```

Search `e2e/` and `src/` for any old text you changed. Tests may assert it.

## 6. Critic review (every term bank change)

Run the `term-critic` agent with the Agent tool once the tests pass. Give it the diff of `i18n/` and `messages/` (`git diff -- i18n messages`) and nothing else. Don't pass on your reasoning; the point is an independent read.

Handle each finding in one of three ways:
- **fix:** change the entry or the messages, then rerun step 5
- **lower the status:** if the critic could not confirm a source
- **disagree:** keep the entry, and give the reason in your report

Re-run the critic after substantial fixes. One clean pass is enough.

A PostToolUse hook reminds you when `i18n/terms.json` is edited. Inside this skill that reminder is expected; step 6 covers it.

## 7. Report

End with:
- each changed term: id, the word in each language, its status and the source ids
- the critic's verdict and what you did with each finding
- `pnpm terms:report` counts. Terms still `proposed` need a fluent speaker; say so plainly, and don't present them as checked.
