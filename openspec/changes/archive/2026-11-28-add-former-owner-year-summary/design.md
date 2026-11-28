## Context

Access to a flat is a row in `property_access`. Every flat page, server function and file route checks that row. Ownership is in `ownership_periods`, one row per owner and period, with `user_id` and `share`. Removing someone's access deletes their access row and keeps their periods. That happens in an ownership change, by removing a member, or by a member leaving. So the history still knows they owned a share, but no page lets them in.

The year summary (`year-summary.server.ts`) already reads the user's flats, the active and the archived ones, as its access check. It computes each flat's year with `flatYear()` at the holder's share on each date, so amounts after a former owner's period already count as 0. Its payment, vacancy and treatment checks already cover only months with the holder's share. What doesn't fit a former owner:
- the access check
- the whole flats and other people's figures, which show the new owners' data
- the flat details' tenancies, which cover the whole calendar year
- the form 7H page's Add buttons and links to flat pages

Decisions taken with the user on 28.11.2026: the year summary only, tenants of their own period, until the flat is deleted.

## Goals / Non-Goals

**Goals:**
- A former owner gets their own form 7H figures, page and PDF for the years of their share, with no other way into the flat.
- Nothing outside the year summary changes: every other access check stays on `property_access`.

**Non-Goals:**
- A read-only flat page, or the rent payments, entries and documents of their period.
- A time limit on the former owner's view.
- A former owner seeing another owner's figures or the whole flat.
- Changing what a member with a 0 % share sees (the user decided to leave the PDF's tenancy list as it is for them).

## Decisions

### 1. A former owner is computed, not stored

A former owner of a flat is a user with no `property_access` row for it and an `ownership_periods` row with `share > 0`. `propertyRepository(db).listFormerlyOwnedForUser(userId)` reads these flats in one query:
- `properties` joined to the user's periods with a share above 0
- left out where the user has an access row
- distinct

A migration adds the index `ownership_periods_user_idx` on `user_id`, so the read doesn't scan the table. It is an additive `CREATE INDEX`, safe to run before the code.

Alternative considered: a `former` role or flag on `property_access`. Every access check in the app would then have to leave it out, and a forgotten one would open flat pages to a former owner. Keeping the former owner out of `property_access` keeps every other feature unchanged by construction.

### 2. The year summary's access check includes former flats, for the own share only

`userFlats(deps)` returns the accessible flats and the former ones (one more query, so the count stays fixed), and the ids of the former ones. The inputs are loaded once for all of them. Then:
- **Holder:** `holderOf` resolves `person` from the accessible flats' periods only. A former flat never makes someone a known person.
- **Years:** the own share's years come from every flat. The whole flats' and another person's years come from the accessible flats.
- **Cards:** with the own share, a former flat gets a card in a year it is `included`. With the whole flats or another person, former flats are skipped.
- **Not included:** former flats are never named.
- **People and counts:** `people` and `counts.whole` use the accessible flats; `counts.own` includes the former flats with a card.
- `loadFlatYear` finds the flat among both. For a former flat it uses the own share whatever `person` says, never builds `owners`, and returns `former: true` in `FlatYearView`.
- `loadYearSummaryPdf` gets all of this through the shared `summarise`.

### 3. Clipping tenancies to the holder's days is a pure option of `flatYear`

`flatYear(input, holder, year, today, { ownDaysOnly })`. With `ownDaysOnly`, `flatDetails` works from the holder's spans in the year: the runs of days, up to the last day counted, on which `holderShare > 0`, built from the ownership periods.
- Each tenancy of `tenanciesInYear` is intersected with each span, and a tenancy with no overlap is dropped.
- `tenant` counts the tenancies left.
- `period` runs from the first clipped day to the last.
- `tenancies` lists the clipped pieces in start order.

Without the option nothing changes. The server passes it for former flats only.

Alternative considered: clipping for everyone whose share ended. The user decided that members see the whole year (the PDF review question), so only the former owner's view is clipped.

### 4. The form 7H page is read-only for a former owner

`FlatTaxPage` reads `view.former`. When it is set, the page shows:
- a note band like another owner's, saying they no longer own the flat and see only their own ownership period
- `CheckItem` with no link
- `DetailRow` with no `addTo`, so no Add button
- the copy buttons unchanged

The year summary's cards need no change: they only link to the form 7H page.

### 5. The ownership change form says what removing access keeps

`ownership_remove_access_hint` gains the second half: with the choice selected, the person still sees their own period's figures in the year summary.

## Risks / Trade-offs

- **[A former owner sees post-sale data through another path]** → Only the year summary reads former flats. Its Workers tests assert that the whole flats, another person's figures, the sheet and "Not included" leave them out. The former owner's form 7H page and PDF clip the tenants.
- **[The query count grows]** → By one read with an index, the same for any number of flats. The query count test covers the former flats too.
- **[A share split across a sale and a rebuy]** → `period` runs from the first to the last clipped day, so it covers the gap. The list of tenancies in the PDF shows the pieces. This is rare; a unit test fixes the behaviour.
- **[A flat deleted later]** → The former owner's view goes with it. Deleting is refused while another person had a share above 0 (#64), so this needs that rule to change first.

## Migration Plan

- The migration only adds an index, so it is safe before the new code.
- Deploy as usual. Rollback: revert the commits (the index can stay).

## Open Questions

None.
