## MODIFIED Requirements

### Requirement: Help and support on the account page
The account page SHALL have a *Help and support* section between the language choice and Sign out. It SHALL have a link to the user guide in the user's language, which opens in a new tab: `https://ohje.kotivalo.app/` in Finnish, `https://ohje.kotivalo.app/sv/` in Swedish and `https://ohje.kotivalo.app/en/` in English. It SHALL also say in one sentence that questions and problems can be sent by email, and show the support address link.

#### Scenario: The account page shows Help and support
- **WHEN** the signed-in user named `Annika`, whose language is `fi`, opens `/account`
- **THEN** the page shows the section *Ohje ja tuki* with the link `tuki@kotivalo.app`, above the Sign out button

#### Scenario: The link to the user guide
- **WHEN** Annika, whose language is `fi`, opens `/account`
- **THEN** the *Ohje ja tuki* section has the link *Käyttöohje* to `https://ohje.kotivalo.app/`, opening in a new tab

#### Scenario: The user guide in Swedish
- **WHEN** Jussi, whose language is `sv`, opens `/account`
- **THEN** the guide link goes to `https://ohje.kotivalo.app/sv/`
