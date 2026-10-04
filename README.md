# Afilados Club

A private seasonal headquarters for friends. Home, **El Afiladero** (`/afiladero`) and **Calendar** (`/calendario`) require a verified Auth identity and active club membership; entry is Google-only at `/entrar`. See the [product brief](docs/product-brief.md).

## Stack and requirements

Next.js **16.3.8** App Router, React **19.3.0**, strict TypeScript, Tailwind CSS 4, shadcn/ui configuration, and Supabase browser/server/proxy groundwork. Utility dependencies: Lucide, Motion, date-fns, and Zod. Vitest/Testing Library, Playwright, ESLint, and Prettier cover quality.

- **Node 22.12+ on the 22.x line**, 24.x, or 26+ (see `engines`); verified locally with 22.18.0. Vitest/Vite set the minimum above Supabase's Node 22 requirement.
- **pnpm 10.33.0**, pinned in `packageManager`; Corepack can resolve the project version.
- Docker is required for real local database security checks; unit tests and anonymous-entry browser checks do not require it.

## Quick start

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. Without Supabase public configuration, private `/` fails closed to the branded entry. No member data appears. The existing native Barlow Condensed font and Season Home remain unchanged.

## Environment and optional local Supabase

`supabase/config.toml` is configured for local development. The first migration creates `club_members` and hash-only `club_member_access`, three approved identities, own-active member RLS, a Google-only before-user-created hook, and atomic identity binding. The new Afiladero migration evolves SELECT to an **active roster visible only to active requesters**, without changing admission/binding. Seeds remain disabled: approved entries are versioned in the first migration; no ideas or votes are seeded. There is no automatic Auth-user creation/backfill or member management UI. No remote login/link is needed for local SQL checks.

Local ports use **56320–56329** to coexist with occupied Supabase defaults: API **56321**, database **56322**, shadow database **56320**, Studio **56323**, mail UI **56324**, analytics **56327**, and edge inspector **56328**. Pooler **56329** remains disabled; optional SMTP/POP3 remain unconfigured. Check availability before starting. Local Studio is `http://127.0.0.1:56323`; the local API is `http://127.0.0.1:56321`. This port choice does not enable additional services.

With a local Docker context and running daemon:

```sh
SUPABASE_TELEMETRY_DISABLED=1 pnpm exec supabase start
pnpm exec supabase db reset --local --no-seed
pnpm exec supabase test db
pnpm exec supabase db lint --local --level warning --fail-on warning
SUPABASE_TELEMETRY_DISABLED=1 pnpm exec supabase stop --project-id afilados-club
```

The reset command destroys **this local project's** database contents; use only disposable development data. If Docker is unavailable, report the SQL verification gap rather than substituting a remote project. Do not stop another project's stack.

