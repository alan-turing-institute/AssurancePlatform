# ADR 0002 — Plugin architecture: extensible core, official plugins first

- **Status:** Proposed (v2 — rewritten 2026-07-03 after the design session with Chris; v1's external-API-only framing is superseded and preserved in this branch's history)
- **Date:** 2026-07-03
- **Author:** cid (agent-atelier technical lead), for the TEA v1.0 release
- **Deciders:** Chris Burr (PI), TEA maintainers
- **Related:** ADR 0001 (runtime evidence & claim-state — see "Relationship to ADR 0001" below), evidence format v0.1 (`docs/specs/evidence-format-v0.1.md`), the plugin-ecosystem vision page, DARTER technical development plan (Interfaces B & C, milestone M1 — *design* frozen July 2026)

---

## Context

The design session of 2026-07-03 settled the question v1 of this ADR answered too narrowly. The target model for TEA's extensibility is **Obsidian's**: a lean core that is fully usable on its own, a set of **official plugins** that ship with the platform and can be toggled on and off, and — as a later destination — a **community marketplace** where third parties submit plugins for review.

Three consequences drove the rewrite:

1. **Claim/evidence health is a plugin, not core.** v1 of this ADR (and ADR 0001 before it) put claim-state fields on the core `AssuranceElement` schema. Under the adopted model, a user who installs nothing gets the base case builder and stores **no** health data at all. Platform-wide schema changes to serve one extension were exactly the overfit Chris flagged.
2. **The plugin system must serve more than one shape of plugin.** Three official plugins are already named: **claim/evidence health** (1.0), **TEA techniques integration** and **GSN-style UI** (1.1). A surface designed against three known consumers is generic by construction.
3. **Release staging is decided:** **1.0** = plugin system + health plugin · **1.1** = techniques + GSN-UI plugins · **later** = the community ecosystem (review pipeline, sandboxing, API stability guarantees). 1.0 ships official plugins only — first-party code, so no sandboxing problem — under the discipline that official plugins use *only* the public extension surfaces. We prove the surfaces on ourselves before opening the door.

**What "plugin" means, physically, in 1.0:** an official plugin is a first-party module compiled into the platform, registered in a static manifest, and switchable per assurance case. It is *not* runtime-loaded third-party code (that is the community tier, later) and it is *not* an external process. External processes — like the DARTER pipeline — are **integrations**: machine clients holding scoped API tokens. v1 of this ADR conflated the two; this version separates them. A plugin may *expose* machine endpoints that integrations call — the health plugin does exactly this.

## Decision

### 1. The layer model

| Layer | Contains | Commitment |
|---|---|---|
| **Core** | Case builder, element graph, permissions, auth, snapshots, SSE — plus the four extension surfaces below | Semantically neutral: core knows *that* plugins exist, never *what they mean* |
| **Official plugins** (1.0: health; 1.1: techniques, GSN-UI) | First-party modules on the public surfaces; hierarchically toggleable (organisation → team → user, off wins downward) | May be disabled without loss: their data sits inert, never stripped |
| **Integrations** | External machine clients (DARTER pipeline first) with scoped tokens | Talk to core and plugin machine endpoints; never inside the process |
| **Community plugins** (later) | Third-party code, reviewed, sandboxed | Out of scope for 1.0/1.1 — named, not designed here |

**One-way dependency rule (load-bearing):** plugins depend on core; core never depends on any plugin. No core table references a plugin table; no core module imports from a plugin module. This rule is what keeps the base platform genuinely plugin-free.

### 2. The four extension surfaces

#### 2.1 Extension data — two tiers

**Tier 1 — namespaced generic data.** One core table holds structured JSON per plugin, per case or element:

```
model PluginData {
  id         String   @id @default(uuid())
  pluginId   String   @map("plugin_id")     // the namespace, e.g. "tea.health"
  caseId     String   @map("case_id")       // permission anchor — access rides on canAccessCase
  elementId  String?  @map("element_id")    // null = case-level data
  data       Json
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  @@unique([pluginId, caseId, elementId])
  @@index([caseId, pluginId])
  @@map("plugin_data")
}
```

