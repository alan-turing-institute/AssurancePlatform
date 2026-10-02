import { createHash } from "node:crypto";
import { canonicalJSON as canonical } from "@/lib/health-canonical-json";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
	type EchoDifference,
	echoAgainst,
} from "@/lib/schemas/health-criteria";
import type {
	HealthEvidenceRecord,
	HealthVerdict,
} from "@/lib/schemas/health-evidence";
import { EVIDENCE_FORMAT_VERSION } from "@/lib/schemas/health-evidence";
import { INDEFINITE, parseDurationSeconds } from "@/lib/schemas/health-rules";
import {
	DELETED_USER_NAME,
	guardClaimAccess,
	usernamesById,
} from "@/lib/services/health-claim-access";
import {
	type PluginHealthBindingSource,
	type PluginHealthEchoState,
	type PluginHealthEvidenceVerdict,
	type PluginHealthRevocationCause,
	Prisma,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "health-evidence-service" });

/**
 * The health plugin's append-only evidence log (`plugin_health_evidence`).
 * This module is the ONLY code path allowed to write to the evidence table
 * and to the tables that qualify it (claim bound-check state, binding
 * history, revocations). Its operations on those tables are: append a
 * record, revoke one, reinstate one, and change a claim's bound check, which
 * `applyBoundCheck` also does for the evidence settings service inside that
 * service's own transaction.
 * There is no function anywhere in this file that updates or deletes an
 * evidence row — append-only is a structural property of the service
 * surface — and revoking a record adds a separate revocation row, so the
 * record and its place in the hash chain never change.
 * `src/__tests__/integration/health-evidence-service.test.ts` asserts the
 * module's exports directly to prove it.
 *
 * Concurrency: two writers racing to append evidence for the SAME claim
 * could both read the same "current tip" and fork the chain. This is
 * prevented by locking the claim's own `AssuranceElement` row
 * (`SELECT ... FOR UPDATE`) for the duration of the read-tip + insert
 * critical section, inside one Prisma interactive transaction. The claim
 * row always exists, so this works identically for a claim's first record
 * and its hundredth. Writers for DIFFERENT claims lock different rows and
 * never block each other.
 */

const RECORD_NOT_FOUND = "Record not found";
const DUPLICATE_RECORD = "A record with this record_id already exists";
const ALREADY_REVOKED = "This record is already revoked";
const NOT_REVOKED = "This record is not revoked";
const ALREADY_BOUND = "This claim is already bound to that check";
const CHECK_SET_BY_SETTINGS =
	"This claim's check is set in its evidence settings";

export const DEFAULT_EVIDENCE_PAGE_SIZE = 50;
export const MAX_EVIDENCE_PAGE_SIZE = 200;

/** The refusal for a record naming a check other than the one the claim is bound to. */
export function boundCheckRefusal(boundCheckName: string): string {
	return `This claim is bound to check ${boundCheckName}. Evidence from another check needs its own evidence claim in the case.`;
}

// ---------------------------------------------------------------------------
// Wire vocabularies
// ---------------------------------------------------------------------------

const VERDICT_TO_DB: Record<HealthVerdict, PluginHealthEvidenceVerdict> = {
	pass: "PASS",
	marginal: "MARGINAL",
	fail: "FAIL",
	indeterminate: "INDETERMINATE",
};

export type RevocationCauseWire =
	| "evidence-defect"
	| "binding-defect"
	| "duplicate"
	| "superseded"
	| "other";

const CAUSE_TO_DB: Record<RevocationCauseWire, PluginHealthRevocationCause> = {
	"evidence-defect": "EVIDENCE_DEFECT",
	"binding-defect": "BINDING_DEFECT",
	duplicate: "DUPLICATE",
	superseded: "SUPERSEDED",
	other: "OTHER",
};

const CAUSE_FROM_DB: Record<PluginHealthRevocationCause, RevocationCauseWire> =
	{
		EVIDENCE_DEFECT: "evidence-defect",
		BINDING_DEFECT: "binding-defect",
		DUPLICATE: "duplicate",
		SUPERSEDED: "superseded",
		OTHER: "other",
	};

