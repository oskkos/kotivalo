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

## License

[MIT](LICENSE)
