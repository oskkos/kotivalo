## Why

When something fails unexpectedly, the user sees "Something went wrong" and nothing else. If they report it, nothing ties their report to the logs. Every request and browser log line now carries a trace id (#56), so showing a short reference from it lets a report lead straight to the right log lines.

## What Changes

- **The unexpected-error alert shows a reference.** It is the first 8 characters of the page's trace id, e.g. "Virhetunnus: 4bf92f35" ("Error reference" in English).
  - The alert shows it when a sign-in request fails unexpectedly (`unexpected` reason).
  - The root error view shows it when a page fails to render.
- **The same failure is in the logs under that trace.** The browser already logs these failures with its trace id (`clientLog`), so searching the logs for the reference finds them.
- The reference is not personal data and is safe to show: it only identifies log lines.

## Capabilities

### New Capabilities

- `error-reporting`: what users see when something fails unexpectedly, and how that ties to the logs.

### Modified Capabilities

None.

## Impact

- **Tables:** none.
- **UI screens:** the `unexpected` alert on the sign-in steps and the root error view. They have no Design canvas screen; the reference is one line of secondary text in the existing alert.
- **Code:**
  - `ReasonAlert` gains an optional reference line.
  - a helper for the reference from `browserTraceId()` (`src/lib/trace.ts`)
  - one message in `messages/{fi,sv,en}.json`
- **Dependencies:** none.
