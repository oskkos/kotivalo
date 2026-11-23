## Why

A housing company can collect several financing charges (*rahoitusvastike*, the Tax Administration's *pääomavastike*) for one flat at the same time, e.g. one for a pipe renovation loan and another for a facade project. Today a flat has one financing charge (#31), so two charges can only be entered as their sum, which hides when each one starts, changes and ends (#90).

## What Changes

- **Several named financing charges per flat.**
  - Each has a name (e.g. *Putkiremontti*) and its own monthly amount periods, with the same rules as today: from the first of a month, never overwritten, only the latest change can be undone.
  - A new charge needs a name. Names are unique within the flat, ignoring case and surrounding spaces.
  - The name can be changed at any time. It is not a validity period.
- **The existing financing charge becomes the flat's first charge, without a name.** A charge without a name is shown as *Rahoitusvastike* in the user's language. Its name can be set later, but not removed again.
- **The treatment stays per flat** (*tuloutettu* / *rahastoitu*, as validity periods as today) and applies to all of the flat's financing charges. The Tax Administration ties it to the housing company's bookkeeping, not to a charge.
- **Ending a charge:** the change form gets a choice *Uusi summa* / *Päättyy*. *Päättyy* sets 0 € from the chosen month, the existing way to end a charge. A charge whose amount is 0 € today with no later change is ended. Ended charges are listed under *Päättyneet rahoitusvastikkeet*, where they can still be opened, renamed and undone.
- **Removing a charge added by mistake:** undoing the only amount of a financing charge removes the charge itself. No separate delete.
- **The Rent and charges page** shows the financing charges in one card: each charge with its amount, start and upcoming change, *Lisää rahoitusvastike* for owners, and the treatment once, "koskee kaikkia". With one unnamed charge the page looks as it does today.
- **Computed views follow:**
  - The accumulated capitalised financing charges sum all charges.
  - The charges page by year (#99) gets one summary line per financing charge with an amount in the year, split by treatment when it changes mid-year. Each month lists every charge with an amount and marks when a financing charge started or ended.
  - The flat details page lists each financing charge in effect today and the treatment once.
- The word stays *rahoitusvastike* in the UI. The term bank already accepts *pääomavastike* as the same term.

Not in this change:
- One-off extra charges (*ylimääräinen vastike*) for improvements. They stay entries for now.
- Moving the rent from the Rent and charges page to the tenancy (#102).
- The year summary (#34), which will sum the financing charges into form 7H row 2.3 or the acquisition cost by treatment.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `recurring-amounts`:
  - New requirements: adding, renaming and ending a financing charge.
  - The financing charge is several named sequences of periods in "Rent and charges are recorded as monthly periods", "The rent and charges page", "Setting a rent or charge", "Undoing the latest rent or charge change" (undoing the only amount removes the charge), "The financing charge treatment" (applies to all), "Accumulated capitalised financing charges" (sums all), "Charges of a month" and "The charges page" (one line per charge).
- `properties`: "The flat details page" lists each financing charge in effect today with the treatment once.

## Impact

- **Tables:**
  - New `financing_charges` (id, property, name or null).
  - `recurring_amounts` gets a nullable `financing_charge_id`, set on every `financing_charge` row.
  - The migration creates one unnamed charge for each flat that has financing charge periods and links its rows. The previous version keeps working: it ignores the new column, and every flat has at most one charge until the new version is live.
- **Code:**
  - The repository and server logic in `features/recurring-amounts/` (charge-scoped period writes, adding, renaming, removing with the last period).
  - New server functions `addFinancingCharge` and `renameFinancingCharge`; `setRecurringAmount` and `undoRecurringAmount` take a charge id for financing charges.
  - The pure calculations `charges.ts` and `periods.ts` (`accumulatedCapitalised`), `RecurringAmountsPage`, `AmountForm`, `ChargesPage`, `details.server.ts` and `FlatDetailsPage`.
  - New routes `/properties/$propertyId/amounts/financing/new` and `/properties/$propertyId/amounts/financing/$chargeId`.
- **UI:** Design canvas, row *Useampi rahoitusvastike (#90)*:
  - *Vuokra ja vastikkeet · useampi rahoitusvastike* (`RahoitusVastikkeet`)
  - *Lisää rahoitusvastike* (`RahoitusUusi`)
  - *Muuta rahoitusvastiketta · nimi ja päättyminen* (`RahoitusMuutos`)
  - *Asunnon tiedot · useampi rahoitusvastike* (`AsuntoTiedotRahoitus`)
  - *Vastikkeet kuukausittain · useampi rahoitusvastike* (`VastikeKuukaudetUseat`)
- **Messages:** new fi, sv and en messages and reason codes (`financing_charge_name_required`, `financing_charge_name_taken`, `financing_charge_not_found`), written with the translate skill.
- **Logs:**
  - `financing_charge.added`, `financing_charge.renamed`, `financing_charge.removed`.
  - `recurring_amount.set` and `recurring_amount.undone` carry the charge id for financing charges.
