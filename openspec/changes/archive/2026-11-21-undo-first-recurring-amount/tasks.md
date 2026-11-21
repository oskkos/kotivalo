## 1. Undoing the only amount and the treatment on the server

- [x] 1.1 `recurring-amount.repository.server.ts`:
  - `undoLatestAmount` takes `previousStart: IsoDate | null`; with null it only deletes the open latest period
  - new `undoLatestTreatment`, the same for `financing_treatments`
  - Workers tests: the only period is deleted, a period added meanwhile makes it not apply, other flats and kinds are untouched, a member's undo doesn't apply
- [x] 1.2 `recurring-amounts.server.ts`: `undoRecurringAmount` refuses only when there are no periods; new `undoFinancingTreatment` with access and owner checks, `treatment_nothing_to_undo`, `amount_changed` on a race, and `financing_treatment.undone` logged at info (`propertyId`, `from`)
- [x] 1.3 `functions.ts`: `undoFinancingTreatment` server function; `schemas.ts`: its input (`propertyRefInput`)
- [x] 1.4 `src/lib/reasons.ts`: the alert `treatment_nothing_to_undo`. Messages in fi, then sv and en with the translate skill; rewrite `reason_amount_nothing_to_undo` (no longer "correct it by setting a new amount") and widen `reason_amount_changed` to cover the treatment
- [x] 1.5 Workers tests named after the scenarios: "Undoing the only rent", "Undoing a treatment change", "Undoing the only treatment", "No treatment to undo is refused", "A member can't undo the treatment", the logged event. The test "The only period can't be undone" keeps its name until the archive commit and checks undoing a rent that has no periods

## 2. Undo buttons and the dialog

- [x] 2.1 Move the undo dialog out of `AmountForm.tsx` into `UndoDialog.tsx`: title, text and the action as props; saving state, the reason alert and the client log stay in the dialog
- [x] 2.2 `AmountForm.tsx`: show "Undo the latest change" whenever the amount has a period; for the only period the dialog says the amount is removed and can be set again
- [x] 2.3 `TreatmentForm.tsx`: "Undo the latest change" under the history whenever a treatment is set, with the dialog naming the treatment that stays in force or saying the treatment is removed
- [x] 2.4 Messages for the dialog texts in fi, then sv and en with the translate skill
- [x] 2.5 Component tests for both forms: the button shows with one period, the dialog's two texts, undoing calls the server function and reloads
- [x] 2.6 Playwright tests in `e2e/recurring-amounts.spec.ts`: "Undoing the only rent" (undo, then set from the right date) and "Undoing the latest treatment change" › "Undoing a treatment change"

## 3. Archive

- [x] 3.1 `pnpm check:traceability` and the full test suite pass; the design canvas needs no new board (the dialogs follow VastikePeru)
- [x] 3.2 `openspec archive undo-first-recurring-amount`; rename the test "The only period can't be undone" to "Nothing to undo is refused"; check the spec's Purpose
