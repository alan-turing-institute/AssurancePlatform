import { randomUUID } from "node:crypto";
import { vi } from "vitest";
import prisma from "@/lib/prisma";
import { healthEvidenceRecordSchema } from "@/lib/schemas/health-evidence";
import {
	readCriteria,
	readHealthHygiene,
} from "@/lib/services/health-criteria-service";
import {
	appendHealthEvidence,
	computeRecordHash,
	type HealthEvidenceListItem,
	listHealthEvidence,
	reinstateHealthEvidence,
	revokeHealthEvidence,
	type ThinHealthEvidenceOptions,
	thinHealthEvidence,
} from "@/lib/services/health-evidence-service";
import { computeHealthStatus } from "@/lib/services/health-status-service";
import {
	buildHealthCheckList,
	SYSTEM_CHECK_NAME,
} from "../fixtures/health-checks";
import { expectSuccess } from "./assertion-helpers";
import { mockAuth } from "./auth-helpers";
import {
	addPipeline,
	callCriteriaPut,
	callMachineClaimCriteria,
	itemSettings,
	saveBody,
	setupCriteriaCase,
} from "./health-criteria-kit";
import { createTestElement } from "./prisma-factories";

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * A fixed instant well in the past, with milliseconds, so every arrival time
 * in a test is a known value and nothing depends on the real clock. The
 * thinning cut-off for a call made at `NOW` is `CUTOFF`.
 */
export const NOW = Date.UTC(2026, 0, 10, 12, 34, 56, 789);
export const CUTOFF = Date.UTC(2026, 0, 9, 12, 0, 0, 0);

// ---------------------------------------------------------------------------
// World: a case with claims whose accepted settings the records echo, and
// pipeline accounts that may write to them.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

interface Pipeline {
	integrationId: string;
	secret: string;
	systemUserId: string;
}

interface Claim {
	id: string;
	/** What the pipeline reads back from the claim's accepted settings; null when the claim has none. */
	served: Json | null;
	/** Whether records for the claim carry an aggregation (and so must list members). */
	summary: boolean;
}

export interface World {
	caseId: string;
	claims: Claim[];
	owner: { id: string; username: string; email: string };
	pipelines: Pipeline[];
}

function systemSettings(): Json {
	const check = buildHealthCheckList().checks.find(
		(entry) => entry.name === SYSTEM_CHECK_NAME
	);
	if (!check) {
		throw new Error("fixture check missing");
	}
	return {
		check: { name: check.name, version: check.version, scope: check.scope },
		...check.recommended,
	};
}

async function acceptSettings(
	world: Pick<World, "pipelines">,
	claimId: string,
	settings: Json
): Promise<Json> {
	const response = await callCriteriaPut(
		claimId,
		saveBody(world.pipelines[0]?.integrationId ?? "", settings, true)
	);
	if (response.status !== 200) {
		throw new Error(`accepting settings answered ${response.status}`);
	}
	const served = await (
		await callMachineClaimCriteria(claimId, world.pipelines[0]?.secret)
	).json();
	return served as Json;
}

/** Re-accepts settings for a claim (a new settings revision) and returns what the pipeline now reads. */
export async function reaccept(
	world: World,
	claimIndex: number,
	settings: Json = itemSettings()
): Promise<Json> {
	const claim = world.claims[claimIndex];
	if (!claim) {
		throw new Error("no such claim");
	}
	const served = await acceptSettings(world, claim.id, settings);
	claim.served = served;
	return served;
}

export async function setupWorld(
	options: { claims?: number; pipelines?: number } = {}
): Promise<World> {
	const context = await setupCriteriaCase();
	await mockAuth(context.owner.id, context.owner.username, context.owner.email);
	const pipelines: Pipeline[] = [
		{
			integrationId: context.integration.id,
			secret: context.secret,
			systemUserId: context.systemUserId,
		},
	];
	for (let i = 1; i < (options.pipelines ?? 1); i++) {
		const extra = await addPipeline(context.owner.id, context.testCase.id);
		pipelines.push({
			integrationId: extra.integration.id,
			secret: extra.secret,
			systemUserId: extra.systemUserId,
		});
	}
	const world: World = {
		owner: {
			id: context.owner.id,
			username: context.owner.username,
			email: context.owner.email,
		},
		caseId: context.testCase.id,
		pipelines,
		claims: [],
	};
	world.claims.push({
		id: context.claim.id,
		served: await acceptSettings(world, context.claim.id, itemSettings()),
		summary: true,
	});
	for (let i = 1; i < (options.claims ?? 1); i++) {
		await addClaim(world);
	}
	return world;
}

