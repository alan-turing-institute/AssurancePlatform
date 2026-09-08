# Health plugin — accepted limitations (1.0)

- **Status:** Accepted for the 1.0 release
- **Date:** 2026-07-13
- **Related:** ADR 0002 (plugin architecture), evidence format v0.1 (`docs/specs/evidence-format-v0.1.md`)

The claim/evidence health plugin ships in 1.0 with four known limitations,
each accepted deliberately rather than silently carried forward. Each entry
below states the limitation and the concrete trigger that would make it
worth revisiting — none of them are blockers for the 1.0 release.

## 1. Evidence retention on case purge

Permanently deleting a case (emptying it from trash) cascades through to the
health evidence log for every claim in that case: the evidence records are
deleted along with everything else. This is a deliberate foreign-key
relationship, not an oversight, and is covered by an automated test that
would fail if the cascade behaviour ever changed unintentionally.

For an internal or evaluation deployment this is the expected and desired
behaviour — when a case is gone, it's gone. It becomes a limitation only in
a context where the evidence log is expected to outlive the case it was
recorded against (for example, a regulator wanting proof that evidence once
existed even after the underlying case has been deleted).

**Revisit trigger:** any deployment intended for regulator-facing use, where
evidence retention independent of case lifecycle is a requirement.

## 2. A timing difference between "no access" and "doesn't exist"

Reading a claim's health state runs slightly different work depending on
whether the claim doesn't exist at all versus whether it exists but the
requester doesn't have permission to see it. Both cases return the exact
same error message, so nothing is disclosed through the response content —
but the two paths take a measurably different amount of time to run, which
is in principle a side channel an attacker could use to learn whether a
given claim ID exists, independent of what the response says.

This is a common and generally low-risk shape for this kind of check, and
not something we've treated as a priority to close in 1.0.

**Revisit trigger:** any deployment with a threat model that specifically
requires every claim-lookup response to take a uniform amount of time
regardless of outcome (typically a regulator-facing or high-assurance
deployment).

## 3. One live connection per claim shown on a canvas

Each claim's health indicator on the case canvas keeps its own live update
connection open, rather than sharing one connection per case. This is simple
and works well for the case sizes seen so far, but means the number of open
connections for a case scales with the number of claims on screen at once,
not just with the number of people viewing it.

**Revisit trigger:** case canvases large enough (in claim count) that this
becomes a real resource concern, or findings from planned verification work
on this behaviour.

**Update, 2026-07-13:** HTTP/2 has been verified enabled on both staging and
production, so these per-claim connections multiplex over a single
underlying connection rather than each opening its own. This softens the
concern considerably — the trigger above still applies for very large
canvases, but it is no longer a near-term one.

## 4. No settings-management path for automated integrations

The scoring thresholds and validity window used to compute a claim's health
score are read per human user (each user can have their own settings), but
there's no equivalent settings entry point for an automated system acting on
its own account — such an integration always gets the platform defaults,
with no way to configure them for itself.

This is a non-issue while only one external pipeline (DARTER) is producing
evidence, since its evaluating account can simply use the defaults.

**Revisit trigger:** a second automated integration begins sharing a case's
evidence and needs its own distinct scoring configuration.
