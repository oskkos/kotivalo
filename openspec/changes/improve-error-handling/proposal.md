## Why

Three faults found while building #28, all from earlier changes:

1. **A failed connection looks like a bug.** A request that never reaches the server (offline, or a reload that cancels it) is logged at `error`, which makes a Cloudflare Workers Issue and an alert, and the user sees "Something went wrong" with an error reference that finds nothing on the server.
2. **An unknown address shows TanStack's bare "Not Found"** and logs a warning that the root route has no `notFoundComponent`. In development, Chrome DevTools' automatic request for `/.well-known/appspecific/com.chrome.devtools.json` is the likely trigger.
3. **A changed language cookie causes a hydration error.** When the `kotivalo_locale` cookie differs from the account's language, the server renders the page in the cookie's language and puts the cookie back to the account's in the same response; the browser then renders in the account's language and React throws away the server's HTML (#13, design decision 7, accepted one page in the wrong language but not this).

## What Changes

- **Connection failures:** the browser recognises a failed fetch (Chrome "Failed to fetch", Firefox "NetworkError…", Safari "Load failed") and:
  - logs it at `warn`, not `error`, so it makes no alert
  - shows a new alert reason `network` ("No connection: check your connection and try again") without an error reference, in forms and on the error page
- **Page not found:** the root route gets a not-found page in the user's language with a link to the home page.
- **Language drift:** when the signed-in layout puts the cookie back to the account's language, it reloads the page at once (a redirect on the server, a full reload in the browser), so the page is rendered in the account's language from the start.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `error-reporting`: new requirements "Telling the user when the connection fails" and "Showing that a page was not found".
- `authentication`: "The user's language is stored on the account" gets a scenario for a changed cookie.

## Impact

- **Code:** `src/lib/client-log.ts` (network errors), `src/lib/reasons.ts` (`network`), `ErrorView`, the sign-in steps and `PropertyForm` (catch blocks), `src/routes/__root.tsx` (`notFoundComponent`), `features/authentication/functions.ts` and `src/routes/_authed.tsx` (reload on drift).
- **Tables:** none. **Screens:** none on the Design canvas; the not-found page and the connection alert follow the existing error alert and the flat-not-found page.
- **Messages:** fi, sv, en for the new reason and the not-found page.
