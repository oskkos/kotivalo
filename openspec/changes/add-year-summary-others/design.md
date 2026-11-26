## Context

The year summary (#34) computes form 7H figures in one pure function, `flatYear(input, userId, year, today)` in `features/year-summary/summary.ts`. Every share lookup in it asks for one user's share of an ownership period:
- `shareOn`
- `ownedInYear`
- `shareAtEnd`
- `paymentChecks`
- `shareChanges`
- `summaryYears`

`loadYearSummary` and `loadFlatYear` in `year-summary.server.ts` load the user's flats (archived included), the access check, and everything else by their ids with a fixed number of queries. Each function returns a computed view.

The user decided (Design canvas, section #122):
- The menu lists everyone with a share above 0 in the year in a flat the user has access to.
- Everyone with access to the flat may see another owner's figures, also a 0 % member.
- The whole flats are every flat the user has access to.

A flat without any owner in the year, and so without figures, is left out of the whole flats too. Archived flats are included, as in the own share.

## Goals / Non-Goals

**Goals:**
- Another owner's and the whole flats' figures from the same calculation as the own share, with no second implementation to drift.
- The choice in the URL, so Back, reloads and links keep it.
- No flat the user can't see in anyone's figures.

**Non-Goals:**
- A former owner's own access to the flat (#123, waits for #88).
- The tax estimate and the Finnish originals of tax terms (#121).
- A partly income-recognised financing charge (#119).
- Inflected names.

## Decisions

### 1. A holder in place of the user id

`summary.ts` gets a holder type:

```ts
export type Holder = { kind: 'owner'; userId: string } | { kind: 'whole' }
/** The holder's basis points in a period: one owner's, or all owners' summed. */
export function holderShare(period: Period, holder: Holder): number
```

- `flatYear`, `ownedInYear`, `shareAtEnd`, `paymentChecks`, `shareChanges` and `summaryYears` take a `Holder` and use `holderShare`.
- For `whole` the share is the sum of the period's shares, so it is 10000 whenever the flat is owned and 0 before the first period.
- `shareChanges` returns nothing for `whole`: the sum doesn't change when owners do.
- The own share is `{ kind: 'owner', userId }`, so its results don't change. The existing `summary.test.ts` tests stay as they are, with only the argument changed.
- **Alternative, multiply the own share's figures by 10000 / share:** rejected.
  - It is wrong for mid-year changes.
  - It rounds twice.
  - It gives nothing for a flat where the user's share is 0.
- **Alternative, sum each owner's figures:** rejected. It rounds once per owner, so the whole flat could be a cent off the payments.

### 2. One `person` search parameter

- Both routes validate `person` with a schema in `schemas.ts`: a user id (1–64 characters) or `whole`, optional. Anything else is dropped, which gives the own share.
- The server functions take it: `getYearSummary({ year?, person? })` and `getFlatYear({ propertyId, year?, person? })`.
- Without `person` the result is the own share, as today.
- The year buttons, the cards, Back and the *Omistajat* links all carry `person` along.
- **Alternative, the choice in `sessionStorage`:** rejected. A link or a reload would lose it, and the server would render the own share first.

### 3. Who may be chosen, and the access check

The access check stays the same: the flats are the user's own, active and archived. The year's people are computed from those flats' ownership periods:
- Everyone with a share above 0 on a day of the year up to today is a choice, except the user.
- A `person` id that is in none of the user's flats' periods in any year falls back to the own share.
- An id in them, but not in the chosen year, gives the empty state "no share in the flats you see in <year>".

So a person's figures can't be asked for beyond the user's own flats, and a guessed id shows nothing. A 0 % member sees owners' figures because they have access to the flat (decision of #122). Nothing about a person is read outside the flats the user can see.

### 4. Names from the ownership repository

`ownershipRepository(db).namesFor(propertyIds)` returns `Record<userId, name>` for everyone in the ownership periods of those flats. It is one query joining `ownership_periods` with `user`, also covering people who no longer have access, as `history` already does. It is added to `loadInputs`' first `Promise.all`, so the query count stays fixed.

### 5. The views

`view.ts`:
- `YearSummaryView` gains:
  - `holder`: `'own' | 'whole' | { userId, name }`
  - `people`: the menu, `{ userId, name, flats }[]` sorted by name, plus the own and whole counts
  - `holderHasYears`
- `FlatCard` gains `owners`, `{ name, share, isYou }[]` for the whole flats. Its `share` is the holder's share: the person's, or 10000.
- `FlatYearView` gains:
  - the holder
  - `owners`, `{ userId, name, share, income, isYou }[]`, for the whole flat's *Omistajat* card. Each owner's row 2.1 comes from one more pure `flatYear` call per owner. No more queries.

The view now carries co-owners' ids and names. Everyone with access to the flat sees them already on the Ownership and sharing page, so this widens nothing. It replaces the "other owners' ids never reach the browser" note of #34's decision 5, which was about minimising, not a rule.

### 6. The years

- The own share's years are unchanged.
- A person's years come from `summaryYears` with their holder over the user's flats.
- The whole flats' years come from the `whole` holder.
- When the own share has no years (a 0 % member), the page uses the whole flats' years. Otherwise such a member, who now has figures to see, couldn't move between years.

### 7. The UI

- **Selector:** `HolderChoice.tsx` in the feature folder: a full-width button with the label *Kenen luvut* and the current choice, opening a MUI `Drawer` (bottom) with a radio group. Choosing navigates with the new `person` and closes the sheet. It is rendered only when `people` is not empty.
- **Another owner:** `YearSummaryPage` shows the intro card with the person's name and a warning band (*Vain yhteiset asunnot*).
- **Whole flats:** the intro says the figures are for checking. Each card shows its owners instead of *Osuutesi*.
- **`FlatTaxPage`, another owner:** the kicker names the person and a band says whose share it is. Copy buttons stay.
- **`FlatTaxPage`, whole:**
  - no details card and no copy buttons
  - an *Omistajat* card
  - rows from the same `RowsCard` with copying off
- **Names:** used only where Finnish needs no case ending: in the nominative after a colon or as a label. Other sentences say *hän*.

## Risks / Trade-offs

- **[A spouse reads a person's figures as their whole form 7H]** → The warning band on every person view says that only the shared flats are counted and that the person may have others.
- **[Whole flat figures copied into a return]** → No copy buttons, and a note on both pages. The whole flats are labelled for checking.
- **[A larger view per load]** → One more query (names), and pure calculations per owner on the whole flat page. The fixed-query rule of #34 still holds.
- **[The sketch shows "omisti 30.6. asti" in the menu]** → Left out. A person with several flats has no single end date, and the count of flats is enough to choose. The spec doesn't promise it.

## Migration Plan

- No schema change.
- Deploy as usual.
- Rollback: revert the commits. Nothing is stored.

## Open Questions

None.
