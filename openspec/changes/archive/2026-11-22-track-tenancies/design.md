## Context

A flat has owners and members (#28), rent and charges as monthly periods (#31) and entries (#32), but no tenant. The notice periods were checked against the Act on Residential Leases for #18 (CONCEPT.md §4.2): the landlord's period depends on when the contract was made, because 531/2026 changed it on 1.10.2026 and kept the old rule for older contracts. #25 decided that rent payments count from the tenancy's due day; they come in #33. Deposits and the contract attachment moved to #93, after go-live.

The Design canvas row "Vuokrasuhteet" has the screens, and the user approved its open points (tenancy card on the edit page, the rent in the form, "agreed" as a third way to end, statuses on the flats list, cancelling, contact details for everyone with access, corrections in place).

## Goals / Non-Goals

**Goals:**
- Tenancies per flat with the contract details, statuses and history
- The earliest legal last rent day for each case, as pure functions
- Adding a tenant also sets the rent when it changes, in one save
- The tenancy status on the flats list and the edit page

**Non-Goals:**
- Deposits, their return and the contract attachment (#93)
- Rent payments, paid / late and partial-month rent (#33)
- Reminders (#84); the flat details page (#33)
- Court proceedings, eviction or the tenant's protection against notice (§56): the app records what happened

## Decisions

### One table, the tenancy as a period

`tenancies` uses `validity()`: `valid_from` is the start, and `valid_to` is the tenancy's last day: the fixed term's end, or the last rent day once it is ended, or null while an open-ended tenancy runs. The other columns are `id()`, `property_id`, `tenant_name`, `tenant_phone` and `tenant_email` (nullable), `contract_type` (`open_ended`, `fixed_term`), `contract_made` and `term_end` (`isoDate()`, `term_end` only for fixed-term), `due_day` (integer 1–31), `notice_given_by` (`tenant`, `landlord`, `agreed`, `court`, `other`, nullable) and `notice_date` (nullable), `created_by`, `created_at` and `updated_at` (`instant()`), and an index on `(property_id, valid_from)`.

- Overlap, statuses and "the tenancy running on a day" are then the same validity queries as the other periods.
- `term_end` is kept separately so that cancelling an early end of a fixed term restores it.
- Ending sets `valid_to`, `notice_given_by` and `notice_date`; cancelling clears the notice and puts `valid_to` back to `term_end` (or null).
- Alternative: a separate `tenancy_endings` table. Rejected: one ending per tenancy, and a second table only adds a join.

The tenant's contact details stay in the tenancy row: there is no tenant entity shared between flats or tenancies, because a landlord with 1–10 flats rarely rents to the same person twice, and a separate table would need its own access rules.

### Notice periods and statuses are pure functions

`features/tenancies/notice.ts`:

- `noticePeriodMonths({ by, contractMade, start, noticeDate })`: 1 for the tenant; for the landlord 6 / 3 or 4 / 3 by `contractMade` against `LANDLORD_RULE_CHANGE = '2026-10-01'` and whether the tenancy has lasted 1 or 2 full years on the notice date; 0 for `agreed`, `court` and `other`. `other` covers the legal grounds the app doesn't model (rescission §61, an estate's notice, the other cases of §51), so it is never blocked.
- `earliestLastDay(...)`: the last day of the month `n` months after the notice date's month (the period runs from the month's last day, and adding whole months to a month end gives a month end).
- `validateEnding(...)`: returns a reason or nothing, with the limit only for the landlord (§52(4): a term shortening the landlord's period is void, and one shortening the tenant's is allowed).

`features/tenancies/status.ts`: `tenancyStatus(tenancy, today)` (`starts`, `active`, `ends`, `notice_given`, `ended`) and `flatStatus(tenancies, today)` (`let`, `notice_given`, `vacant`, with the next start). `dueDate(dueDay, month)` caps the day at the month's last day. Date rules for adding and correcting (`validateTenancyDates`) are pure too, and the server feeds them the flat's other tenancies and its ownership start.

Date arithmetic stays on ISO strings with small helpers in `src/lib/dates.ts` (`addMonths` to a month, `lastDayOfMonth`, `addYears`), as the other features do; no date library.

### The rent is saved with the tenancy

The form shows the rent in effect on the start date from the flat's rent periods. When the owner changes it, the new amount starts on the first of the start month, because rent periods start on the first of a month (#31). The rent of a partial first month is #33's question.

The save is one `atomically()` batch: the tenancy insert (an `INSERT … SELECT` with the owner and overlap conditions), then the rent statements of `recurringAmountRepository` conditioned on the tenancy row existing. `setAmount` is split so that it can return its statements without running them (`rentStatements`), and the existing Rent and charges page keeps calling it as before.

- The rent's own conditions (no period on or after the date, the latest period as the client saw it) can still fail after the tenancy row is in: then the server deletes the new tenancy and returns `amount_changed`, the alert the Rent and charges page uses when the amounts changed meanwhile. Rare (another owner changing the rent at the same moment), and the result is the same as a refused save.
- Alternative: a tenancy-specific rent column. Rejected: the year summary and the Rent and charges page already read the rent periods (#31), and two sources of rent would disagree.

### Overlap is checked against every tenancy of the flat

A tenancy `[valid_from, valid_to ?? ∞]` must not intersect another of the same flat. Checking against all, not just the latest, lets an owner record an earlier tenant afterwards. The check runs in the server for the reason and again in the write's `WHERE NOT EXISTS`, so two owners adding at once can't both succeed.

### Who may do what

Reading follows flat access (owners and members, `sharing`). Adding, correcting, ending and cancelling need the owner role, checked in the server and in each write's conditions, as the other features do (`sharing_owner_only`). Members see the contact details: the user chose this, and they already see everything else about the flat.

### Personal data

The tenant's name, phone and email are a third party's personal data.
- They are never logged; events carry the tenancy and property ids only.
- They are deleted with the flat. Account deletion (#85) and the privacy notice (#77) need to cover them.
- No field beyond what the screens use: no personal identity code, no address history.

### Routes

- `/properties/$propertyId/tenancy`: the Tenancy page (current, earlier, buttons for owners; the cancel confirmation as a dialog)
- `/properties/$propertyId/tenancy/new`: the new tenant form (`?` none; owners only, members are redirected to the page)
- `/properties/$propertyId/tenancy/$tenancyId/edit`: corrections, the same form without the rent
- `/properties/$propertyId/tenancy/$tenancyId/end`: the end form, open-ended or fixed-term by the tenancy's type

The edit page's loader gets the tenancy card's summary, and the flats list's loader gets each flat's status in one query for the user's flats (`tenancyRepository.currentFor(propertyIds, today)`).

### Logging

`tenancy.created`, `tenancy.updated`, `tenancy.ended` (with `noticeGivenBy`, no dates) and `tenancy.ending_cancelled` at info, with `tenancyId` and `propertyId`. A rent changed with a new tenancy logs the same event as on the Rent and charges page. Refusals are expected outcomes and are not logged; a compensating delete after a failed rent write logs `tenancy.rent_conflict` at warn.

## Risks / Trade-offs

- [The notice hints are read as legal advice] → The form says they are hints, and the landlord's limit is the only hard rule; the tenant's and agreed endings accept any date.
- [The contract may set other notice terms the app doesn't know, e.g. counting from mid-month] → Allowed for the tenant, where they can only shorten the period. For the landlord, a term shortening the period is void, so the limit holds.
- [Contracts made before 1.10.2026 can agree to switch to the new rule] → Rare; the owner can end by agreement, or correct *Contract made*. Recorded here, no switch in the UI.
- [Rent periods start on the first of a month, tenancies on any day] → The rent change starts on the first of the start month, which may also apply to the previous tenant's last days in that month. #33 decides partial months.
- [Overlap checked twice, in the server and the write] → The write condition is the authority; the server check gives the reason.

## Migration Plan

One migration adds `tenancies`; it changes no existing table, so the previous version keeps working while it runs. Rollback: the table can stay empty and unused.

## Open Questions

- Partial-month rent at a tenancy's start or end: #33.
- Whether a fixed-term tenancy that the tenant keeps living in after the term becomes open-ended in the app automatically. The law's rule was not checked for this change; until then the owner corrects the contract type.