/** Adds a claim with accepted settings (or none), returning its index. */
export async function addClaim(
	world: World,
	options: { accept?: boolean; system?: boolean } = {}
): Promise<number> {
	const element = await createTestElement(world.caseId, world.owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	const first = world.claims[0];
	let served: Json | null;
	if (options.accept === false) {
		served = null;
	} else {
		served = await acceptSettings(
			world,
			element.id,
			options.system ? systemSettings() : itemSettings()
		);
	}
	const template = served ?? first?.served ?? null;
	world.claims.push({
		id: element.id,
		served,
		summary: Boolean(template?.aggregation),
	});
	return world.claims.length - 1;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

interface RecordSpec {
	/** Which pipeline account appends it (default the first). */
	account?: number;
	/** When the log stores it (default `ts`). */
	arrived?: number;
	comment?: string | null;
	/** Provenance keys beyond the four named ones; default `{ sim_time: <counter> }`. */
	extraProvenance?: Json | null;
	members?: string[];
	/** Last-minute edits to the wire record, applied before it is validated. */
	mutate?: (record: Json) => void;
	/** Append with the real clock instead of a pretended arrival time (for use while a call is running). */
	realClock?: boolean;
	session?: string;
	/** The record's own timestamp. */
	ts: number;
	value?: unknown;
	verdict?: "pass" | "marginal" | "fail" | "indeterminate";
}

let counter = 0;

/** The provenance of the `n`th record built: the four named values, readings and extra values. */
function provenanceFor(claim: Claim, spec: RecordSpec, n: number): Json {
	const provenance: Json = {
		session: spec.session ?? "S1",
		pipeline_version: "0.4.0",
		run: "offline",
		twin_version: "2.3",
	};
	if (claim.summary) {
		provenance.members =
			spec.members ?? Array.from({ length: 2 + (n % 4) }, () => randomUUID());
	}
	if (spec.extraProvenance !== null) {
		Object.assign(provenance, spec.extraProvenance ?? { sim_time: n * 7 });
	}
	return provenance;
}

/** The settings a record echoes from what the pipeline reads back. */
function echoedSettings(served: Json): Json {
	return {
		check: served.check,
		rule: served.rule,
		...(served.reduction ? { reduction: served.reduction } : {}),
		...(served.aggregation ? { aggregation: served.aggregation } : {}),
		window: served.window,
		valid_for: served.valid_for,
	};
}

/** The comment (and, for an indeterminate record, the missing value) of the `n`th record built. */
function setCommentAndValue(record: Json, spec: RecordSpec, n: number) {
	if (spec.comment !== null) {
		record.comment = spec.comment ?? `check ${n}`;
	}
	if (record.verdict === "indeterminate") {
		record.value = undefined;
		record.comment = spec.comment ?? "Inapplicable: nothing to judge.";
	}
}

function dropUndefinedKeys(record: Json) {
	for (const key of Object.keys(record)) {
		if (record[key] === undefined) {
			delete record[key];
		}
	}
}

function buildWire(
	claim: Claim,
	spec: RecordSpec,
	fallback: Json | null = null
): Json {
	counter += 1;
	const n = counter;
	const served = claim.served ?? fallback;
	if (!served) {
		throw new Error("claim has no served settings to echo");
	}
	const record: Json = {
		format_version: "1.1",
		record_id: randomUUID(),
		timestamp: new Date(spec.ts).toISOString(),
		claim_ref: claim.id,
		...echoedSettings(served),
		value: spec.value ?? { number: 1, unit: "ratio" },
		verdict: spec.verdict ?? "pass",
		provenance: provenanceFor(claim, spec, n),
	};
	setCommentAndValue(record, spec, n);
	spec.mutate?.(record);
	dropUndefinedKeys(record);
	return record;
}

/** Appends a record at its arrival time and returns its record id. */
export async function put(
	world: World,
	claimIndex: number,
	spec: RecordSpec
): Promise<string> {
	const claim = world.claims[claimIndex];
	const account = world.pipelines[spec.account ?? 0];
	if (!(claim && account)) {
		throw new Error("no such claim or account");
	}
	const wire = buildWire(
		claim,
		spec,
		world.claims.find((entry) => entry.served)?.served ?? null
	);
	if (!spec.realClock) {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(spec.arrived ?? spec.ts);
	}
	try {
		const parsed = healthEvidenceRecordSchema.parse(wire);
		const result = await appendHealthEvidence(
			account.systemUserId,
			claim.id,
			parsed
		);
		if ("error" in result) {
			throw new Error(`append refused: ${result.error}`);
		}
	} finally {
		vi.useRealTimers();
	}
	return wire.record_id as string;
}

/** Appends `count` identical-result records `stepMs` apart starting at `start`. */
export async function putRun(
	world: World,
	claimIndex: number,
	start: number,
	count: number,
	stepMs: number,
	spec: Omit<RecordSpec, "ts"> = {}
): Promise<string[]> {
	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		ids.push(await put(world, claimIndex, { ...spec, ts: start + i * stepMs }));
	}
	return ids;
}

/** Withdraws a record; the answer carries `error` only when the service refused. */
export async function withdraw(
	world: World,
	claimIndex: number,
	recordId: string
): Promise<{ error?: string }> {
	const claim = world.claims[claimIndex];
	if (!claim) {
		throw new Error("no such claim");
	}
	const result = await revokeHealthEvidence(
		world.owner.id,
		claim.id,
		recordId,
		{ cause: "evidence-defect", reason: "withdrawn in a test" }
	);
	return "error" in result ? { error: result.error } : {};
}

/** Reinstates a record; the answer carries `error` only when the service refused. */
export async function reinstate(
	world: World,
	claimIndex: number,
	recordId: string
): Promise<{ error?: string }> {
	const claim = world.claims[claimIndex];
	if (!claim) {
		throw new Error("no such claim");
	}
	const result = await reinstateHealthEvidence(
		world.owner.id,
		claim.id,
		recordId,
		{ reason: "reinstated in a test" }
	);
	return "error" in result ? { error: result.error } : {};
}

export async function thin(
	nowMs: number = NOW,
	options: Partial<ThinHealthEvidenceOptions> = {}
) {
	return expectSuccess(
		await thinHealthEvidence({ now: new Date(nowMs), ...options })
	);
}

// ---------------------------------------------------------------------------
// Reading the log
// ---------------------------------------------------------------------------

export interface Row {
	createdAt: number;
	createdById: string;
	echo: string;
	/** Whether any revocation row exists, open or closed. */
	everWithdrawn: boolean;
	hash: string;
	id: string;
	prev: string | null;
	record: Json;
	recordId: string;
	revision: number | null;
	seq: number;
	session: string;
	ts: number;
	verdict: string;
}

export async function readRows(claimId: string): Promise<Row[]> {
	const rows = await prisma.pluginHealthEvidence.findMany({
		where: { claimId },
		orderBy: { chainSequence: "asc" },
		include: { revocations: { select: { id: true } } },
	});
	return rows.map((row) => ({
		id: row.id,
		recordId: row.recordId,
		seq: row.chainSequence,
		createdAt: row.createdAt.getTime(),
		ts: row.recordTimestamp.getTime(),
		verdict: row.verdict,
		echo: row.echoState,
		revision: row.criteriaRevision,
		createdById: row.createdById,
		session: row.session,
		record: row.record as Json,
		everWithdrawn: row.revocations.length > 0,
		hash: row.recordHash,
		prev: row.previousRecordHash,
	}));
}

export async function listAll(
	world: Pick<World, "owner">,
	claimId: string,
	options: { live?: boolean } = {}
): Promise<HealthEvidenceListItem[]> {
	const items: HealthEvidenceListItem[] = [];
	let before: number | undefined;
	for (let page = 0; page < 200; page++) {
		const result = expectSuccess(
			await listHealthEvidence(world.owner.id, claimId, {
				limit: 200,
				before,
				live: options.live,
			})
		);
		items.push(...result.items);
		if (result.nextBefore === null) {
			break;
		}
		before = result.nextBefore;
	}
	return items;
}

// ---------------------------------------------------------------------------
// An independent statement of the rule: what makes two results the same, and what a run keeps
// ---------------------------------------------------------------------------

const NAMED_PROVENANCE = new Set([
	"session",
	"pipeline_version",
	"run",
	"twin_version",
]);

function stable(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stable).join(",")}]`;
	}
	if (typeof value === "object" && value !== null) {
		const entries = Object.entries(value as Json)
			.sort(([a], [b]) => a.localeCompare(b, "en"))
			.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`);
		return `{${entries.join(",")}}`;
	}
	return JSON.stringify(value);
}

