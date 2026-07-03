# Evidence format v0.1 — the runtime evidence item

- **Status:** Frozen for DARTER S0 (v0.1)
- **Date:** 2026-07-03
- **Owner:** cid (agent-atelier technical lead)
- **Defined by:** ADR 0001 §2/§5 (runtime evidence & claim-state); DARTER Interface B
- **Consumed by:** `POST /api/elements/[id]/evidence` (TEA), the DARTER pipeline and monitor, anything downstream that reads the evidence log

This document is the canonical definition of **one piece of runtime evidence**. Everything upstream produces it; everything downstream consumes it. Changes bump `formatVersion`; v0.1 is frozen — additive change goes to v0.2, breaking change to v1.0.

## The item

```json
{
  "formatVersion": "0.1",
  "claimId": "9f3c1a2e-5b7d-4c8a-9e1f-2a3b4c5d6e7f",
  "metricName": "in-distribution-rate",
  "value": 0.982,
  "threshold": 0.95,
  "verdict": "PASS",
  "oddDimensions": ["traffic-density", "aircraft-type-mix"],
  "sourceSystem": "darter-pipeline",
  "provenance": {
    "check": "ood-monitor/kl-divergence",
    "checkVersion": "1.4.2",
    "twinVersion": "bluebird-atc-2.1.0",
    "scenarioId": "replay-2026-06-30-heathrow-07",
    "runId": "gh-run-9241775533"
  },
  "evaluatedAt": "2026-07-03T09:41:07Z"
}
```

## Fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `formatVersion` | string, literal `"0.1"` | yes | The version of this spec the item conforms to. **Stored on the record** (`RuntimeEvidence.formatVersion`) so every stored item can later prove which spec version governed its capture. |
| `claimId` | string (uuid) | yes | The `PROPERTY_CLAIM` element this evidence bears on. When POSTed to `/api/elements/[id]/evidence`, it MUST equal the path id — mismatch is a 400, never a silent re-target. (Route-layer equality check: path param and body are parsed separately; this is not expressible in the body schema alone.) |
| `metricName` | string, 1–200 chars | yes | What was measured, namespaced by convention (`kebab-case`, e.g. `in-distribution-rate`). |
| `value` | number | no | The measured value. Omit for checks with no scalar result (e.g. a structural assertion). |
| `threshold` | number | no | The threshold the value was compared against, if any. |
| `verdict` | `"PASS"` \| `"FAIL"` \| `"DEGRADED"` | yes | What the check concluded. This — not `value` — drives claim-state. |
| `oddDimensions` | string[] | no (default `[]`) | Which dimension(s) of the operational design domain (the conditions the system was validated for) this evidence touches. Free strings in v0.1; a controlled vocabulary is a DARTER Interface D concern. |
| `sourceSystem` | string, 1–100 chars | yes | The producing system, stable per deployment (e.g. `darter-pipeline`, `darter-monitor`). |
| `provenance` | object | yes | Which check produced this, against what. Regulator-grade traceability — see below. |
| `evaluatedAt` | string, ISO 8601 UTC | yes | When the **check ran** — not when the item was stored. Staleness derives from this. |

### `provenance` — required keys

v0.1 requires at least `check` (which check, string) and `runId` (an identifier that lets a human find the producing run). `checkVersion`, `twinVersion`, `scenarioId`, and further keys are recommended and preserved verbatim. The object is stored as-is (JSON column) — provenance is never lossy.

### What the producer does NOT send

Set server-side, never accepted from the wire: the tamper-evidence hash chain (`recordHash`, `previousRecordHash`), the storing timestamp (`createdAt`), and the recording principal (`createdById`, from the API token). A producer cannot write history or identity.

## Validation & semantics

- Enforced at the endpoint by a zod schema (`lib/schemas/`, per house rules); unknown top-level fields are **rejected** (fail-loud beats silent drift), unknown `provenance` keys are **kept**.
- `verdict` is authoritative for claim-state; `value`/`threshold` are evidential colour. A producer that computes verdicts differently than `value >= threshold` is free to — the platform does not re-derive verdicts.
- Items are **append-only**: there is no update or delete, and re-sending is a new item, not a correction. Producers correct the record by appending.
- One item bears on **one claim**. A check spanning several claims emits several items.

## Deferred to a later version (named)

- **Predictive distributions** (DARTER open question §6.3): v0.1 carries point `value` only. v0.2 is expected to add an optional `distribution` object (type + parameters or samples) so probabilistic predictors degrade gracefully to `value` — additive, non-breaking.
- Batch submission (array body); v0.1 is one item per request.
- A controlled `oddDimensions` vocabulary (belongs to envelope declaration, Interface D).
