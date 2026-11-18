## Context

#56 gives every request and browser log line a trace id: the browser keeps one per page load (`browserTraceId()`) and sends it with server function calls and `POST /api/log`. Unexpected failures show the `unexpected` reason in a `ReasonAlert`, and are logged with `clientLog.error()`.

## Goals / Non-Goals

**Goals:**
- A reference the user can read out or copy, which finds the failure in the logs.

**Non-Goals:**
- A way to send a report from the app.
- References for expected failures (wrong code, limits): those are explained to the user and need no support.

## Decisions

1. **The reference is the first 8 hex characters of the page's trace id.** That is short enough to read out, and with only the day's logs to search (3 days' retention), collisions don't matter. No new id is needed, and the browser already has it before the request fails, also when the server never answered.
2. **`ReasonAlert` takes an optional `reference`.** It shows one secondary line, "Virhetunnus: 4bf92f35", in a monospaced font so it is easy to read out. Only the `unexpected` reason passes it.
3. **Logging stays as it is.** The browser's `clientLog.error()` already sends the failure with the trace id. The reference is derived from the same id, so the two can't drift apart.

## Risks / Trade-offs

- [Several failures on one page share a reference, because the trace is per page load] → Acceptable: they are the same visit, and the log lines have times and event names.
- [A blocked `/api/log` (ad blockers, offline) means the browser line never arrives] → The server's own lines for the failed request still carry the trace id, if the request reached it.

## Migration Plan

None. UI and messages only.

## Open Questions

None.
