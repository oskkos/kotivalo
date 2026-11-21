## Why

A wrongly dated first rent, charge or financing charge treatment can't be fixed (#78). An earlier date is refused because it is before the latest change. The only period can't be undone. A later date only adds a second period, so the months before it keep an amount that never applied. The treatment has no undo at all, so even a later treatment change on the wrong date stays for good. A wrong amount or treatment in the past months would later give wrong tax figures (#34).

## What Changes

- **Undoing the only period of a rent or charge.** Undoing the latest change also works when the amount has one period. The period is deleted and the amount is not set again, so the owner can set it from the right date. The confirmation dialog says the amount will be removed instead of naming the previous one.
- **Undoing the latest treatment change.** The treatment form gets the same "Undo the latest change" button and confirmation as the amount form. Undoing deletes the latest treatment period and makes the previous one current again with no end. If it was the only one, the treatment is no longer set. The accumulated capitalised charges follow, because they are computed from the periods.
- Undoing an amount or treatment that has no periods is still refused: `amount_nothing_to_undo` for amounts and a new `treatment_nothing_to_undo` for the treatment. This can only happen when two owners act at the same time, or when a request is sent directly.

Not in this change:
- editing a period's start date directly. Undoing and setting again covers the same need, without a new form and its own date rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `recurring-amounts`:
  - "Undoing the latest rent or charge change" also allows undoing the only period. The scenario "The only period can't be undone" is replaced by "Undoing the only rent" and by a refusal when there is nothing to undo.
  - The new requirement "Undoing the latest treatment change" is added.

## Impact

- **Tables:** none. `recurring_amounts` and `financing_treatments` are unchanged; undoing deletes rows as it already does for amounts.
- **Code:** `features/recurring-amounts/`:
  - the repository's amount undo accepts a missing previous period
  - a new treatment undo in the repository
  - the server logic (`undoRecurringAmount`, a new `undoFinancingTreatment`) and a new server function
  - the undo button and dialog in `AmountForm.tsx`, and the same in `TreatmentForm.tsx`
- **Logging:** `financing_treatment.undone` at info, ids only.
- **Reasons:** the new alert `treatment_nothing_to_undo`. The text of `amount_nothing_to_undo` no longer tells the owner to correct the only period by setting a new amount.
- **Screens:** the "Vuokra ja vastikkeet" row on the Design canvas. The undo dialog for the only period and the treatment undo follow the existing VastikePeru board, so no new board is needed.
- **Messages:** fi, sv and en for the new dialog texts and the reason, with the translate skill. No new terms.
