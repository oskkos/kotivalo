## MODIFIED Requirements

### Requirement: Changing a flat's ownership
An owner of a flat SHALL be able to record a new split of its ownership on the Ownership and sharing page. The split SHALL list everyone with access to the flat with a share given in percent with at most two decimals, adding up to exactly 100 %, with at least one share above 0 %. The change SHALL have a date on or after the start of the current period and not in the future, and a reason: sale, gift, inheritance, division of property / divorce, or other. A change dated on the current period's start SHALL correct that period's split and reason instead of starting a new period, so that a flat bought together is recorded from the day it was bought, without a one-day period of one owner. For each person whose share becomes 0 %, the owner SHALL be able to remove their access in the same change. A person whose access is removed SHALL keep seeing the flat in their year summary for the days they had a share (openspec: year-summary, "A former owner's year summary"), and the form SHALL say so next to the choice. A member SHALL NOT be able to change ownership.

#### Scenario: An owner records a sale of half the flat
- **WHEN** Annika, owner of 100 % since `2022-06-12`, records Annika 50 % and Jussi 50 % from `1.3.2025`, reason sale
- **THEN** the history shows "from 1.3.2025: Annika 50 % · Jussi 50 %, sale" above "from 12.6.2022: Annika 100 %", and the current owners are Annika and Jussi with 50 % each

#### Scenario: A change on the current period's start corrects its split
- **WHEN** Annika and Jussi bought `Kuusikuja 3 B 12` together on `12.6.2022`, Annika added it owned since `12.6.2022`, and after Jussi joined she records Annika 50 % and Jussi 50 % from `12.6.2022`, reason sale
- **THEN** the history has one period, "from 12.6.2022: Annika 50 % · Jussi 50 %, sale", and Jussi is an owner

#### Scenario: A split that doesn't add up is refused
- **WHEN** Annika enters 60 % and 30 % and saves
- **THEN** the form shows that the shares add up to 90 % and must add up to 100 %, and nothing is saved

#### Scenario: A change dated before the current period is refused
- **WHEN** the current period started on `2025-03-01` and an owner records a change from `2025-02-01`
- **THEN** it is refused with the reason `ownership_date_too_early`, and nothing changes

#### Scenario: A change dated in the future is refused
- **WHEN** an owner records a change from tomorrow
- **THEN** it is refused with the reason `ownership_date_in_future`, and nothing changes

#### Scenario: Removing access from a person who no longer owns a share
- **WHEN** Annika and Jussi own 50 % each, and Annika records Annika 100 % and Jussi 0 % with "Remove Jussi's access" selected
- **THEN** Jussi no longer has access to the flat, the history still shows his earlier share, and the flat stays in his year summary for the days he owned 5000 basis points

#### Scenario: A member can't change ownership
- **WHEN** Jussi, a member, sends an ownership change to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes
