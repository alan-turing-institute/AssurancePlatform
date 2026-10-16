import { createHash } from "node:crypto";
import { canonicalJSON as canonical } from "@/lib/health-canonical-json";
import {
	chooseRecordsToKeep,
	THINNING_RULE_VERSION,
} from "@/lib/health-thinning-rule";
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
	type PluginHealthRevocation,
	type PluginHealthRevocationCause,
	Prisma,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "health-evidence-service" });

/**
 * The health plugin's evidence log (`plugin_health_evidence`). This module is
 * the ONLY code path allowed to write to the evidence table and to the tables
 * that qualify it (claim bound-check state, binding history, revocations,
 * thinned-run notes). Its operations on those tables are: append a record,
 * revoke one, reinstate one, change a claim's bound check, which
 * `applyBoundCheck` also does for the evidence settings service inside that
 * service's own transaction, and thin the log.
 * No function in this file updates an evidence row, and revoking a record adds
 * a separate revocation row, so a record and its place in the hash chain never
 * change.
 * The one function that deletes evidence rows is `thinHealthEvidence`. It
 * removes only passing results that repeat their neighbours exactly, once they
 * are more than a day old, and leaves a thinned-run note for each stretch it
 * removes, naming the kept records either side so the hash chain can still be
 * walked across the gap. The only other removal is the cascade that follows
 * deleting a claim or its case for good, which takes the evidence and the
 * notes together.
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
 * never block each other. Revoking and reinstating a record take the same
 * lock, and so does each batch of the thinning job, so a withdrawal can never
 * land between the job's check for withdrawals and its removal.
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

/**
 * A stretch of repeated passing results removed from the log straight before
 * a kept record (see `thinHealthEvidence`).
 */
export interface HealthThinnedRunView {
	/** The record timestamps and chain positions of the first and last removed record. */
	first_removed_at: string;
	first_removed_sequence: number;
	last_removed_at: string;
	last_removed_sequence: number;
	/** How many records were removed. */
	removed_count: number;
	/** Which version of the thinning rule removed them. */
	rule_version: number;
	thinned_at: string;
}

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
	/** The records removed from the log between this one and the next older kept record; null when none were. */
	thinned_before: HealthThinnedRunView | null;
}

export interface HealthEvidencePage {
	items: HealthEvidenceListItem[];
	/** Pass as `before` to read the next (older) page; null when there is none. */
	nextBefore: number | null;
}