Namespacing is enforced, not hoped for: a plugin's service can only read/write rows under its own `pluginId`. Permissions anchor on the **case** via the existing `canAccessCase` machinery — no parallel ACL. Disabled or uninstalled plugin → rows sit inert (never rendered, never deleted without an explicit user action).

**Tier 2 — plugin-owned tables**, for official server-side plugins with integrity requirements that JSON cannot honestly carry. Decided in-session to fix one instance now, against technical debt: **the evidence log is a real table from day one** (`plugin_health_evidence` — the append-only, hash-chained design from ADR 0001 §2, unchanged in substance). Rules for all tier-2 tables: name prefixed `plugin_<pluginId>_`, migrations through the normal reviewed pipeline (first-party code needs no new machinery), foreign keys may point **at** core, never the reverse.

Community plugins (later) get tier 1 only; tier 2 is an official-plugin privilege because it rides the reviewed-migration pipeline.

#### 2.2 Plugin lifecycle

- A static **manifest** of official plugins in code: id (`tea.health`), name, version, which surfaces it uses.
- **Availability** is a deployment concern (config/env: which official plugins this instance offers).
- **Enablement is hierarchically scoped, off wins downward** (settled with Chris, 2026-07-03 — per-case toggles were considered and rejected as too fine-grained, the Obsidian per-note trap). The scope chain rides the platform's account model: **organisation → team → user**. A plugin is usable in a context only if *no level above it* has switched it off: organisation off means no team, user, or case beneath can use it; a user may switch a plugin off for themselves even where the organisation/team has it on — never the reverse.
- **1.0 implements** deployment availability + the **user-level** toggle. The schema carries the scope dimension from day one — `PluginState` (pluginId, `scopeType` ORGANISATION | TEAM | USER, scopeId, enabled, settings JSON, unique per plugin+scope) — so the organisation and team tiers activate when the organisation model (not yet built) lands, with no migration.
- **The storage guarantee moves up the hierarchy:** a user-level "off" hides the plugin's UI and API surface *for that user*; data written by other enabled collaborators on a shared case still exists and sits inert for them (Obsidian's exact semantics — plugin off ≠ others' data purged). The strong "nothing stored at all" property attaches to the topmost OFF: deployment or organisation.
- A **settings section** (core UI) lists available plugins with toggle + per-plugin settings, showing the *effective* state and which level pinned it — the analogue of Obsidian's community-plugins pane, official-only for now.

#### 2.3 UI extension points

Build-time slots, registered by official plugins through one registry module (the pattern `lib/export/exporters/` already proves). Sized against the three known plugins:

| Slot | First consumer |
|---|---|
| `element-badge` — small status affordance on a canvas node | Health: the state dot |
| `element-panel` — a tab in the element detail view | Health: the evidence log / trace view |
| `case-panel` — a sidebar section at case level | Techniques (1.1): suggested evidence-generating techniques |
| `canvas-decorator` — notation/re-skin layer over the graph | GSN-UI (1.1) |
| `settings-section` — per-plugin settings within the plugin pane | All |

Slots render nothing when no enabled plugin registers into them; core screens must be complete without any slot filled.

#### 2.4 Machine access (the surviving pillar of v1)

Carried over from v1 with one rename and all feasibility-review findings intact:

