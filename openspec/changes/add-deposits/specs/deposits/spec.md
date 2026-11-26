## ADDED Requirements

### Requirement: A tenancy's deposit
A tenancy SHALL have an optional deposit, an amount in cents. The new tenant form ("Adding a tenant") and the tenancy's correction form ("Correcting a tenancy") SHALL ask for it as *Vakuus €*, empty meaning no deposit. When given, it SHALL be more than 0 and at most 100 000 €, with at most two decimals, written with a comma or a point (`deposit_amount_invalid`). When it is more than three times the rent in effect on the tenancy's start day, the form SHALL say, under the field, that the law allows a deposit of at most three months' rent, with that amount. The form SHALL still save it: a term asking for more is void (Act on Residential Leases 481/1995 § 8(5), 531/2026), but the deposit is still the tenant's money. A deposit is not income. Only owners SHALL set or change the deposit, through these forms; the server SHALL refuse a member with the reason `sharing_owner_only`. Creating and correcting a tenancy log their existing events; the deposit is not logged as a value.

#### Scenario: Adding a tenant with a deposit
- **WHEN** Annika adds `Aino Koski` to `Kuusikuja 3 B 12` with the rent `890` and the deposit `1780`
- **THEN** the tenancy is stored with the deposit 178000 cents, and the Tenancy page's *Vakuus* card shows `1 780,00 €`

#### Scenario: A tenancy without a deposit
- **WHEN** Annika adds a tenant and leaves *Vakuus €* empty
- **THEN** the tenancy is stored without a deposit, and the *Vakuus* card says there is no deposit

#### Scenario: A deposit over three months' rent is warned about
- **WHEN** Annika enters the rent `890` and the deposit `3000` in the new tenant form
- **THEN** the field says that the law allows at most three months' rent, `2 670,00 €`, and saving stores the deposit 300000 cents

#### Scenario: An invalid deposit is refused
- **WHEN** an owner enters the deposit `0` or `1780,555`
- **THEN** the field shows the reason `deposit_amount_invalid`, and nothing is stored

#### Scenario: Correcting the deposit
- **WHEN** `Aino Koski`'s tenancy has the deposit 178000 cents, no return is recorded, and Annika corrects it to `1700` in the correction form
- **THEN** the *Vakuus* card shows `1 700,00 €`

#### Scenario: A member can't set a deposit
- **WHEN** Jussi, a member of the flat, sends a correction with a deposit to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and the tenancy is unchanged

### Requirement: The deposit on the tenancy page
The Tenancy page SHALL show, below the fees card of the current tenancy, a *Vakuus* card with the tenancy's deposit and that it is returned once the tenancy has ended and the final inspection is done, or that there is no deposit. Owners SHALL see *Muuta* on it, or *Lisää* when no deposit is set, opening the tenancy's correction form. In the list of the flat's other tenancies, each row SHALL show its deposit status: no deposit, the deposit not returned, or the return date with the amount returned and the amount kept. Members SHALL see the card and the statuses, without the buttons.

#### Scenario: The deposit card of the current tenancy
- **WHEN** `Aino Koski`'s current tenancy has the deposit 178000 cents, and Annika opens the Tenancy page
- **THEN** the *Vakuus* card shows `1 780,00 €` and *Muuta*

#### Scenario: An ended tenancy's deposit status
- **WHEN** `Aino Koski`'s tenancy ended on `2026-12-31`, its return on `2027-01-15` kept 50000 of 178000 cents, and the flat's Tenancy page lists it under the other tenancies
- **THEN** its row says the deposit was returned on `15.1.2027`, `1 280,00 €`, with `500,00 €` kept

#### Scenario: A member sees the deposit but can't change it
- **WHEN** Jussi, a member of the flat, opens the Tenancy page
- **THEN** he sees the *Vakuus* card with `1 780,00 €`, without *Muuta*

