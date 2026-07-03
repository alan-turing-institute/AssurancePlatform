# ADR 0002 — Plugin architecture v1: external plugins over a token-authenticated API

- **Status:** Proposed
- **Date:** 2026-07-03
- **Author:** cid (agent-atelier technical lead), for the TEA v1.0 release
- **Deciders:** Chris Burr (PI), TEA maintainers
- **Related:** ADR 0001 (runtime evidence & claim-state), the plugin-ecosystem vision page (`content/technical-guide/architecture/plugin-ecosystem.mdx`), DARTER technical development plan (Interfaces B & C, milestone M1 — contracts frozen July 2026), TEA 1.0 decision package (vault, 2026-07-02)
- **Supersedes:** the "post-v1.0" timeline stated on the vision page — plugin architecture v1 is **in** 1.0 scope by decision of 2026-07-02

---

## Context

The vision page names four plugin types — element-type, format, analysis, and integration plugins — and defers all of them past 1.0. Two things changed:

1. **DARTER needs a machine-writable path into assurance cases now** (its M1 milestone, July 2026, requires the interface contracts frozen). ADR 0001 designed that path: scoped machine tokens, an append-only evidence endpoint, claim-state.
2. **The 1.0 review (2026-07-02) found that the evidence path and a plugin system are one build, not two.** What a plugin fundamentally needs — an identity, scoped permissions, and a stable documented API to read and write through — is exactly what ADR 0001's machine auth already specifies. The plugin system's 1.0 core *is* that auth plus a registry and a published contract.

**The question this ADR answers first: what is a plugin, physically, in this codebase?** The platform is a single Next.js application with a database schema fixed at build time. Loading third-party code *into* that process at runtime is neither safe (arbitrary code in the trusted process, no isolation story) nor practical for 1.0 (no stable in-process extension API exists, and designing one speculatively would displace the evidence work DARTER is waiting on).

## Decision

**A plugin is an external process holding a scoped API token.** It reads case structure through the existing documented API and writes through purpose-built endpoints — first among them the evidence endpoint of ADR 0001. The platform does not load, host, or execute plugin code in 1.0.

Five parts:

### 1. Plugin registry — `PluginRegistration`

A first-class record of what is connected, by whom, with which permissions:

```
model PluginRegistration {
  id            String        @id @default(uuid())
  name          String        @unique                    // e.g. "darter-evidence-pipeline"
  description   String?
  ownerId       String        @map("owner_id")           // the human accountable for this plugin
  systemUserId  String        @unique @map("system_user_id") // the machine principal (User with isSystemUser)
  scopes        String[]      @default([]) @map("scopes")    // verb grants, see §3
  status        PluginStatus  @default(ACTIVE)
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")
  lastSeenAt    DateTime?     @map("last_seen_at")       // updated on authenticated use
  owner         User          @relation("PluginOwner", fields: [ownerId], references: [id])
  systemUser    User          @relation("PluginPrincipal", fields: [systemUserId], references: [id])
  tokens        ApiToken[]
  @@map("plugin_registrations")
}
enum PluginStatus { ACTIVE  SUSPENDED  REVOKED }
```

