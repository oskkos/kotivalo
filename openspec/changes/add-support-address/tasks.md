## 1. The support address and the email footer

- [x] 1.1 `src/lib/support.ts`: `supportAddress(locale)`, from a `Record<Locale, string>` (design.md, decision 1). Unit test: `fi` gives `tuki@kotivalo.app`, `sv` and `en` give `support@kotivalo.app`.
- [x] 1.2 `email_support` in fi, sv and en, with `{address}` exactly once (design.md, decisions 5 and 6). `renderEmail()` adds it as the last line:
  - in the HTML: under a divider, in a smaller muted font, with the address as an escaped `mailto:` link
  - in the plain text: as the last paragraph

  No `Reply-To`.
- [x] 1.3 Tests in `layout.test.ts`:
  - "The support address in the HTML is a link" (`en`)
  - the footer in the plain text
  - `email_support` holds `{address}` once in each language

  In `sign-in.server.test.ts`: "The sign-in code email shows the Finnish support address", including no `Reply-To`. In `invitation-email.test.ts`: "The invitation email shows the recipient's support address" (`sv`). Update any test that compares a whole email body.
- [x] 1.4 Playwright (`e2e/support.spec.ts`), under "The support address in every email": request a code in Finnish, and check that the email from the test inbox ends with `tuki@kotivalo.app`.

## 2. The support address on the sign-in code step and the account page

- [ ] 2.1 `components/SupportLink.tsx`: a MUI `Link` to `mailto:` with the address as its text, from `supportAddress(getLocale())` (design.md, decision 2). Component test.
- [ ] 2.2 `CodeStep.tsx`: under the spam hint, `sign_in_support` followed by `SupportLink`. The email step shows nothing (design.md, decision 3).
- [ ] 2.3 `AccountPage.tsx`: the *Ohje ja tuki* card between the language choice and Sign out, labelled by its heading, with `account_support_title`, `account_support_text` and `SupportLink` (design.md, decision 4).
- [ ] 2.4 Messages `sign_in_support`, `account_support_title` and `account_support_text` in fi, sv and en.
- [ ] 2.5 Component tests:
  - in `CodeStep` or the sign-in page tests: "The code step shows the support address" and "The email step does not show it"
  - in `AccountPage.test.tsx`: "The account page shows Help and support"
- [ ] 2.6 Playwright, in `e2e/support.spec.ts`:
  - "Help when the sign-in code does not arrive": the code step shows the link
  - "Help and support on the account page": the card with the link above Sign out
  - "The support address follows the language", with "Finnish shows tuki@" and, after switching the account to Swedish, "Swedish and English show support@"
- [ ] 2.7 CLAUDE.md "Current state": the support address (`lib/support.ts`, `SupportLink`, the email footer).

## 3. Verification, review and archive

- [ ] 3.1 The full `pnpm test`, `pnpm test:e2e` and `pnpm check:traceability`.
- [ ] 3.2 The `pr-review` skill, and its findings handled.
- [ ] 3.3 By hand, before the merge (the user): Cloudflare Email Routing for `tuki@kotivalo.app` and `support@kotivalo.app`, and a test message to each that arrives.
- [ ] 3.4 `openspec archive add-support-address` as the PR's last commit.
