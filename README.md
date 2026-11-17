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
pnpm build
pnpm preview    # serve the built Worker locally
```

The app runs on Cloudflare Workers (TanStack Start + the Cloudflare Vite plugin). Under WSL, run Git and Node from the Linux side.

## License

[MIT](LICENSE)
