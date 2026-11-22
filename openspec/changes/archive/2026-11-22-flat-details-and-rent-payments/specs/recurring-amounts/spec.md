## MODIFIED Requirements

### Requirement: The rent and charges page
Everyone with access to a flat SHALL be able to open its Rent and charges page from the rent and charges on the flat's details page ("The flat details page") and from its menu. The page SHALL show, for the rent, the maintenance charge and the financing charge, the amount in effect today with its start date, or that it is not set, and the next upcoming change if there is one. The financing charge SHALL also show its current treatment, or that it is not set. Only owners SHALL see the buttons to set or change them.

#### Scenario: Opening the rent and charges page from the details page
- **WHEN** Annika, owner of `Kuusikuja 3 B 12`, opens its details page and chooses "Muuta" next to its rent and charges
- **THEN** the Rent and charges page of `Kuusikuja 3 B 12` opens

#### Scenario: A flat without amounts
- **WHEN** an owner opens the page of a flat with no amounts or treatment set
- **THEN** the rent, maintenance charge, financing charge and treatment each show "Ei asetettu" with an "Aseta" button

#### Scenario: The current amount and an upcoming change
- **WHEN** today is `2026-11-21` and the maintenance charge is 21400 cents from `2026-01-01` and 22600 cents from `2027-01-01`
- **THEN** the maintenance charge shows `214,00 €/kk`, "1.1.2026 alkaen", and the upcoming change "1.1.2027 alkaen 226,00 €/kk"

#### Scenario: A member sees the amounts but can't change them
- **WHEN** Jussi, a member of the flat, opens its Rent and charges page
- **THEN** he sees the amounts and the treatment, and no button to set or change them
