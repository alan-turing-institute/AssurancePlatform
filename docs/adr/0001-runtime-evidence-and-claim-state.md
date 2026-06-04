# ADR 0001 — Runtime evidence ingestion and claim-state

- **Status:** Proposed
- **Date:** 2026-06-03
- **Author:** cid (agent-atelier technical lead), for the DARTER / TEA v1.0 work
- **Deciders:** Chris Burr (PI), Steffen Zschaler (Co-I), TEA maintainers
- **Related:** DARTER roadmap (`obsidian/research/Drafts/darter-roadmap.md`), DARTER technical development plan, Burden of Proof post "Inside the build: AI Assurance as Code" (2026-06-03)
- **Implements:** beads epic `AssurancePlatform-<evidence-epic>` (see "Work breakdown" below)

---

## Context

The TEA Platform stores an assurance case as a graph of `AssuranceElement` nodes (`GOAL → STRATEGY → PROPERTY_CLAIM`, with `EVIDENCE` linked to claims via `EvidenceLink`). Today, two capabilities are missing — and they are exactly what turns a static assurance case into a *living* one:

1. **There is no machine-writable path to add evidence.** Evidence is an `AssuranceElement` of type `EVIDENCE` carrying `urls[]`, attached by a human through the UI. A runtime check (a monitor, a pipeline) cannot deposit evidence against a claim.
2. **There is no field that records whether a claim is currently holding.** The schema has no claim-state, no pass/fail, no confidence value, and no notion of how *fresh* the supporting evidence is. There is nowhere to put the sentence "this claim is, as of now, true (and we checked recently)."

DARTER — which builds a continuous-assurance pipeline and a domain-boundary monitor over the Bluebird digital twin — needs both. Its evidence must flow automatically from runtime checks into the assurance case and move a claim's state as the evidence beneath it changes. This is the "executable assurance case" in concrete form, and it is the first dependency of DARTER's S0/S1 (July/August 2026). It is also a genuine TEA v1.0 capability increment, so we build it **once, in TEA main, upstreamable** — not as a DARTER fork.

This ADR is deliberately opinionated so it can be argued with. It commits to a *working* model, not a final one: how a claim should carry its truth, and how defeat should cascade through a DAG of claims, are open problems in both epistemology and computer science. We are not solving them here — we are building the smallest honest mechanism that lets runtime evidence move a claim's state, and leaving the hard parts explicitly replaceable.

---

## Decision

We add four things to TEA, plus a documented evidence format. Each is a separate, sequenced piece of work (see "Work breakdown").

### 1. Claim-state on `AssuranceElement` — **two orthogonal axes, not one scale**

The single most important design decision, and the one the BoP post flagged as least-precedented: **health and timeliness are separate axes.** "Stale" is *not* a fourth rung between amber and red. A claim can be green-but-stale. Red means "we have evidence the claim fails" (positive disconfirmation); stale means "we no longer know whether it holds" (the evidence stopped arriving). The operator response differs — red → investigate/halt; stale → re-gather / re-run the check — so the data model must keep them distinct.

New fields on `AssuranceElement` (applicable to `PROPERTY_CLAIM`, optionally `GOAL`):

| Field | Type | Meaning |
|---|---|---|
| `confidenceState` | `ClaimConfidenceState?` (enum: `GREEN`/`AMBER`/`RED`) | **Health axis.** Driven by what the evidence says. The user-facing RAG badge. |
| `confidenceScore` | `Float?` | The **continuous score behind the enum** (0.0–1.0). The RAG bands are thresholds on this; the badge is a presentation layer over a quantitative value. |
| `lastEvaluatedAt` | `DateTime?` | When runtime evidence last touched this claim. |
| `validityWindowSeconds` | `Int?` | **Per-claim** freshness window — how long evidence stays "fresh" for *this* claim. Deliberately per-claim: a proof-backed claim may never need re-checking; an empirically-validated one may need near-continuous confirmation. |

**Timeliness (current/stale) is derived, not stored as a third state:** a claim is *stale* when `now − lastEvaluatedAt > validityWindowSeconds`. Computed on read and materialised by a sweeper (see §4) for query/visualisation. Keeping it derived enforces the orthogonality: freshness is a function of *time since last evidence*, never conflated with the health verdict.

