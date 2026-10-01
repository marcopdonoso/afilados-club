# Afilados Club: working agreement

## Product

- A private project for a known group of friends, organized in reusable annual seasons.
- Season 2026 runs November 28–December 22. Preserve the premise in `docs/product-brief.md`.
- Make it fun and distinctive, not corporate. WhatsApp remains the main chat; this is the season headquarters.
- Foundation work does not authorize product features, authentication flows, or database schema.

## Engineering

- Use strict TypeScript, Next.js App Router, Supabase, and mobile-first layouts. Prefer Server Components; add client boundaries only when necessary.
- Keep dependencies and abstractions minimal. No overengineering or silent stack changes.
- Future private data requires explicit authorization checks and RLS before exposure. The smoke home is not a security boundary.
- Never commit secrets or service-role credentials. Keep `.env.local` ignored and `.env.example` safe.
- Do not bypass typechecking, disable required checks, or mutate applied migrations.
- Supabase cookie refresh belongs in the proxy: preserve request/response cookies and anti-cache headers. Verify identity with `getClaims`, not unverified session contents.

## Workflow

- Inspect relevant files first, make small scoped changes, run affected checks, inspect the full diff, and report outcomes and blockers honestly.
- Run `pnpm check` for static/unit checks and `pnpm test:e2e` for production home smoke. Check whitespace, including staged new files when applicable.
- Normalize source before final verification. Edits after verification require checking affected bytes again.
- Never commit unless the current prompt authorizes it; current bootstrap delivery reserves the sole initial commit for the parent.
- No push, merge, PR, deploy, remote execution, or use of ambient authenticated sessions without explicit authorization for that operation.

## UX

- Build a distinct identity: shadcn/ui primitives are tools, not the product's identity.
- Support mobile and desktop, semantic markup, keyboard access, readable contrast, and reduced-motion preferences.
- Animation must communicate intent, not decoration. Do not turn the foundation smoke screen into a definitive design.
