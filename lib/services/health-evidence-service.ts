import { createHash } from "node:crypto";
import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { EVIDENCE_FORMAT_VERSION } from "@/lib/schemas/health-evidence";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import type { PluginHealthEvidence } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * The health plugin's append-only evidence log (ADR 0001 §2, relocated by
 * ADR 0002 v2 §3 — `plugin_health_evidence`). This module is the ONLY code
 * path allowed to write to that table, and it exposes exactly two
 * operations that touch the table: `appendHealthEvidence` and
 * `listHealthEvidence` (plus the pure, side-effect-free hash helpers
 * `canonicalJSON`/`computeRecordHash`, exported for hash-chain
 * verification). There is no update or delete function anywhere in this
 * file — append-only is a structural property of the service surface, not a
 * convention a caller could violate, and
 * `src/__tests__/integration/health-evidence-service.test.ts` asserts the
 * module's exports directly to prove it.
 *
 * Concurrency: two writers racing to append evidence for the SAME claim
 * could both read the same "current tip" and both compute a
 * `previousRecordHash` pointing at it — forking the chain. This is
 * prevented by locking the claim's own `AssuranceElement` row
 * (`SELECT ... FOR UPDATE`) for the duration of the read-tip + insert
 * critical section, inside one Prisma interactive transaction. The claim
 * row always exists (evidence cannot be posted against a nonexistent
 * claim), so this works identically for a claim's first evidence item and
 * its hundredth — unlike locking the latest evidence row, which has
 * nothing to lock before the first item exists. Writers for DIFFERENT
 * claims lock different rows and never block each other.
 */

const PLUGIN_ID = "tea.health";

export interface HealthEvidenceInput {
	claimId: string;
	evaluatedAt: string;
	metricName: string;
	oddDimensions: string[];
	provenance: Record<string, unknown>;
	sourceSystem: string;
	threshold?: number;
	value?: number;
	verdict: "PASS" | "FAIL" | "DEGRADED";
}

/**
 * A single generic message for every reason a claim reference could fail —
 * doesn't exist, is soft-deleted, isn't a PROPERTY_CLAIM, or the caller
 * lacks case access. Mirrors `element-service.ts`'s `updateElement`
 * precedent and `plugin-data-service.ts`'s `validateElementBelongsToCase`:
 * distinguishing these would let a caller with access to ANY case probe
 * arbitrary ids and learn, from the message, whether something exists
 * elsewhere on the platform.
 */
const CLAIM_NOT_FOUND = "Claim not found";

interface ResolvedClaim {
	caseId: string;
}

/**
 * Resolves `claimId` to its `caseId`, or the generic not-found message if
 * the claim doesn't exist, is soft-deleted, or isn't a PROPERTY_CLAIM (the
 * only element type evidence-format-v0.1 evidence bears on).
 */
async function resolveClaim(claimId: string): Promise<ResolvedClaim | null> {
	const element = await prisma.assuranceElement.findUnique({
		where: { id: claimId },
		select: { caseId: true, elementType: true, deletedAt: true },
	});
	if (
		!element ||
		element.deletedAt ||
		element.elementType !== "PROPERTY_CLAIM"
	) {
		return null;
	}
	return { caseId: element.caseId };
}

/**
 * Shared guard for both operations below: plugin enablement (for the
 * acting principal — human or machine, see the module doc on
 * `health-evidence-service.ts`'s callers for the machine-principal
 * enablement decision) + case permission + claim resolution. Returns the
 * resolved `caseId` on success, or the error to surface otherwise.
 */
async function guardClaimAccess(
	userId: string,
	claimId: string,
	requiredLevel: "VIEW" | "EDIT"
): Promise<{ caseId: string } | { error: string }> {
	const enablement = await assertPluginEnabledForUser(PLUGIN_ID, userId);
	if ("error" in enablement) {
		return { error: enablement.error };
	}

	const claim = await resolveClaim(claimId);
	if (!claim) {
		return { error: CLAIM_NOT_FOUND };
	}

	const hasAccess = await canAccessCase(
		{ userId, caseId: claim.caseId },
		requiredLevel
	);
	if (!hasAccess) {
		return { error: CLAIM_NOT_FOUND };
	}

	return { caseId: claim.caseId };
}

/**
 * Canonical (sorted-key) JSON serialization. Used ONLY for hash-chain
 * content, never for storage or the API response: Postgres's `jsonb` type
 * does not guarantee it will hand back object keys in their original
 * insertion order, so re-deriving `recordHash` from a rehydrated row using
 * plain `JSON.stringify` would be a latent tamper-detection bug — a
 * legitimate, unmodified record could fail its own hash check purely from
 * key reordering. Sorting keys at every level makes the serialization
 * depend only on content, never on any particular storage/transport's
 * ordering behaviour.
 *
 * Exported (alongside `computeRecordHash` below) for two callers outside
 * this file: the future hardening sweeper that periodically re-verifies the
 * whole chain, and this module's own integration tests, which recompute a
 * record's hash from the columns Prisma hands back and assert it against
 * the stored `recordHash` — the only way to actually prove a round trip.
 */
