## 1. Page not found

`fix(app): show a not-found page for unknown addresses`

- [ ] 1.1 Add a `notFoundComponent` to the root route (title, text, link to `/`) with fi, sv and en messages
- [ ] 1.2 Playwright: "An unknown address shows that the page was not found" (status 404)

## 2. Language cookie drift

`fix(auth): reload in the account's language when the cookie drifts`

- [ ] 2.1 `getSignedInUser()` returns `localeReset`; the `_authed` layout redirects to the same address with `reloadDocument` when it is true
- [ ] 2.2 Playwright: "A changed language cookie is put back" (English from the first render, no hydration error in the console or the client log, cookie `en`)
- [ ] 2.3 Update CLAUDE.md "Language resolution"

## 3. Connection failures

`fix(app): treat connection failures as warnings and say there is no connection`

- [ ] 3.1 Write `isNetworkError(error)` in `src/lib/` with unit tests for Chromium, Firefox and Safari messages and an unrelated `TypeError`
- [ ] 3.2 `clientLog.error` sends network errors at `warn` with `network: true`; unit tests
- [ ] 3.3 Add the `network` alert reason with fi, sv and en messages; `ReasonAlert` shows no reference for it
- [ ] 3.4 Use `network` in `ErrorView`, `EmailStep`, `CodeStep` and `PropertyForm` for network errors; component tests
- [ ] 3.5 Playwright: the two connection scenarios (offline with `context.setOffline`)
- [ ] 3.6 Update CLAUDE.md "Logging in the browser"

## 4. Archive

`docs(openspec): archive improve-error-handling`

- [ ] 4.1 `openspec archive improve-error-handling`, write the specs' changes into place and run `pnpm check:traceability`
