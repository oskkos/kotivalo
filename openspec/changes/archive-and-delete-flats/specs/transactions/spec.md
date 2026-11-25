## MODIFIED Requirements

### Requirement: New entry from the bottom bar
The new entry form opened from the bottom bar (`/transactions/new`) SHALL ask for the flat, among the flats the user owns and hasn't archived ("Archiving a flat"). With one such flat it SHALL be chosen already; with several, the flat last used for an entry on this device, or else the first by street address. Flats the user is only a member of SHALL NOT be listed. A user who owns no such flat SHALL see an explanation instead of the form: with no flats at all, an "Add flat" action; with only shared flats, that entries are added by the owners; when every flat they own is archived, that their flats are archived and can be restored to the list from the flats list's archived flats, with a link to the flats list.

#### Scenario: The only owned flat is chosen already
- **WHEN** Annika owns only `Koivupolku 7 A 4` and opens New entry from the bottom bar
- **THEN** the form shows `Koivupolku 7 A 4` as the flat

#### Scenario: Choosing among owned flats
- **WHEN** Annika owns `Koivupolku 7 A 4` and `Kuusikuja 3 B 12` and is a member of `Hallilantie 12 B 8`, and she opens the flat choice in the form
- **THEN** it lists `Koivupolku 7 A 4` and `Kuusikuja 3 B 12` and not `Hallilantie 12 B 8`

#### Scenario: A user without flats is asked to add one
- **WHEN** a user with no flats opens New entry from the bottom bar and selects "Add flat"
- **THEN** the new flat form opens

#### Scenario: A member of shared flats only can't add entries
- **WHEN** Jussi is only a member of `Kuusikuja 3 B 12` and opens New entry from the bottom bar
- **THEN** the page says that entries are added by the flat's owners, and shows no form

#### Scenario: An archived flat is not offered
- **WHEN** Annika owns `Koivupolku 7 A 4` and `Kuusikuja 3 B 12`, has archived `Koivupolku 7 A 4`, and opens New entry from the bottom bar
- **THEN** the form shows `Kuusikuja 3 B 12` as the flat, with no choice of `Koivupolku 7 A 4`

#### Scenario: A user whose owned flats are all archived
- **WHEN** Annika owns only `Koivupolku 7 A 4`, is a member of `Kuusikuja 3 B 12`, has archived `Koivupolku 7 A 4`, and opens New entry from the bottom bar
- **THEN** the page says that her flats are archived and can be restored from the flats list, links to the flats list, and shows no form
