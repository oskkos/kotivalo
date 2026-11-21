## MODIFIED Requirements

### Requirement: Undoing the latest rent or charge change
An owner SHALL be able to undo the latest change of a rent or charge that has at least one period. Undoing SHALL delete the latest period and make the previous one current again, with no end. When the deleted period was the only one, the amount SHALL no longer be set, so that it can be set again from the right date. The confirmation SHALL name the amount that stays in force, or say that the amount will be removed. A member SHALL NOT be able to undo.

#### Scenario: Undoing a charge increase
- **WHEN** the maintenance charge is 21400 cents from `2026-01-01` and 22600 cents from `2027-01-01`, and Annika undoes the latest change
- **THEN** the maintenance charge is 21400 cents from `2026-01-01` with no end, and no upcoming change is shown

#### Scenario: Undoing the only rent
- **WHEN** the rent's only period is 89000 cents from `2025-06-01`, and Annika undoes it and sets `890` from `1.3.2025`
- **THEN** the rent has one period, 89000 cents from `2025-03-01` with no end

#### Scenario: Nothing to undo is refused
- **WHEN** an owner sends undoing the rent of a flat that has no rent to the server
- **THEN** it is refused with the reason `amount_nothing_to_undo`, and nothing changes

## ADDED Requirements

### Requirement: Undoing the latest treatment change
An owner SHALL be able to undo the latest change of the financing charge treatment, with the same confirmation as undoing an amount. Undoing SHALL delete the latest treatment period and make the previous one current again, with no end. When the deleted period was the only one, the treatment SHALL no longer be set. Undoing when no treatment is set SHALL be refused with the reason `treatment_nothing_to_undo`. A member SHALL NOT be able to undo the treatment.

#### Scenario: Undoing a treatment change
- **WHEN** the treatment is capitalised from `2025-03-01` and income-recognised from `2027-01-01`, and Annika undoes the latest change
- **THEN** the treatment is capitalised from `2025-03-01` with no end

#### Scenario: Undoing the only treatment
- **WHEN** today is `2026-11-21`, the financing charge is 8000 cents from `2025-03-01`, the treatment's only period is capitalised from `2025-03-01`, and Annika undoes it
- **THEN** no treatment is set, and no accumulated capitalised amount is shown

#### Scenario: No treatment to undo is refused
- **WHEN** an owner sends undoing the treatment of a flat that has no treatment to the server
- **THEN** it is refused with the reason `treatment_nothing_to_undo`, and nothing changes

#### Scenario: A member can't undo the treatment
- **WHEN** the treatment is capitalised from `2025-03-01`, and Jussi, a member, sends undoing it to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes
