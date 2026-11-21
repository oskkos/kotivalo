## Context

`track-recurring-amounts` (#31) records rent, charges and the financing charge treatment as monthly periods. Undoing only works when there is a previous period, and the treatment has no undo. Together with the date rules (no date before the latest period's start), a wrongly dated first period can't be fixed (#78). Monthly amounts and the accumulated capitalised charges are computed from the periods, so deleting a period needs no other clean-up.

## Goals / Non-Goals

**Goals:**
- Undo the only period of a rent or charge, leaving it not set.
- Undo the latest treatment change, including the only one.
- Keep the race checks of the existing undo: nothing changes if another owner changed the periods after the page was read.

**Non-Goals:**
- Editing a period's start date in place.
- Undoing more than the latest change at once.

## Decisions

**Undo and set again instead of editing the start date.** With undo of the only period, a wrong start is fixed in two steps: undo, then set again. Editing the date in place would need its own form and limits (not before the ownership's month, not past the next period's start). Ownership has a correction form for its first period, but ownership changes also change roles and access, which amounts don't. The extra form is not worth it here.

**Repository: the previous period becomes optional.** `undoLatestAmount` takes `previousStart: IsoDate | null`. With null it runs only the delete, which already requires that the latest period is open (`valid_to` null), starts on `latestStart` and that the actor is an owner. The delete is the statement that tells whether the undo applied, so a period added by someone else meanwhile (which closes the read latest period) still makes it not apply (`amount_changed`).

**A treatment undo of the same shape.** `undoLatestTreatment({ propertyId, actorId, latestStart, previousStart })` on `financing_treatments`, with the same two statements in `atomically`. The two tables have no shared column helper, so the code is repeated, not shared. A generic helper over two Drizzle tables would cost more types than the repetition costs lines.

**Server.** `undoRecurringAmount` refuses only when there are no periods (`amount_nothing_to_undo`). The new `undoFinancingTreatment` does the same with `treatment_nothing_to_undo`. Both check access and the owner role first, return `amount_changed` when the write didn't apply, and log `recurring_amount.undone` / `financing_treatment.undone` with `propertyId` and the undone period's start. `amount_changed` stays the race reason for both. Setting a treatment already returns it, but its text names only the amounts ("Joku muutti summia samaan aikaan"), so the text is widened to cover the treatment. A new server function, `undoFinancingTreatment`, takes `{ propertyId }`.

**UI: one dialog for both forms.** The undo dialog moves out of `AmountForm.tsx` into `UndoDialog.tsx` in the feature folder. It takes the title, the text and the action to run, and handles saving, errors and closing. The forms build their own texts:
- amount with a previous period: the existing "Voimaan jää edellinen summa {amount} ({date} alkaen)."
- the only amount period: a new text saying the amount is removed and can be set again
- treatment: the same two variants with the treatment's name

The amount form shows "Undo the latest change" whenever the amount has a period; the treatment form shows it under its history whenever a treatment is set.

**Tests and traceability.** The main spec keeps the scenario "The only period can't be undone" until the archive commit, and the main specs block in CI. Its test stays under that name until then and checks the remaining refusal, undoing an amount that has no periods. The archive commit renames it to "Nothing to undo is refused". The new scenario "Undoing the only rent" gets a Workers test and a Playwright test. The treatment requirement gets Workers tests for every scenario and a Playwright test for undoing a treatment change.

## Risks / Trade-offs

- **An owner can now remove the only amount by mistake.** The dialog says what will be removed. Nothing is computed from it that can't be recomputed after setting it again.
- **A co-owner might undo another owner's first entry.** That is already true of later changes, and only owners can do it.
