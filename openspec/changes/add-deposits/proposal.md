## Why

A tenancy's deposit is not stored anywhere today, and the deposit return has no screen (CONCEPT.md §6). The return also decides tax:
- the part kept for unpaid rent is rental income in the year it is kept;
- the part kept for damage is tax-free compensation, and it limits the deductible repair costs.

Until this change, form 7H is wrong whenever a deposit is kept, and the form 7H page says that deposits are not counted yet. The signed lease is already a flat document (#114), but the Tenancy page doesn't show it. Issue #93; its dependencies, #30 and #114, are done.

## What Changes

- **A deposit on the tenancy.** The new tenant form and the tenancy's correction form ask for an optional deposit. Above three months' rent the form warns but still saves: the Act on Residential Leases makes a term asking for more void (§ 8(5), 531/2026). The Tenancy page shows a *Vakuus* card for the current tenancy. Owners open the correction form from it with *Muuta*, or with *Lisää* when no deposit is set.
- **Recording the deposit return** on a page of its own, once the tenancy has ended.
  - The return is either *Kokonaan* (in full) or *Vähennyksin* (with deductions), with the return date.
  - Deductions are kept as two amounts by reason: unpaid rent, and damage and cleaning. A note is optional.
  - The amount returned is computed, never typed.
  - There is one return per tenancy. Owners correct or delete it; members see it.
- **Rent kept from the deposit becomes rent payments.** The part kept for unpaid rent is recorded as payments for the tenancy's months with rent missing, oldest first, paid on the return date. The months show as paid. Row 2.1 counts the payments in the year of the return. The year summary's unpaid check clears without a new calculation.
  - These payments are labelled *Vakuudesta* on the payments pages. They can't be deleted on their own: correcting or deleting the return replaces or removes them.
  - The rent kept can't exceed the rent missing.
- **Damage kept from the deposit in the year summary.** Row 2.4 gets a negative part, *Vakuudesta korvatut vahingot*, at the user's share on the return date. The part is at most the row's annual repairs of that year, so the row never goes below 0. A surplus is shown on the Not on form 7H card as tax-free compensation (Vero, *Vuokratulojen verotus* 12.1.2026, §2.1.3, example 1). The note "deposits are not counted yet" is removed.
- **The deposit return reminder.** From the last rent day of a tenancy with a deposit and no return, the Tenancy page shows the card *Vakuus palauttamatta*. It has *Kirjaa palautus* and the legal deadline: the deposit is returned, or the deduction notified in writing, within 14 days of the contract's end (§ 8(2), 531/2026, which applies to earlier contracts too). The card stays when a new tenant has already started.
  - The other tenancies list shows each tenancy's deposit status.
  - The correction form of an ended tenancy links to its return.
- **The end tenancy form** says how much the deposit is and that the return is recorded later from the Tenancy page. It doesn't ask for the return: notice is usually given months before the final inspection. This drops the "later / in full / with deductions" choice from CONCEPT.md §3.
- **A recorded return stays inside its tenancy.** With a return recorded:
  - cancelling the ending, or correcting the end so that it falls after the return date, is refused;
  - lowering the deposit below the amounts kept is refused.
- **The lease on the Tenancy page.** A *Vuokrasopimus* card lists the current tenancy's lease documents, newest first, and opens each one's details page. Owners get *Lisää vuokrasopimus*, which opens the add document form with *Vuokrasopimus* and the tenancy preselected.

## Capabilities

### New Capabilities

- `deposits`: a tenancy's deposit, and its return:
  - recording, correcting and deleting the return;
  - the rent kept as payments;
  - the reminder and the deadline;
  - the deposit when ending a tenancy;
  - a return staying inside its tenancy.

### Modified Capabilities

- `rent-payments`: "Deleting a rent payment" refuses a payment kept from a deposit.
- `year-summary`:
  - "Form 7H rows of the own share": row 2.4 gets the damage part, and row 2.1 names the rent kept from a deposit.
  - "Shares on the cash basis": a return counts at the share on its date.
  - "The Not on form 7H card": the surplus of the damage compensation.
  - "The form 7H page of a flat": drops the note that deposits are not counted yet.
- `documents`: "Adding a document" can open with the kind and the tenancy preselected, from the Tenancy page. A new requirement covers the lease card on the Tenancy page.

## Impact

- **Tables:**
  - `tenancies` gets `deposit` (cents, nullable).
  - New `deposit_returns`:
    - `tenancy_id`, unique, `ON DELETE CASCADE`;
    - `returned_on`, `rent_kept`, `damage_kept` (cents, ≥ 0) and `note`;
    - `created_by`, `created_at`, `updated_at`.
  - `rent_payments` gets `deposit_return_id`, nullable, `ON DELETE CASCADE`.

  All are additive, so the previous version keeps working. This replaces the `deposit_returns` draft in CONCEPT.md §5.2 ("amount returned, deduction, reason, date"): one deduction with one reason can't hold the common case of keeping some for rent and some for damage.
- **Code:**
  - New `features/deposits/`:
    - the pure calculations: allocating the rent kept, the amount returned, the deadline and the three months' rent warning;
    - the repository, the server functions and `DepositReturnForm.tsx`.
  - Changed:
    - `features/tenancies/`: the deposit field, the cards on `TenancyPage.tsx`, the guards in `updateTenancy` and `cancelTenancyEnding`, and the end form's note.
    - `features/rent-payments/`: the label, and the delete guard.
    - `features/year-summary/summary.ts`: the damage part and the surplus.
    - `features/documents/`: the preselected kind and tenancy.
  - The flat deletion cascade test gets `deposit_returns`.
- **Routes:**
  - adds `/properties/$propertyId/tenancy/$tenancyId/deposit`;
  - `/properties/$propertyId/documents/new` gets optional `kind` and `tenancyId` search parameters.
- **Messages:** fi, sv and en for the deposit field and warning, the cards, the return page, the payment label and the year summary parts. The term bank already has *vakuus* (`deposit`) and *vakuuden palautus* (`deposit_return`). New words (*pidättää*, *lopputarkastus*) go through the translate skill and the term-critic.
- **Design canvas:** the section "Vuokravakuus ja vuokrasopimus (#93)":
  - Vuokrasuhde · vakuus ja vuokrasopimus
  - Uusi vuokralainen · vakuus
  - Päätä vuokrasuhde · vakuus palautetaan myöhemmin
  - Vuokrasuhde · vakuus palauttamatta
  - Vakuuden palautus
  - Vuokrasuhde · vakuus palautettu

  One gap with the canvas: there, an ended tenancy's row opens its return. The spec keeps the row opening the correction form ("The tenancy page", tenancies), and the correction form links to the return, so a row opens one thing.
- **Docs:**
  - CONCEPT.md: §3 (the End tenancy row), §4.2 (the 14-day deadline, rent kept as payments), §5.2 (the tables), and §6 (tick the deposit return screen; add the open question of repairs paid in another year than the deposit is kept);
  - CLAUDE.md "Current state".
