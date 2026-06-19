# CLAUDE.md — TEA Platform

Full-stack Next.js (App Router) application backed by Postgres via Prisma. The
Django backend was removed in 2025; everything is TypeScript. This file is the
single source of truth for what **correct** and **good** code looks like here.
When existing code contradicts this file, this file wins — see "Legacy: do not
imitate" below.

| Environment | URL |
|---|---|
| Local | `http://localhost:3000` |
| Staging | `https://staging-assuranceplatform.azurewebsites.net` |
| Production | `https://assuranceplatform.azurewebsites.net` |

## Architecture — the canonical slice

Every server-side feature follows one layered pattern. Read this exemplar slice
before writing similar code:

| Layer | Rule | Exemplar |
|---|---|---|
| Route / action | Auth + validate + delegate. No business logic, no Prisma. | `app/api/case-studies/route.ts` |
| Schema | All input validation is **zod**, in `lib/schemas/` (shared primitives in `lib/schemas/base.ts`, re-exported via `lib/schemas/index.ts`). | `lib/schemas/case-study.ts` |
| Service | Owns all business logic, **all Prisma access**, and **all permission checks**. Returns `ServiceResult` (`types/service.ts`), never throws for expected failures. | `lib/services/case-study-service.ts` |
| Responses | Uniform envelopes via `apiSuccess` / `apiError` (`lib/api-response.ts`) and typed errors (`lib/errors.ts`). | `app/api/case-studies/route.ts` |

Hard rules:

- **Prisma is imported only by services** (`lib/services/`) and `lib/prisma.ts`. Never in routes, actions, components, or hooks.
- **Every mutating endpoint validates with a zod schema and checks auth** before touching a service.
- ajv is banned; zod is the only validation library. Infer types from schemas
  (`z.infer`/`z.input`/`z.output`) — never hand-write a type a schema already defines.
  Trim/coerce with `.transform()` in the schema, not downstream.
- Next.js 15: route `params` are Promises — always `await` them.
- Routes exempt from the envelope pattern: SSE (`app/api/cases/[id]/events`),
  `app/api/health`, and the NextAuth handlers (framework-owned).

## Auth & permissions

- **API routes:** `requireAuth()` → `userId` (throws `unauthorised()`).
  **Server actions:** `validateSession()` → `{userId, username, email}`.
- **Never trust a client-supplied user ID** — always derive identity from the session.
- Permission checks live in the **service layer** via `canAccessCase` / helpers
  in `lib/permissions.ts`, not in routes.
- Return the **same error for not-found and no-permission** — prevents
  resource-enumeration attacks.
- Two distinct models: teams have **roles** (ADMIN / MEMBER); cases have
  **permission levels** (VIEW / COMMENT / EDIT / ADMIN).

## Database & migrations — CRITICAL

CI/Azure only ever applies committed migration files via `prisma migrate
deploy`; nothing else may touch the schema. Therefore:

- **Never run** `prisma migrate dev`, `prisma db push`, or `prisma db execute`
  (interactive/untracked — they bypass the reviewed-migration pipeline).
- **Create migrations manually:** edit `prisma/schema.prisma`, create
  `prisma/migrations/<timestamp>_description/migration.sql` by hand, apply with
  `prisma migrate deploy`.
- After schema changes, regenerate the client: `npx prisma generate`.
- Keep transactions short; never perform network requests inside a transaction.

## Server surface — when to use what

- **API routes (`app/api/`)** are the official, documented surface: anything an
  external tool, integration, webhook, or future plugin could call. They appear
  in the OpenAPI spec (`pnpm docs:generate`).
- **Server actions (`actions/`)** are internal UI plumbing: form submissions and
  page mutations that only our own components invoke.
- Routes under `/api/public/` and anything in the published OpenAPI spec are
  **semi-contractual**: changes need care, removals need a CHANGELOG entry.

## Client side

- UI primitives: shadcn components in `components/ui/` — extend these; add new
  ones via `pnpm dlx shadcn@latest add <component>`, never hand-roll equivalents.
- **Tailwind v4: there is no `tailwind.config.*`** — the theme lives in
  `app/globals.css` (`@theme`). Use semantic tokens (`bg-background`,
  `text-foreground`, `bg-primary`); never hardcoded colours. Dark mode is
  class-based via next-themes.
