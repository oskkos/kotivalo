## Context

`track-tenancies` (#30, PR #94) added tenancies as periods with endings, notice periods and the rent saved with a new tenancy. Its review found that owners get stuck in four cases (proposal.md): a tenancy that never starts, an earlier open-ended tenancy, a tenancy that starts before the flat's latest rent period, and a cancel rule stricter in the spec than in the code. The review fixes already in `develop` (the correction checked against the recorded ending, "Add a new tenant" while a tenancy has a last day, the all-or-nothing save, the previous-tenancy banner) stay as they are.

The table already has everything needed: `valid_to`, `notice_given_by` and `notice_date` hold an ending, whenever it is recorded.

## Goals / Non-Goals

**Goals:**
- Remove a tenancy before it starts
- Record an earlier tenancy, open-ended or fixed-term, with its ending, and reach it to correct it
- Add a tenancy that starts before the latest rent period without touching the rent
- Make the spec's cancel rule match the code

**Non-Goals:**
- Removing a tenancy that has started: a wrong history entry is corrected instead, and deposits (#93) and rent payments (#33) will refer to tenancies
- Changing the rent of a past period from the tenancy form: it stays on the Rent and charges page
- Any table change

## Decisions

### The ending is part of adding, with the same rules

`createTenancy` takes an optional ending `{ noticeGivenBy, noticeDate, lastDay }`, with the same schema as `endTenancyInput` (`schemas.ts`), so the form and the server share it.

- The server checks the dates with `validateTenancyDates` and `validTo` set to the ending's last day (else the term's end), then `validateEnding(fields, ending, today)`. The ending's own rules give the same reasons as the end form, and a notice date before the start (any ending on a tenancy that hasn't started) is refused there with `tenancy_notice_before_start`.
- The repository's create statement takes `validTo`, `noticeGivenBy` and `noticeDate` instead of always `term_end` and nulls, and its overlap condition uses `validTo`. One insert, so the batch with the rent stays as it is.
- The form shows an "already ended or notice given" section only when the start entered is before today. Its fields follow the end form (`EndTenancyForm`): who gave notice, the notice date, the last rent day suggested by `earliestLastDay`. To keep `TenancyForm` reviewable, the fields move into a small shared component used by both forms.
- Alternative: add the tenancy, then end it. Rejected: the add itself is refused by the overlap, which is the bug.

### Rent is asked only from the latest rent period on

A pure `rentAsked(rents, start)` in `features/tenancies/rent.ts`: true when there is no rent period, or the start's month is on or after the latest period's start. The form hides the rent field when it is false, and the server ignores the rent and writes no rent statements then. The schema's `rent` becomes optional, and the server answers `amount_invalid` (the empty-field reason the form already shows) when the rent is asked but missing.

- This replaces the `amount_date_too_early` refusal for a new tenancy. It also covers the current tenant who moved in before the owner entered the rent, which the old rule made impossible to add.
- Alternative: write the rent anyway, as a period before the latest one. Rejected: rent periods are corrected only at the end (#31); inserting into the middle would need a new period operation for this one form.

### Removing is a guarded delete

`tenancyRepository.removeNotStarted(actorId, propertyId, tenancyId, today)`: a `DELETE` conditioned on the owner role and `valid_from > today`, returning the id. The server checks first for the reason (`tenancy_already_started`, `tenancy_not_found`, the role), and a delete that applies nothing is explained again from a fresh read, as the other writes do. Rent periods are not touched. Logged as `tenancy.removed` at `info`.

- The action is on the correction form (`TenancyForm` in edit mode), shown only while the tenancy hasn't started, with a confirmation dialog like the entry delete dialog. The form is where an owner goes to change a single tenancy, and every tenancy is reachable from it once the other tenancies link there.
- Alternative: a button on the Tenancy page. Rejected: an upcoming tenancy after a running one is listed under the other tenancies, which have no actions; the form covers both.

### The Tenancy page

- `TenancyPage` takes an `otherAction` render prop like `currentActions`, so the route wraps each other tenancy in a link to its correction form for owners, and the feature stays free of routes.
- "Add an earlier tenancy" is a text link for owners under the other tenancies (or where they would be), shown whenever the flat has a current tenancy. A vacant flat already offers "Add tenant".
- The route no longer offers "End tenancy" while the status is `starts`.

### Cancelling

No code change: `cancelTenancyEnding` and the repository's `noOverlap` already refuse only an overlapping later tenancy. The spec now says so, and a Workers test covers the new scenario.

## Risks / Trade-offs

- [A tenancy added before the latest rent period has no rent of its own in the app] → The rent periods are the source for the year summary (#31); a past tenancy's rent belongs there too, and the Rent and charges page is where it is set. The form says so instead of the field.
- [Removing deletes data] → Only before the start, by an owner, after a confirmation; nothing else refers to a tenancy yet. Once deposits and payments (#93, #33) refer to tenancies, removal must refuse a tenancy that has them.
- [Recording an old ending under today's notice rules] → `validateEnding` uses the contract date against `LANDLORD_RULE_CHANGE`, not today, so an ending in 2025 follows the old law. The tenant's and agreed endings have no limit, so a past ending the owner remembers roughly is accepted.

## Migration Plan

No migration. The changes are code only and deploy as usual; rollback is a revert.

## Open Questions

None.