/** Equal for two rows exactly when the rule calls them the same result (apart from the verdict, comparison and withdrawal conditions). */
function resultKey(row: Row): string {
	const record = structuredClone(row.record);
	record.record_id = undefined;
	record.timestamp = undefined;
	record.comment = undefined;
	const provenance = (record.provenance ?? {}) as Json;
	record.provenance = Object.fromEntries(
		Object.entries(provenance).filter(([key]) => NAMED_PROVENANCE.has(key))
	);
	return `${stable(record)}|${row.createdById}|${row.revision}`;
}

/** Sessions in a case where any record at all, of any claim, carries a non-empty `valid_while`. */
export async function sessionsWithConditions(
	caseId: string
): Promise<Set<string>> {
	const rows = await prisma.pluginHealthEvidence.findMany({
		where: { claim: { caseId } },
		select: { session: true, record: true },
	});
	const sessions = new Set<string>();
	for (const row of rows) {
		const validWhile = (row.record as Json).valid_while;
		if (
			typeof validWhile === "object" &&
			validWhile !== null &&
			Object.keys(validWhile).length > 0
		) {
			sessions.add(row.session);
		}
	}
	return sessions;
}

interface OracleResult {
	/** The last record the call examined (kept, and the context for the next call). */
	lastSeq: number | null;
	removed: Set<string>;
}

/**
 * What one call must remove from a claim's surviving rows. `contextSeq` is the
 * last record examined by the previous call: it is read as the start of the
 * stretch, never removed, and only the records after it are examined.
 */