// ---------------------------------------------------------------------------
// Hash chain
// ---------------------------------------------------------------------------

export { canonicalJSON } from "@/lib/health-canonical-json";

/** What a record's hash covers: the record as stored, who stored it, and when. */
export interface EvidenceHashContent {
	createdAt: string;
	createdById: string;
	record: unknown;
}

/**
 * `recordHash = hash(content + previousRecordHash)`. A NUL separator sits
 * between the previous hash and the canonical content string so that no
 * ambiguous concatenation can produce the same bytes. That guarantee
 * depends on this being the ONLY NUL byte in the assembled payload —
 * `canonicalJSON` serializes strings through `JSON.stringify`, which
 * escapes an embedded NUL character as a six-character JSON escape
 * sequence, never as a raw byte.
 */
export function computeRecordHash(
	content: EvidenceHashContent,
	previousRecordHash: string | null
): string {
	const payload = `${previousRecordHash ?? ""}\u0000${canonical(content)}`;
	return createHash("sha256").update(payload).digest("hex");
}

// ---------------------------------------------------------------------------
// Append
// ---------------------------------------------------------------------------

export interface AppendedHealthEvidence {
	caseId: string;
	/** The record exactly as stored. */
	record: HealthEvidenceRecord;
}

type AppendOutcome =
	| { kind: "ok"; record: HealthEvidenceRecord }
	| { kind: "duplicate" }
	| { kind: "bound-elsewhere"; boundCheckName: string };

function expiryOf(record: HealthEvidenceRecord, timestamp: Date): Date | null {
	if (record.valid_for === INDEFINITE) {
		return null;
	}
	const seconds = parseDurationSeconds(record.valid_for);
	if (seconds === null) {
		// Refuse rather than store a record that would never go stale.
		throw new Error("valid_for is not a valid duration");
	}
	return new Date(timestamp.getTime() + seconds * 1000);
}

/**
 * Appends one validated record to `claimId`'s log, computing the next
 * hash-chain link under a claim-row lock (see module doc). In the same
 * locked section it refuses a repeated `record_id` and enforces the claim's
 * bound check: the first accepted record binds its check, and a record
 * naming another check is refused and counted. Requires EDIT-level case
 * access for `actingUserId`. Returns the stored record plus the claim's
 * `caseId`, which the route needs to address the SSE broadcast.
 */