Follow the existing schema conventions: `@map` snake_case columns, a new `ClaimConfidenceState` enum alongside the others, nullable (only claims carry state).

### 2. `RuntimeEvidence` — an append-only, provenance-stamped evidence log

The human `EVIDENCE` element + `EvidenceLink` stay as they are (argument-structure nodes, mutable, human-authored). Runtime evidence is a *different shape*: a stream of timestamped, machine-produced records that bear on a claim. New model:

```
model RuntimeEvidence {
  id              String   @id @default(uuid())
  claimId         String   @map("claim_id")        // the AssuranceElement (PROPERTY_CLAIM) it bears on
  // What the check found
  metricName      String   @map("metric_name")     // e.g. "in-distribution-rate"
  value           Float?                            // measured value
  threshold       Float?                            // threshold compared against
  verdict         EvidenceVerdict                   // PASS | FAIL | DEGRADED
  oddDimensions   String[] @default([]) @map("odd_dimensions") // which ODD dimension(s) this touches
  // Provenance (regulator-grade, first-class)
  sourceSystem    String   @map("source_system")   // e.g. "darter-pipeline"
  provenance      Json                              // which check, DT state/version, pipeline run id
  evaluatedAt     DateTime @map("evaluated_at")     // when the check ran (not when we stored it)
  // Tamper-evidence (append-only hash chain, per claim)
  recordHash      String   @map("record_hash")
  previousRecordHash String? @map("previous_record_hash")
  // Audit
  createdById     String   @map("created_by_id")   // the machine principal (a system User)
  createdAt       DateTime @default(now()) @map("created_at")
  claim           AssuranceElement @relation(fields: [claimId], references: [id], onDelete: Cascade)
  @@index([claimId, evaluatedAt])
  @@map("runtime_evidence")
}
enum EvidenceVerdict { PASS  FAIL  DEGRADED }
```

**Append-only is a hard rule**, enforced at the service layer (no update/delete paths) and reinforced by the hash chain: each record stores `recordHash = hash(content + previousRecordHash)`, so any tampering with history is detectable. This satisfies the regulator-grade provenance requirement: evidence is tamper-evident, timestamped, and traceable to the check that produced it.

### 3. Machine authentication — scoped API tokens

`requireAuthSession()` is human/NextAuth only. Machine writers (the DARTER pipeline, the monitor) authenticate with a **scoped, hashed API token** bound to a **system `User`** (the schema already has `isSystemUser` for exactly this). New `ApiToken` model (hashed secret, owning system user, scopes e.g. `evidence:write`, optional expiry, `lastUsedAt`), plus a `requireApiToken(scope)` helper mirroring `requireAuthSession`. Reuse the existing `RateLimitAttempt` / `SecurityAuditLog` patterns for throttling and audit of machine writes.

### 4. Endpoints, scoring, staleness, snapshot

- **`POST /api/elements/[id]/evidence`** — authenticated by API token (`evidence:write`). Validates a Zod body, **appends** one `RuntimeEvidence` record (computing the hash chain), recomputes the claim's `confidenceScore` / `confidenceState` / `lastEvaluatedAt`, and emits an SSE event (`claim:state-changed`, mirroring the existing `emitSSEEvent` pattern) so a dashboard box flips green→amber live. Returns the updated claim state. This is the keystone — DARTER's "Interface C".
- **`GET /api/elements/[id]/evidence`** — returns the append-only log for a claim (audit/trace view).
- **Confidence scoring (v1, deliberately simple and documented):** a service maps recent `RuntimeEvidence` for a claim → `confidenceScore` → `confidenceState` via **configurable thresholds**. v1 rule: *worst verdict within the validity window* (FAIL→RED, DEGRADED→AMBER, all PASS→GREEN), with the continuous score as the proportion of passing checks in the window. **Defeat cascade through the DAG is explicitly out of scope for v1** — flagged as the known hard problem; v1 sets only the directly-evidenced claim's state. This is the "working model, not a final one."
- **Staleness sweeper:** a job under the existing `app/api/cron` route marks claims stale (`now − lastEvaluatedAt > validityWindowSeconds`) and emits SSE, so green-but-stale surfaces without waiting for the next read.
- **Snapshot integration:** include `confidenceState` / `confidenceScore` / `lastEvaluatedAt` in the `ReleaseSnapshot` JSON `content`, so a snapshot is a citable point-in-time record of the whole argument's state ("here is exactly what the assurance argument looked like at 14:32"). The `Release`/`ReleaseSnapshot` model is the natural audit anchor.

