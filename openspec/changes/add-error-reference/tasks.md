## 1. Error reference

`feat(platform): show an error reference with unexpected failures`

- [ ] 1.1 Add `errorReference()` (the first 8 characters of `browserTraceId()`) to `src/lib/trace.ts`, with a unit test
- [ ] 1.2 Add the `error_reference` message ("Virhetunnus: {reference}") in Finnish, Swedish and English
- [ ] 1.3 `ReasonAlert` shows an optional reference line; the sign-in steps pass it with `unexpected`, and the root error view shows it
- [ ] 1.4 Tests:
  - component tests for "A page that fails to render shows a reference" and the sign-in steps
  - a Workers test for "The reference finds the failure in the logs"
  - a Playwright test for "A failed request shows a reference", answering the server function with 500
- [ ] 1.5 `pnpm check:traceability` shows no pending gaps, and typecheck, lint, format, Vitest and Playwright pass

## 2. Archive

`docs(openspec): archive error reference`

- [ ] 2.1 Run `openspec archive add-error-reference` and check that `pnpm check:traceability` passes with the spec in `openspec/specs/`
