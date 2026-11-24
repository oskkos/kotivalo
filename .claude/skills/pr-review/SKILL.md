---
name: pr-review
description: Review a Kotivalo pull request and fix what the review finds, with the pr-reviewer and pr-fixer agents in turn, until the review is clean or two rounds have run. Use when an OpenSpec change's implementation is done (all tasks.md groups committed), or when the user asks to review a PR or branch.
---

Run the review–fix loop for the current branch's PR. The reviewer and the fixer are separate agents on purpose: the reviewer never sees the implementer's reasoning, and the fixer doesn't trust the reviewer blindly. Agents can't start other agents, so this loop runs here, in the main session.

**Input**: optionally a PR number and an OpenSpec change name. Default: the current branch's PR (`gh pr view --json number,title,headRefName`) and the change named in its branch or title, or the only one in `openspec/changes/` (also `archive/`).

## 1. Preconditions

- `git status --porcelain` is empty. If not, stop and ask: uncommitted work would get mixed into fix commits.
- The branch is pushed (`git status -sb` shows no `ahead`), so the reviewer and CI see the same commits.
- Note `BASE=$(git rev-parse HEAD)`: fixes will start after it.

## 2. Review (round 1)

Start the `pr-reviewer` agent with only: the PR number, the change name, and "review the whole PR". No summary of the work, no hints about known weak spots.

If the diff touches `messages/` or `i18n/`, start the `term-critic` agent at the same time with `git diff origin/develop...HEAD -- i18n messages` only.

## 3. Triage

Show the user the findings in short form (id, severity, title, where), then sort them yourself:

- `blocker` and `important` with high confidence go to the fixer.
- `important` with medium confidence: read the code yourself first; send it on only if it holds.
- `nit`: go to the fixer only if the user has said to fix nits.
- `question`, and anything that changes a spec decision the user made: don't send. Ask the user.
- term-critic `reject` and `question` verdicts: handle them with the translate skill here, not through the fixer.

If nothing goes to the fixer, skip to step 6.

## 4. Fix

Start the `pr-fixer` agent with the selected findings verbatim and the change name. When it returns, check its table: every `fixed` row has a commit, and `git status` is clean.

## 5. Re-review (round 2, once)

Start a new `pr-reviewer` with `scope: $BASE..HEAD` and the findings that were fixed, so it checks that each is resolved and the fixes broke nothing. New `blocker` or `important` findings go to one more `pr-fixer` run. Then stop: don't start a third round. Whatever is still open goes to the user.

## 6. Push and report

- If there are new commits, `git push` (never force) and say that CI will run. Don't wait for CI unless the user asks.
- Report to the user, in their language:
  - each finding with its outcome (fixed + SHA, rejected + why, needs decision, question, nit left);
  - the term-critic verdicts, if it ran;
  - what is left for them: questions, decisions, and human checks no agent can do (native Swedish or Finnish wording, how the screen looks on a phone).

Don't post the review on GitHub unless the user asks; then post one summary comment with `gh pr comment`.
