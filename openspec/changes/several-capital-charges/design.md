## Context

The financing charge is one of three `recurring_amounts` kinds (#31): rows of `kind = 'financing_charge'` per flat, one sequence of periods. The repository scopes every period write by `(property_id, kind)` and carries its checks in the statements (owner, latest period as read). Its treatment is a separate per-flat sequence, `financing_treatments`. The Rent and charges page, the amount form (`/amounts/$kind`), the charges page by year (`charges.ts`, `ChargesPage`), the accumulated capitalised total (`accumulatedCapitalised`) and the flat details page (`details.server.ts`, `FlatDetailsPage`) all read `amounts.financing_charge` as one sequence.

#90 makes it several sequences, each with a name. The treatment stays one per flat.

## Goals / Non-Goals

**Goals:**
- Several named financing charges per flat, each with the period rules the amounts already have.
- Existing data moves to the new model with no change in what a flat with one charge shows.
- Adding, renaming, ending and removing a charge added by mistake, with no new period rules.
- Every view that sums the financing charge sums all charges.

**Non-Goals:**
- A treatment per charge (the Tax Administration ties it to the housing company's bookkeeping).
- One-off extra charges, and the rent's move to the tenancy (#102).
- Several maintenance charges, or named rent.
- The year summary (#34).

## Decisions

### A `financing_charges` table, and the periods stay in `recurring_amounts`

New table `financing_charges`:
- `id()`
- `property_id`, referencing `properties` with cascade
- `name` text, nullable

New nullable column `recurring_amounts.financing_charge_id`, referencing `financing_charges` with cascade, and an index `(financing_charge_id, valid_from)`. Every `financing_charge` row has it; rent and maintenance rows don't.

Why not a separate period table: the period writes (`amountStatements`), the period functions in `periods.ts` and the form all work on `recurring_amounts`, so a charge is just one more scope for the same statements. The `kind` column stays, so a query by kind still finds every financing period.

Alternatives considered:
- A `name` column on each period row. This repeats the name and makes renaming rewrite periods.
- A new kind per charge. Kinds are an enum.

### The scope of a period write is a sequence

`amountScope(propertyId, kind)` becomes `amountScope(propertyId, sequence)`. A sequence is `{ kind: 'rent' | 'maintenance_charge' }` or `{ kind: 'financing_charge', chargeId }`, and a financing scope also matches `financing_charge_id`. The statements are unchanged otherwise, so correcting, closing and inserting keep their concurrency checks. The insert also writes `financing_charge_id`.

A financing scope adds a condition that the charge belongs to the flat (`exists` on `financing_charges`). An id from another flat then applies nothing. The server function answers `financing_charge_not_found` before that, from the charges it read.

### Adding, renaming and removing

- **Add:** one `atomically` batch with two statements.
  - The charge insert, gated by `isOwner` through an `insert … select … from properties where …`, like the period insert.
  - The first period insert, gated on the charge row existing.
  - The ids are made in the Worker (`crypto.randomUUID()`), so the second statement can name the first's row.
- **Rename:** an update of `name`, gated by `isOwner` and the charge's flat.
- **Name rules:**
  - Trimmed, 1–60 characters (`financingChargeName` in `schemas.ts`).
  - Unique per flat, ignoring case. The server checks this against the names it read, comparing `toLocaleLowerCase('fi')`.
  - There is no unique index. SQLite's `lower()` folds only ASCII (Ä, Ö), and an expression index is database-specific. Two owners adding the same name in the same second could both succeed. The only harm is two charges with the same name, and either can be renamed or undone.
- **Undoing a financing charge's only period:** the undo batch deletes the period and then the charge. The charge delete is gated on the charge having no periods left (`notExists`), so it can't remove a charge another write just gave a period. The view and the log call it `financing_charge.removed`.

### The unnamed charge

- `name` is null only for charges made by the migration. The UI shows a null name as `m.financing_charge()`, the term's word in the user's language, so no Finnish text is stored.
- Renaming requires a name, so a named charge can't go back to null. Adding requires one too.
- A null name never collides with a typed name. "Rahoitusvastike" typed as a name is allowed, and looks the same.

### Ending is 0 € from a date

- An ended charge is one whose period in effect today has amount 0 and that has no later period (`isEnded(periods, today)` in `periods.ts`).
- *Päättyy* in the form sends `amount: 0` to `setRecurringAmount`. The schema already allows 0, and no new server function or reason is needed.
- The ended list shows the day before the last period starts ("Päättyi") and the amount of the period before it.
- A charge whose only period is 0 € counts as ended immediately. It is a mistake the owner can undo, which removes it.

### The migration

`pnpm db:generate` writes the DDL. The backfill is appended to the same migration file before it is committed:

```sql
INSERT INTO financing_charges (id, property_id, name)
  SELECT lower(hex(randomblob(16))), property_id, NULL
  FROM recurring_amounts WHERE kind = 'financing_charge'
  GROUP BY property_id;
UPDATE recurring_amounts SET financing_charge_id =
  (SELECT id FROM financing_charges f WHERE f.property_id = recurring_amounts.property_id)
  WHERE kind = 'financing_charge';
```

- `randomblob` is SQLite. It runs once, in a migration, which is SQLite-specific anyway and would be regenerated for another database. The ids are 32 hex characters, not dashed UUIDs. Nothing parses them; the input schemas accept any id of 1 to 64 characters.
- The previous version keeps working after the migration and before the deploy. It reads financing periods by kind and doesn't know the column. A financing period it writes in those seconds has no `financing_charge_id`.
- The new version reads only financing rows with a charge, so such a stray row would not be shown. Guarding against it would mean code for a window of seconds: attaching rows without a charge to the unnamed charge, or making a synthetic one. **Decision: accept the loss and add no guard.** It takes a single write by an owner during a deploy, the owner would see it missing and set it again, the deploy runs from CI right after the migration, and today's users are a handful of owners.

### Server functions

- `setRecurringAmount` and `undoRecurringAmount` take an optional `chargeId`. It is required when `kind` is `financing_charge` (a zod refinement) and forbidden otherwise.
- New `addFinancingCharge({ propertyId, name, amount, from })` and `renameFinancingCharge({ propertyId, chargeId, name })`.
- `getRecurringAmounts` returns `amounts` for `rent` and `maintenance_charge` only, plus `financingCharges: { id, name: string | null, periods }[]` ordered by their first period's start, then name.
- Reason codes:
  - `financing_charge_name_required` (field)
  - `financing_charge_name_taken` (field)
  - `financing_charge_not_found` (alert)
- Logs:
  - `financing_charge.added` (`propertyId`, `chargeId`, `from`)
  - `financing_charge.renamed` (`propertyId`, `chargeId`)
  - `financing_charge.removed` (`propertyId`, `chargeId`)
  - `recurring_amount.set` and `recurring_amount.undone` with `chargeId` for financing charges

  No names in logs: a name is the owner's text.

### The calculations

- `accumulatedCapitalised(charges, treatments, today)` sums the existing per-sequence calculation over the charges.
- `charges.ts`:
  - `ChargePeriods` becomes `{ maintenance: Period<number>[]; financing: { id, name, periods }[] }`.
  - A month's `charges` is a list of `{ key, kind, chargeId?, name?, amount, treatment?, changedFrom?, started?, ended? }` instead of one entry per kind.
  - The year's lines are the maintenance sum and, per financing charge, one line per treatment with a sum above 0.
  - `chargeYears` takes the earliest start over all sequences.
  - The rules are the spec's "Charges of a month", including the new *started* and *ended* marks.
- `ChargesPage` and the details page's row read the new shapes. Both are pure, so the unit tests cover the scenarios.

### Routes and components

- `/amounts/$kind` keeps `rent` and `maintenance-charge`. The financing slug is not found.
- New `/amounts/financing/new` (`FinancingChargeForm` in add mode: name, amount, date, the treatment note).
- New `/amounts/financing/$chargeId` (`AmountForm` with a name field and the *Uusi summa* / *Päättyy* choice, `ChoiceField`).
  - Saving the name and the amount are separate server calls. The name is saved first, only if it changed, so a refused amount doesn't leave a half-saved form.
  - On an ended charge the form shows the name and the history only, with undo.
- `RecurringAmountsPage`:
  - `AmountCard` for rent and maintenance.
  - A `FinancingCharges` card: a list of charges, the sum when there are several, *Lisää rahoitusvastike*, and the existing `Treatment` row at the bottom.
  - Then the ended list and the capitalised note.
- `FlatDetailsPage` `Amounts`: one row per financing charge in effect today (the name as the secondary line when named), then a treatment row. When none is in effect, one *Rahoitusvastike* row with *Ei asetettu*.

## Risks / Trade-offs

- [Name uniqueness is checked by the server, not the database] → A same-second race can make a duplicate name. It is harmless and fixable by renaming. Documented above.
- [A financing period written by the previous version during the deploy window has no charge and is not shown] → Accepted; the deploy follows the migration immediately (see "The migration").
- [The view's shape changes (`amounts.financing_charge` goes away)] → To keep every commit green, the view keeps a transitional `amounts.financing_charge`, the periods of the flat's first charge, until the commit that moves the charges page and the details page to the charges removes it. In the commits between, the pages that still read it show only the first charge. No commit is deployed on its own, because the PR lands on `develop` whole.
- [The month list grows with many charges] → Each month row lists charges in its secondary text, which wraps. Flats have a handful at most.

## Migration Plan

1. Migration `0008`: `financing_charges`, `recurring_amounts.financing_charge_id` with its index, and the backfill. CI applies it before the deploy (`pnpm db:migrate:production`).
2. The deploy of the same commit reads the charges.
3. Rollback: the previous version runs on the migrated database unchanged, ignoring the new table and column. Charges added after the migration would show to it as one summed sequence with overlapping periods, so a rollback after owners add charges needs a manual cleanup. This is acceptable for a short rollback window.

## Open Questions

None. The name, ending and removal decisions were agreed on the design canvas on 2026-11-23.
