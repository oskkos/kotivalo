## MODIFIED Requirements

### Requirement: Deleting a rent payment
An owner SHALL be able to delete a recorded payment from the month's payments page after a confirmation, for example to record it again with the right amount or date. Payments SHALL NOT be edited. A payment recorded by a deposit return ("Rent kept from the deposit") SHALL NOT be deleted on its own: the page SHALL NOT offer deleting it, and the server SHALL refuse it with the reason `rent_payment_from_deposit`; correcting or deleting the return changes it ("Correcting and deleting a deposit return"). A member SHALL NOT be able to delete payments.

#### Scenario: Deleting a wrongly recorded payment
- **WHEN** November's only payment is 89000 cents on `2026-11-03`, and Annika deletes it and confirms
- **THEN** the month's payments page lists no payments, and the month's status is computed without it

#### Scenario: A payment from the deposit can't be deleted on its own
- **WHEN** December 2026 has a payment of 30000 cents recorded by a deposit return, and an owner sends deleting it to the server
- **THEN** it is refused with the reason `rent_payment_from_deposit`, and the payment stays; the month's payments page shows it as *Vakuudesta* without a delete button

#### Scenario: A member can't delete a payment
- **WHEN** Jussi, a member of the flat, sends deleting a payment to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and the payment stays