### 5. Evidence format v0.1 (the shared contract)

The JSON body the `POST` endpoint accepts **is** DARTER's canonical "evidence item" (Interface B) — documented as a versioned schema in the repo. This is the artefact DARTER's June/July warm-start emits and everything downstream consumes. Owned by cid; frozen as v0.1 for S0.

---

## Consequences

**Positive**
- DARTER gets its core dependency (machine-writable evidence + claim-state) as a TEA-native, upstreamable capability — the work counts once for both TEA v1.0 and DARTER.
- The green-but-stale distinction is represented honestly, which is the contribution the BoP post stakes out and the thing a single RAG number cannot express.
- Provenance is tamper-evident and snapshot-anchored — regulator-credible by construction.
- Human evidence (`EVIDENCE` + `EvidenceLink`) is untouched; this is additive, low blast-radius.

**Negative / costs**
- A Prisma migration adds fields + two models + an enum — coordinate with the open Phase 5 testing work and the blocked `qzl` type-modernisation so they don't collide.
- API-token auth is new security surface; must get hashing, scoping, and rate-limiting right (reuse existing audit/rate-limit patterns).
- The v1 scoring rule and the absence of defeat-cascade are known simplifications; consumers must not over-read a GREEN as a whole-subtree guarantee. Documented as such.

**Deferred (named, not silently dropped)**
- Defeat propagation through the claim DAG (how the defeat of one claim cascades). Genuinely hard; needs Steffen + the DTNet+ workshop (Nov 2026).
- A formal account of how far evidence warrants a claim (Assurance 2.0-style). v1 thresholds are a stand-in.
- Per-claim validity-window *policy* (who sets the window, on what principled basis) — context-dependent; out of scope for the mechanism.

---

## Alternatives considered

- **Reuse `EVIDENCE` elements + `EvidenceLink` for runtime evidence.** Rejected: they are mutable argument nodes, not an append-only time-series; overloading them would conflate the argument's structure with its runtime evidence stream and break tamper-evidence.
- **A single 4-value enum `GREEN/AMBER/RED/STALE`.** Rejected: it collapses two orthogonal axes and makes green-but-stale inexpressible — the precise failure the BoP post identifies.
- **Store staleness as a third persisted state.** Rejected: derive it from `lastEvaluatedAt + validityWindowSeconds` to keep timeliness strictly a function of time-since-evidence, never mixed with the health verdict (materialise only as a cache).
- **DARTER-side fork of TEA.** Rejected per the roadmap's "upstream, don't fork" principle — a permanent merge burden and a weaker open-source story.

---

## Work breakdown (beads epic)

Sequenced so the keystone demo (one evidence POST flips one claim's badge) lands fast, then hardens:

1. Schema: claim-state + freshness fields on `AssuranceElement` (+ `ClaimConfidenceState` enum) — *foundational*
2. Schema: `RuntimeEvidence` append-only model + hash chain (+ `EvidenceVerdict` enum) — *foundational*
3. Machine auth: `ApiToken` model + `requireApiToken(scope)` helper — *foundational, security*
4. `POST /api/elements/[id]/evidence` — append + recompute state + SSE — *keystone; deps 1,2,3*
5. `GET /api/elements/[id]/evidence` — audit/trace read — *deps 2*
6. Confidence scoring + thresholds (v1 working model; no cascade) — *deps 1,2*
7. Staleness derivation + cron sweeper — *deps 1*
8. Snapshot integration (claim-state in `ReleaseSnapshot`) — *deps 1*
9. Evidence format v0.1 spec doc (cid) — *the shared contract*

Front-load 1–4 (the DARTER S0/S1 dependency, target ~mid-June); 5–8 harden through the v1.0 window; 9 in parallel.
