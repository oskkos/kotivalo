# support Specification

## Purpose
The support address by language (#112): `tuki@kotivalo.app` in Finnish, `support@kotivalo.app` in Swedish and English, shown as a `mailto:` link on the sign-in code step, in the *Help and support* card on the account page and in the footer line of every email, in the recipient's language; the sender stays `noreply@` with no `Reply-To`.
## Requirements
### Requirement: The support address follows the language
Kotivalo SHALL show one support address per language:
- `tuki@kotivalo.app` in Finnish
- `support@kotivalo.app` in Swedish and English

In the app the address SHALL follow the language the page is shown in. In an email it SHALL follow the recipient's language. Wherever the app shows the address, it SHALL be a `mailto:` link that also shows the address as text, so it can be copied when no mail app opens.

#### Scenario: Finnish shows tuki@
- **WHEN** a user whose language is `fi` opens the account page
- **THEN** the support link reads `tuki@kotivalo.app` and points to `mailto:tuki@kotivalo.app`

#### Scenario: Swedish and English show support@
- **WHEN** a user whose language is `sv`, or one whose language is `en`, opens the account page
- **THEN** the support link reads `support@kotivalo.app` and points to `mailto:support@kotivalo.app`

### Requirement: Help when the sign-in code does not arrive
The sign-in code step SHALL show, under the hint to check the spam folder, a line offering the support address. A visitor who is not signed in SHALL see it, because without the code they can reach no page behind sign-in.

#### Scenario: The code step shows the support address
- **WHEN** a visitor on the sign-in page in Finnish has requested a code for `mikko@example.com`
- **THEN** the code step shows *Etkö saanut koodia? Tarkista roskaposti.* and under it a line with the link `tuki@kotivalo.app`

#### Scenario: The email step does not show it
- **WHEN** a visitor opens `/sign-in` and has not requested a code
- **THEN** the page shows no support address

### Requirement: Help and support on the account page
The account page SHALL have a *Help and support* section between the language choice and Sign out. It SHALL say in one sentence that questions and problems can be sent by email, and show the support address link.

#### Scenario: The account page shows Help and support
- **WHEN** the signed-in user named `Annika`, whose language is `fi`, opens `/account`
- **THEN** the page shows the section *Ohje ja tuki* with the link `tuki@kotivalo.app`, above the Sign out button

### Requirement: The support address in every email
Every email Kotivalo sends SHALL end with a footer line, under the content, that gives the support address in the recipient's language. The line SHALL be in both the HTML and the plain-text part, with the address as a `mailto:` link in the HTML. The sender SHALL stay `noreply@kotivalo.app`, and the email SHALL NOT set a `Reply-To` header.

#### Scenario: The sign-in code email shows the Finnish support address
- **WHEN** a code is requested for `mikko@example.com` on the sign-in page in Finnish
- **THEN** the email's text ends with the support line with `tuki@kotivalo.app`, and the email has no `Reply-To` header

#### Scenario: The invitation email shows the recipient's support address
- **WHEN** Annika, whose language is `fi`, invites `jussi@example.com`, whose account's language is `sv`
- **THEN** the email's text ends with the Swedish support line with `support@kotivalo.app`

#### Scenario: The support address in the HTML is a link
- **WHEN** an email is rendered for a recipient whose language is `en`
- **THEN** its HTML has a link to `mailto:support@kotivalo.app` with the text `support@kotivalo.app`, and the address is escaped like the rest of the content

