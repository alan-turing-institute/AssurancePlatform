# Health plugin — accepted limitations (1.0)

- **Status:** Accepted for the 1.0 release
- **Date:** 2026-07-13
- **Related:** ADR 0002 (plugin architecture), the technical guide's health plugin page (evidence format 1.1)

The claim/evidence health plugin ships in 1.0 with eight known limitations,
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

## 4. The evidence log has no retention rule

Every accepted evidence record is kept for as long as its case exists. A
check that reports once a minute adds about 1,440 records to its claim each
day, and a record can carry several kilobytes (its member list, provenance
and payload), so a busy claim's log grows without limit. Nothing archives,
thins or deletes records other than the case purge described in limitation
1. Reads are paged, so a long log does not slow the evidence tab, but the
storage it occupies keeps growing.

This is acceptable while a small number of claims receive evidence from one
pipeline and the deployment's database is sized for it.

**Revisit trigger:** the evidence table's size becoming a storage or backup
concern, or any deployment where claims receive evidence at a high rate for
months at a time.

## 5. The echo shows a pipeline that is behind, not one that misreports

A result carries a copy of the settings' version labels, and TEA compares
that copy with the accepted settings when the result arrives. The comparison
catches a pipeline that has not yet picked up an edit. It cannot catch a
pipeline that copies the declared labels while judging by other rules, because
the labels are the pipeline's own statement about what it did. Likewise, a
pipeline can keep the "read at" time of settings fresh by fetching them
without using them, so the read time is never described as use.

**Revisit trigger:** a requirement that the judging itself, not the pipeline's
account of it, is verified, for example by re-deriving a verdict from the
reported value.

## 6. The echo columns are outside the hash chain

The comparison stored with a result (`echo_state`, `echo_differences` and
`criteria_revision`) is set by the server and is not part of what a record's
hash covers, like its expiry time. A change to those columns is not detected
by the chain. They describe how the record compared with the settings of the
moment, not the evidence itself, so the chain protects the record and who
stored it, and nothing else.

**Revisit trigger:** any use of the comparison as evidence in its own right,
rather than as a signal that a pipeline is behind.

## 7. Deleting a claim removes its settings history with it

A claim's settings and their history are removed when the claim is deleted
for good, as its evidence is, by the same cascade. Within a living claim the
history is append-only and settings are never deleted, only made inactive.
After a claim, or a case, is purged, nothing remains to show what settings
were declared for it.

**Revisit trigger:** the same trigger as limitation 1: a deployment where the
record of what was declared must outlive the case.

## 8. A status shows the settings declared for a claim to every pipeline that can view the case

A claim's status belongs to the claim, not to a pipeline.
A pipeline that can view a case can therefore read, through the status routes, the version labels and check settings declared for a claim whose settings were set up for another pipeline on the same case.
The criteria routes return only the settings whose check came from the calling pipeline's own list.
The status routes are not filtered in that way.
The same token can already read the claim's evidence records, which carry the same labels and check settings.

**Revisit trigger:** a case where two pipelines run for different parties and the settings declared for one must not be visible to the other.