### Requirement: Recording a deposit return
An owner SHALL be able to record a tenancy's deposit return on its own page, opened from the deposit return reminder or from the tenancy's correction form. The page SHALL show the tenant, the deposit and the tenancy's last rent day, and ask:
- *Palautetaan*: *Kokonaan* (in full) or *Vähennyksin* (with deductions), *Kokonaan* by default
- the return date, today by default, not before the tenancy's last rent day (`deposit_return_before_end`) and not in the future (`deposit_return_date_in_future`)
- with deductions:
  - the amount kept for unpaid rent (*Maksamaton vuokra €*), with the rent missing from the tenancy's months shown under it;
  - the amount kept for damage and cleaning (*Vahingot ja siivous €*);
  - an optional note of at most 200 characters (`deposit_note_too_long`).

  Each amount SHALL be 0 or more, with at most two decimals (`deposit_amount_invalid`). At least one SHALL be more than 0 (`deposit_kept_required`), and together they SHALL NOT be more than the deposit (`deposit_kept_exceeds_deposit`).

The amount returned SHALL be computed as the deposit minus the amounts kept, shown as the form changes, and never typed. A return SHALL need a tenancy with a deposit (`deposit_not_set`) whose last rent day is set. A tenancy SHALL have at most one return (`deposit_return_exists`). The return SHALL record the user who recorded it, and log `deposit.return_recorded` with the tenancy and return ids. After saving, the owner SHALL land on the Tenancy page. A member SHALL NOT be able to record a return (`sharing_owner_only`), and a tenancy of a flat the user has no access to SHALL be refused as not found (`tenancy_not_found`).

#### Scenario: Returning a deposit in full
- **WHEN** today is `2027-01-15`, `Aino Koski`'s tenancy with the deposit 178000 cents ended on `2026-12-31`, and Annika records the return *Kokonaan* on `15.1.2027`
- **THEN** a return of `2027-01-15` keeping 0 and 0 cents is stored, and her row on the Tenancy page says `1 780,00 €` was returned on `15.1.2027`

#### Scenario: Returning with deductions
- **WHEN** December 2026 of the same tenancy has 30000 cents of rent missing, and Annika records *Vähennyksin* on `15.1.2027` keeping `300` for unpaid rent and `200` for damage and cleaning, with the note `Lattian korjaus`
- **THEN** the page shows `1 280,00 €` to return before saving, and the stored return keeps 30000 and 20000 cents

#### Scenario: Deductions can't exceed the deposit
- **WHEN** the deposit is 178000 cents, and an owner keeps `1000` for unpaid rent and `900` for damage
- **THEN** it is refused with the reason `deposit_kept_exceeds_deposit`, and nothing is stored

#### Scenario: Deductions need an amount
- **WHEN** an owner chooses *Vähennyksin* and leaves both amounts at 0
- **THEN** it is refused with the reason `deposit_kept_required`, and nothing is stored

#### Scenario: A return before the last rent day is refused
- **WHEN** the tenancy's last rent day is `2026-12-31`, and an owner sends a return dated `2026-12-30` to the server
- **THEN** it is refused with the reason `deposit_return_before_end`, and nothing is stored

#### Scenario: A return date in the future is refused
- **WHEN** today is `2027-01-15`, and an owner records a return dated `16.1.2027`
- **THEN** the date field shows the reason `deposit_return_date_in_future`, and nothing is stored

#### Scenario: A tenancy without a deposit has no return
- **WHEN** an owner sends a return for a tenancy without a deposit to the server
- **THEN** it is refused with the reason `deposit_not_set`, and nothing is stored

#### Scenario: A second return is refused
- **WHEN** `Aino Koski`'s tenancy already has a return, and an owner sends another one to the server
- **THEN** it is refused with the reason `deposit_return_exists`, and the first return is unchanged

#### Scenario: A member can't record a return
- **WHEN** Jussi, a member of the flat, sends a return to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing is stored

### Requirement: Rent kept from the deposit
The amount kept for unpaid rent SHALL be recorded as rent payments of the tenancy, paid on the return date and linked to the return, in the same write as the return. It SHALL cover the tenancy's months whose payments are less than their expected rent ("Expected rent of a month"), oldest first, each month up to the amount missing. The amount kept for unpaid rent SHALL NOT be more than the rent missing from all of the tenancy's months (`deposit_rent_exceeds_unpaid`). These payments SHALL count like other payments in the month's status and in the year summary, in the year of the return date. On the month's payments page and the rent payments page they SHALL be labelled *Vakuudesta*.