function oracle(
	rows: Row[],
	cutoffMs: number,
	protectedSessions: Set<string>,
	contextSeq: number | null = null
): OracleResult {
	const prefix = examinedPrefix(rows, cutoffMs, contextSeq);
	const keys = prefix.map((row) => keyIfRemovable(row, protectedSessions));
	const removed = new Set<string>();
	let first = 0;
	while (first < prefix.length) {
		const last = runEnd(prefix, keys, first);
		for (const id of removedFromRun(prefix, first, last)) {
			removed.add(id);
		}
		first = last + 1;
	}
	return { removed, lastSeq: prefix.at(-1)?.seq ?? null };
}

/** The rows a call examines: from the context record (if any) up to the first row that arrived at or after the cut-off. */
function examinedPrefix(
	rows: Row[],
	cutoffMs: number,
	contextSeq: number | null
): Row[] {
	let start = 0;
	if (contextSeq !== null) {
		start = rows.findIndex((row) => row.seq === contextSeq);
		if (start < 0) {
			throw new Error("the context record is missing");
		}
	}
	const prefix: Row[] = [];
	for (let i = start; i < rows.length; i++) {
		const row = rows[i] as Row;
		const isContext = contextSeq !== null && i === start;
		if (!isContext && row.createdAt >= cutoffMs) {
			break;
		}
		prefix.push(row);
	}
	return prefix;
}

/** The result key of a row the rule may remove; null for one it never removes. */
function keyIfRemovable(
	row: Row,
	protectedSessions: Set<string>
): string | null {
	const plain =
		row.verdict === "PASS" &&
		row.echo === "MATCH" &&
		!row.everWithdrawn &&
		!protectedSessions.has(row.session);
	return plain ? resultKey(row) : null;
}

/** Where the run that starts at `first` ends (`first` itself for a single record). */
function runEnd(prefix: Row[], keys: (string | null)[], first: number): number {
	let last = first;
	while (
		last + 1 < prefix.length &&
		keys[first] !== null &&
		keys[last + 1] === keys[first] &&
		(prefix[last + 1] as Row).ts >= (prefix[last] as Row).ts
	) {
		last++;
	}
	return last;
}

/** The ids the rule removes from the run `prefix[first..last]`: everything but its ends, the hourly records and either side of a pause. */
function removedFromRun(prefix: Row[], first: number, last: number): string[] {
	const removed: string[] = [];
	let lastKept = (prefix[first] as Row).ts;
	for (let m = first + 1; m < last; m++) {
		const row = prefix[m] as Row;
		const next = prefix[m + 1] as Row;
		if (row.ts - lastKept >= HOUR || next.ts - row.ts >= HOUR) {
			lastKept = row.ts;
		} else {
			removed.push(row.id);
		}
	}
	return removed;
}

interface Stretch {
	afterId: string;
	beforeId: string;
	count: number;
	firstSeq: number;
	firstTs: number;
	lastSeq: number;
	lastTs: number;
}

/** The maximal stretches of `removed` in `rows`, each with the survivors either side. */
function stretchesOf(rows: Row[], removed: Set<string>): Stretch[] {
	const found: Stretch[] = [];
	let i = 0;
	while (i < rows.length) {
		if (removed.has((rows[i] as Row).id)) {
			let j = i;
			while (j + 1 < rows.length && removed.has((rows[j + 1] as Row).id)) {
				j++;
			}
			const before = rows[i - 1];
			const after = rows[j + 1];
			if (!(before && after)) {
				throw new Error("a removed stretch has no kept record beside it");
			}
			found.push({
				beforeId: before.id,
				afterId: after.id,
				count: j - i + 1,
				firstSeq: (rows[i] as Row).seq,
				lastSeq: (rows[j] as Row).seq,
				firstTs: (rows[i] as Row).ts,
				lastTs: (rows[j] as Row).ts,
			});
			i = j + 1;
		} else {
			i++;
		}
	}
	return found;
}

// ---------------------------------------------------------------------------
// A verifier that has only the evidence list items
// ---------------------------------------------------------------------------

/** Two list items that the rule would call the same result, judged from the items alone. */
function sameResult(a: HealthEvidenceListItem, b: HealthEvidenceListItem) {
	const key = (item: HealthEvidenceListItem) =>
		resultKey({
			record: item.record as unknown as Json,
			createdById: item.created_by_id,
			revision: item.criteria_revision,
		} as unknown as Row);
	return (
		a.echo_state === "match" &&
		b.echo_state === "match" &&
		a.record.verdict === "pass" &&
		b.record.verdict === "pass" &&
		key(a) === key(b)
	);
}

/**
 * Walks a claim's whole list as an outside verifier would: recomputes every
 * hash from the item alone, requires every link to match the older neighbour,
 * and accepts a break only where the item carries a note. Returns what it
 * found wrong.
 */