- Merge classes with `cn()` from `@/lib/utils`; accept `className` as the last
  argument so parents can override.
- Naming: kebab-case files, PascalCase components, `{ComponentName}Props`.
- Canvas state: the zustand store in `store/` (React Flow). Modal/UI state:
  hooks in `hooks/`. Components stay presentational; data access goes through
  routes/actions.

## Observability

- No raw `console.*` in app code. Use the structured logger (logs to stdout so
  containerised/self-hosted deployments work unchanged).
- Telemetry is OpenTelemetry-based; Azure App Insights is an optional exporter
  activated by env var only. Never wire a vendor SDK outside that seam —
  forkability is a requirement.

## Testing

Risk-tiered, integration-heavy ("testing trophy", not pyramid):

- **Services and API routes:** integration tests against **real Postgres** —
  never mock the Prisma client; use factories + transaction rollback for
  isolation. Mock auth only at the boundary (`vi.mock("@/lib/auth")` for
  routes, `@/lib/auth/validate-session` for actions).
- **Secured endpoints:** test the full permission matrix — owner; EDIT/VIEW/
  COMMENT via direct share and via team; no permission; unauthenticated;
  non-existent resource.
- **User-critical e2e journeys only** (Playwright, `e2e/`): auth lifecycle,
  case management, sharing & permissions, publishing.
- **Presentational components:** tests optional. No snapshot tests anywhere —
  test behaviour, not implementation.
- Commands: `pnpm test:unit` / `pnpm test:integration` / `pnpm test:e2e`.

## Quality gates & conventions

- Lint/format: ultracite (Biome preset). Type checking is strict — no `any`,
  no `@ts-ignore`, no unexplained `as` casts.
- Structural quality: **fallow** (dead code, duplication, cycles) — config in
  `.fallowrc.json`, report-only in CI initially.
- Before pushing: `pnpm lint && pnpm typecheck` must pass. A git pre-push hook
  (`.githooks/`, armed by `pnpm install`) enforces this for `staging`/`main`;
  CI remains authoritative.
- **British English** in all prose, UI copy, and identifiers ("colour",
  "organisation", "optimise").
- No AI attribution (Co-Authored-By etc.) in commits or PRs.
- Branch flow: `feature/*` → `staging` → `main`. Cleanup policy is
  **delete-first**: verified-dead code is deleted, not deprecated; git history
  is the archive.

## Local development

- Docker dev stack: `docker-compose -f docker-compose.local.yml up -d --build`.
  **Never `docker-compose down -v`** — it wipes the local database volume. To
  pick up new npm packages, remove only `assuranceplatform_node_modules_dev`.
- Docs run in production mode inside Docker (Nextra 4 dev-mode crash); for hot
  reload run `pnpm dev` on the host against Docker's Postgres.
- Seed test users: `chris`, `alice`, `bob`, `charlie` (password from the
  `SEED_USER_PASSWORD` env var; alice/bob share Test Team, charlie is an
  external viewer).
- `prisma generate` needs `DATABASE_URL` resolvable; "Unknown argument" errors
  after schema changes mean the client needs regenerating.

## Legacy: do not imitate

Code listed here is scheduled for removal or repair. Do not copy its patterns,
and do not "fix" it incidentally — it is tracked work.

- `src/generated/prisma/` — generated Prisma client output (untracked from
  git; regenerate with `prisma generate`). Never edit it or import from it
  outside `lib/prisma.ts` and services.
- Circular imports between `store/` and node components — being inverted; do
  not add new imports from `store/` to component modules.
- Large duplicated blocks in `components/docs/curriculum/` and the share-modal
  export sections — live code, pending consolidation (not deletion).
- Curriculum components are imported from MDX in `content/` (and the case
  viewer is lazy-loaded via dynamic `import()`) — static analysers miss both;
  check MDX and dynamic imports before declaring anything in
  `components/docs/curriculum/` dead.
- Scattered `console.*` calls — being replaced by the structured logger.

## Open decisions

- Plugin system is design-only (`content/technical-guide/architecture/plugin-ecosystem.mdx`);
  no plugin code exists yet.
