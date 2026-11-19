## 1. Page not found

`fix(app): show a not-found page for unknown addresses`

- [x] 1.1 Add a `notFoundComponent` to the root route (title, text, link to `/`) with fi, sv and en messages
- [x] 1.2 Playwright: "An unknown address shows that the page was not found" (status 404)

## 2. Language cookie drift

`fix(auth): reload in the account's language when the cookie drifts`

- [x] 2.1 `getSignedInUser()` returns `localeReset`; the `_authed` layout redirects to the same address with `reloadDocument` when it is true
- [x] 2.2 Playwright: "A changed language cookie is put back" (English from the first render, no hydration error in the console or the client log, cookie `en`)
- [x] 2.3 Update CLAUDE.md "Language resolution"

## 3. Connection failures

`fix(app): treat connection failures as warnings and say there is no connection`

- [x] 3.1 Write `isNetworkError(error)` in `src/lib/` with unit tests for Chromium, Firefox and Safari messages and an unrelated `TypeError`
- [x] 3.2 `clientLog.error` sends network errors at `warn` with `network: true`; unit tests
- [x] 3.3 Add the `network` alert reason with fi, sv and en messages; `ReasonAlert` shows no reference for it
- [x] 3.4 Use `network` in `ErrorView`, `EmailStep`, `CodeStep` and `PropertyForm` for network errors; component tests
- [x] 3.5 Playwright: the two connection scenarios (offline with `context.setOffline`)
- [x] 3.6 Update CLAUDE.md "Logging in the browser"

## 4. Cross-site requests to server functions

`fix(platform): refuse cross-site server function calls`

- [x] 4.1 Add TanStack Start's `createCsrfMiddleware` for server functions to `src/start.ts` (`Sec-Fetch-Site` same-origin, then `Origin`, then `Referer`)
- [x] 4.2 Playwright: a server function call marked `Sec-Fetch-Site: cross-site` gets 403, a same-origin one doesn't
- [x] 4.3 Note it in CLAUDE.md next to the signed-in pages' rules

## 5. Archive

`docs(openspec): archive improve-error-handling`

- [ ] 5.1 `openspec archive improve-error-handling`, write the specs' changes into place and run `pnpm check:traceability`
