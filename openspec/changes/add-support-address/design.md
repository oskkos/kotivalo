## Context

The app has no contact address (#112). Emails come from `noreply@kotivalo.app` (`EMAIL_FROM` in `wrangler.jsonc`, production). The domain `kotivalo.app` is in place (#86). Cloudflare Email Routing can forward addresses on it to an existing mailbox for free, but that is set up by hand in the dashboard and is not in the repository.

The address has to reach users in three situations:
- **A visitor who is not signed in.** The code doesn't arrive, and no page behind sign-in is reachable.
- **A signed-in user.** They look for help in the app.
- **Someone reading an email.** Replying to `noreply@` goes nowhere.

The user decided:
- **Address per language:** `tuki@` in Finnish, `support@` in Swedish and English.
- **No `Reply-To`:** the sender stays `noreply@`, because each email carries the support address itself.

## Goals / Non-Goals

**Goals:**
- One definition of the addresses, reusable by the privacy notice (#77).
- The address on the sign-in code step, on the account page and in the footer of every email, each in the right language.

**Non-Goals:**
- A help page, FAQ or contact form.
- The address in error alerts or on the offline page.
- `Reply-To` headers.
- Setting up Email Routing from code or CI.

## Decisions

### 1. The addresses are a constant in `src/lib/support.ts`

```ts
const SUPPORT_ADDRESS: Record<Locale, string> = {
  fi: 'tuki@kotivalo.app',
  sv: 'support@kotivalo.app',
  en: 'support@kotivalo.app',
}
export function supportAddress(locale: Locale): string
```

- **Who uses it:** the browser components and the server's email layout both import it. `lib/` is the shared place for pure helpers.
- **Type safety:** `Record<Locale, …>` makes the compiler ask for an address when a language is added.
- **Alternative, a `SUPPORT_EMAIL` var in `wrangler.jsonc`:**
  - It reaches only server code. The UI would need it passed through a loader or server function, and the sign-in page has no such data today.
  - The address doesn't differ between environments.
  - Local and test runs show the production addresses. That is harmless, because nothing is sent to them.
- **Alternative, the address inside the messages:** rejected.
  - It would repeat the address in every message that names it.
  - The `mailto:` link needs the address on its own anyway.
  - So the messages take it as a parameter (`{address}`) or stand next to it.
- **Brand name:** `kotivalo.app` is not UI copy, so the ESLint no-hard-coded-text rule doesn't apply to a `.ts` constant.

### 2. One component for the link: `components/SupportLink.tsx`

- A MUI `Link` with `href="mailto:…"` and the address as its text, both from `supportAddress(getLocale())`.
- The code step and the account page both use it, so the address always reads the same way and has a test in one place.
- **Selectable text:** the address is the link's text, so it can be selected and copied when tapping does nothing (for example a desktop without a mail client). No separate copy button.

### 3. The sign-in code step: one line under the spam hint

- Below `sign_in_spam_hint` in `CodeStep.tsx`, the same `body2` style.
- The text is `sign_in_support` followed by `SupportLink`:
  - fi: *"Ei sielläkään? Kirjoita meille:"*
  - sv: *"Inte där heller? Skriv till oss:"*
  - en: *"Not there either? Write to us:"*
- The email step shows nothing: a visitor who hasn't asked for a code has no problem yet.

### 4. The account page: a *Help and support* card

- A section between `LanguageChoice` and the Sign out button.
- It uses the card style of the name card: paper background, `cardBorder`, `radii.card`.
- Contents:
  - a heading, `account_support_title`:
    - fi: *"Ohje ja tuki"*
    - sv: *"Hjälp och support"*
    - en: *"Help and support"*
  - one sentence, `account_support_text`:
    - fi: *"Kysy tai kerro ongelmasta sähköpostilla."*
    - sv: *"Ställ frågor eller berätta om problem per e-post."*
    - en: *"Ask a question or report a problem by email."*
  - `SupportLink`
- The section is `aria-labelledby` its heading, so tests find it as a region.

### 5. Every email: a footer line in `renderEmail()`

- **The message:** `renderEmail()` adds `email_support({ address }, { locale })` after the button (or the last paragraph):
  - fi: *"Kysyttävää? Kirjoita meille: {address}"*
  - sv: *"Frågor? Skriv till oss: {address}"*
  - en: *"Questions? Write to us: {address}"*
  - The address comes from `supportAddress(locale)`.
- **HTML:**
  - The line sits under a 1 px divider, in a smaller muted font, as on the *Code email* canvas sketch.
  - The address is an `<a href="mailto:…">` link. The message is split around the address so the link can be built: the text before `{address}` is escaped, then comes the escaped link.
  - So the message must contain `{address}` exactly once. A test checks this in each language.
- **Plain text:** the line is the last paragraph.
- **Why the layout:** every email gets the footer without each template remembering it. That covers the sign-in code and the invitation today, and reminders later.
- **No `Reply-To`:** `EmailMessage` gets no new field.

### 6. Messages and terms

- New keys, in fi, sv and en:
  - `sign_in_support`
  - `account_support_title`
  - `account_support_text`
  - `email_support`
- None uses a domain term, so the term bank doesn't change. The Swedish and English wording is mine and needs a fluent speaker's look, like the rest of the messages.

## Risks / Trade-offs

- **[Email Routing not set up before the deploy]** The app would show addresses that bounce. → Set up Email Routing for both addresses first and send a test message to each. It is a manual step in tasks.md, before the merge.
- **[Spam to a published address]** Both addresses appear in the app and in every email. → Email Routing forwards everything. Filter in the receiving mailbox. A contact form is out of scope.
- **[Email tests comparing whole bodies]** Adding a footer changes every email's text. → Find and update those tests in the same commit as the layout change.
- **[The sv/en wording]** It is unreviewed. → It is listed for a human check, as with the earlier changes.

## Migration Plan

- No schema change.
- Deploy as usual from `develop`, after Email Routing is in place.
- Rollback: revert the commits. Nothing is stored.

## Open Questions

None.
