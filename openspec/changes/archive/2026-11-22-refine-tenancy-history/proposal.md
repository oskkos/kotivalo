## Why

The review of `track-tenancies` (PR #94) found gaps that leave owners stuck in ordinary cases:

- A tenant who withdraws before moving in leaves a tenancy that can't be ended or removed. It blocks the flat until its term ends.
- The usual Finnish contract is open-ended, but an earlier open-ended tenancy can't be added to record the history. Without an end it overlaps every later tenancy.
- A current tenant who moved in before the flat's first rent period can't be added at all, because any rent typed is refused as too early.
- The spec refuses to cancel an ending whenever a later tenancy exists. The code refuses only when the restored period would overlap it, which is the sensible rule.
- The rule that a correction must fit a recorded ending is in the code since PR #94, but no scenario states it.

## What Changes

- **Removing a tenancy that hasn't started.** An owner can remove a tenancy before its start day, after a confirmation, from the tenancy's correction form. Once it has started, removing it is refused (`tenancy_already_started`). Rent periods saved with it stay, because the rent belongs to the flat. "End tenancy" is no longer offered while a tenancy hasn't started, because the notice date can't be both before today and on or after the start.
- **Adding an earlier tenancy with its ending.** When the start is before today, the new tenant form can record the tenancy's ending: who gave notice, the notice date and the last rent day, under the rules of "Ending a tenancy" and "Ending a fixed-term tenancy early". The overlap check uses that last day. The same works for a running tenancy whose notice has already been given.
- **Reaching earlier tenancies.** Owners get an "Add an earlier tenancy" link under the other tenancies, because no add action shows while an open-ended tenancy runs. Each tenancy listed there opens its correction form for owners, so a history entry can be corrected, and an upcoming one removed.
- **The rent of a tenancy that starts before the latest rent period.** When the start month is before the latest rent period's start, the form doesn't ask for the rent and the save doesn't change the rent periods. The rent stays on the Rent and charges page. This replaces the refusal with `amount_date_too_early`.
- **Cancelling an ending.** Refused only when a later tenancy would overlap the restored period (`tenancy_cancel_later_tenancy`).
- **Correcting a tenancy.** A correction must fit a recorded ending (`tenancy_correction_conflicts_ending`): a scenario for the rule already in the code.

Not in this change: removing a tenancy that has started. A wrong history entry is corrected instead; deposits (#93) and rent payments (#33) will refer to tenancies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tenancies`:
  - "Adding a tenant": the ending of an earlier tenancy can be recorded in the same form.
  - "Tenancy dates and details": an earlier open-ended tenancy fits before the others once its ending is recorded.
  - "The rent of a new tenancy": no rent is asked or saved before the latest rent period.
  - "The tenancy page": the earlier-tenancy link, other tenancies open for owners, and no End while a tenancy hasn't started.
  - "Cancelling an ending": only an overlapping later tenancy refuses it.
  - "Correcting a tenancy": the recorded-ending scenario.
  - New requirement "Removing a tenancy that hasn't started".

## Impact

- **Tables:** none added or altered. A tenancy added with its ending fills the existing `valid_to`, `notice_given_by` and `notice_date` columns.
- **Code:**
  - `features/tenancies/`:
    - the repository: create with an ending, and a remove guarded by the start date and the owner check
    - the server functions: the ending on create, the rent skipped before the latest period, removing, the cancel check
    - `TenancyForm`: the ending fields and the remove action
    - `TenancyPage`: the earlier-tenancy link and links on the other tenancies
  - the Tenancy page route: no End while the tenancy hasn't started
- **Screens:** the Tenancy page, the new tenant form and the correction form, on the Design canvas row "Vuokrasuhteet". The canvas has no ending section in the new tenant form and no remove action. The ending fields follow the "Päätä vuokrasuhde" form, and the remove confirmation follows the entry delete dialog.
- **Messages:** fi, sv and en for the new labels and the reason `tenancy_already_started`, with the translate skill and the term bank.
- **Docs:** CLAUDE.md: the current state.
