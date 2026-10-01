# Afilados Club

A private seasonal headquarters for friends. This bootstrap provides a tested technical foundation, not product features or a login flow. See the [product brief](docs/product-brief.md).

## Stack and requirements

Next.js **16.3.8** App Router, React **19.3.0**, strict TypeScript, Tailwind CSS 4, shadcn/ui configuration, and Supabase browser/server/proxy groundwork. Utility dependencies: Lucide, Motion, date-fns, and Zod. Vitest/Testing Library, Playwright, ESLint, and Prettier cover quality.

- **Node 22.12+ on the 22.x line**, 24.x, or 26+ (see `engines`); verified locally with 22.18.0. Vitest/Vite set the minimum above Supabase's Node 22 requirement.
- **pnpm 10.33.0**, pinned in `packageManager`; Corepack can resolve the project version.
- Docker is optional for local Supabase and unnecessary for the smoke home, unit tests, or build.

## Quick start

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:3000`. No environment values are needed for **AFILADOS CLUB / Foundation ready.** System sans fonts avoid external font downloads.

## Environment and optional local Supabase

`supabase/config.toml` is initialized for local development. No product migrations, tables, seed data, users, or login routes exist. Seeds are disabled. The project-local CLI is pinned; no global CLI or remote login/link is needed.

Local ports use **56320–56329** to coexist with occupied Supabase defaults: API **56321**, database **56322**, shadow database **56320**, Studio **56323**, mail UI **56324**, analytics **56327**, and edge inspector **56328**. Pooler **56329** remains disabled; optional SMTP/POP3 remain unconfigured. Check availability before starting. Local Studio is `http://127.0.0.1:56323`; the local API is `http://127.0.0.1:56321`. This port choice does not enable additional services.

With a local Docker context and running daemon:

```sh
SUPABASE_TELEMETRY_DISABLED=1 pnpm exec supabase start
SUPABASE_TELEMETRY_DISABLED=1 pnpm exec supabase stop
```

If Docker is unavailable, keep using the no-env home. Do not substitute a remote project. Do not stop another project's stack.

If later authorized local work needs the clients, copy `.env.example` to ignored `.env.local` and populate only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the **local** stack. Never add service-role keys, signing secrets, or real credentials to tracked files.

- `src/lib/supabase/client.ts`: nullable browser client; public config only.
- `src/lib/supabase/server.ts`: fresh, nullable **read-only Server Component** client. It deliberately omits cookie writes; do not use it for session-mutating Server Actions/Route Handlers.
- `src/proxy.ts` / `src/lib/supabase/proxy.ts`: no-env passthrough; configured requests use `getClaims`. Refresh writes synchronize request/response cookies and preserve cookie-associated `Cache-Control`, `Expires`, and `Pragma`, including successive writes. No route guards or redirects exist. Future mutating handlers need an explicit response-aware adapter, not swallowed header writes.

These helpers are groundwork, not authentication or private-data protection. Live session integration requires a separately scoped local environment; mocks do not prove real authentication works.

## Quality and production smoke

```sh
pnpm format
pnpm check
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`check` runs lint, generated-route typechecking, non-watch unit tests, and formatting checks only. It does not start infrastructure or run E2E. Individual commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`; interactive unit runner: `pnpm test:watch`.

Playwright builds production with empty Supabase public values and owns a server on `http://127.0.0.1:3100`. It refuses an existing server, tests desktop/mobile content and metadata without horizontal overflow, and stops its process group afterward. Chromium provisioning may require a download. No live Supabase service is needed.

For a production server outside tests: `pnpm build` then `pnpm start` (loopback port 3000). Normalize before final checks; after any edits, rerun affected verification. Check staged new-file whitespace with `git diff --cached --check` when delivering.

## Structure and UI primitives

`src/app` holds routes, `src/lib` holds useful shared/Supabase helpers, and `src/test` holds setup/E2E tests. Unit tests live beside their subjects. `supabase` holds local configuration; `docs` holds product context.

`components.json`, Tailwind theme tokens, and `cn` initialize shadcn/ui conventions without pretending components are installed. `src/components/ui`, `src/features`, and `src/hooks` are intentionally unpopulated; create them only with useful scoped files, not placeholder markers. New primitives should use the configured aliases and accessible behavior without becoming the product identity.
