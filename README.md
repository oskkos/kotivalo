# kotivalo

Kotivalo – Valoa vuokranantajan arkeen.

A mobile-first app for Finnish private landlords: flats, tenancies, income, expenses and receipts in one place, and each owner's tax return figures (form 7H) at year end. See [CONCEPT.md](CONCEPT.md) for the product and technical choices.

## Development

Requires Node 24+ and pnpm (`corepack enable` picks up the pinned version).

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e   # Playwright; first run: pnpm exec playwright install chromium
pnpm db:migrate:local   # apply database migrations to the local D1
pnpm build
pnpm preview    # serve the built Worker locally
```

The app runs on Cloudflare Workers (TanStack Start + the Cloudflare Vite plugin). Under WSL, run Git and Node from the Linux side: the Git hooks (Lefthook, installed by `pnpm install`) need them.

Every push to `develop` deploys to production on Cloudflare once CI passes.

Emails are not sent locally: they are printed in the dev server's log, so a sign-in code at http://localhost:3000/sign-in can be read there (or from `/api/test/inbox?to=<address>`). To send real email through Resend, copy `.dev.vars.example` to `.dev.vars` and fill it in.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org), checked by commitlint in a `commit-msg` hook and in CI.

## User guide

The guide for landlords is in `docs/guide/` (Finnish, [Starlight](https://starlight.astro.build)), published at https://ohje.kotivalo.app. It is a script: MDX pages and Playwright capture scripts, and the screenshots are taken from the real app in CI, never committed.

```sh
pnpm guide:capture   # builds the app and takes the screenshots (first run: pnpm exec playwright install chromium)
pnpm guide:dev       # preview the site; a missing screenshot shows a placeholder
pnpm guide:build     # GUIDE_STRICT=1 makes a missing screenshot an error, as in CI
pnpm guide:check     # each page's requirement hashes against the specs
```

The `guide` workflow captures, builds and, after every push to `develop` that touches what the guide shows, deploys the site to its own Worker `kotivalo-guide`. Pages are written with the `generate-user-guides` skill.

## Production logs and errors

The Worker writes structured JSON log lines (`src/server/log/log.ts`), and the browser's errors and logs reach the same logs (`POST /api/log`). Every line of a request carries `traceId`, `versionId`, `commit` and, once signed in, `userId`. Lines carry no email addresses or other personal data.

In the Cloudflare dashboard, open **Workers & Pages → kotivalo**:

- **Observability → Logs / Traces:** search by field, e.g. `traceId`, `event` (`authentication.code_email_failed`) or `userId`.
  - When a user reports an error, they see a reference such as `Virhetunnus: 4bf92f35`, the first 8 characters of the trace id. Search for lines whose `traceId` starts with it.
  - `source: client` marks lines from the browser.
- **Issues:** uncaught exceptions, 5xx responses and every `error`-level line, grouped. Set up a notification for new issues there (email or webhook). It covers unexpected errors and email failures (`authentication.code_email_failed`, including the Resend quota).
- **Limits on the free plan:** 200,000 log and trace events a day, kept for 3 days. From 1 December 2026 Cloudflare's Observability pricing applies; check the free allowance then.

Refused requests (`authentication.limit_reached`) are `warn` lines: look for them in the logs when abuse is suspected. Resend's own dashboard shows each email, tagged with `trace_id`.

## License

[MIT](LICENSE)