export function verifyFromItems(items: HealthEvidenceListItem[]): string[] {
	const problems: string[] = [];
	const ascending = [...items].sort(
		(a, b) => a.chain_sequence - b.chain_sequence
	);
	let previous: HealthEvidenceListItem | undefined;
	for (const item of ascending) {
		problems.push(...hashProblems(item), ...linkProblems(item, previous));
		previous = item;
	}
	return problems;
}

/** The item's own hash recomputed from the item alone, and the field every item must carry. */
function hashProblems(item: HealthEvidenceListItem): string[] {
	const label = `seq ${item.chain_sequence}`;
	const problems: string[] = [];
	const recomputed = computeRecordHash(
		{
			record: item.record,
			createdById: item.created_by_id,
			createdAt: item.created_at,
		},
		item.previous_record_hash
	);
	if (recomputed !== item.record_hash) {
		problems.push(`${label}: hash does not recompute`);
	}
	if (item.thinned_before === undefined) {
		problems.push(`${label}: thinned_before is missing`);
	}
	return problems;
}

/** What is wrong with the link from `item` to the next older item, if there is one. */
function linkProblems(
	item: HealthEvidenceListItem,
	previous: HealthEvidenceListItem | undefined
): string[] {
	const label = `seq ${item.chain_sequence}`;
	if (previous === undefined) {
		return firstItemProblems(item, label);
	}
	if (item.previous_record_hash === previous.record_hash) {
		return item.thinned_before ? [`${label}: note on an unbroken link`] : [];
	}
	if (item.thinned_before) {
		return gapProblems(item, previous, item.thinned_before, label);
	}
	return [`${label}: broken link without a note`];
}

function firstItemProblems(
	item: HealthEvidenceListItem,
	label: string
): string[] {
	const problems: string[] = [];
	if (item.previous_record_hash !== null) {
		problems.push(`${label}: first record has a previous hash`);
	}
	if (item.thinned_before) {
		problems.push(`${label}: first record has a note`);
	}
	return problems;
}

type ThinnedNote = NonNullable<HealthEvidenceListItem["thinned_before"]>;

/** Whether a note's counts and chain positions fit between the two kept records. */
function noteFitsGap(
	note: ThinnedNote,
	previous: HealthEvidenceListItem,
	item: HealthEvidenceListItem
): boolean {
	const span = note.last_removed_sequence - note.first_removed_sequence + 1;
	return (
		note.first_removed_sequence > previous.chain_sequence &&
		note.last_removed_sequence < item.chain_sequence &&
		note.first_removed_sequence <= note.last_removed_sequence &&
		note.removed_count >= 1 &&
		note.removed_count <= span
	);
}

/** Whether the removed stretch lies between the kept records in time. */
function noteTimesFit(
	note: ThinnedNote,
	previous: HealthEvidenceListItem,
	item: HealthEvidenceListItem
): boolean {
	const first = Date.parse(note.first_removed_at);
	const last = Date.parse(note.last_removed_at);
	const lower = Date.parse(previous.record.timestamp);
	const upper = Date.parse(item.record.timestamp);
	return lower <= first && first <= last && last <= upper;
}

/** A broken link that carries a note: the note must fit, and both kept records must say the same thing. */
function gapProblems(
	item: HealthEvidenceListItem,
	previous: HealthEvidenceListItem,
	note: ThinnedNote,
	label: string
): string[] {
	const problems: string[] = [];
	if (!noteFitsGap(note, previous, item)) {
		problems.push(`${label}: note does not fit the gap`);
	}
	if (!sameResult(previous, item)) {
		problems.push(`${label}: the kept records either side of the gap differ`);
	}
	if (!noteTimesFit(note, previous, item)) {
		problems.push(
			`${label}: the note's times do not lie between the kept records`
		);
	}
	return problems;
}

// ---------------------------------------------------------------------------
// What the rest of the application computes from the log
// ---------------------------------------------------------------------------

/** Every status-like answer the application derives from the log, at several instants. */
export async function statusPicture(world: World, instants: number[]) {
	const picture: Record<string, unknown> = {};
	for (const claim of world.claims) {
		for (const instant of instants) {
			picture[`status ${claim.id} @${instant}`] = await computeHealthStatus(
				claim.id,
				world.caseId,
				new Date(instant)
			);
		}
		const criteria = await readCriteria(world.owner.id, claim.id);
		picture[`latest result ${claim.id}`] =
			"data" in criteria ? criteria.data.latest_result : criteria;
	}
	picture.hygiene = await readHealthHygiene(world.owner.id, world.caseId);
	return picture;
}

/** The writes thinning makes, as one comparable value. */
export async function storeFingerprint() {
	const [evidence, notes, states, revocations] = await Promise.all([
		prisma.pluginHealthEvidence.findMany({
			select: { id: true },
			orderBy: { chainSequence: "asc" },
		}),
		prisma.pluginHealthThinnedRun.count(),
		prisma.pluginHealthClaimState.findMany({
			orderBy: { claimId: "asc" },
		}),
		prisma.pluginHealthRevocation.count(),
	]);
	return {
		evidence: evidence.map((row) => row.id),
		notes,
		states,
		revocations,
	};
}

