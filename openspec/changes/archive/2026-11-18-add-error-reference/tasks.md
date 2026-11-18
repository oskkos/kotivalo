## 1. Error reference

`feat(platform): show an error reference with unexpected failures`

- [x] 1.1 Add `errorReference()` (the first 8 characters of `browserTraceId()`) to `src/lib/trace.ts`, with a unit test
- [x] 1.2 Add the `error_reference` message ("Virhetunnus: {reference}") in Finnish, Swedish and English
- [x] 1.3 `ReasonAlert` shows the reference line for `unexpected`; the root error view moves to `src/components/ErrorView.tsx`
- [x] 1.4 Tests:
  - component tests for "A page that fails to render shows a reference" and the sign-in steps
  - a Workers test for "The reference finds the failure in the logs"
  - a Playwright test for "A failed request shows a reference", answering the server function with 500
- [x] 1.5 `pnpm check:traceability` shows no pending gaps, and typecheck, lint, format, Vitest and Playwright pass

## 2. Archive

`docs(openspec): archive error reference`

- [x] 2.1 Run `openspec archive add-error-reference` and check that `pnpm check:traceability` passes with the spec in `openspec/specs/`
