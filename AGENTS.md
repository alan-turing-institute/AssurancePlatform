# AGENTS.md — Trustworthy & Ethical Assurance Platform

Read this file before working in the repository.
It holds the shared conventions for every coding agent; `CLAUDE.md` imports it rather than duplicating it.
Where this file and the code disagree, check the code and fix whichever is wrong; neither wins by default.

## Project and map

TEA helps multi-stakeholder teams build, share and publish graphical assurance cases: structured arguments and evidence about trustworthy and ethical technology.
The application and its Nextra documentation share one Next.js App Router project.
The stack is Next.js 16, React 19, TypeScript, PostgreSQL, Prisma 7, NextAuth 4, Tailwind 4, React Flow and Zustand.
The Django backend was removed in December 2025; everything is TypeScript.
Use `package.json` and `pnpm-lock.yaml` for exact dependency versions.

| Environment | URL |
|---|---|
| Local | `http://localhost:3000` |
| Staging | `https://staging-assuranceplatform.azurewebsites.net` |
| Production | `https://assuranceplatform.azurewebsites.net` |

- `app/`: pages, layouts and API routes; `actions/`: internal UI server actions.
- `lib/schemas/`: Zod input schemas; `lib/services/`: business logic and database operations.
- `lib/api-response.ts`, `lib/errors.ts`, `types/service.ts`: response and error contracts.
- `lib/auth/`: session validation, API tokens, client-IP extraction, token encryption.
- `lib/logger.ts`: the structured logger.
- `lib/plugins/`: the plugin manifest, slot registries, client bootstrap and the `tea.health` plugin.
- `components/ui/`: shadcn primitives; `components/cases/` and `components/shared/nodes/`: case canvas UI.
- `store/`: canvas and history state (Zustand); `hooks/` and `providers/`: UI state and context.
- `prisma/`: schema, reviewed migrations and the development seed; `src/generated/prisma/`: generated client, untracked, never edit by hand.
- `content/`: MDX documentation and curriculum; `docs/`: the database DBML and accepted-limitations specs (design records live outside the repo).
- `src/__tests__/integration/`: database and API tests; colocated `*.test.ts(x)`: unit and component tests; `e2e/`: Playwright journeys.
- `lint-rules/`: GritQL rules for Biome; `patches/`: pnpm patches applied at install.

The `@/` import alias points to the repository root, not `src/`.

## Install and run

Use pnpm, pinned by `packageManager` in `package.json`.
Build, test and Docker use Node 20; the release and structural-quality jobs use Node 22.
Use Node 20 to reproduce the build and test environment.
Run commands from the repository root.

Have the maintainer provision local environment values before starting; copy `.env.example` as the starting point.
Docker Compose reads `.env`; the Prisma CLI reads `.env` through `dotenv`; Next.js also reads `.env.local`.
Do not assume Next.js environment loading applies to Prisma CLI commands.
For host development, `DATABASE_URL` must address the local Postgres port; the Compose app addresses the `postgres` service instead.
Never print credentials, and never commit local environment files.

Host development against Docker Postgres:

    corepack enable pnpm
    pnpm install --frozen-lockfile
    docker compose -f docker-compose.local.yml up -d postgres
    pnpm exec prisma generate
    pnpm exec prisma migrate deploy
    pnpm dev

The app is at `http://localhost:3000`; the dev database is exposed on port 5432.
With `SEED_USER_PASSWORD` provisioned, seed via `pnpm exec tsx prisma/seed/dev-seed.ts`.
Seed users are `chris`, `alice`, `bob` and `charlie`; alice and bob share Test Team, charlie is an external viewer.

The full local stack starts with `docker compose -f docker-compose.local.yml up -d --build`.
Its app command applies migrations, seeds, and starts in production mode; use host `pnpm dev` for hot reload.
The image bakes source and dependencies in at build time, so `--build` alone picks up changes.
Never use `docker compose down -v`: it destroys the dev database volume.

`pnpm build` creates a standalone Next.js build.
`pnpm start` runs `node server.js` and assumes the packaged standalone layout; it is not a repository-root preview command.
CI starts `node .next/standalone/server.js` after copying `public/` and `.next/static/` into the standalone tree; Docker packages the same layout.

## Server architecture and permissions