export function canonicalJSON(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJSON(item)).join(",")}]`;
	}
	const entries = Object.keys(value as Record<string, unknown>)
		.sort()
		.map(
			(key) =>
				`${JSON.stringify(key)}:${canonicalJSON((value as Record<string, unknown>)[key])}`
		);
	return `{${entries.join(",")}}`;
}

interface EvidenceHashContent {
	claimId: string;
	createdAt: string;
	createdById: string;
	evaluatedAt: string;
	formatVersion: string;
	metricName: string;
	oddDimensions: string[];
	provenance: Record<string, unknown>;
	sourceSystem: string;
	threshold: number | null;
	value: number | null;
	verdict: string;
}

/**
 * `recordHash = hash(content + previousRecordHash)` (ADR 0001 §2). A NUL
 * separator sits between the previous hash and the canonical content string
 * so that no ambiguous concatenation (e.g. previousHash `"ab"` + content
 * `"c"` vs. previousHash `"a"` + content `"bc"`) can ever produce the same
 * bytes fed to the digest. That guarantee depends on this being the ONLY NUL
 * byte in the assembled payload — `canonicalJSON` always serializes string
 * values through `JSON.stringify`, which escapes an embedded NUL character
 * as a six-character JSON escape sequence, never as a raw byte, so a
 * producer cannot smuggle in a second raw separator byte via, say, a
 * `provenance` string.
 */
export function computeRecordHash(
	content: EvidenceHashContent,
	previousRecordHash: string | null
): string {
	const payload = `${previousRecordHash ?? ""}\u0000${canonicalJSON(content)}`;
	return createHash("sha256").update(payload).digest("hex");
}

export interface AppendedHealthEvidence {
	caseId: string;
	evidence: PluginHealthEvidence;
}

/**
 * Appends one evidence-format-v0.1 item to `claimId`'s log, computing the
 * next hash-chain link under a claim-row lock (see module doc). Requires
 * EDIT-level case access for `actingUserId` (a write, same bar as
 * `writePluginData`). Returns the persisted record plus the claim's
 * `caseId` — the route layer needs it to recompute the score and to
 * address the SSE broadcast (which is by case), and resolving it here
 * avoids a second round-trip to look it up again.
 */
export async function appendHealthEvidence(
	actingUserId: string,
	input: HealthEvidenceInput
): ServiceResult<AppendedHealthEvidence> {
	const guard = await guardClaimAccess(actingUserId, input.claimId, "EDIT");
	if ("error" in guard) {
		return { error: guard.error };
	}
	const { caseId } = guard;

	try {
		const createdAt = new Date();
		// Parsed ONCE and reused for both the hash preimage and storage — the
		// same fix as `createdAt` above. `evaluatedAt` is client-supplied and
		// round-trips through Postgres's `TIMESTAMP(3)` column as a `Date`, not
		// as the producer's original wire string; if the hash were computed
		// from `input.evaluatedAt` directly but the column stored
		// `new Date(input.evaluatedAt)`, a record's hash could never be
		// recomputed from its own returned data (e.g. a wire value with no
		// fractional seconds hashes as `"...07Z"` but re-serializes from the
		// stored `Date` as `"...07.000Z"` — a spurious tamper signal on an
		// untouched record). Hashing and storing the SAME `Date` instance
		// makes the round trip exact.
		const evaluatedAtDate = new Date(input.evaluatedAt);
		const record = await prisma.$transaction(async (tx) => {
			// Locks the claim's own row for the duration of this transaction.
			// It is guaranteed to exist (guardClaimAccess just resolved it), so
			// this works identically for a claim's first evidence item as for
			// its Nth — unlike locking "the latest evidence row", which has
			// nothing to lock before one exists.
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${input.claimId} FOR UPDATE`;

			const previous = await tx.pluginHealthEvidence.findFirst({
				where: { claimId: input.claimId },
				orderBy: { chainSequence: "desc" },
				select: { recordHash: true },
			});
			const previousRecordHash = previous?.recordHash ?? null;

			const content: EvidenceHashContent = {
				claimId: input.claimId,
				metricName: input.metricName,
				value: input.value ?? null,
				threshold: input.threshold ?? null,
				verdict: input.verdict,
				oddDimensions: input.oddDimensions,
				sourceSystem: input.sourceSystem,
				provenance: input.provenance,
				evaluatedAt: evaluatedAtDate.toISOString(),
				formatVersion: EVIDENCE_FORMAT_VERSION,
				createdById: actingUserId,
				createdAt: createdAt.toISOString(),
			};
			const recordHash = computeRecordHash(content, previousRecordHash);

			return await tx.pluginHealthEvidence.create({
				data: {
					claimId: input.claimId,
					metricName: input.metricName,
					value: input.value,
					threshold: input.threshold,
					verdict: input.verdict,
					oddDimensions: input.oddDimensions,
					sourceSystem: input.sourceSystem,
					provenance: input.provenance,
					evaluatedAt: evaluatedAtDate,
					formatVersion: EVIDENCE_FORMAT_VERSION,
					recordHash,
					previousRecordHash,
					createdById: actingUserId,
					createdAt,
				},
			});
		});

		return { data: { evidence: record, caseId } };
	} catch (error) {
		console.error("Failed to append health evidence:", error);
		return { error: "Failed to append health evidence" };
	}
}

/** Returns `claimId`'s full evidence log in append order. Requires VIEW-level case access. */
export async function listHealthEvidence(
	actingUserId: string,
	claimId: string
): ServiceResult<PluginHealthEvidence[]> {
	const guard = await guardClaimAccess(actingUserId, claimId, "VIEW");
	if ("error" in guard) {
		return { error: guard.error };
	}

	try {
		const records = await prisma.pluginHealthEvidence.findMany({
			where: { claimId },
			orderBy: { chainSequence: "asc" },
		});
		return { data: records };
	} catch (error) {
		console.error("Failed to list health evidence:", error);
		return { error: "Failed to list health evidence" };
	}
}
