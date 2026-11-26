## 1. Tables and the deposit return repository

- [x] 1.1 `src/server/db/schema.ts`:
  - `tenancies.deposit` (`cents`, nullable)
  - `deposit_returns`:
    - `id()`, and `tenancy_id`: unique, `ON DELETE CASCADE`
    - `returned_on`: `isoDate`
    - `rent_kept` and `damage_kept`: `cents`, not null
    - `note`: nullable
    - `created_by`, `created_at` and `updated_at`
  - `rent_payments.deposit_return_id`: nullable, references `deposit_returns.id`, `ON DELETE CASCADE`

  Then `pnpm db:generate`, and commit the migration (design.md, Migration Plan).
- [x] 1.2 `features/deposits/deposit-return.repository.server.ts` (design.md, decisions 3 and 5):
  - `forTenancies(tenancyIds)`, using `inChunks`
  - `forPropertiesYear(propertyIds, year)`
  - the statements for recording, correcting and deleting a return with its payments, for `atomically`

  The tenancy repository reads and writes `deposit`. The rent payment repository reads `depositReturnId`.
- [x] 1.3 Workers tests:
  - the repository: a return with its payments written and read, correcting replaces the payments, deleting cascades to them, and a second return for a tenancy fails on the unique index
  - `deposit_returns` in the flat deletion cascade test (`CHILD_TABLES` and `fill` in `property.repository.server.test.ts`), for "Deleting a flat removes its deposit returns"

## 2. Deposit terms

_Outcome:_ Finlex (481/1995 § 8) and the Tax Administration's guidance §2.1.3 could not be read here (Finlex serves no law text without JavaScript, the guidance page was unreachable). The Swedish and English tax pages that could be read only cover keeping the deposit against unpaid rent. So no term was added or changed: *vakuus* / *hyresgaranti* / *deposit* stay verified, `deposit_return` stays `proposed`, and *pidättää*, *lopputarkastus* and *vahingonkorvaus* are not terms (no term bank diff, so no critic review). The Swedish and English words of the new messages are `proposed` and need a fluent speaker.

- [x] 2.1 With the translate skill, check *vakuus* (`deposit`) and *vakuuden palautus* (`deposit_return`), and decide whether these need terms of their own:
  - *pidättää* (keeping part of a deposit)
  - *lopputarkastus* (final inspection)
  - *vahingonkorvaus* (damage compensation)

  Take the Swedish words from the Swedish text of 481/1995 § 8 and the Tax Administration's Swedish *Beskattning av hyresinkomster* §2.1.3, the English from its English pages. Record the sources in `i18n/sources.json`.
- [x] 2.2 The term-critic's review of the term bank diff, and its findings fixed.

## 3. Deposit calculations

- [x] 3.1 `features/deposits/deposit.ts`, pure:
  - `allocateRentKept(months, kept)`: oldest first, up to each month's missing amount, or `deposit_rent_exceeds_unpaid`
  - `missingRent(tenancy, payments, excludeReturnId?)`: every month of the tenancy, from `rent-payments/status.ts`
  - `amountReturned(deposit, return)`
  - `checkReturn(input)`: the reasons of "Recording a deposit return" except access and existence
  - `returnDeadline(lastRentDay)`
  - `depositOverLimit(deposit, rent)`
  - `pendingReturns(tenancies, returns, today)`
- [x] 3.2 Unit tests named after the scenarios of "Rent kept from the deposit", the checks of "Recording a deposit return" ("Deductions can't exceed the deposit", "Deductions need an amount", "A return before the last rent day is refused", "A return date in the future is refused"), "A deposit over three months' rent is warned about", and "The deposit return reminder" ("The reminder after the last rent day", "No reminder before the last rent day", "A tenancy without a deposit has no reminder").

## 4. The deposit on the server