Follow the layered slice: `app/api/cases/[id]/information/route.ts`, `lib/schemas/case-information.ts`, `lib/services/case-information-service.ts`.
Routes and actions authenticate, validate and delegate; services own business logic and case permission checks.
Keep application Prisma access in services and `lib/prisma.ts`; never add it to routes, actions, components or hooks.
Database setup, seed and test infrastructure necessarily access the database directly.

- Validate mutations with Zod schemas in `lib/schemas/`; share primitives through `base.ts` and exports through `index.ts`.
  Infer types from schemas rather than duplicating them; put trimming and coercion in the schema.
  Zod is the only validation library; do not introduce ajv.
- Services return `ServiceResult` from `types/service.ts` for expected failures; do not throw for normal business errors.
- Use `apiSuccess`, `apiError`, `apiErrorFromUnknown` and `serviceErrorToAppError` from `lib/api-response.ts` with errors from `lib/errors.ts`.
  Success returns the payload directly; do not add a `{ data: ... }` wrapper.
  SSE (`app/api/cases/[id]/events`), `app/api/health` and the NextAuth handlers have their own response contracts.
- Await dynamic route `params`.
- Session-authenticated API routes use `requireAuth()` (or `requireAuthSession()`) from `lib/api-response.ts`; actions use `validateSession()` from `lib/auth/validate-session.ts` and handle a missing session.
  Derive user identity from authentication, never from client-supplied user IDs.
- Read a client IP only through `extractClientIp` in `lib/auth/extract-client-ip.ts`.
  Never read `x-forwarded-for` or `x-real-ip` directly; both are attacker-controllable in this deployment.
  If a CDN or Front Door is ever placed in front of App Service, the helper's trusted-hop policy must be revisited.
- Machine endpoints under `/api/machine/` use `requireApiToken` from `lib/auth/require-api-token.ts` with the scopes appropriate to the operation.
  Keep intentionally public routes and authentication-entry routes distinct from session-protected mutations.
- Check case access in services using `canAccessCase` and the helpers in `lib/permissions.ts`.
  Return the same error for a missing resource and an inaccessible one.
  Teams have roles (ADMIN, MEMBER); cases have permission levels (VIEW, COMMENT, EDIT, ADMIN).

API routes are the external integration surface; server actions are internal UI plumbing.
Regenerate the OpenAPI documentation with `pnpm docs:generate` when changing documented routes.
Routes under `/api/public/` and anything in the published OpenAPI spec are semi-contractual: changes need care and removals need a `CHANGELOG.md` entry.

## Database changes

Create reviewed migrations manually: edit `prisma/schema.prisma`, then add `prisma/migrations/<timestamp>_description/migration.sql`.
Apply migrations with `pnpm exec prisma migrate deploy`; regenerate the client with `pnpm exec prisma generate`.
Do not use `prisma migrate dev`, `prisma db push` or `prisma db execute`; CI and Azure apply committed migration files only.
The Prisma CLI needs `DATABASE_URL` set, including for `generate`.
"Unknown argument" errors after a schema change mean the client needs regenerating.
Keep transactions short and make network calls outside them.

## Logging

No raw `console.*` in application code; Biome's `suspicious/noConsole` rule reports it as an error.
Use the logger in `lib/logger.ts`: one JSON line per entry on stdout, no vendor SDK, usable from server and browser code.
Do not import it, or anything that imports it (`lib/errors.ts`, `lib/api-response.ts`), from `middleware.ts`: the production build rejects `process.stdout` in the Edge Runtime bundle, and the unit tests never bundle the middleware, so only `pnpm build` shows the failure.
Its sink (`setLogSink` / `resetLogSink`) is the seam a future OpenTelemetry bridge will use; nothing is wired to it yet, so do not import an OpenTelemetry or App Insights SDK.
Test files, `scripts/`, `prisma/seed/` and `e2e/` are exempt from the console rule because console output is their interface.
Keep secrets out of log entries.

## Client, plugins and documentation

- Extend the shadcn primitives in `components/ui/`; add new ones with `pnpm dlx shadcn@latest add <component>`.
- Tailwind 4 theme tokens live in `app/globals.css`; there is no Tailwind config file.
  Use semantic colours such as `bg-background` and `text-foreground`; dark mode is class-based via next-themes.