Google configuration uses environment references for `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in the CLI process only. Never place their values in Next.js runtime configuration, Vercel variables, `.env.example`, TOML, or logs. Both references must resolve before enabling the provider; local SQL/UI work can proceed with Google disabled when credentials are unavailable. Their presence does not prove validity or Google Console callback setup.

The official `[remotes.production]` overlay targets only `lqvggnstktauywthlbha`: the canonical production site, its callback, the localhost callback, and the owner-scoped Preview redirect pattern. Applying remote database/Auth changes is a separate authorized operation after local SQL PASS. Review `pnpm exec supabase config diff --project-ref lqvggnstktauywthlbha --output-format json`; `config push` uses resource confirmations, not a dry-run or auth-only flag. Do not affirm unrelated resources or use blanket auto-approval.

If later authorized local work needs the clients, copy `.env.example` to ignored `.env.local` and populate only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the **local** stack. Never add service-role keys, signing secrets, or real credentials to tracked files.

- `src/lib/supabase/client.ts`: nullable browser client; public config only.
- `src/lib/supabase/server.ts`: fresh, nullable **read-only Server Component** client. It deliberately omits cookie writes; do not use it for session-mutating Server Actions/Route Handlers.
- `src/proxy.ts` / `src/lib/supabase/proxy.ts`: refresh only, with verified `getClaims`, synchronized cookies, and accumulated anti-cache headers. No per-request membership query lives in the proxy.
- `src/lib/supabase/route.ts`: writable request-scoped cookie view and final-response preservation for OAuth and POST logout.
- `src/lib/auth/member.ts`: verified claims plus own-active membership query under the caller's RLS; render-pass-only React memoization. Both private layout and page enforce authorization.

`/entrar` stays public; active members go to `/`, valid nonmembers stay at entry with safe errors and POST logout. OAuth endpoints use trusted origins and a fixed Home destination, not an untrusted `next` parameter. Roster reads require active membership; access hashes are never exposed. Real Google sign-in still requires the user's browser and approved identity; mocks and component fixtures do not prove provider behavior.

## El Afiladero

Home links its Afiladero and Calendar teasers. The board reads the current `season.year`, active roster, ideas, votes and scheduling badges under the caller's session/RLS; failed reads show an error, never a valid empty board or fabricated zero counts.

| Behavior  | Contract                                                                                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposals | Ten categories; trimmed title 3–80 characters; optional trimmed description up to 400 characters, blank becomes NULL. Native dialogs provide labeled forms and keyboard focus.                                                                                |
| Ownership | Authors edit category/title/description. Authors or active admins delete, after confirmation; deleting an idea cascades its votes.                                                                                                                            |
| Votes     | One `in` / `maybe` / `pass` vote per member/idea, including self-votes. A different choice changes it; selecting the current choice removes it.                                                                                                               |
| Ordering  | **MÁS AFILADAS**: `in` descending, `maybe` descending, creation time descending. **NUEVAS**: creation time descending only.                                                                                                                                   |
| Security  | Each action reuses `requireClubMember()` and a session public-key client. Private SQL definers resolve active identity/admin status without recursive roster RLS or new public RPCs. Identity/year/timestamps cannot be updated through client column grants. |

Vote changes deliberately use INSERT or caller-scoped vote-only UPDATE, not upsert requiring wider immutable-column grants. Successful mutations revalidate `/afiladero`; zero affected rows and DB failures return generic Spanish errors. There is no realtime, aggregate RPC, write cutoff, pagination, member administration, or production fixture data.

## Season calendar

The single temporal source is `src/features/season/model.ts`: **November 28, 2026 at 07:25 → December 21 at 07:25 exclusive**, `America/La_Paz`, exactly **23 days**. Planning dates are November 28–December 20. Home numbers La Paz calendar dates; December 21 remains live before closing but shows departure copy, never Day 24. Warmup runs from October 1 midnight and reaches 100% at the exact opening.

`/calendario` shows all 23 dates even when empty: seven chronological desktop columns starting Saturday, a readable tablet grid, and a vertical mobile agenda. Metrics count noncancelled activities, confirmed activities and dates without a noncancelled covering activity. Multi-day entries cover every plan date but never add a departure cell. Within each date, timed entries sort first by start time, then all-day entries; creation time ascending and ID break ties. Cancelled entries remain visible with explicit status and struck titles but do not occupy dates.

One native-dialog form serves direct/day creation, idea promotion and creator/admin edits. Start date is required; end date defaults to start. Time is optional; same-day end must be later than start, while overnight ranges may end earlier. A December 21 end requires both times and must finish by 07:25, never all-day. Creation allows tentative/confirmed only; editing can cancel or reinstate.

Any active member can **AGENDAR** an unlinked idea, without vote thresholds. Title/category/description are independent editable snapshots. A unique, immutable source link prevents duplicate promotion, including cancellation. Deleting an activity frees the idea; deleting an idea clears only the link and keeps the activity snapshot. Creator/admin deletion requires confirmation and should be reserved for erroneous entries, not abandoned plans. Calendar mutations and idea deletion revalidate `/calendario`, `/afiladero` and Home.

The new migration defaults member/year/ID/timestamps in the database, grants only actual input/read columns, and independently enforces active-member RLS plus creator/admin mutation authority. A private, non-callable trigger checks same-season source provenance. No Auth, admission, votes, applied migrations or real-data backfills change.

## Quality and production smoke

```sh
pnpm format
pnpm check
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`check` runs lint, generated-route typechecking, non-watch unit tests, and formatting checks only. It does not start infrastructure or run E2E. Individual commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`; interactive unit runner: `pnpm test:watch`.

Playwright builds production with empty public Supabase values and owns `http://127.0.0.1:3100`. It verifies anonymous private-root/Afiladero/Calendar denial, branded entry, safe callback errors, and POST-only logout. A separate **test-only component renderer** on `127.0.0.1:3200` mounts Home, Afiladero and Calendar fixtures with real production CSS/native fonts. It covers 390×844, 768×1024, and 1440×900, all 23 dates, empty/populated boards, day/date controls, dialog viewport/focus/Escape, pending/errors, cancellation/reinstatement, idea snapshot promotion, and reduced motion. It imports no Auth clients and is not a production route or authorization bypass. Fixture mutations affect only component state, never the database. These checks are not authenticated-route CRUD or Google OAuth proof. Both servers reject existing processes and are stopped by Playwright. Chromium provisioning may require a download.

The SQL suite uses transaction-scoped fictitious identities and rolls them back. It verifies admission/binding, schema/constraints, helper ACLs, narrow grants, active-member RLS, creator/admin distinctions, vote ownership, date/time/departure limits, source uniqueness/same-season provenance, snapshot independence and deletion semantics without inserting real approved Auth accounts. Run it after a fresh disposable local reset with no seeds; never substitute a remote project. Real member CRUD acceptance remains a human browser check after the new migration is separately authorized and applied.

For a production server outside tests: `pnpm build` then `pnpm start` (loopback port 3000). Normalize before final checks; after any edits, rerun affected verification. Check staged new-file whitespace with `git diff --cached --check` when delivering.

## Structure and UI primitives

`src/app` holds routes, `src/lib` holds useful shared/Supabase helpers, and `src/test` holds setup/E2E tests. Unit tests live beside their subjects. `supabase` holds local configuration; `docs` holds product context.

`components.json`, Tailwind theme tokens, and `cn` initialize shadcn/ui conventions without pretending components are installed. Season and entry features remain small and server-first; add primitives only when useful, with accessible behavior and the product's existing identity.