- **`Integration`** (was `PluginRegistration` — renamed because these are external machine clients, not in-app plugins) + **`ApiToken`**: human-owned registrations of external systems, hashed tokens (`teap_` prefix, shown once, timing-safe compare), scoped, suspendable; acting through a dedicated system `User`.
- **Scopes** gate verbs; **which cases** an integration touches rides on the existing per-case permission model via its system user (verified against code in the 2026-07-03 feasibility review: `canAccessCase` keys on a bare `userId`, zero session coupling). Scope strings are plugin-namespaced where they gate plugin endpoints (`health:evidence:write`); core scopes stay unprefixed (`case:read`).
- **All machine endpoints live under one path prefix: `/api/machine/…`** — a single `middleware.ts` matcher exemption (the review's R1 blocker: today every unlisted route 307-redirects bearer-token clients to the login page). `requireApiToken(scope)` is enforced in every handler under the prefix; failed attempts throttle by `ip` (the existing `identifierType` union has no token variant) and audit to `SecurityAuditLog`.
- **Required accompanying fix (review R2, privilege escalation):** `getOrCreateSystemUser` selects by bare `isSystemUser: true` and reassigns deleted users' case ownership to whatever it finds; it must select the generic fallback account by stable identifier before any integration system user exists.
- Prisma back-relations declared on both ends; no cascade from `Integration` to `User` — owner deletion is blocked while active integrations exist.

#### 2.5 Events

SSE event types become namespaced when plugin-emitted (`tea.health/state-changed`). The connection manager's closed `SSEEventType` union gains a plugin-event variant; plugins emit only after their write transaction commits.

### 3. The first official plugin: claim/evidence health (1.0)

The health plugin is the proof of every surface, and DARTER's dependency. Its internals adopt ADR 0001's designs, relocated:

- **Storage:** `plugin_health_evidence` (tier 2 — ADR 0001 §2's append-only, provenance-stamped, hash-chained log, plus a `format_version` column) and per-claim state in tier-1 `PluginData` under `tea.health`: `{ score, lastEvaluatedAt, validityWindowSeconds }`.
- **Representation (the question that started all this):** a **continuous score 0.0–1.0** with every vocabulary (traffic lights, binary) as a derived, configurable view — now a *plugin-internal* choice, revisable without touching anyone's core schema. Health ⊥ freshness (green-but-stale) is preserved: staleness derives from `lastEvaluatedAt` + `validityWindowSeconds`.
- **Ingestion:** `POST /api/machine/health/elements/[id]/evidence`, token scope `health:evidence:write`, body = **evidence format v0.1 unchanged** (`docs/specs/evidence-format-v0.1.md` survives verbatim as the plugin's ingestion contract; body `claimId` must equal the path id, 400 on mismatch). Append (hash chain, concurrency-guarded row lock) → score recompute (worst-verdict-in-window v1 rule, thresholds in plugin settings) → `PluginData` update → SSE after commit. `GET` returns the log.
- **UI:** state dot via `element-badge`; evidence log via `element-panel`. Both dark when the plugin is off.
- **Staleness sweeper:** the existing cron-route pattern, marking stale claims and emitting SSE.
- **Snapshots:** `ReleaseSnapshot` content gains a `pluginData` section capturing every plugin namespace **holding data on the case** (capture follows data present, not any viewer's toggle) — a snapshot remains a citable point-in-time record, plugins included, without core understanding any of it.
- **DARTER end-to-end:** pipeline (integration, token) → machine endpoint → health plugin → score + SSE → badge flips live. The keystone demo survives intact, one architectural floor lower.

### 4. Explicitly not in 1.0 (named, not silently dropped)

Community runtime (sandboxing, review pipeline, marketplace, API stability guarantees) · third-party UI code · tier-1 public write API hardening (quotas, per-plugin schema registry — needed only when non-first-party code writes) · element-type plugins (schema-baked; unchanged from v1's deferral) · case-interchange format plugins (GSN XML, SACM, SCSC — no existing seam; own design cycle) · webhooks/event push to integrations.

## Relationship to ADR 0001

ADR 0001 (merged, status Proposed) is **partially superseded**: its §1 claim-state fields on core `AssuranceElement` and its §4 placement of endpoints in the core API do not proceed. Its §2 evidence-log design, §3 machine-auth concept, and §5 evidence format survive intact inside the health plugin and the integration pillar. A supersession banner goes on ADR 0001 in this same PR; it stays in the record as the design the health plugin implements.

## Consequences

**Positive**
- The core stays semantically neutral — the platform-wide-commitment problem that triggered the 2026-07-03 review structurally cannot recur; plugin design mistakes are now local and revisable.
- Three release trains (1.0 / 1.1 / community) each land on surfaces already proven by the previous one; DARTER M1 (July, *design* frozen) is satisfied by this document rather than by rushed code.
- "No plugins = base builder, nothing stored" is a checkable property, per case.

**Negative / costs**
- More design lands before the first line of implementation; the coded keystone demo moves (~2 weeks — see timeline).
- Two storage tiers to explain and police (mitigated: tier 2 is a *rule*, not machinery).
- Core UI must be complete with every slot empty — a real design constraint on 1.0 screens.
- Cases shared to a deployment without a given plugin show inert data affordances (a "plugin data present but plugin unavailable" state needs one honest UI treatment).

**Deferred (named)** — everything in §4, plus: activating the ORGANISATION/TEAM tiers of the scoped-enablement schema (waits on the organisation model; schema is ready), plugin data export/purge tooling (until a real deletion request), defeat-cascade through the claim DAG (unchanged from ADR 0001 — Steffen/DTNet+, Nov 2026).

## Alternatives considered

- **v1 of this ADR (external-API-only "plugins").** Superseded: it answered the integration question and called it the plugin system; it could never yield toggleable in-app capabilities like GSN-UI, and it forced claim health into core schema.
- **Claim-state in core with a migration to plugins post-1.0** (the "hybrid" option at the direction call). Rejected: a data migration against live user cases to fix a known-wrong placement, twice the design work in exchange for ~2 weeks of schedule.
- **Community runtime in 1.0.** Rejected: sandboxing + review + API guarantees is an ecosystem investment; shipping official plugins on public surfaces gets the architecture validated without it.
- **Tier-1-only storage (evidence log in JSON).** Rejected in-session: migrating an append-only, hash-chained, regulator-facing log out of JSONB later is the single worst migration on offer.

## Work breakdown (1.0)

Sequenced; issue mapping in brackets (vault, epic [[TEA 1.0 Release]]):

1. **Extension foundations schema** — `PluginData` + `PluginState` + `Integration` + `ApiToken`, one migration [re-cuts *Plugin auth schema foundation*]
2. **Machine auth + integration registry service** — `requireApiToken`, `/api/machine` middleware exemption, `getOrCreateSystemUser` fix, seed script for the DARTER integration [survives as *Machine auth & plugin registry service*, renamed objects]
3. **Plugin lifecycle core** — manifest, per-case enablement service, settings pane with toggles [new issue]
4. **UI extension slots** — registry + `element-badge` + `element-panel` minimal [new issue, aerith]
5. **Health plugin, server core** — `plugin_health_evidence` + scoring + machine endpoints + SSE [re-cuts *Evidence endpoints & confidence scoring (keystone)*]
6. **Health plugin, hardening** — staleness sweeper + snapshot `pluginData` capture [re-cuts *Staleness sweeper & snapshot integration*]
7. **Integration management API + settings UI** [survives as *Plugin management API & settings UI*]
8. **Plugin guide + contract docs** — the vision page rewritten against THIS model [survives as *Plugin guide & contract docs*]
9. *(flex)* Document-export registry seam [unchanged]

## Timeline proposal (for the reconvene)

- **Now (July):** this ADR approved → DARTER M1's "TEA extension design" frozen — the milestone the July date actually names.
- **w/c 7 Jul → early Aug:** items 1–4 (barret + aerith), cid reviewing around BAE commitments (partial until 23 Jul).
- **Keystone demo w/c 11 Aug** (was ~24 Jul): one evidence POST from a token-authenticated integration flips a claim badge on staging — now demonstrating the *whole architecture*, not a special-cased path.
- **v1.0 tag Thursday 4 September** (was 21 Aug — the decision package's named conservative date, now the honest one). 1.1 (techniques + GSN-UI) is scoped after 1.0 ships.
