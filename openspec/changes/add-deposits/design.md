## Context

Tenancies, rent payments, documents and the year summary are built (#30, #33, #114, #34). A deposit is nowhere in the data yet. The year summary's form 7H page says that deposits are not counted.

The tax rules come from the Tax Administration's *Vuokratulojen verotus* (12.1.2026), §2.1.3 *Vuokravakuus*:
- a deposit is not income when received;
- the part used for unpaid rent, or for the last months' rent, is taxable rental income;
- the part kept because the tenant caused damage is tax-free compensation (TVL 36 and 78 §), and repair costs are deductible "vain siltä osin kuin ne ylittävät vuokravakuuden". Example 1: a deposit of 500 € kept, materials 250 €, so nothing is deductible. (Checked against the ohje of 12.1.2026 during the review.)

The ohje doesn't say what happens when the repair is paid in another year than the deposit is kept.

The law is the Act on Residential Leases 481/1995 § 8 as amended by 531/2026, in force 1.10.2026:
- the deposit is returned, or its keeping notified in writing with the grounds and an estimate, within 14 days of the end of the contract (§ 8(2));
- a term requiring more than three months' rent is void (§ 8(5)).

The transitional provision applies the new law to earlier contracts too, except that § 8(1) and the old § 8(2) (in place of the new § 8(5)) stay for contracts made before 1.10.2026. The cap of three months' rent is in the old § 8(2) as well as I recall it, but that wasn't checked against the old text (see Open Questions).

The Design canvas section "Vuokravakuus ja vuokrasopimus (#93)" has the screens. Its proposals were accepted as drawn.

## Goals / Non-Goals

**Goals:**
- Store a tenancy's deposit, and record its return in full or with deductions by reason.
- Make the tax effect of the return land in the year summary through the existing calculations: rent kept as rent payments, damage as a part of row 2.4.
- Remind the owner of an unreturned deposit, with the legal deadline.
- Show the current tenancy's lease on the Tenancy page and let owners add it there.

**Non-Goals:**
- The form of the deposit (bank account, bank guarantee, Kela commitment), whether it was paid, and interest.
- Reminders by email or push (#84), and the former owner's view (#88).
- Matching a damage compensation to repairs paid in another year (Open Questions).
- A deposit on the flat details page's tenancy card, and in the flats list.

## Decisions

### 1. The deposit is a column on `tenancies`, not a period

`tenancies.deposit`, cents, nullable. A deposit belongs to one contract and doesn't change over time like rent. A correction is a correction in place, as for the tenant's phone number.

*Alternative:* a period table like `tenancy_rents`. Rejected: a raised deposit during a tenancy is rare, and the return needs only the amount held at the end.

### 2. A return keeps two amounts by reason

`deposit_returns` has these columns:
- `id`
- `tenancy_id`: unique, `ON DELETE CASCADE`
- `returned_on`: `isoDate`
- `rent_kept` and `damage_kept`: `cents`, ≥ 0
- `note`: nullable, up to 200 characters
- `created_by`, `created_at` and `updated_at`

The amount returned is `deposit − rent_kept − damage_kept`. It is computed, never stored, so correcting the deposit can't make it stale. *Kokonaan* is a return with both amounts 0. The form's choice isn't stored.

*Alternative:* CONCEPT.md's draft "amount returned, deduction, reason". Rejected: one deduction with one reason can't keep 300 € for rent and 200 € for damage, the common case, and the two reasons are taxed differently.

### 3. Rent kept is recorded as rent payments linked to the return

`rent_payments.deposit_return_id` is nullable, references `deposit_returns.id`, and uses `ON DELETE CASCADE`. Recording a return inserts the return and its payments in one `atomically` write:
- each payment is for a month of the tenancy;
- each is paid on the return date;
- the payments are allocated by `allocateRentKept`.

Correcting deletes the return's payments, updates the return and inserts the new payments, in one write. Deleting the return deletes its payments by the cascade.

*Why:* the rent kept is rent received. As payments, it follows every existing rule with no new code: the month statuses, the months not fully paid, row 2.1 by payment date at the share on that date, the year summary's unpaid check, and "Payments stay inside their tenancy".

*Alternative:* a row 2.1 part read from the return. Rejected: the months would stay late, and both the details page and the year summary would warn about rent that was in fact covered.

`allocateRentKept(months, kept)` is pure, in `features/deposits/deposit.ts`. It takes the tenancy's months with their missing amount, oldest first, and fills each up to its missing amount. Above the total missing it refuses with `deposit_rent_exceeds_unpaid`.
- The missing amounts come from `rent-payments/status.ts`: the expected rent with fees, minus the payments, for every month of the tenancy, not only the last two years.
- For a correction, the return's own payments are left out first.

### 4. Damage compensation is a negative, capped part of row 2.4

A new part key, `deposit_damage`, is `−min(round(Σ damage_kept × bp ÷ 10000), annual_repair part)`.
- Each return counts at the user's share on `returned_on`, in the year of `returned_on`.
- The rest goes to the Not on form 7H card as `deposit_damage_surplus`.
- The cap keeps row 2.4 at 0 or above. It applies after rounding, so the part is rounded once as the other parts are.
- Only row 2.4 is reduced: the ohje speaks of repair costs, and the app files repairs as annual repairs (`annual_repair`). An "other expense" entry for a repair stays in row 2.5. The note under the card says so.

*Alternative:* reduce every expense row. Rejected: the guidance is about repair costs, and mixing rows would hide where the deduction went.

### 5. Reads for the year summary stay a fixed number of queries

`depositReturns.forPropertiesYear(propertyIds, year)` reads the returns of the flats' tenancies dated in the year, joined through `tenancies`. It is one more query in `loadInputs`, whatever the number of flats. Rent kept needs no read of its own: it is already in `payments.forProperties`.

### 6. The reminder and the deadline are computed

`returnDeadline(lastRentDay)` is the last rent day plus 14 days. The app doesn't track a handover after the contract's end, which the law also counts from, so the date is the earliest deadline. The reminder shows for tenancies with `deposit > 0`, no return, and `valid_to ≤ today`.

The Tenancy page's loader already reads every tenancy of the flat. It also reads their returns, one query by tenancy ids, and the current tenancy's leases (`documents` by `tenancy_id`).

### 7. Where the return is opened from

The return page `/properties/$propertyId/tenancy/$tenancyId/deposit` records a new return or corrects the recorded one, and offers *Poista palautus* with a confirmation. It is opened from:
- the reminder card;
- the correction form of an ended tenancy with a deposit, which shows the return's status.

A row under the other tenancies keeps opening the correction form (tenancies, "The tenancy page"). The canvas row opens the return directly, but one row can't open two things, and the correction form is where every other detail of an ended tenancy is reached.

### 8. Guards for a recorded return

- `updateTenancy` refuses:
  - a deposit below `rent_kept + damage_kept`, with `deposit_below_kept`;
  - a change that moves `valid_to` after `returned_on` or clears it, with `tenancy_has_deposit_return`.
- `cancelTenancyEnding` refuses with `tenancy_has_deposit_return` when a return exists.
- `deleteRentPayment` refuses a payment with `deposit_return_id`, with `rent_payment_from_deposit`.

Each is a read before the write, like the existing payment guards. Two owners racing can still pass a guard together, as elsewhere in the app; the D1 statements stay guarded where a `WHERE` can express the rule. An example is the payment delete: `deposit_return_id IS NULL`.

### 9. The three months' rent warning is shown in the form, never enforced

`depositOverLimit(deposit, rent)` returns the limit when `deposit > 3 × rent`. The new tenant form uses the rent field. The correction form uses the rent in effect on the tenancy's start day. The server doesn't check it: an existing contract may hold a larger deposit, and the app records what was paid.

### 10. Preselecting a lease on the add document form

`/properties/$propertyId/documents/new` gets `validateSearch` with an optional `kind` (one of the kinds) and `tenancyId`. The form uses them as defaults when the tenancy is one of the flat's. Otherwise it keeps its usual defaults, so a stale or forged link does no harm. With `tenancyId`, closing the form returns to the Tenancy page.

## Risks / Trade-offs

- [A damage compensation in one year and the repair paid in another] → The app counts the compensation in the year of the return, shows a surplus on the Not on form 7H card, and the note tells the user to check. It is recorded as an open question in CONCEPT.md §6.
- [Rent kept as payments looks as if the tenant paid] → The payments are labelled *Vakuudesta* on both payments pages and can't be deleted on their own. The return page names the months covered.
- [A return recorded and the tenancy then corrected] → Guarded by `tenancy_has_deposit_return` and `deposit_below_kept`. The payments already stay inside the tenancy by the existing rule.
- [The legal text for contracts made before 1.10.2026] → The cap is only a warning, and the deadline rule applies to all contracts by the transitional provision.
- [D1's 100 bound parameters] → The read by tenancy ids uses `inChunks`, as the tenancy repository does.

## Migration Plan

One migration from `pnpm db:generate`, all additive:
- `tenancies.deposit`, nullable;
- the `deposit_returns` table, with its unique index on `tenancy_id`;
- `rent_payments.deposit_return_id`, nullable.

The previous version ignores them, so the deploy order (migrations first) is safe. Rollback means deploying the previous code. The columns stay unused, and a later change can drop them if ever needed.

## Open Questions

- Whether the old § 8(2), which stays for contracts made before 1.10.2026, has the same three months' cap. I recall that it does, but the old text wasn't checked: Finlex's page shows only the current version. The answer changes only the warning's wording.
- Whether the 14-day deadline of § 8(2) applies to contracts made before 1.10.2026, and whether it runs from the end of the contract or the handover: sources differ, and the law's text couldn't be read. The reminder words it as a usual deadline and tells the owner to check the contract.
- How a damage compensation is matched to repairs paid in a different year. The ohje is silent. Until a source says otherwise, the app uses the year of the return.
