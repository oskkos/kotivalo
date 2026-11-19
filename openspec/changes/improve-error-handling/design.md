## Context

Client logging (#56) sends every `clientLog.error` as an `error` line, and every `error` line becomes a Cloudflare Workers Issue. Render errors, uncaught errors and the forms' catch blocks all go through it. Language (#13): the signed-in layout's `getSignedInUser()` sets the cookie back to the account's language when they differ, and the next page load uses it.

## Goals / Non-Goals

**Goals:** no alerts for connection failures; a message that tells the user what to do; a real not-found page; no hydration error when the cookie drifts.

**Non-Goals:** retrying requests automatically; offline use (the service worker's offline page covers page loads without a connection); a language setting for signed-in users (#27).

## Decisions

1. **Recognise network errors by their `TypeError` messages** in one helper, `isNetworkError(error)` in `src/lib/`: `Failed to fetch` (Chromium), `NetworkError when attempting to fetch resource.` (Firefox), `Load failed` (Safari), and `AbortError`. There is no standard property; the messages are stable across these browsers' recent versions. An unrecognised message stays an `error`: the cost of a missed match is an alert, not a lost failure.
2. **`clientLog.error` downgrades network errors to `warn`** and adds `network: true`, so every caller gets it without changing call sites, and the line is still kept (Workers Logs) for when a user reports a problem.
3. **A new alert reason `network`**, shown without an error reference: nothing reached the server, so a reference would find only the browser's warning. Callers choose it with `isNetworkError(error) ? 'network' : 'unexpected'`; `ErrorView` does the same for render errors.
4. **Not found:** `notFoundComponent` on the root route, so it covers every unmatched path and any `notFound()` without a closer handler. The response stays 404 (TanStack Start sets it). The flat's own not-found page stays as it is.
5. **Language drift:** `getSignedInUser()` returns `localeReset: true` when it set the cookie back. The `_authed` layout's `beforeLoad` then throws `redirect({ href: location.href, reloadDocument: true })`: during SSR that is a 307 carrying the new cookie, in the browser a full reload. The next request has the right cookie, so there's no loop. *Alternative:* a Paraglide server strategy reading the account's language before rendering; it would need the session (a D1 read) in the middleware for every request, signed in or not.

## Risks / Trade-offs

- [A browser's network error message changes] → It shows as `unexpected` and alerts again; the helper's tests list the known messages.
- [Cookies blocked] → The cookie can't be set, so the redirect would repeat; but without cookies there is no session either, so the layout redirects to `/sign-in` before this check.