**No Playwright test:** the allocation is a pure calculation, and its effect in the browser is shown by "Recording a deposit return"'s Playwright test, where the month the rent kept covers turns paid.

#### Scenario: The rent kept pays the missing month
- **WHEN** December 2026's expected rent is 89000 cents with a payment of 59000, and the return on `2027-01-15` keeps 30000 cents for unpaid rent
- **THEN** a payment of 30000 cents for `2026-12` paid on `2027-01-15` is stored with the return, December shows as paid, and the payment is labelled *Vakuudesta*

#### Scenario: The rent kept covers the oldest months first
- **WHEN** November 2026 has 10000 cents of rent missing and December 2026 30000, and the return keeps 35000 cents for unpaid rent
- **THEN** payments of 10000 cents for `2026-11` and 25000 cents for `2026-12` are stored, and December still has 5000 cents missing

#### Scenario: The rent kept can't exceed the rent missing
- **WHEN** the tenancy's months have 30000 cents of rent missing in all, and an owner keeps 40000 cents for unpaid rent
- **THEN** it is refused with the reason `deposit_rent_exceeds_unpaid`, and nothing is stored

#### Scenario: The rent kept counts in the year of the return
- **WHEN** Annika owns 10000 basis points, and the return on `2027-01-15` keeps 30000 cents for December 2026's rent
- **THEN** row 2.1 of 2027 includes the 30000 cents, and row 2.1 of 2026 doesn't

### Requirement: Correcting and deleting a deposit return
The correction form of an ended tenancy with a deposit SHALL show its return, or that it is not recorded, and open the return page. An owner SHALL be able to correct a recorded return on that page, with the same checks, and to delete it after a confirmation. The rent payments the return recorded SHALL be replaced in the same write when it is corrected, and removed with it when it is deleted. When the rent missing is checked for a correction, the return's own payments SHALL NOT count as paid. A payment recorded by a return SHALL NOT be deleted on its own ("Deleting a rent payment"). Correcting SHALL log `deposit.return_updated`, and deleting SHALL log `deposit.return_deleted`, with the ids. A deposit lowered below the amounts kept, or removed while a return keeps an amount, SHALL be refused with the reason `deposit_below_kept`. A member SHALL NOT be able to correct or delete a return (`sharing_owner_only`).

#### Scenario: Correcting the amount kept for damage
- **WHEN** the return keeps 30000 cents for unpaid rent and 20000 for damage, and Annika corrects the damage to `150`
- **THEN** the return keeps 30000 and 15000 cents, December 2026 still has one payment of 30000 cents from the deposit, and `1 330,00 €` is returned

#### Scenario: Correcting the rent kept replaces its payments
- **WHEN** the return keeps 30000 cents for December 2026's missing rent, and Annika corrects the rent kept to `100`
- **THEN** December 2026 has one payment of 10000 cents from the deposit, and 20000 cents are missing again

#### Scenario: Deleting a return removes its payments
- **WHEN** the return keeps 30000 cents for December 2026, and Annika deletes the return and confirms
- **THEN** no return is stored, December 2026 has 30000 cents missing again, and the deposit return reminder shows again

#### Scenario: Opening the return from the correction form
- **WHEN** `Aino Koski`'s tenancy ended on `2026-12-31` with a return recorded, and Annika selects her row under the other tenancies
- **THEN** the correction form shows the return, and opening it shows the return page with the recorded amounts

#### Scenario: The deposit can't go below the amounts kept
- **WHEN** the return keeps 50000 cents in all, and an owner corrects the deposit to `400` or removes it
- **THEN** it is refused with the reason `deposit_below_kept`, and the tenancy is unchanged

#### Scenario: A member can't delete a return
- **WHEN** Jussi, a member of the flat, sends deleting the return to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and the return stays