function toThinnedRunView(run: {
	firstRemovedAt: Date;
	firstRemovedSequence: number;
	lastRemovedAt: Date;
	lastRemovedSequence: number;
	removedCount: number;
	ruleVersion: number;
	thinnedAt: Date;
}): HealthThinnedRunView {
	return {
		removed_count: run.removedCount,
		first_removed_at: run.firstRemovedAt.toISOString(),
		first_removed_sequence: run.firstRemovedSequence,
		last_removed_at: run.lastRemovedAt.toISOString(),
		last_removed_sequence: run.lastRemovedSequence,
		rule_version: run.ruleVersion,
		thinned_at: run.thinnedAt.toISOString(),
	};
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
 * its open revocation (or null) and the note of any records thinned out
 * straight before it (or null). `before` is a `chain_sequence`: only
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
				thinnedBefore: true,
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
				thinned_before: row.thinnedBefore
					? toThinnedRunView(row.thinnedBefore)
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
 * (marked revoked) and keeps its place in the hash chain. Runs under the
 * claim-row lock, so the thinning job cannot remove the record while this
 * withdrawal is being written. Requires EDIT.
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
		const outcome = await prisma.$transaction(
			async (
				tx
			): Promise<{ error: string } | { created: PluginHealthRevocation }> => {
				await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
				const evidence = await tx.pluginHealthEvidence.findFirst({
					where: { recordId, claimId },
					select: { id: true },
				});
				if (!evidence) {
					return { error: RECORD_NOT_FOUND };
				}
				const open = await tx.pluginHealthRevocation.findFirst({
					where: { evidenceId: evidence.id, reinstatedAt: null },
					select: { id: true },
				});
				if (open) {
					return { error: ALREADY_REVOKED };
				}
				const created = await tx.pluginHealthRevocation.create({
					data: {
						evidenceId: evidence.id,
						cause: CAUSE_TO_DB[input.cause],
						reason: input.reason,
						revokedById: actingUserId,
					},
				});
				return { created };
			}
		);
		if ("error" in outcome) {
			return { error: outcome.error };
		}
		const names = await usernamesById([actingUserId]);
		return {
			data: {
				caseId: guard.caseId,
				revocation: toRevocationView(outcome.created, names),
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
 * Takes the same claim-row lock as a withdrawal. Requires EDIT.
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
		const outcome = await prisma.$transaction(
			async (tx): Promise<{ error: string } | { ok: true }> => {
				await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
				const evidence = await tx.pluginHealthEvidence.findFirst({
					where: { recordId, claimId },
					select: { id: true },
				});
				if (!evidence) {
					return { error: RECORD_NOT_FOUND };
				}
				const closed = await tx.pluginHealthRevocation.updateMany({
					where: { evidenceId: evidence.id, reinstatedAt: null },
					data: {
						reinstatedAt: new Date(),
						reinstatedById: actingUserId,
						reinstatementReason: input.reason,
					},
				});
				return closed.count === 0 ? { error: NOT_REVOKED } : { ok: true };
			}
		);
		if ("error" in outcome) {
			return { error: outcome.error };
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

// ---------------------------------------------------------------------------
// Thinning
// ---------------------------------------------------------------------------

/** Names the database-wide advisory lock that lets one thinning call run at a time. */
export const THINNING_LOCK_NAME = "plugin_health_evidence_thinning";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_THINNING_BATCH_SIZE = 2000;
const DEFAULT_THINNING_TIME_BUDGET_MS = 60_000;
/** How far a call may overrun its time budget while its last batch finishes. */
const THINNING_OVERRUN_ALLOWANCE_MS = 300_000;
const BATCH_TRANSACTION_TIMEOUT_MS = 30_000;
const POOL_WAIT_MS = 5000;

export interface ThinHealthEvidenceOptions {
	/** How many records a batch examines (default 2,000). */
	batchSize?: number;
	/** Work out what would be removed and write nothing. */
	dryRun?: boolean;
	/** The time the cut-off is measured from (default now). */
	now?: Date;
	/** Stop starting batches after this long (default 60 seconds); a call always finishes one batch. */
	timeBudgetMs?: number;
}

interface HealthThinningResult {
	/** Another call holds the lock; nothing was done. */
	busy: boolean;
	/** Claims whose position moved on in this call. */
	claimsProcessed: number;
	/** Records may remain to be examined, so the caller should call again. */
	more: boolean;
	recordsRemoved: number;
	/** Thinned-run notes written. */
	runsRecorded: number;
}

/** One record of a claim's chain, as the thinning job reads it: no record JSON. */
interface ChainRow {
	chain_sequence: number;
	created_at: Date;
	ever_withdrawn: boolean;
	id: string;
	/** A pass whose comparison with the settings said match. */
	plain_pass: boolean;
	record_timestamp: Date;
	session: string;
}

/** A stretch of removed records and the kept records either side of it. */
interface RemovedStretch {
	after: ChainRow;
	before: ChainRow;
	removed: ChainRow[];
}

interface ThinningRun {
	/** Batches examined so far, whether written or only counted. */
	batches: number;
	batchSize: number;
	claimsProcessed: number;
	cutoff: Date;
	dryRun: boolean;
	more: boolean;
	recordsRemoved: number;
	runsRecorded: number;
	sessionsWithConditions: Map<string, Promise<boolean>>;
	startedAt: number;
	timeBudgetMs: number;
}

/** The start of the current UTC hour, a day back: nothing newer is touched. */
function thinningCutoff(now: Date): Date {
	return new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS - DAY_MS);
}

function overBudget(run: ThinningRun): boolean {
	return Date.now() - run.startedAt >= run.timeBudgetMs;
}

/** The next records of `claimId`'s chain after `after`, in chain order, with no record JSON. */
async function readChainRows(
	claimId: string,
	after: number,
	limit: number
): Promise<ChainRow[]> {
	return await prisma.$queryRaw<ChainRow[]>`
		SELECT e.id, e.chain_sequence, e.created_at, e.record_timestamp, e.session,
			(e.verdict = 'PASS' AND e.echo_state = 'MATCH') AS plain_pass,
			EXISTS (
				SELECT 1 FROM plugin_health_revocations r WHERE r.evidence_id = e.id
			) AS ever_withdrawn
		FROM plugin_health_evidence e
		WHERE e.claim_id = ${claimId} AND e.chain_sequence > ${after}
		ORDER BY e.chain_sequence
		LIMIT ${limit}
	`;
}

/**
 * The same-result key of each record: a hash computed by the database from
 * the record with these taken out: `record_id`, `timestamp`, `comment`, and
 * every `provenance` value except `session`, `pipeline_version`, `run` and
 * `twin_version` (so `members` and `failed_subjects` go too). The value,
 * uncertainty, judged value, payload, check, settings, subject and the rest
 * stay in. The settings revision and the recording account are added, so two
 * records have the same key only when they say the same thing under the same
 * settings from the same pipeline.
 */
async function readResultKeys(ids: string[]): Promise<Map<string, string>> {
	if (ids.length === 0) {
		return new Map();
	}
	const rows = await prisma.$queryRaw<
		Array<{ id: string; result_key: string }>
	>`
		SELECT e.id,
			encode(sha256(convert_to(jsonb_build_array(
				(e.record - 'record_id' - 'timestamp' - 'comment' - 'provenance')
					|| jsonb_build_object('provenance', COALESCE(
						(SELECT jsonb_object_agg(p.name, p.val)
							FROM jsonb_each(e.record -> 'provenance') AS p(name, val)
							WHERE p.name IN ('session', 'pipeline_version', 'run', 'twin_version')),
						'{}'::jsonb)),
				e.criteria_revision,
				e.created_by_id
			)::text, 'UTF8')), 'hex') AS result_key
		FROM plugin_health_evidence e
		WHERE e.id = ANY(${ids})
	`;
	return new Map(rows.map((row) => [row.id, row.result_key]));
}

/**
 * Whether any record of `caseId` in `session` carries a `valid_while`
 * condition. Conditions read provenance values the same-result key ignores,
 * so records in such a session are never thinned.
 */
async function sessionCarriesConditions(
	caseId: string,
	session: string
): Promise<boolean> {
	const rows = await prisma.$queryRaw<Array<{ found: boolean }>>`
		SELECT EXISTS (
			SELECT 1
			FROM plugin_health_evidence v
			JOIN assurance_elements a ON a.id = v.claim_id
			WHERE a.case_id = ${caseId}
				AND v.session = ${session}
				AND jsonb_typeof(v.record -> 'valid_while') = 'object'
				AND v.record -> 'valid_while' <> '{}'::jsonb
		) AS found
	`;
	return rows[0]?.found === true;
}

/** Answers `sessionCarriesConditions` once per case and session in a call. */
function protectedSession(
	run: ThinningRun,
	caseId: string,
	session: string
): Promise<boolean> {
	const cacheKey = `${caseId}\u0000${session}`;
	let answer = run.sessionsWithConditions.get(cacheKey);
	if (!answer) {
		answer = sessionCarriesConditions(caseId, session);
		run.sessionsWithConditions.set(cacheKey, answer);
	}
	return answer;
}

/** Which of `rows` the keep rule removes, as the stretches between kept records. */
async function planRemovals(
	run: ThinningRun,
	caseId: string,
	rows: ChainRow[]
): Promise<RemovedStretch[]> {
	const candidates: ChainRow[] = [];
	for (const row of rows) {
		if (
			row.plain_pass &&
			!row.ever_withdrawn &&
			!(await protectedSession(run, caseId, row.session))
		) {
			candidates.push(row);
		}
	}
	const keys = await readResultKeys(candidates.map((row) => row.id));
	const kept = chooseRecordsToKeep(
		rows.map((row) => ({
			resultKey: keys.get(row.id) ?? null,
			timestampMs: row.record_timestamp.getTime(),
		}))
	);

	const stretches: RemovedStretch[] = [];
	let index = 0;
	while (index < rows.length) {
		if (kept[index]) {
			index++;
			continue;
		}
		const start = index;
		while (index < rows.length && !kept[index]) {
			index++;
		}
		const before = rows[start - 1];
		const after = rows[index];
		if (!(before && after)) {
			// The rule keeps the first and last record of every batch.
			throw new Error("Thinning plan removes a batch edge");
		}
		stretches.push({ before, after, removed: rows.slice(start, index) });
	}
	return stretches;
}

/**
 * Removes the planned stretches, writes their notes and moves the claim's
 * position on, in one short transaction under the claim-row lock. Gives up,
 * writing nothing, when the position has moved since the batch was read or
 * a record in the batch has been withdrawn since.
 */
async function applyRemovals(
	claimId: string,
	mark: number | null,
	rows: ChainRow[],
	stretches: RemovedStretch[]
): Promise<"written" | "given-up"> {
	const first = rows[0]?.chain_sequence ?? 0;
	const last = rows.at(-1)?.chain_sequence ?? 0;
	const withdrawnWhenRead = rows.filter((row) => row.ever_withdrawn).length;
	const removedIds = stretches.flatMap((stretch) =>
		stretch.removed.map((row) => row.id)
	);

	return await prisma.$transaction(
		async (tx) => {
			await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;

			const state = await tx.pluginHealthClaimState.findUnique({
				where: { claimId },
				select: { thinnedThroughSequence: true },
			});
			if (state?.thinnedThroughSequence !== mark) {
				return "given-up";
			}
			const withdrawnNow = await tx.$queryRaw<Array<{ count: bigint }>>`
				SELECT count(DISTINCT r.evidence_id) AS count
				FROM plugin_health_revocations r
				JOIN plugin_health_evidence e ON e.id = r.evidence_id
				WHERE e.claim_id = ${claimId}
					AND e.chain_sequence BETWEEN ${first} AND ${last}
			`;
			if (Number(withdrawnNow[0]?.count ?? 0) !== withdrawnWhenRead) {
				return "given-up";
			}

			if (removedIds.length > 0) {
				const deleted = await tx.pluginHealthEvidence.deleteMany({
					where: { id: { in: removedIds }, claimId },
				});
				if (deleted.count !== removedIds.length) {
					throw new Error("Thinning removed a different number of records");
				}
				await tx.pluginHealthThinnedRun.createMany({
					data: stretches.map((stretch) => ({
						claimId,
						keptBeforeId: stretch.before.id,
						keptAfterId: stretch.after.id,
						removedCount: stretch.removed.length,
						firstRemovedSequence: stretch.removed[0]?.chain_sequence ?? 0,
						lastRemovedSequence: stretch.removed.at(-1)?.chain_sequence ?? 0,
						firstRemovedAt: stretch.removed[0]?.record_timestamp ?? new Date(0),
						lastRemovedAt:
							stretch.removed.at(-1)?.record_timestamp ?? new Date(0),
						ruleVersion: THINNING_RULE_VERSION,
					})),
				});
			}
			await tx.pluginHealthClaimState.update({
				where: { claimId },
				data: { thinnedThroughSequence: last },
			});
			return "written";
		},
		{ maxWait: POOL_WAIT_MS, timeout: BATCH_TRANSACTION_TIMEOUT_MS }
	);
}

/**
 * Thins one claim, batch by batch from where the last pass stopped, until its
 * records run out, reach the cut-off or the call's time budget ends.
 */
async function thinClaim(
	run: ThinningRun,
	claim: { caseId: string; claimId: string; mark: number | null }
): Promise<void> {
	let mark = claim.mark;
	let moved = false;
	for (;;) {
		const fetched = await readChainRows(
			claim.claimId,
			mark ?? 0,
			run.batchSize
		);
		const firstRecent = fetched.findIndex(
			(row) => row.created_at.getTime() >= run.cutoff.getTime()
		);
		const rows = firstRecent === -1 ? fetched : fetched.slice(0, firstRecent);
		const lastRow = rows.at(-1);
		if (!lastRow) {
			break;
		}

		run.batches++;
		const stretches = await planRemovals(run, claim.caseId, rows);
		if (!run.dryRun) {
			const outcome = await applyRemovals(claim.claimId, mark, rows, stretches);
			if (outcome === "given-up") {
				log.info(
					"Gave up thinning a batch: the claim changed while it was read",
					{
						claimId: claim.claimId,
					}
				);
				break;
			}
		}
		mark = lastRow.chain_sequence;
		moved = true;
		run.recordsRemoved += stretches.reduce(
			(total, stretch) => total + stretch.removed.length,
			0
		);
		run.runsRecorded += stretches.length;

		if (rows.length < run.batchSize) {
			break;
		}
		if (overBudget(run)) {
			run.more = true;
			break;
		}
	}
	if (moved) {
		run.claimsProcessed++;
	}
}

async function thinClaims(run: ThinningRun): Promise<void> {
	const states = await prisma.pluginHealthClaimState.findMany({
		select: {
			claimId: true,
			thinnedThroughSequence: true,
			claim: { select: { caseId: true } },
		},
		orderBy: { claimId: "asc" },
	});
	for (const state of states) {
		if (run.batches > 0 && overBudget(run)) {
			run.more = true;
			return;
		}
		try {
			await thinClaim(run, {
				claimId: state.claimId,
				caseId: state.claim.caseId,
				mark: state.thinnedThroughSequence,
			});
		} catch (error) {
			log.error("Failed to thin one claim's health evidence", {
				error,
				claimId: state.claimId,
			});
		}
		if (run.more) {
			return;
		}
	}
}

/**
 * Thins the evidence log: removes the passing results that repeat their
 * neighbours exactly, once they are more than a day old, and writes a note for
 * each stretch it removes. The rule is `chooseRecordsToKeep`; the same-result
 * key it works from is `readResultKeys`.
 *
 * The cut-off is the start of the current UTC hour minus 24 hours, fixed for
 * the call. Each claim is read forward in chain order from where the last pass
 * stopped (`thinnedThroughSequence`), up to the first record that arrived at or
 * after the cut-off, so only records that are neighbours in the chain are ever
 * judged to be a run. A batch is decided from narrow rows outside any lock,
 * then written in one short transaction under the claim-row lock, which gives
 * up if the claim has moved on or a record in the batch has been withdrawn
 * since it was read.
 *
 * One call runs at a time: it holds a database-wide advisory lock for its
 * whole length and returns `busy` when another call holds it. It stops
 * starting batches after `timeBudgetMs` and reports `more` so the caller can
 * call again. With `dryRun` it writes nothing and reports what a real call
 * would do. Not tied to a person or a case: callers authenticate with the cron
 * secret.
 */
export async function thinHealthEvidence(
	options: ThinHealthEvidenceOptions = {}
): ServiceResult<HealthThinningResult> {
	const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_THINNING_TIME_BUDGET_MS;
	try {
		const result = await prisma.$transaction(
			async (lockTx): Promise<HealthThinningResult> => {
				const lock = await lockTx.$queryRaw<Array<{ locked: boolean }>>`
					SELECT pg_try_advisory_xact_lock(hashtext(${THINNING_LOCK_NAME}::text)) AS locked
				`;
				if (lock[0]?.locked !== true) {
					return {
						busy: true,
						claimsProcessed: 0,
						more: false,
						recordsRemoved: 0,
						runsRecorded: 0,
					};
				}
				const run: ThinningRun = {
					batchSize: options.batchSize ?? DEFAULT_THINNING_BATCH_SIZE,
					batches: 0,
					claimsProcessed: 0,
					cutoff: thinningCutoff(options.now ?? new Date()),
					dryRun: options.dryRun === true,
					more: false,
					recordsRemoved: 0,
					runsRecorded: 0,
					sessionsWithConditions: new Map(),
					startedAt: Date.now(),
					timeBudgetMs,
				};
				await thinClaims(run);
				return {
					busy: false,
					claimsProcessed: run.claimsProcessed,
					more: run.more,
					recordsRemoved: run.recordsRemoved,
					runsRecorded: run.runsRecorded,
				};
			},
			{
				maxWait: POOL_WAIT_MS,
				timeout: timeBudgetMs + THINNING_OVERRUN_ALLOWANCE_MS,
			}
		);
		log.info("Health evidence thinning finished", {
			...result,
			dryRun: options.dryRun === true,
		});
		return { data: result };
	} catch (error) {
		log.error("Failed to thin health evidence", { error });
		return { error: "Failed to thin health evidence" };
	}
}