export async function appendHealthEvidence(
	actingUserId: string,
	claimId: string,
	input: HealthEvidenceRecord
): ServiceResult<AppendedHealthEvidence> {
	const guard = await guardClaimAccess(actingUserId, claimId, "EDIT");
	if ("error" in guard) {
		return { error: guard.error };
	}
	const { caseId } = guard;

	// Hashed and stored from the same JSON-normalised value, so the stored row
	// recomputes to the same hash.
	const record = JSON.parse(JSON.stringify(input)) as HealthEvidenceRecord;
	const createdAt = new Date();
	const recordTimestamp = new Date(record.timestamp);

	try {
		const outcome = await prisma.$transaction(
			async (tx): Promise<AppendOutcome> => {
				await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;

				const existing = await tx.pluginHealthEvidence.findUnique({
					where: { recordId: record.record_id },
					select: { id: true },
				});
				if (existing) {
					return { kind: "duplicate" };
				}

				const state = await tx.pluginHealthClaimState.findUnique({
					where: { claimId },
				});
				if (state && state.boundCheckName !== record.check.name) {
					return {
						kind: "bound-elsewhere",
						boundCheckName: state.boundCheckName,
					};
				}
				if (!state) {
					await applyBoundCheck(tx, {
						claimId,
						name: record.check.name,
						source: "FIRST_RECORD",
						changedById: actingUserId,
					});
				}

				const echo = echoAgainst(
					record,
					await tx.pluginHealthCriteria.findUnique({ where: { claimId } })
				);

				const previous = await tx.pluginHealthEvidence.findFirst({
					where: { claimId },
					orderBy: { chainSequence: "desc" },
					select: { recordHash: true },
				});
				const previousRecordHash = previous?.recordHash ?? null;
				const recordHash = computeRecordHash(
					{
						record,
						createdById: actingUserId,
						createdAt: createdAt.toISOString(),
					},
					previousRecordHash
				);

				await tx.pluginHealthEvidence.create({
					data: {
						claimId,
						record: record as unknown as Prisma.InputJsonObject,
						recordId: record.record_id,
						recordTimestamp,
						verdict: VERDICT_TO_DB[record.verdict],
						checkName: record.check.name,
						session: record.provenance.session,
						validFor: record.valid_for,
						expiresAt: expiryOf(record, recordTimestamp),
						formatVersion: EVIDENCE_FORMAT_VERSION,
						echoState: echo.state,
						echoDifferences: echo.differences
							? (echo.differences as unknown as Prisma.InputJsonArray)
							: undefined,
						criteriaRevision: echo.revision,
						recordHash,
						previousRecordHash,
						createdById: actingUserId,
						createdAt,
					},
				});
				await tx.pluginHealthClaimState.update({
					where: { claimId },
					data: { rejectedSinceLastAccept: 0 },
				});

				return { kind: "ok", record };
			}
		);

		if (outcome.kind === "duplicate") {
			return { error: DUPLICATE_RECORD };
		}
		if (outcome.kind === "bound-elsewhere") {
			// Counted in its own short transaction: the refusal must be visible
			// even though the append transaction stored nothing. It takes the
			// same claim-row lock as an append, so it cannot land after a later
			// accepted record has reset the count.
			await prisma.$transaction(async (tx) => {
				await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
				await tx.pluginHealthClaimState.update({
					where: { claimId },
					data: { rejectedSinceLastAccept: { increment: 1 } },
				});
			});
			return { error: boundCheckRefusal(outcome.boundCheckName) };
		}
		return { data: { record: outcome.record, caseId } };
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			// Two appends for different claims raced on the same record_id.
			return { error: DUPLICATE_RECORD };
		}
		log.error("Failed to append health evidence", { error });
		return { error: "Failed to append health evidence" };
	}
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface HealthRevocationView {
	cause: RevocationCauseWire;
	reason: string;
	revoked_at: string;
	revoked_by_name: string;
}

type EchoWire = "match" | "mismatch" | "undeclared";

const ECHO_FROM_DB: Record<PluginHealthEchoState, EchoWire> = {
	MATCH: "match",
	MISMATCH: "mismatch",
	UNDECLARED: "undeclared",
};

export interface HealthEvidenceListItem {
	chain_sequence: number;
	created_at: string;
	created_by_id: string;
	/** The settings revision the record was compared with when it arrived. */
	criteria_revision: number | null;
	/** How the record differed from the accepted settings when it arrived; null unless `echo_state` is `mismatch`. */
	echo_differences: EchoDifference[] | null;
	echo_state: EchoWire;
	expires_at: string | null;
	id: string;
	previous_record_hash: string | null;
	record: HealthEvidenceRecord;
	record_hash: string;
	revocation: HealthRevocationView | null;
}

export interface HealthEvidencePage {
	items: HealthEvidenceListItem[];
	/** Pass as `before` to read the next (older) page; null when there is none. */
	nextBefore: number | null;
}

function toRevocationView(
	revocation: {
		cause: PluginHealthRevocationCause;
		reason: string;
		revokedAt: Date;
		revokedById: string;
	},
	names: Map<string, string>
): HealthRevocationView {
	return {
		cause: CAUSE_FROM_DB[revocation.cause],
		reason: revocation.reason,
		revoked_at: revocation.revokedAt.toISOString(),
		revoked_by_name: names.get(revocation.revokedById) ?? DELETED_USER_NAME,
	};
}

/**
 * One page of `claimId`'s evidence log, newest first, each item carrying
 * its open revocation (or null). `before` is a `chain_sequence`: only
 * records older than it are returned. With `live`, only records that are
 * not revoked and whose validity has not run out are returned. Requires
 * VIEW-level case access.
 */