Every plugin is **owned by a human** (accountability) and **acts as a dedicated system `User`** (the schema's existing `isSystemUser` flag, built for exactly this). Suspending or revoking the registration cuts off every token it holds.

Schema notes for the implementer: both named relations need their **back-relation fields declared on `User`** (Prisma requires both ends — same for ADR 0001's `RuntimeEvidence.claim` ↔ `AssuranceElement`); and the `User` relations deliberately carry **no cascade** — deleting a human owner is **blocked while they own `ACTIVE` registrations** (reassign first), enforced in the account-deletion service path.

### 2. Tokens — `ApiToken` (ADR 0001 §3, now owned by the registry)

Tokens are issued *to a registration*, never free-floating:

```
model ApiToken {
  id             String     @id @default(uuid())
  registrationId String     @map("registration_id")
  tokenHash      String     @unique @map("token_hash")  // SHA-256 of the secret; plaintext shown once
  tokenPrefix    String     @map("token_prefix")        // first 8 chars, for identification in UI/logs
  expiresAt      DateTime?  @map("expires_at")
  lastUsedAt     DateTime?  @map("last_used_at")
  revokedAt      DateTime?  @map("revoked_at")
  createdAt      DateTime   @default(now()) @map("created_at")
  registration   PluginRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  @@map("api_tokens")
}
```

Rules: hashed at rest; compared timing-safely (`lib/auth/timing-safe.ts` already exists); plaintext displayed exactly once at issuance; rotation = issue new + revoke old (both live during the overlap); a `teap_` prefix on the secret so leaked tokens are grep-able by secret scanners.

`requireApiToken(scope)` — the machine mirror of `requireAuth()` — resolves the bearer token to its registration, checks status + expiry + scope, stamps `lastUsedAt`/`lastSeenAt`, and returns the machine principal context (`systemUserId`, `registrationId`). Failures are throttled via the existing `RateLimitAttempt` pattern (keyed on `ip` for failed attempts — a garbage token resolves to no user, and the current `identifierType` union has no token variant) and logged to `SecurityAuditLog`.

**Middleware exemption (load-bearing, easy to miss):** `middleware.ts` routes everything outside a fixed allowlist through NextAuth's `withAuth` — a bearer-token-only client hitting a machine endpoint today gets a 307 redirect to the login page, never the route handler. The machine-endpoint path prefixes MUST be added to the matcher's negative lookahead (exact precedent: the existing `api/cron` entry). Auth for these routes is then enforced solely by `requireApiToken` at the route layer. Without this, nothing in this ADR is reachable.

### 3. Authorisation: scopes gate verbs; **case access reuses the existing permission model**

The deliberate non-decision that keeps this small: **we do not build a parallel ACL system for machines.**

- **Scopes** are a small fixed vocabulary of verb grants held on the registration: `case:read`, `evidence:read`, `evidence:write` (v1 complete list; extended only by ADR).
- **Which cases** a plugin may touch is decided by the existing per-case permission machinery: the plugin's system `User` is granted case permissions (VIEW / EDIT) exactly like a human collaborator, and the service layer's existing `canAccessCase` checks apply unchanged.

So a token proves *who is calling* (authentication), scopes bound *what kinds of action* it may attempt, and per-case permissions decide *which cases* — least privilege by construction, and the case-authorisation path itself is untouched (verified: `canAccessCase` and its call sites key on a bare `userId` with zero session coupling). Not-found and no-permission return the same error, as everywhere else.

**One required accompanying fix — the `isSystemUser` singleton assumption.** `getOrCreateSystemUser` (`lib/services/user-management-service.ts`) does an unqualified `findFirst({ where: { isSystemUser: true } })` and reassigns deleted users' case ownership to whatever it finds. Once plugins each have a system user, that lookup becomes nondeterministic — and because `createdById === userId` grants implicit ADMIN, a plugin principal could silently inherit ownership (and admin rights) over cases it was never granted. The helper MUST be changed to select the generic fallback account by its stable identifier (e.g. email), not the bare flag, in the same change that introduces plugin system users. This is the one place the "reuse, don't rebuild" claim needed a code change, found in feasibility review (2026-07-03).

### 4. The published contract

The plugin-facing surface is the **existing documented API** (the OpenAPI spec, `pnpm docs:generate`) plus the purpose-built machine endpoints from ADR 0001. Two artefacts make it a *contract*:

- **Evidence format v0.1** (`docs/specs/evidence-format-v0.1.md`) — the versioned JSON schema of one evidence item (DARTER's Interface B). The `POST /api/elements/[id]/evidence` body *is* this format. Frozen as v0.1 for DARTER S0; changes bump the version.
- **The plugin guide** — the vision page (`plugin-ecosystem.mdx`) is rewritten from "coming soon" to the real how-to: register, obtain a token, scopes, the endpoints, rate limits, the evidence format. Routes in the published spec are semi-contractual per the repo's existing rule.

### 5. How the four visioned plugin types map

| Vision type | 1.0 answer |
|---|---|
| **Integration** (external systems) | **Native fit** — this model, no adaptation needed. First instance: the DARTER evidence pipeline. |
| **Analysis** (checkers, validators) | **Native fit** — read via `case:read`, write findings as evidence via `evidence:write`. |
| **Format** (import/export) | **Two different things, answered separately (corrected in feasibility review 2026-07-03).** *Document export* (PDF/DOCX/Markdown reports) already has a working `ExporterRegistry` in `lib/export/` — 1.0 keeps it as the explicit contribution seam; third-party formats arrive as reviewed code contributions. *Case-data interchange* (GSN Community Standard XML, SACM, SCSC — what the vision page actually means) has **no seam at all**: `case-import-service` only auto-detects TEA's two internal JSON shapes, and there is no import counterpart to generalise. Interchange formats are **deferred beyond 1.0 as their own design cycle** — saying otherwise would misprice the work. |
| **Element-type** (custom node types) | **Deferred beyond 1.0, explicitly.** The element-type list is baked into the database enum and the canvas components. Genuinely hard; not 1.0 material; revisit with real demand. |

### Sequencing (aligned to the approved 1.0 plan)

- **Phase A (now → ~24 Jul, with the evidence increment):** the full schema above lands in one migration alongside ADR 0001's models — schema is cheap, churn is not. `requireApiToken(scope)` + registry service. The DARTER registration and its first token are created by a **seed/ops script** — no UI yet. This is everything the keystone demo needs.
- **Phase B (24 Jul → 14 Aug):** management API routes + minimal settings UI (register plugin, issue/rotate/revoke tokens, see scopes and last-used), the rewritten plugin guide, format-registry seam.

## Consequences

**Positive**
- One build, two payoffs: the machine-auth + registry + contract *is* the plugin system's core, and the DARTER evidence pipeline is its first working plugin — no speculative plugin-loader built on guesses about future needs.
- Authorisation reuses the battle-tested per-case permission model; the new security surface is authentication only (hashing, timing-safe compare, throttling — all with existing in-repo precedents).
- The platform's open-source story gets a real extension answer at 1.0 without runtime code-loading risk.

**Negative / costs**
- External-only plugins mean no UI extensions and no custom element types in 1.0 — the two most-requested "plugin" imaginings on the vision page. The vision page rewrite must say so plainly.
- Every plugin needs its own hosting; the barrier to entry is "run a service", not "drop in a file". Acceptable for 1.0's actual consumers (pipelines, checkers), revisit if demand says otherwise.
- Token lifecycle (rotation, expiry hygiene) is operational burden on plugin owners; mitigated by `lastUsedAt` visibility and revocation-by-registration.

**Deferred (named, not silently dropped)**
- Element-type plugins (schema + canvas baked; needs its own design cycle).
- Case-data interchange formats (GSN XML, SACM, SCSC) — no existing seam; a fresh design cycle post-1.0 (see §5 format row).
- In-process or sandboxed (WASM/worker) plugin execution.
- Webhooks / event subscriptions pushed *to* plugins (1.0 plugins poll or act on their own schedule; the SSE stream exists for browsers but is not part of the machine contract yet).
- A plugin marketplace/directory; multi-tenant token quotas.

## Alternatives considered

- **In-process plugin loader (npm packages, dynamic import).** Rejected for 1.0: arbitrary third-party code inside the trusted process, no isolation, and a speculative extension API designed before any real consumer exists — except one, DARTER, which is external by nature.
- **Sandboxed execution (WASM / worker threads).** The credible long-term in-process answer, but a research-grade effort; nothing in 1.0 scope needs it.
- **Webhook-only integration (platform pushes, plugins receive).** Inverts the wrong way for the first consumer: DARTER *produces* evidence on its own cadence and must write in; it does not wait to be called.
- **A separate machine ACL table (per-token case lists).** Rejected: duplicates the existing permission model, guaranteeing drift between human and machine authorisation. Granting the system user case permissions keeps one model.
- **Ship the evidence endpoint with ad-hoc auth, design plugins later.** Rejected: the marginal cost of the registry over a bare token table is one model + one service, and skipping it now means re-cutting the auth surface within weeks.

## Work breakdown

Sequenced; items 1–3 are Phase A (shared foundation with ADR 0001 — its item 3 *is* item 2 here), 4–6 are Phase B:

1. Schema: `PluginRegistration` + `ApiToken` + `PluginStatus` enum (incl. `User` back-relations; `formatVersion` column on `RuntimeEvidence` so stored records carry the spec version they were captured under), one migration with ADR 0001's models — *foundational*
2. Machine auth: `requireApiToken(scope)` + hashing/timing-safe/throttle/audit wiring + **`middleware.ts` matcher exemption for machine endpoints** + registry service (`ServiceResult`, service-layer-only Prisma) — *foundational, security; = ADR 0001 item 3*
3. Seed/ops script: register the DARTER plugin, grant its system user case permissions, issue its token — **plus the `getOrCreateSystemUser` singleton fix (§3), which must land before any plugin system user exists** — *unblocks the keystone demo*
4. Management API routes + minimal settings UI (register / tokens / revoke / last-used) — *Phase B*
5. Plugin guide: rewrite `plugin-ecosystem.mdx` from vision to contract; OpenAPI annotations on machine endpoints — *Phase B*
6. Document-export contribution seam: keep `ExporterRegistry` as the single registration point; derive `ExportFormat` from it (one source of truth); document it as the format-contribution path — *Phase B, small; case-interchange formats deferred per §5*