- Merge classes with `cn()` from `@/lib/utils`, with the caller's `className` last.
  Use kebab-case filenames, PascalCase components and `{ComponentName}Props`.
- Keep components presentational; data access goes through routes and actions, and state through the existing Zustand stores and hooks.
  Do not add imports from `store/` into node components; that cycle is being inverted.
- Plugins: consult `lib/plugins/manifest.ts`, `lib/plugins/slots/`, `lib/plugins/bootstrap.ts` and the `tea.health` implementation under `lib/plugins/health/` before changing extension behaviour.
  Keep plugin semantics out of core; register plugin UI through the slot registries and the client bootstrap.
  Disabling a plugin leaves its data stored; do not purge it as a side effect.
  Machine integrations under `/api/machine/` are distinct from in-process plugins.
- Check MDX and dynamic imports before deleting apparently unused curriculum or viewer components.
  Fallow cannot tell on its own that these components are dead.
- Use British English in prose, UI copy and new identifiers, preserving required external API spellings.
- Put each Markdown sentence on its own source line.

## Tests and quality checks

Run the checks relevant to the change, and report the commands, the results and anything not run:

    pnpm lint
    pnpm typecheck
    pnpm test:unit
    pnpm test:integration
    pnpm test:e2e

`pnpm format` applies Ultracite (Biome) fixes; review its diff.
TypeScript is strict: no `any`, no `@ts-ignore`, no unexplained casts in application code.
`biome.json` carries narrower exceptions for test files.

Use `test:unit` and `test:integration` explicitly: plain `pnpm test` starts Vitest and does not mean all tiers.
Services and routes need integration tests against real Postgres using the factories in `src/__tests__/utils/prisma-factories.ts`; never mock the Prisma client.
Mock session authentication only at the boundary (`@/lib/auth/validate-session` in the existing route and action tests).

`pnpm test:integration` needs its own Postgres, separate from dev's.
`docker-compose.local.yml` runs two: `postgres` (dev, port 5432, durable) and `postgres-test` (port 5433, `fsync=off`, tmpfs-backed, disposable).
Start it with `docker compose -f docker-compose.local.yml up -d postgres-test`; nothing else starts it.
The harness clones a migrated template into per-worker `tea_test_p<pid>_w<n>` databases, truncates application tables after each test and drops the worker databases at teardown.
It needs a role able to create and drop databases; `src/__tests__/scripts/test-db-config.ts` and `vitest.workspace.ts` hold the local defaults and CI overrides them.
Do not run two integration suites against the same Postgres instance.

Test secured operations across owner, direct and team permissions, no permission, unauthenticated and missing-resource cases.
Keep Playwright to the critical journeys: auth, case management, sharing, publishing.
Presentational component tests are optional; snapshot tests are not the convention.
Install the browser with `pnpm exec playwright install chromium`.
Outside CI, `e2e/global-setup.ts` runs `prisma migrate reset --force` and reseeds, so point it only at a disposable database.
Playwright starts `pnpm dev` locally or reuses a server on port 3000, so that server must use the intended test database too.

Structural quality is checked by fallow in CI's `structural-quality` job, against the per-analysis baselines (`.fallow-baseline.*.json`); findings introduced by the change fail the job.

## Workflow and known limits

Branch from `staging` using `feature/*` or `fix/*`; PRs target `staging`, and `staging` merges to `main` for production.
Use Conventional Commit subjects such as `feat: ...` or `fix: ...`; semantic-release derives releases from them on `main`.
Do not add AI attribution to commits or PRs.
Keep changes scoped; delete verified-dead code rather than deprecating it, and do not perform incidental cleanups.

`pnpm install` arms the hooks in `.githooks/` by setting `core.hooksPath`.
The pre-push hook runs lint and typecheck for pushes to `staging` and `main`; CI remains authoritative and also runs the tests.
`.pre-commit-config.yaml` is for manual runs and pre-commit.ci; `pre-commit install` refuses to install while `core.hooksPath` is set.

Work is tracked in GitHub Issues.
The plugin system is real but partial: the manifest, slots and one official plugin exist; a marketplace does not.
`middleware.ts` still carries the Next 15 name; the Next 16 `proxy.ts` rename is tracked work, not something to do in passing.