export async function listHealthEvidence(
	actingUserId: string,
	claimId: string,
	options: { limit?: number; before?: number; live?: boolean } = {}
): ServiceResult<HealthEvidencePage> {
	const guard = await guardClaimAccess(actingUserId, claimId, "VIEW");
	if ("error" in guard) {
		return { error: guard.error };
	}
	const limit = Math.min(
		Math.max(options.limit ?? DEFAULT_EVIDENCE_PAGE_SIZE, 1),
		MAX_EVIDENCE_PAGE_SIZE
	);

	try {
		const rows = await prisma.pluginHealthEvidence.findMany({
			where: {
				claimId,
				...(options.before === undefined
					? {}
					: { chainSequence: { lt: options.before } }),
				...(options.live
					? {
							revocations: { none: { reinstatedAt: null } },
							OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
						}
					: {}),
			},
			orderBy: { chainSequence: "desc" },
			take: limit + 1,
			include: {
				revocations: { where: { reinstatedAt: null }, take: 1 },
			},
		});
		const hasMore = rows.length > limit;
		const page = hasMore ? rows.slice(0, limit) : rows;

		const names = await usernamesById([
			...new Set(
				page.flatMap((row) =>
					row.revocations.map((revocation) => revocation.revokedById)
				)
			),
		]);

		const items = page.map(
			(row): HealthEvidenceListItem => ({
				id: row.id,
				record: row.record as unknown as HealthEvidenceRecord,
				chain_sequence: row.chainSequence,
				record_hash: row.recordHash,
				previous_record_hash: row.previousRecordHash,
				created_by_id: row.createdById,
				created_at: row.createdAt.toISOString(),
				echo_state: ECHO_FROM_DB[row.echoState],
				echo_differences: row.echoDifferences as EchoDifference[] | null,
				criteria_revision: row.criteriaRevision,
				expires_at: row.expiresAt?.toISOString() ?? null,
				revocation: row.revocations[0]
					? toRevocationView(row.revocations[0], names)
					: null,
			})
		);
		return {
			data: {
				items,
				nextBefore: hasMore ? (items.at(-1)?.chain_sequence ?? null) : null,
			},
		};
	} catch (error) {
		log.error("Failed to list health evidence", { error });
		return { error: "Failed to list health evidence" };
	}
}

// ---------------------------------------------------------------------------
// Revocation
// ---------------------------------------------------------------------------

export interface RevokedHealthEvidence {
	caseId: string;
	revocation: HealthRevocationView;
}

/**
 * Withdraws one record from its claim's status. The evidence row is not
 * touched: the revocation is a separate row, so the record stays in the log
 * (marked revoked) and keeps its place in the hash chain. Requires EDIT.
 */
export async function revokeHealthEvidence(
	actingUserId: string,
	claimId: string,
	recordId: string,
	input: { cause: RevocationCauseWire; reason: string }
): ServiceResult<RevokedHealthEvidence> {
	const guard = await guardClaimAccess(actingUserId, claimId, "EDIT");
	if ("error" in guard) {
		return { error: guard.error };
	}

	try {
		const evidence = await prisma.pluginHealthEvidence.findFirst({
			where: { recordId, claimId },
			select: { id: true },
		});
		if (!evidence) {
			return { error: RECORD_NOT_FOUND };
		}
		const open = await prisma.pluginHealthRevocation.findFirst({
			where: { evidenceId: evidence.id, reinstatedAt: null },
			select: { id: true },
		});
		if (open) {
			return { error: ALREADY_REVOKED };
		}

		const created = await prisma.pluginHealthRevocation.create({
			data: {
				evidenceId: evidence.id,
				cause: CAUSE_TO_DB[input.cause],
				reason: input.reason,
				revokedById: actingUserId,
			},
		});
		const names = await usernamesById([actingUserId]);
		return {
			data: {
				caseId: guard.caseId,
				revocation: toRevocationView(created, names),
			},
		};
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			// A concurrent revocation of the same record won the open-revocation index.
			return { error: ALREADY_REVOKED };
		}
		log.error("Failed to revoke health evidence", { error });
		return { error: "Failed to revoke health evidence" };
	}
}

/**
 * Puts a revoked record back. The revocation row stays, now closed with who
 * reinstated it, when and why; revoking the record again adds a new row.
 * Requires EDIT.
 */