- [x] 4.1 `features/tenancies/schemas.ts`: an optional `deposit` through `parseDecimal`, more than 0 and at most 100 000 € (`deposit_amount_invalid`). It goes into `createTenancy` and `updateTenancy`, and `getTenancy` returns it.
- [x] 4.2 Guards (design.md, decision 8):
  - `updateTenancy`: `deposit_below_kept`, and `tenancy_has_deposit_return` when `valid_to` moves after the return date or is cleared
  - `cancelTenancyEnding`: `tenancy_has_deposit_return`
- [x] 4.3 The reasons in `src/lib/reasons.ts`, with their fi, sv and en messages, written with the translate skill:
  - `deposit_amount_invalid` and `deposit_below_kept` (field)
  - `tenancy_has_deposit_return` (alert)
- [x] 4.4 Workers tests:
  - "Adding a tenant with a deposit", "A tenancy without a deposit", "An invalid deposit is refused", "Correcting the deposit" and "A member can't set a deposit"
  - "The deposit can't go below the amounts kept"
  - "Cancelling the ending of a returned tenancy is refused" and "Moving a fixed term's end past the return is refused"

## 5. Deposit return server functions

- [x] 5.1 `features/deposits/functions.ts` with the logic in `deposits.server.ts`:
  - `getDepositReturn({ propertyId, tenancyId })`: the tenancy, the deposit, the last rent day, the rent missing by month and the recorded return
  - `recordDepositReturn`, `updateDepositReturn` and `deleteDepositReturn`

  Each checks the session, owners only and access (`tenancy_not_found`), and writes with `atomically`. They log `deposit.return_recorded`, `deposit.return_updated` and `deposit.return_deleted` with the tenancy and return ids, and refusals at `warn` where the app does so already.
- [x] 5.2 `deleteRentPayment` refuses a payment from a return with `rent_payment_from_deposit`. The month's payments and the rent payments views say which payments come from a deposit.
- [x] 5.3 The reasons, with their fi, sv and en messages:
  - `deposit_not_set`, `deposit_return_exists` and `rent_payment_from_deposit` (alerts)
  - `deposit_return_before_end`, `deposit_return_date_in_future`, `deposit_kept_exceeds_deposit`, `deposit_rent_exceeds_unpaid`, `deposit_kept_required` and `deposit_note_too_long` (fields)
- [x] 5.4 Workers tests:
  - the server-side scenarios of "Recording a deposit return"
  - "The rent kept pays the missing month" and "The rent kept covers the oldest months first", end to end
  - "Correcting and deleting a deposit return": "Correcting the amount kept for damage", "Correcting the rent kept replaces its payments", "Deleting a return removes its payments" and "A member can't delete a return"
  - "A payment from the deposit can't be deleted on its own"
  - the log events

## 6. Deposits in the year summary

- [x] 6.1 `year-summary.server.ts` reads `depositReturns.forPropertiesYear` in `loadInputs` (design.md, decision 5). The query count test still holds.
- [x] 6.2 `summary.ts` (design.md, decision 4):
  - the `deposit_damage` part of row 2.4 at the share on the return date, capped after rounding
  - `deposit_damage_surplus` on the Not on form 7H card
- [x] 6.3 `FlatTaxPage.tsx`:
  - the part's and the surplus's labels, and the surplus note
  - `flat_tax_note` without "Vakuuksia ei vielä lasketa"

  The messages in fi, sv and en, with the translate skill.
- [x] 6.4 Tests:
  - unit tests for "Damage kept from a deposit lowers row 2.4", "Damage compensation over the repairs leaves row 2.4 at 0", "A deposit return counts at the share on its date", "Damage compensation over the repairs is shown" and "The rent kept counts in the year of the return"
  - the form 7H page's component test for the new labels
  - an update to any test asserting the old note

## 7. The deposit field and card

