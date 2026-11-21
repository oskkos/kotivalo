## Why

Rent, the maintenance charge and the financing charge change over time: rent goes up by contract, and the housing company decides new charges every year. The year summary (#34) and the flat details page (#33) need these amounts **as they were in each month**, and a change must not overwrite the past (#31). The financing charge also needs its treatment in the housing company (income-recognised or capitalised) as a period of its own, because it decides whether the charge is deductible or added to the acquisition cost.

## What Changes

- **Rent and charges as periods.** A flat has three monthly amounts: rent, maintenance charge and financing charge. Each is a sequence of periods with an amount and a start date, from the first day of a month. A new amount ends the previous period the month before. Nothing is overwritten.
- **The Rent and charges page.** A new page for each flat shows the current amount of each, with its start date and any upcoming change. The financing charge card shows its treatment and the acquisition cost accumulated from capitalised charges so far.
  - The page opens from a new button in the edit page's header, next to Ownership and sharing.
  - When the flat details page (#33) comes, its menu opens the same page.
- **Changing an amount.** An owner sets the first amount, or a new one, from a date.
  - The date may be in the future (an announced increase), but not before the month the flat's first ownership period starts in, and not before the latest change. A new amount on the latest change's own date corrects it.
  - The form shows the current amount, the difference, and its effect on that year (e.g. "In 2027 adds €156 to deductible expenses, 12 months").
  - It also shows the amount's change history.
- **Undoing the latest change.** An owner can undo the latest change of an amount that has more than one period, which makes the previous amount current again.
- **Financing charge treatment.** An owner sets whether the housing company recognises the financing charge as income or capitalises it, from a date, with the same date rules. The history is kept.
- **Computed, never generated.** Monthly amounts and the accumulated capitalised charges are computed from the periods when needed, by pure functions. No monthly entries are written to the database, so correcting an amount afterwards also corrects the past months. The year summary (#34) will use the same functions.
- **Only owners change.** Everyone with access sees the amounts and their history. Only owners can change them, because they decide the owners' taxes.

Not in this change:
- rent per tenancy, prorated rent and payment status (#30, #25)
- logged income and expense entries (#32)
- the year summary's use of these amounts (#34)
- asking for the amounts in the new flat form
- showing the Finnish original next to the tax terms (#34)

## Capabilities

### New Capabilities

- `recurring-amounts`: rent and charges as monthly periods, the Rent and charges page, setting and changing an amount from a date, undoing the latest change, the financing charge treatment as periods, and the computed monthly amounts and accumulated capitalised charges.

### Modified Capabilities

None. The new page's entry point on the edit page is part of the new capability; the requirements of "Editing a flat" don't change.

## Impact

- **Tables:**
  - new `recurring_amounts`: id, property id, kind (`rent`, `maintenance_charge`, `financing_charge`), amount in cents, `valid_from`, `valid_to`
  - new `financing_treatments`: id, property id, treatment (`income_recognised`, `capitalised`), `valid_from`, `valid_to`

  Both start empty; existing flats have no amounts until an owner sets them.
- **Code:**
  - `features/recurring-amounts/`:
    - a repository
    - pure functions for the periods (date rules, the amount in a month, the year's effect, the accumulated capitalised charges) with unit tests
    - server functions with owner checks and logging
    - the page, the change form and the treatment form
  - The edit page's header gets the new button.
- **Screens:** the "Vuokra ja vastikkeet" row on the Design canvas:
  - the page, its empty state and the member view
  - the change form: first amount, error, undo
  - the treatment form
  - the edit page header

  They replace the older "Muuta vuokraa / vastiketta" sketch, which assumed the flat details page and a kind switch inside the form.
- **Messages:** fi, sv and en for the screens and the new reason codes, written with the translate skill and the term bank. The term bank's rent, maintenance charge, financing charge, income-recognised, capitalised and acquisition cost terms are verified.
- **Docs:**
  - CONCEPT.md: the open question on generating recurring entries is answered (computed on the fly). The translations question is ticked as done by #57.
  - CLAUDE.md: the current state.