// ---------------------------------------------------------------------------
// A seeded random log
// ---------------------------------------------------------------------------

export function rng(seed: number): () => number {
	const modulus = 4_294_967_296;
	let state = seed % modulus;
	return () => {
		// A linear congruential generator: the product stays below 2^53.
		state = (state * 1_664_525 + 1_013_904_223) % modulus;
		return state / modulus;
	};
}

interface RandomLogOptions {
	/** Records per claim. */
	count: number;
	/** No record arrives after this (default a minute before `NOW`). */
	end?: number;
	/** Where the first record of each claim arrives. */
	start: number;
}

/** "SV" is the session some record of which carries a condition. */
function pickSession(roll: number): string {
	if (roll < 0.15) {
		return "SV";
	}
	return roll < 0.55 ? "S1" : "S2";
}

function pickVerdict(
	roll: number
): "pass" | "marginal" | "fail" | "indeterminate" {
	if (roll < 0.04) {
		return "fail";
	}
	if (roll < 0.06) {
		return "marginal";
	}
	if (roll < 0.07) {
		return "indeterminate";
	}
	return "pass";
}

function between(random: () => number, low: number, high: number): number {
	return Math.floor(low + random() * (high - low));
}

/**
 * Fills every claim of the world with a log that has bursts of repeats,
 * pauses of every length, changes of value, other accounts, other sessions,
 * failures, odd timestamps, mismatching settings and withdrawn records.
 * Some records of the session "SV" carry a condition, so that session is left
 * whole in every claim.
 */
export async function fillRandomly(
	world: World,
	seed: number,
	options: RandomLogOptions
): Promise<void> {
	const random = rng(seed);
	for (const [claimIndex, claim] of world.claims.entries()) {
		if (claim.served) {
			await fillClaimRandomly(world, claimIndex, random, options);
		}
	}
}

/** What drifts from one random record to the next in a claim's log. */
interface Drift {
	account: number;
	arrival: number;
	payload: Json | undefined;
	previousTs: number;
	session: string;
	value: unknown;
}

/** The wait before the next record: mostly seconds, sometimes minutes, hours or most of a working day. */
function pickGap(random: () => number): number {
	const pick = random();
	if (pick < 0.75) {
		return between(random, 6 * SECOND, 90 * SECOND);
	}
	if (pick < 0.87) {
		return between(random, 5 * MINUTE, 50 * MINUTE);
	}
	if (pick < 0.95) {
		return between(random, 55 * MINUTE, 3 * HOUR);
	}
	return between(random, 4 * HOUR, 8 * HOUR);
}

/** The record's own timestamp: just before its arrival, or now and then a repeat of the last or an earlier one. */
function pickTimestamp(random: () => number, drift: Drift): number {
	const ts = drift.arrival - between(random, 0, 2 * SECOND);
	const oddity = random();
	if (oddity < 0.05) {
		return drift.previousTs;
	}
	if (oddity < 0.1) {
		return drift.arrival - between(random, MINUTE, 90 * MINUTE);
	}
	return ts;
}

/** Now and then changes the value, account, session or payload that later records carry. */
function driftState(
	random: () => number,
	drift: Drift,
	accounts: number
): void {
	if (random() < 0.08) {
		drift.value = { number: between(random, 0, 4), unit: "ratio" };
	}
	if (random() < 0.03) {
		drift.account = accounts > 1 ? (drift.account + 1) % accounts : 0;
	}
	if (random() < 0.03) {
		drift.session = pickSession(random());
	}
	if (random() < 0.04) {
		drift.payload =
			random() < 0.5 ? undefined : { phase: between(random, 0, 3) };
	}
}

/** The odd features a random record may carry. */
interface Oddities {
	conditional: boolean;
	equivalentWindow: boolean;
	mismatching: boolean;
	verdict: "pass" | "marginal" | "fail" | "indeterminate";
}

function pickOddities(random: () => number, session: string): Oddities {
	const verdict = pickVerdict(random());
	const mismatching = random() < 0.03;
	const equivalentWindow = random() < 0.03;
	const conditional = session === "SV" && random() < 0.12;
	return { verdict, mismatching, equivalentWindow, conditional };
}

function applyOddities(record: Json, drift: Drift, oddities: Oddities) {
	if (drift.payload) {
		record.payload = drift.payload;
	}
	if (oddities.mismatching) {
		record.window = "PT2M";
	}
	if (oddities.equivalentWindow) {
		record.window = "PT60S";
	}
	if (oddities.conditional) {
		record.valid_while = { twin_version: "2.3" };
	}
}