### Requirement: The deposit return reminder
For each of a flat's tenancies with a deposit and no return whose last rent day is today or earlier, the Tenancy page SHALL show a card at its top, *Vakuus palauttamatta*. The card SHALL show the tenant, the deposit and the last rent day, and the legal deadline: the deposit is returned, or the deduction notified in writing with its grounds and an estimate of the amount, within 14 days of the end of the contract, here the last rent day plus 14 days (Act on Residential Leases § 8(2), 531/2026, which applies to contracts made before 1.10.2026 too). It SHALL say that the hints are not legal advice. Owners SHALL see *Kirjaa palautus*, opening the return page. The card SHALL be shown also when the flat is vacant or a new tenancy has started, and SHALL go once the return is recorded. Members SHALL see the card without the button.

#### Scenario: The reminder after the last rent day
- **WHEN** today is `2027-01-10`, `Aino Koski`'s tenancy with the deposit 178000 cents ended on `2026-12-31` with no return, and Annika opens the Tenancy page
- **THEN** the top card says `Aino Koski`'s deposit `1 780,00 €` is not returned, with the deadline `14.1.2027` and *Kirjaa palautus*

#### Scenario: No reminder before the last rent day
- **WHEN** today is `2026-12-30`, and `Aino Koski`'s tenancy with a deposit has notice given with the last rent day `2026-12-31`
- **THEN** the Tenancy page shows no deposit return reminder

#### Scenario: The reminder stays while a new tenant lives in the flat
- **WHEN** today is `2027-01-20`, `Aino Koski`'s deposit is not returned, and `Mikko Lehtinen`'s tenancy started on `2027-01-15`
- **THEN** the Tenancy page shows `Mikko Lehtinen` as the current tenancy, and the reminder for `Aino Koski` above it

#### Scenario: A tenancy without a deposit has no reminder
- **WHEN** `Pekka Virtanen`'s tenancy without a deposit ended on `2025-02-28`
- **THEN** the Tenancy page shows no reminder for it

### Requirement: The deposit when ending a tenancy
When a tenancy has a deposit, the end tenancy form ("Ending a tenancy", "Ending a fixed-term tenancy early") SHALL show the deposit and say that it is returned after the final inspection and that the return is recorded from the Tenancy page. The form SHALL NOT ask for the return. A tenancy without a deposit SHALL show nothing about it.

#### Scenario: The end form shows the deposit
- **WHEN** `Aino Koski`'s tenancy has the deposit 178000 cents, and Annika opens its end form
- **THEN** the form shows `1 780,00 €` and that the return is recorded later from the Tenancy page

#### Scenario: No deposit, no deposit section
- **WHEN** the tenancy has no deposit, and Annika opens its end form
- **THEN** the form says nothing about a deposit

### Requirement: A deposit return stays inside its tenancy
While a tenancy has a recorded return, cancelling its ending ("Cancelling an ending") and correcting it ("Correcting a tenancy") so that its last rent day would be after the return date, or would be removed, SHALL be refused with the reason `tenancy_has_deposit_return`. Nothing SHALL change. The owner deletes the return first. Deleting a flat removes its returns with its tenancies.

**No Playwright test:** server-side checks with the same forms and reason display as the tenancy forms' browser tests; Vitest covers them.

#### Scenario: Cancelling the ending of a returned tenancy is refused
- **WHEN** `Aino Koski`'s last rent day is `2027-01-31`, today is `2027-01-31`, a return dated `2027-01-31` is recorded, and an owner cancels the ending
- **THEN** it is refused with the reason `tenancy_has_deposit_return`, and the tenancy and the return are unchanged

#### Scenario: Moving a fixed term's end past the return is refused
- **WHEN** `Mikko Lehtinen`'s fixed-term tenancy ended on `2027-12-31`, its return is dated `2028-01-10`, and an owner corrects the term's end to `2028-01-31`
- **THEN** it is refused with the reason `tenancy_has_deposit_return`, and the tenancy is unchanged

#### Scenario: Deleting a flat removes its deposit returns
- **WHEN** an owner deletes a flat whose tenancy has a deposit return
- **THEN** no deposit return of the flat is stored
