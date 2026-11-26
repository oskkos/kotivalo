## Why

Users have nowhere to ask for help or report a problem (#112). The app shows no contact address, and the emails come from `noreply@kotivalo.app`. The worst case is a user whose sign-in code doesn't arrive: they can't reach any page behind sign-in, so the help has to be on the sign-in page itself. The own domain is in place (#86), so the addresses can be set up now, before the first users outside the team.

## What Changes

- **Support address by language:**
  - Finnish: `tuki@kotivalo.app`
  - Swedish and English: `support@kotivalo.app`
  - Both are defined in one place so the privacy notice (#77) can use the same addresses.
- **Sign-in code step:** under the existing hint *"Etkö saanut koodia? Tarkista roskaposti."*, add a line with the support address as a `mailto:` link.
- **Account page:** a *Ohje ja tuki* section between the language choice and Sign out. It shows the address as a `mailto:` link, written out so it can be copied when no mail app opens.
- **Every email:** the shared email layout (`renderEmail()`) gets a footer line with the support address in the recipient's language. That covers the sign-in code email, the invitation and every later email.
  - The sender stays `noreply@kotivalo.app`, and no `Reply-To` header is set: the footer line says where to write.
- **Not changed:**
  - error alerts
  - the offline page, because there is no way to send a message without a connection.
- **Outside the repository:** Cloudflare Email Routing for `tuki@` and `support@` is set up by hand in the dashboard, forwarding to an existing mailbox.

## Capabilities

### New Capabilities

- `support`: The support address by language. Where it is shown: the sign-in code step, the account page and the footer of every email.

### Modified Capabilities

None. The account page and the sign-in code step get an addition. Their existing requirements stay as they are, and the new requirements are in `support`.

## Impact

- **Tables:** none.
- **Screens:**
  - the sign-in code step: Design canvas *Code · entry* (`SignInCode`)
  - the account page: Design canvas *Tili* and *Tili · alapalkki*
  - the email layout: Design canvas *Code email* (`SignInCodeEmail`)
  - None of these screens has a support element. The additions reuse existing styles, so no new sketch is needed:
    - the hint line on the sign-in step
    - the card on the account page
    - the footer under a divider in the email, which *Code email* already sketches.
- **Email:** the HTML and plain-text footer in `src/server/email/layout.ts`. It changes the text of every email, so tests that compare a whole email body will need updating.
- **Code:**
  - `src/lib/support.ts` (new)
  - `features/authentication/CodeStep.tsx`
  - `features/account/AccountPage.tsx`
  - messages in fi, sv and en
- **Dependencies:** none.
- **Operations:** Email Routing for both addresses. The addresses go live in the app with the deploy, so set up the routing before merging.