async function fillClaimRandomly(
	world: World,
	claimIndex: number,
	random: () => number,
	options: RandomLogOptions
): Promise<void> {
	const arrival = options.start + between(random, 0, 10 * MINUTE);
	const drift: Drift = {
		arrival,
		previousTs: arrival,
		value: { number: 1, unit: "ratio" },
		session: "S1",
		account: 0,
		payload: undefined,
	};
	for (let i = 0; i < options.count; i++) {
		drift.arrival += pickGap(random);
		if (drift.arrival > (options.end ?? NOW - MINUTE)) {
			break;
		}
		const ts = pickTimestamp(random, drift);
		drift.previousTs = ts;
		driftState(random, drift, world.pipelines.length);
		const oddities = pickOddities(random, drift.session);
		const recordId = await put(world, claimIndex, {
			ts,
			arrived: Math.max(drift.arrival, ts),
			account: drift.account,
			verdict: oddities.verdict,
			value: drift.value,
			session: drift.session,
			mutate: (record) => applyOddities(record, drift, oddities),
		});
		await maybeWithdraw(world, claimIndex, random, recordId);
	}
}

/** Now and then withdraws the record just stored, and sometimes reinstates it. */
async function maybeWithdraw(
	world: World,
	claimIndex: number,
	random: () => number,
	recordId: string
): Promise<void> {
	if (random() < 0.04) {
		await withdraw(world, claimIndex, recordId);
		if (random() < 0.3) {
			await reinstate(world, claimIndex, recordId);
		}
	}
}

// ---------------------------------------------------------------------------
// Comparing a call with the rule
// ---------------------------------------------------------------------------

/** Each claim's surviving records, oldest first. */
export type Log = Map<string, Row[]>;

export async function captureLog(world: World): Promise<Log> {
	const log: Log = new Map();
	for (const claim of world.claims) {
		log.set(claim.id, await readRows(claim.id));
	}
	return log;
}

/** The union of two snapshots by record id, oldest first: the log as it would be had nothing been removed. */
export function unionLog(older: Log | null, newer: Log): Log {
	const merged: Log = new Map();
	for (const [claimId, rows] of newer) {
		const byId = new Map<string, Row>();
		for (const row of older?.get(claimId) ?? []) {
			byId.set(row.id, row);
		}
		for (const row of rows) {
			byId.set(row.id, row);
		}
		merged.set(
			claimId,
			[...byId.values()].sort((a, b) => a.seq - b.seq)
		);
	}
	return merged;
}

export type Contexts = Map<string, number | null>;

/** What one call at `cutoffMs` must remove from every claim, given where the previous call stopped. */
export async function expectedRemoval(
	world: World,
	current: Log,
	cutoffMs: number,
	contexts: Contexts = new Map()
): Promise<Map<string, OracleResult>> {
	const protectedSessions = await sessionsWithConditions(world.caseId);
	const expected = new Map<string, OracleResult>();
	for (const [claimId, rows] of current) {
		expected.set(
			claimId,
			oracle(rows, cutoffMs, protectedSessions, contexts.get(claimId) ?? null)
		);
	}
	return expected;
}

export function totalRemoved(expected: Map<string, OracleResult>): number {
	let total = 0;
	for (const result of expected.values()) {
		total += result.removed.size;
	}
	return total;
}

/** Where each claim's mark moves to once the call has run, for the next call's oracle. */
export function nextContexts(
	expected: Map<string, OracleResult>,
	previous: Contexts = new Map()
): Contexts {
	const next: Contexts = new Map(previous);
	for (const [claimId, result] of expected) {
		if (result.lastSeq !== null) {
			next.set(claimId, result.lastSeq);
		}
	}
	return next;
}

const positions = (rows: Row[], ids: Iterable<string>): number[] => {
	const wanted = new Set(ids);
	return rows.flatMap((row, index) => (wanted.has(row.id) ? [index] : []));
};

/** Differences between what the call removed and what the rule says it must. */
export async function removalProblems(
	world: World,
	before: Log,
	expected: Map<string, OracleResult>
): Promise<string[]> {
	const problems: string[] = [];
	for (const [claimId, rows] of before) {
		const now = new Set((await readRows(claimId)).map((row) => row.id));
		const actual = rows.filter((row) => !now.has(row.id)).map((row) => row.id);
		const want = expected.get(claimId)?.removed ?? new Set<string>();
		const index = world.claims.findIndex((claim) => claim.id === claimId);
		const wrongly = positions(
			rows,
			actual.filter((id) => !want.has(id))
		);
		const missed = positions(
			rows,
			[...want].filter((id) => now.has(id))
		);
		if (wrongly.length > 0) {
			problems.push(`claim ${index}: removed against the rule, at ${wrongly}`);
		}
		if (missed.length > 0) {
			problems.push(`claim ${index}: kept against the rule, at ${missed}`);
		}
	}
	return problems;
}

