# ADR 0003 — Publishing and Discover: publication metadata on the case, one flow, frozen snapshots

- **Status:** **Accepted** (Chris Burr, 2026-07-14 — design session of the same day; two PI amendments folded in before acceptance: case information editable any time via a dedicated pane with publish as validate-and-confirm, and the concrete UI decision — title sheet + repurposed ⓘ toolbar button, Resources content moving to a ? Help modal)
- **Date:** 2026-07-14
- **Author:** cid (agent-atelier technical lead), for the TEA v1.0 release
- **Deciders:** Chris Burr (PI), TEA maintainers
- **Related:** ADR 0002 (plugin architecture — the snapshot `pluginData` capture rule this ADR's snapshots inherit), the 2026-07-14 staging review findings (publish pipeline not wired end-to-end; public API behind the login wall; attached cases never displayed; numeric Discover ids)

---

## Context

The 2026-07-14 staging review established that an assurance case cannot currently be
published through the product at all. The intended pipeline existed as four separately
built, individually tested stages — a "mark as ready" status transition, a publish
endpoint, a case-study linking function, and a public Discover page — with **no stage
wired to the next**: the publish endpoint's only UI caller is imported nowhere, the
linking function has zero callers, the case-study save path discards case selections,
and the public page drops the attachments it is given. Cases stall at "Ready to
Publish" indefinitely; the content on Discover was seeded directly into the database.

The root design problem predates the wiring gaps. The platform split "the assurance
case" from "the case study that describes it" because published material needs
explanatory context (description, authors, sector) that the case itself did not carry.
In hindsight — the PI's own assessment in the design session — that context should
have been **publication metadata on the assurance case directly**. The separate
entity bought a three-stop publishing journey (mark ready → create/fill a case study →
make public), an ambiguous ownership model, and the wiring surface that never got
built, in exchange for a separation (draft vs public) that the snapshot mechanism
already provided on its own.

Two further requirements shaped the decision: nothing should reach the public page
without explanation (a quality floor for Discover), and the platform should eventually
publish **argument patterns** (reusable templates) alongside assurance cases (worked
examples).

## Decision

### 1. Case information lives on the assurance case — editable any time

The explanatory material currently collected by the case-study form — description,
authors, sector, feature image, and any future curation fields — becomes **case
information on the assurance case itself**, maintained through a dedicated **case
information pane/modal** in the case editor. Users and teams populate it whenever
they like, publish intent or not, under the case's normal edit permissions.

This is deliberately broader than "publication metadata" (PI amendment, 2026-07-14):
case information is a first-class, canonical record that **other services and
plugins can reuse** — publishing is just its first consumer. The separate case-study
entity is retired: no new creation surface, and the model is removed once the
transition (§7) completes.

### 2. One publish flow, in the case editor

**Publish** is a single guided action on the case. It **validates that the required
case information is complete** — if fields are missing, the flow surfaces exactly
those gaps (opening the case information form focused on them) rather than
presenting a from-scratch questionnaire; if everything is already filled in,
publishing is a single confirm. The three-stop journey is deleted. The **"Ready to
Publish" intermediate state is retired** — the case lifecycle is:

```
Draft ──[Publish: validate case info → snapshot]──▶ Published
                                                 │  ▲
                             (live edits diverge)│  │ [Update published version:
                                                 ▼  │  fresh snapshot, atomic]
                                        "unpublished changes"
                                                 │
                                    [Unpublish] ─▶ Draft (public record removed)
```

### 3. Publishing takes a frozen snapshot — never a live view

Publishing copies the case content (structure, arguments, evidence, plugin data per
ADR 0002 §3's capture rule) **and the publication metadata** into a separate published
record. The public page and API serve only that frozen record:

- The working case can change freely without affecting the public version.
- The editor surfaces divergence ("published version is behind") using the existing
  change-detection; **republishing is explicit and atomic** (one action, fresh
  snapshot, no partially updated public state).
- The snapshot freezes metadata as well as content, so a published record is a
  **citable point-in-time artefact** end to end.

This preserves — deliberately and verbatim — the draft/public separation that
motivated the original case-study split. The snapshot was always the mechanism doing
that work; this ADR keeps the mechanism and removes the redundant entity.

### 4. The quality gate is structural: required case information, no approval step (yet)

A case cannot be published while its required case information is incomplete — that
is the admission ticket to Discover. **No human approval step ships now.** The publish status
model must leave room for a future `SUBMITTED`/approval state (a documented extension
point, expected when deployments grow multi-team usage), but no approval UI, workflow,
or notification plumbing is built until then.

### 5. Publishable types are generic by design; cases ship first

The publish flow, metadata gate, Discover page, and public API are designed around a
generic **publishable item** with two concrete types:

| Type | Meaning | Ships |
|---|---|---|
| Assurance case | A specific worked example | **v1.0 (this ADR's implementation)** |
| Argument pattern | A reusable template | Fast-follow issue, no rework expected |

The design artefacts (schema shape, route shape, Discover sections) must accommodate
both from day one; only the case type is implemented now.

### 6. Public addressing and access

- **Slugs, not numeric ids**: published items are addressed by stable, name-derived
  slugs (`/discover/<slug>`), unique per deployment, stable across renames (PI ruling,
  2026-07-14). Sequential integers (`/discover/1`) are retired.
- **The public API is genuinely anonymous**: `/api/public/*` is exempted from session
  auth (dispatched separately, 2026-07-14 — the boundary-anchored middleware matcher
  pattern). A published case is fetchable by anyone with the link; that is the point
  of publishing it.

### 7. Legacy content: unpublish everything

Existing case-study content is unpublished as part of this work (PI ruling,
2026-07-14: one real entry on production `main`, not linked to its case — no
meaningful blast radius). Owners retain full access to their assurance cases and
republish through the new flow when ready. The case-study creation surface is retired
immediately; the model and its tables are removed once nothing references them.

## Consequences

- **The keystone demo (w/c 11 Aug) gains its closing beat**: publish the DARTER case
  live, from the case editor to the public Discover page, in one flow.
- The 2026-07-14 review findings on this surface (invisible attachments, dead publish
  modal, uncalled linking function, numeric ids) are **superseded rather than
  patched** — the display-layer fix issue is folded into this implementation.
- Dead code from the old pipeline (publish-modal, linkPublishedCaseToCaseStudy, the
  case-study form and actions) is deleted per the repo's delete-first policy.
- The fallow dead-code question raised in review (why two dead orphans survived the
  baseline) is answered in passing: the deletions land, and the baseline is refreshed
  on its own commit per the established procedure.
- Anonymous access + slugs make published URLs safe to circulate in partner-facing
  material.

## Out of scope

- Argument-pattern publishing (fast-follow issue; design accommodated, not built).
- Admin approval workflow (documented extension point only).
- Any change to the case-editing experience, permissions model, or team/share
  mechanics — publishing is orthogonal to case access control.
- Cross-deployment/global galleries. "Public" means this deployment's Discover page.

## Implementation shape (indicative, for issue-filing)

1. **Schema**: case-information fields on the case (or a 1:1 record); published
   snapshot gains frozen metadata; slug on the published record; publish status enum
   loses `READY_TO_PUBLISH` (migration maps existing values).
2. **Case information pane**: the existing title-click sheet (`case-details.tsx`,
   on the shared `CaseSheet` component) extends to carry the case information,
   editable under the case's normal edit permissions; exposed so future plugins/
   services can read the canonical record. **Concrete UI (PI decision, 2026-07-14):**
   the toolbar's ⓘ button (currently "Resources") is repurposed as **Case
   Information**, opening this same sheet — two entry points, one component. The
   Resources content moves to a **?** Help button; making that Help modal genuinely
   useful is companion work tracked separately, not part of this ADR's critical
   path. (The onboarding tour references the old button id — update it with the swap.)
3. **Publish flow**: validate-completeness gate over the case information (missing
   fields surfaced in place); publish / update published / unpublish actions wired
   to the existing (currently orphaned) service functions.
4. **Discover**: renders published items from their own frozen metadata; slug routes;
   generic item shape ready for patterns.
5. **Removal**: case-study form, actions, model, dead pipeline code; legacy content
   unpublished; e2e count fixtures updated (the four-place count-pinning trap noted
   2026-07-07 applies).
6. **End-to-end acceptance test as a user journey**: draft → fill case information
   (pane) → publish (validate + confirm) →
   anonymous visitor loads `/discover/<slug>` and fetches the snapshot JSON → edit
   case → divergence indicator → republish → public version updates atomically →
   unpublish → gone.
