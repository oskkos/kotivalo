## Context

`share-properties` added sharing:
- `property_access` rows have the role `owner` (whoever added the flat) or `member` (accepted an invitation).
- `property_invitations` holds the pending invitations.
- The Sharing page lists people and invitations.

Shares are not recorded anywhere yet. The year summary (M2) will split each transaction by the owners' shares on its date, so ownership must be a time series: validity periods, never overwritten (CONCEPT.md §4.1, §4.4).

The Design canvas has:
- "Omistus ja jakaminen": current owners, a change form for exactly two people with presets, date and reason, the "remove access" checkbox at 0 %, and the history
- the Ownership section in "Uusi asunto"
- the "Omistus: Sinä 50 % · Annika 50 %" line on the cards and the details page

## Goals / Non-Goals

**Goals:**
- Ownership as contiguous periods with shares that add up to exactly 10000 basis points.
- A free list of owners in the change form.
- Roles derived from the current shares, so ownership can move between people.
- A way to fix mistakes without editing history freely.
- Pure functions for the period rules, ready for the year summary.

**Non-Goals:**
- the year summary and per-owner figures (M2)
- a former owner's read access
- a buyer outside Kotivalo
- estates (#20)
- tax consequences (#21)
- future-dated changes

## Decisions

### 1. Table

```
ownership_periods
  id          text pk (id())
  property_id text not null → properties.id (on delete cascade)
  user_id     text not null → user.id (on delete cascade)
  share       integer not null (basisPoints())   -- 1..10000
  valid_from  text not null (isoDate)            -- validity()
  valid_to    text                                -- null = current
  reason      text                                -- sale | gift | inheritance | division | other; null for the first period
  index (property_id, valid_from)
```

- **One row per owner and period.** A change closes every open row of the flat and inserts the new split, all starting on the same date. A "period" is the set of rows that share a `valid_from`. *Alternative:* a `periods` table plus `period_shares`. That is cleaner in theory, but it needs two tables and a join for every read. CONCEPT.md's draft already has one table.
- **No rows for 0 %.** A person with access and no row is a member. This keeps "visibility only" out of the tax data.
- **`reason` is null for the first period.** It records how the flat was acquired, which the form doesn't ask.
- **`user_id` cascades with the user**, as `property_access` does. Account deletion doesn't exist; when it comes, it must not delete a flat's history. That is recorded in Open Questions.
- **Migration backfill:** one row per existing `owner` access row, with share 10000, `valid_from` set to the flat's `created_at` as an ISO date and `reason` null. This is SQLite date SQL inside the migration only, which is generated and reviewed SQL.

### 2. Pure rules in `features/ownership/periods.ts`

These have no database access and are unit-tested. The year summary reuses them.

- `sharesOn(periods, date)` returns the split that applies on a date.
- `validateSplit(entries)` checks the split:
  - the total is exactly 10000 (`ownership_shares_total`)
  - every share is a number between 0 and 10000 (`ownership_share_invalid`)
  - at least one share is above 0 (`ownership_no_owner`)
  - each person appears once
- `validateChangeDate(date, currentStart, today)` refuses a date that is too early (`ownership_date_too_early`) or in the future (`ownership_date_in_future`).
- `parsePercent(text)` turns the typed percent into basis points: `parseDecimal(text, 2)` (`33,33` is 3333).

### 3. Repository `features/ownership/ownership.repository.server.ts`

- `history(propertyId)` returns every row, grouped into periods, newest first.
- `current(propertyId)` returns the open rows.
- `currentForUser(userId)`: the current shares of every flat the user has access to, with owners' names. It feeds the card line in one query, not one query per card.
- `createFirst(...)` is called inside the property repository's `create` batch, so a flat never exists without a period. `propertyRepository.create` gets `ownedSince` and adds the insert to its `atomically()` call.
- `change({ propertyId, actorId, from, split, removeAccess })` runs one `atomically()` with:
  1. close the open rows: set `valid_to` to the day before `from`, where the flat's open rows start before `from` and the actor is an owner (the guard is in the statement)
  2. insert the new rows
  3. update `property_access.role` to `owner` for users in the split with a share above 0, and to `member` for the others
  4. delete the `property_access` rows listed in `removeAccess` (only those with a 0 % share)

  The server function reads and validates first (rule functions). The guards in the statements keep a concurrent change from corrupting the table: if the first statement matched nothing, the batch's later statements are built with the same guard (`exists open row starting before from`), so they change nothing either.
- `undoLatest(propertyId, actorId)` reads the two latest periods, then runs `atomically()` with: delete the latest rows, reopen the previous rows (`valid_to = null`), and reset the roles from the previous split.
- `correctFirstDate(propertyId, actorId, date)` updates `valid_from` of the earliest rows.

### 4. Roles follow shares

`property_access.role` stays stored, so access checks remain one indexed lookup. It is rewritten in the same batch as every change or undo. Future-dated changes are not allowed, so the stored role is always the role "today". Sharing's checks (`roleOf === 'owner'`) don't change. With several owners:
- `removeMember` already refuses non-members, so owners can't remove owners.
- `leave` already refuses owners.

### 5. Server functions `features/ownership/functions.ts`

- `getOwnership({ propertyId })` returns history, the current split and the people with access. `getSharing` and the page loader call both.
- `changeOwnership({ propertyId, from, reason, shares: [{ userId, percent }], removeAccess: [userId] })`:
  - Only owners may change ownership (`sharing_owner_only`).
  - Every `userId` must have access to the flat. Entries for people without access are refused as `ownership_invalid`.
  - The split and the date are validated with the rule functions.
- `undoOwnershipChange({ propertyId })`: `ownership_nothing_to_undo` for a flat with one period.
- `correctFirstOwnershipDate({ propertyId, date })`: `ownership_date_too_late` when the date isn't before the second period, `ownership_date_in_future`.
- Logging, at `info` with ids only and no shares: `ownership.changed` (propertyId, from, owners count), `ownership.change_undone`, `ownership.first_date_corrected`.

### 6. Screens

The Design canvas row "Omistus ja omistusmuutokset" has every screen below, with the Finnish copy and the error texts (`OmistusVirheet`).

- **Ownership and sharing page** (the Sharing route keeps its URL `/properties/$id/sharing`; the title becomes "Ownership and sharing"). Order follows the canvas:
  1. "Current owners": a card with the initial, the name, "Owner · from 1.3.2025" and the share. It replaces the "Access to the flat" card for owners. Members without a share are listed below it, as now.
  2. "Change ownership" opens the change form in place (the canvas's "Muuta omistusta" button and the form card):
     - presets: "All to me" and "Equal shares"
     - one percent field per person with access
     - "From" (date) and "Reason" (select)
     - a "Remove X's access" checkbox for each person going to 0 %
     - a live preview of the split, or "Shares must add up to 100 %, now 90 %"
     - "Save ownership change"
  3. "Ownership history": one row per period, the current one marked. The latest has "Undo" for owners, with a confirmation dialog. The first has "Correct date" for owners, a small dialog with one date field.
  4. Pending invitations and the invite form, as now.
- **Date fields:** a text field `pp.kk.vvvv` parsed by a shared `parseFiDate()` (`12.6.2022`, also `2022-06-12`). The canvas uses typed dates, and `@mui/x-date-pickers` would be a new dependency for two fields. *Alternative:* the date picker, when the tenancy forms need one anyway.
- **New flat form:** an "Ownership" section with "Owned since" (default today). The edit form doesn't show it; the date is corrected on the ownership page.
- **Card line:** the owners by share, then name, the user as "You", formatted with `formatShare(basisPoints)` (`50 %`, `33,33 %`), plus "· shared with you" for a member. A shared `formatShare` goes in `lib/format.ts`.

## Risks / Trade-offs

- [Undo can't bring back access removed by the undone change] → The dialog says so; a new invitation restores it.
- [Typed dates instead of a picker] → Validation shows the expected format. A picker can replace the field later without changing the stored value.
- [Shares in hundredths of a percent] → Three equal owners are 33,34 + 33,33 + 33,33. The "Equal shares" preset gives the remainder to the first owner.
- [Stored roles could drift from shares] → Every write that changes shares rewrites the roles in the same batch, and a Workers test checks the invariant after each operation.

## Migration Plan

- One migration creates `ownership_periods` and backfills a 100 % period for each existing owner from the flat's creation date.
- The old version ignores the table.
- A flat added by the old version between the migration and the deploy (seconds, in the same CI job) would have no period. Accepted: its card shows no owners and its ownership page offers no change until a period exists; the migration's backfill statement, limited to flats without periods, would fix it by hand. No read path special-cases it.
- Rollback: redeploy the previous version; the table stays.

## Open Questions

- **A sale to a buyer who doesn't use Kotivalo.** The split can only name people with access. Recording a sale to an outsider needs either an owner without an account (a name only) or a "sold" state with archiving (#64). The seller still needs the history for their taxes. Proposed as its own issue.
- **Account deletion and history.** When accounts can be deleted, deleting one must keep ownership periods (or refuse while the user has periods) and must not leave a flat without an owner.