/** Differences between the notes in the database and the stretches that are actually gone. */
export async function noteProblems(
	world: World,
	everything: Log
): Promise<string[]> {
	const problems: string[] = [];
	for (const [claimId, rows] of everything) {
		const index = world.claims.findIndex((claim) => claim.id === claimId);
		const surviving = new Set((await readRows(claimId)).map((row) => row.id));
		const removed = new Set(
			rows.filter((row) => !surviving.has(row.id)).map((row) => row.id)
		);
		const stretches = stretchesOf(rows, removed);
		const notes = await prisma.pluginHealthThinnedRun.findMany({
			where: { claimId },
		});
		if (notes.length !== stretches.length) {
			problems.push(
				`claim ${index}: ${notes.length} notes for ${stretches.length} removed stretches`
			);
		}
		for (const stretch of stretches) {
			const note = notes.find((entry) => entry.keptAfterId === stretch.afterId);
			if (!note) {
				problems.push(
					`claim ${index}: no note for the stretch at ${stretch.firstSeq}`
				);
				continue;
			}
			const got = {
				before: note.keptBeforeId,
				count: note.removedCount,
				firstSeq: note.firstRemovedSequence,
				lastSeq: note.lastRemovedSequence,
				firstTs: note.firstRemovedAt.getTime(),
				lastTs: note.lastRemovedAt.getTime(),
			};
			const want = {
				before: stretch.beforeId,
				count: stretch.count,
				firstSeq: stretch.firstSeq,
				lastSeq: stretch.lastSeq,
				firstTs: stretch.firstTs,
				lastTs: stretch.lastTs,
			};
			if (stable(got) !== stable(want)) {
				problems.push(
					`claim ${index}: note at ${stretch.firstSeq} says ${stable(got)}, expected ${stable(want)}`
				);
			}
		}
	}
	return problems;
}

/** What an outside verifier finds wrong with every claim's list. */
export async function chainProblems(world: World): Promise<string[]> {
	const problems: string[] = [];
	for (const [index, claim] of world.claims.entries()) {
		const items = await listAll(world, claim.id);
		for (const problem of verifyFromItems(items)) {
			problems.push(`claim ${index}: ${problem}`);
		}
	}
	return problems;
}

/** The instants at which a status is compared: fresh, just stale, long stale. */
export function statusInstants(latestMs: number): number[] {
	return [latestMs + SECOND, latestMs + 10 * MINUTE, NOW, NOW + 30 * DAY];
}

/**
 * Whatever the batching, a removed record was never removable-by-exception,
 * lay inside a run (same result as the records either side, timestamps in
 * order), was less than an hour after the last kept record, and was not
 * followed by a pause.
 */
export function rulebookProblems(
	before: Log,
	protectedSessions: Set<string>,
	now: Map<string, Set<string>>
) {
	const problems: string[] = [];
	for (const [claimId, rows] of before) {
		const survivors = now.get(claimId) ?? new Set<string>();
		for (const [index, row] of rows.entries()) {
			if (!survivors.has(row.id)) {
				const label = `claim ${claimId.slice(0, 4)} #${index}`;
				problems.push(
					...removedProblems(label, rows, index, survivors, protectedSessions)
				);
			}
		}
	}
	return problems;
}

/** What is wrong with the rule having removed `rows[index]`, given the records that survived. */
function removedProblems(
	label: string,
	rows: Row[],
	index: number,
	survivors: Set<string>,
	protectedSessions: Set<string>
): string[] {
	const row = rows[index] as Row;
	const problems: string[] = [];
	if (isNeverRemovable(row, protectedSessions)) {
		problems.push(`${label}: removed although it is never removable`);
	}
	const previous = rows[index - 1];
	const next = rows[index + 1];
	if (!(previous && next)) {
		problems.push(`${label}: removed at the edge of the log`);
		return problems;
	}
	if (
		resultKey(previous) !== resultKey(row) ||
		resultKey(next) !== resultKey(row)
	) {
		problems.push(`${label}: removed beside a different result`);
	}
	if (previous.ts > row.ts || next.ts < row.ts) {
		problems.push(`${label}: removed beside a record out of order`);
	}
	problems.push(...timingProblems(label, rows, index, survivors));
	return problems;
}

/** Not a passing match, ever withdrawn, or in a session where a condition is carried. */
function isNeverRemovable(row: Row, protectedSessions: Set<string>): boolean {
	return (
		!(row.verdict === "PASS" && row.echo === "MATCH") ||
		row.everWithdrawn ||
		protectedSessions.has(row.session)
	);
}

/** A removed record is less than an hour after the last kept one and not before a pause. */
function timingProblems(
	label: string,
	rows: Row[],
	index: number,
	survivors: Set<string>
): string[] {
	const row = rows[index] as Row;
	const next = rows[index + 1] as Row;
	const problems: string[] = [];
	const earlier = rows
		.slice(0, index)
		.reverse()
		.find((candidate) => survivors.has(candidate.id));
	if (!earlier || row.ts - earlier.ts >= HOUR) {
		problems.push(
			`${label}: removed although an hour had passed since the last kept`
		);
	}
	if (next.ts - row.ts >= HOUR) {
		problems.push(`${label}: removed before a pause`);
	}
	return problems;
}