- [ ] 7.1 `TenancyForm.tsx` gets *Vakuus €* in the new tenant and correction forms, with the warning from `depositOverLimit` under it (design.md, decision 9).
- [ ] 7.2 `TenancyPage.tsx` gets the *Vakuus* card below the fees card. For owners, *Muuta* or *Lisää* opens the correction form.
- [ ] 7.3 The end tenancy form (`EndTenancyForm.tsx` / `ending.tsx`) gets the deposit section when a deposit is set.
- [ ] 7.4 fi, sv and en messages, with the translate skill. Component tests for the warning, the card and the end form section.
- [ ] 7.5 Playwright tests for "A tenancy's deposit", "The deposit on the tenancy page" and "The deposit when ending a tenancy". The `addTenant` helper in `e2e/support/tenancies.ts` gets a `deposit` option.

## 8. The lease on the tenancy page

- [ ] 8.1 `/properties/$propertyId/documents/new` gets `validateSearch` with `kind` and `tenancyId`. `DocumentForm.tsx` uses them as defaults when the tenancy is the flat's, and closing returns to the Tenancy page when opened from it (design.md, decision 10).
- [ ] 8.2 The Tenancy page loader reads the current tenancy's leases. `TenancyPage.tsx` gets the *Vuokrasopimus* card below the *Vakuus* card, with *Lisää vuokrasopimus* for owners.
- [ ] 8.3 fi, sv and en messages, with the translate skill. Component tests.
- [ ] 8.4 Playwright tests for "The lease on the tenancy page" and "Adding a document": "Another flat's tenancy in the address is ignored". They use `addDocument` from `e2e/support/documents.ts`.

## 9. The deposit return page and reminder

- [ ] 9.1 Route `src/routes/_authed/properties/$propertyId/tenancy/$tenancyId/deposit.tsx` and `features/deposits/DepositReturnForm.tsx`:
  - the tenancy summary
  - *Kokonaan* or *Vähennyksin*, and the return date
  - the two amounts, with the rent missing by month under the first, and the note
  - the amount returned, computed as the form changes
  - *Tallenna palautus*, and for a recorded return *Poista palautus* with a confirmation

  Members are sent back to the Tenancy page.
- [ ] 9.2 `TenancyPage.tsx`:
  - the *Vakuus palauttamatta* cards at the top (`pendingReturns`), with the deadline and *Kirjaa palautus* for owners
  - each other tenancy's deposit status
- [ ] 9.3 The correction form of an ended tenancy with a deposit shows the return's status and opens the return page.
- [ ] 9.4 The month's payments page and the rent payments page label payments from a deposit *Vakuudesta*, with no delete button.
- [ ] 9.5 fi, sv and en messages, with the translate skill. Component tests for the form's computed amount, the reminder and the labels.
- [ ] 9.6 Playwright tests for "Recording a deposit return", "Correcting and deleting a deposit return" and "The deposit return reminder". The data is set up with an earlier tenancy ended in the past through the forms. `e2e/support/deposits.ts` has `openDepositReturn` and `recordDepositReturn`.
- [ ] 9.7 Docs:
  - CONCEPT.md: §3 (the End tenancy row), §4.2 (the 14-day deadline, rent kept as payments, damage in row 2.4), §5.2 (`tenancies.deposit`, `deposit_returns`, `rent_payments.deposit_return_id`), and §6 (tick "Logging the deposit return later has no screen"; add the open question of repairs paid in another year)
  - CLAUDE.md "Current state": deposits, the return and the lease card; `e2e/support/deposits.ts` among the e2e helpers

## 10. Verification and review

- [ ] 10.1 `pnpm check:traceability`, then the full `pnpm test` and `pnpm test:e2e` once.
- [ ] 10.2 Run the `pr-review` skill on the PR, and fix its findings as `fix(...)` commits.

## 11. Archive

- [ ] 11.1 `openspec archive add-deposits` as the PR's last commit (`docs(openspec): archive add-deposits`). Write the new `deposits` spec's Purpose. Update the Purpose lines of `tenancies` (deposits no longer "come later") and `documents` (still "TBD").
