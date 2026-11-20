## ADDED Requirements

### Requirement: Ownership is recorded as periods
A flat's ownership SHALL be a sequence of periods, each with a start date, an end date (open for the current one) and the owners' shares in basis points that add up to exactly 10000. Periods SHALL follow each other without gaps or overlaps, and a recorded period SHALL NOT be changed except by the corrections in "Undoing the latest ownership change", "Correcting the first ownership date" and a change dated on the current period's start (see "Changing a flat's ownership"). The shares on any date SHALL be those of the period that contains it. A user with access and no share SHALL be a member, with no stored share.

**No Playwright test:** these are rules for stored periods and pure calculations; Vitest covers them with the functions and the repository, and the browser tests of the other requirements use them.

#### Scenario: The shares on a date come from the period containing it
- **WHEN** Annika owned 100 % from `2022-06-12` and the split changed to Annika 5000 and Jussi 5000 from `2025-03-01`
- **THEN** the shares on `2025-02-28` are Annika 10000, and on `2025-03-01` Annika 5000 and Jussi 5000

#### Scenario: A change ends the previous period the day before
- **WHEN** an ownership change from `2025-03-01` is recorded
- **THEN** the previous period ends on `2025-02-28`, and the new one starts on `2025-03-01` with no end

#### Scenario: Shares that don't add up to 100 % are refused
- **WHEN** an owner records Annika 5000 and Jussi 4999
- **THEN** it is refused with the reason `ownership_shares_total`, and nothing is stored

### Requirement: The first ownership period
Adding a flat SHALL record its first ownership period: the user who adds it owns 10000 basis points from the "Owned since" date given in the form, which defaults to today and SHALL NOT be in the future.

#### Scenario: Adding a flat records its owner from the given date
- **WHEN** Annika adds `Kuusikuja 3 B 12` with "Owned since" `12.6.2022`
- **THEN** the flat's ownership is Annika 100 % from `2022-06-12`, and its history shows that period

#### Scenario: An ownership date in the future is refused
- **WHEN** a user adds a flat with "Owned since" tomorrow
- **THEN** the date field shows an error, and no flat is added

### Requirement: Changing a flat's ownership
An owner of a flat SHALL be able to record a new split of its ownership on the Ownership and sharing page. The split SHALL list everyone with access to the flat with a share given in percent with at most two decimals, adding up to exactly 100 %, with at least one share above 0 %. The change SHALL have a date on or after the start of the current period and not in the future, and a reason: sale, gift, inheritance, division of property / divorce, or other. A change dated on the current period's start SHALL correct that period's split and reason instead of starting a new period, so that a flat bought together is recorded from the day it was bought, without a one-day period of one owner. For each person whose share becomes 0 %, the owner SHALL be able to remove their access in the same change. A member SHALL NOT be able to change ownership.

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
- **THEN** Jussi no longer has access to the flat, and the history still shows his earlier share

#### Scenario: A member can't change ownership
- **WHEN** Jussi, a member, sends an ownership change to the server
- **THEN** it is refused with the reason `sharing_owner_only`, and nothing changes

### Requirement: Roles follow the current shares
After an ownership change, everyone with a share above 0 % in the current period SHALL be an owner of the flat, and everyone else with access SHALL be a member. Every owner SHALL be able to invite, cancel invitations, remove members and change ownership.

#### Scenario: A member who gets a share becomes an owner
- **WHEN** Jussi is a member and Annika records Annika 50 % and Jussi 50 %
- **THEN** Jussi is an owner and can invite to the flat

#### Scenario: An owner whose share drops to zero becomes a member
- **WHEN** Annika records Annika 0 % and Jussi 100 % without removing her access
- **THEN** Annika is a member, sees the flat and its history, and can't change its ownership

### Requirement: Undoing the latest ownership change
An owner SHALL be able to undo the latest ownership change of a flat that has more than one period. Undoing SHALL delete the latest period, make the previous period current again and set the roles from its shares. Access removed by the undone change SHALL NOT come back; a new invitation is needed.

#### Scenario: Undoing a change restores the previous split
- **WHEN** Annika undoes the change to Annika 50 % and Jussi 50 % from `2025-03-01`
- **THEN** the flat is again Annika 100 % from `2022-06-12` with no end, and Jussi is a member

#### Scenario: The only period can't be undone
- **WHEN** an owner sends undoing the latest change of a flat with one period to the server
- **THEN** it is refused with the reason `ownership_nothing_to_undo`, and nothing changes

### Requirement: Correcting the first ownership date
An owner SHALL be able to correct the start date of a flat's first ownership period. The date SHALL NOT be in the future and SHALL be before the start of the second period, if there is one.

#### Scenario: Correcting the date a flat was bought
- **WHEN** Annika corrects the first period's start from `2026-11-20` to `2022-06-12`
- **THEN** the history shows "from 12.6.2022: Annika 100 %"

#### Scenario: The first date can't move past the next change
- **WHEN** the second period starts on `2025-03-01` and an owner corrects the first start to `2025-04-01`
- **THEN** it is refused with the reason `ownership_date_too_late`, and nothing changes

### Requirement: Showing a flat's ownership history
Everyone with access to a flat SHALL see, on its Ownership and sharing page, the current owners with their shares and start date, and every period, newest first, with its start date, its split and its reason.

#### Scenario: A member sees the history
- **WHEN** Jussi, a member, opens the Ownership and sharing page of a flat with two periods
- **THEN** he sees both periods, newest first, and no change form