export async function reinstateHealthEvidence(
	actingUserId: string,
	claimId: string,
	recordId: string,
	input: { reason: string }
): ServiceResult<{ caseId: string }> {
	const guard = await guardClaimAccess(actingUserId, claimId, "EDIT");
	if ("error" in guard) {
		return { error: guard.error };
	}

	try {
		const evidence = await prisma.pluginHealthEvidence.findFirst({
			where: { recordId, claimId },
			select: { id: true },
		});
		if (!evidence) {
			return { error: RECORD_NOT_FOUND };
		}
		const closed = await prisma.pluginHealthRevocation.updateMany({
			where: { evidenceId: evidence.id, reinstatedAt: null },
			data: {
				reinstatedAt: new Date(),
				reinstatedById: actingUserId,
				reinstatementReason: input.reason,
			},
		});
		if (closed.count === 0) {
			return { error: NOT_REVOKED };
		}
		return { data: { caseId: guard.caseId } };
	} catch (error) {
		log.error("Failed to reinstate health evidence", { error });
		return { error: "Failed to reinstate health evidence" };
	}
}

// ---------------------------------------------------------------------------
// Bound check
// ---------------------------------------------------------------------------

type TransactionCallback = Parameters<typeof prisma.$transaction>[0];

/** The client handed to an interactive transaction callback. */
export type HealthTransaction = TransactionCallback extends (
	tx: infer T
) => Promise<unknown>
	? T
	: never;

/**
 * Points a claim at `name` and writes the history row, inside the caller's
 * open transaction, which must already hold the claim-row lock. Creates the
 * claim's state row when it has none. Returns false, writing nothing, when
 * the claim is already bound to that check.
 */
export async function applyBoundCheck(
	tx: HealthTransaction,
	change: {
		claimId: string;
		name: string;
		source: PluginHealthBindingSource;
		changedById: string;
		reason?: string;
	}
): Promise<boolean> {
	const { claimId, name } = change;
	const state = await tx.pluginHealthClaimState.findUnique({
		where: { claimId },
	});
	if (state?.boundCheckName === name) {
		return false;
	}
	if (state) {
		await tx.pluginHealthClaimState.update({
			where: { claimId },
			data: { boundCheckName: name },
		});
	} else {
		await tx.pluginHealthClaimState.create({
			data: { claimId, boundCheckName: name },
		});
	}
	await tx.pluginHealthBindingChange.create({
		data: {
			claimId,
			fromCheckName: state?.boundCheckName ?? null,
			toCheckName: name,
			source: change.source,
			reason: change.reason,
			changedById: change.changedById,
		},
	});
	return true;
}

/**
 * Changes the one check a claim accepts evidence from, writing a history
 * row naming the person and their reason. Records for the new check are
 * accepted from then on, and records for the old one are refused. Refused
 * while the claim has accepted evidence settings, which name its check.
 * Requires EDIT.
 */
export async function changeBoundCheck(
	actingUserId: string,
	claimId: string,
	input: { name: string; reason: string }
): ServiceResult<{ caseId: string }> {
	const guard = await guardClaimAccess(actingUserId, claimId, "EDIT");
	if ("error" in guard) {
		return { error: guard.error };
	}

	try {
		const outcome = await prisma.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
			const criteria = await tx.pluginHealthCriteria.findUnique({
				where: { claimId },
				select: { state: true },
			});
			if (criteria?.state === "ACCEPTED") {
				return "declared" as const;
			}
			const changed = await applyBoundCheck(tx, {
				claimId,
				name: input.name,
				source: "PERSON",
				changedById: actingUserId,
				reason: input.reason,
			});
			return changed ? ("changed" as const) : ("unchanged" as const);
		});
		if (outcome === "declared") {
			return { error: CHECK_SET_BY_SETTINGS };
		}
		if (outcome === "unchanged") {
			return { error: ALREADY_BOUND };
		}
		return { data: { caseId: guard.caseId } };
	} catch (error) {
		log.error("Failed to change health bound check", { error });
		return { error: "Failed to change the bound check" };
	}
}
