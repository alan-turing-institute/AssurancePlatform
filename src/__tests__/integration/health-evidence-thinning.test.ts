import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	computeRecordHash,
	listHealthEvidence,
	reinstateHealthEvidence,
	revokeHealthEvidence,
	THINNING_LOCK_NAME,
} from "@/lib/services/health-evidence-service";
import { computeHealthStatus } from "@/lib/services/health-status-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	addClaim,
	MINUTE,
	setupClaim,
	setupMachineWriter,
} from "../utils/health-adversarial-kit";
import {
	appendAt,
	appendSeries,
	markMatched,
	NOW,
	OLD,
	pick,
	storedRecordIds,
	thin,
} from "../utils/health-thinning-kit";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

/** A time `hours` and `minutes` after `OLD`, two days before the job runs. */
const at = (hours: number, minutes: number) =>
	new Date(OLD.getTime() + (hours * 60 + minutes) * MINUTE);

const EVERY_TEN_MINUTES = 10 * MINUTE;
const EVERY_FIVE_MINUTES = 5 * MINUTE;

/**
 * Three runs of one result on one claim, all old enough to thin: five records
 * from 00:00, five from 03:40 (a three-hour pause before them) and fourteen
 * from 06:00 (a pause of an hour and forty minutes), each ten minutes apart.
 * The rule keeps the first and last record, the first record an hour after
 * the last one kept, and both sides of each pause, so sixteen go.
 */
async function seedThreeRuns() {
	const world = await setupClaim();
	const { owner, claim } = world;
	const a = await appendSeries(
		owner.id,
		claim.id,
		at(0, 0),
		5,
		EVERY_TEN_MINUTES
	);
	const b = await appendSeries(
		owner.id,
		claim.id,
		at(3, 40),
		5,
		EVERY_TEN_MINUTES,
		{ firstIndex: 5 }
	);
	const c = await appendSeries(
		owner.id,
		claim.id,
		at(6, 0),
		14,
		EVERY_TEN_MINUTES,
		{ firstIndex: 10 }
	);
	await markMatched(claim.id);
	return { ...world, a, b, c };
}

const KEPT_OF_THREE_RUNS = (ids: { a: string[]; b: string[]; c: string[] }) => [
	...pick(ids.a, [0, 4]),
	...pick(ids.b, [0, 4]),
	...pick(ids.c, [0, 6, 12, 13]),
];

const SEQUENCE_OF = async (claimId: string) =>
	new Map(
		(
			await prisma.pluginHealthEvidence.findMany({
				where: { claimId },
				select: { recordId: true, chainSequence: true, recordHash: true },
			})
		).map((row) => [row.recordId, row])
	);

describe("thinHealthEvidence — what a thinned run keeps", () => {
	it("keeps the first and last of a run, one per hour and both sides of a pause, and writes a note for each removed stretch", async () => {
		const world = await seedThreeRuns();
		const { claim, a, b, c } = world;
		const before = await SEQUENCE_OF(claim.id);

		const result = await thin();

		expect(result).toEqual({
			busy: false,
			claimsProcessed: 1,
			more: false,
			recordsRemoved: 16,
			runsRecorded: 4,
		});
		expect(await storedRecordIds(claim.id)).toEqual(
			KEPT_OF_THREE_RUNS({ a, b, c })
		);

		const notes = await prisma.pluginHealthThinnedRun.findMany({
			where: { claimId: claim.id },
			orderBy: { firstRemovedSequence: "asc" },
			include: {
				keptBefore: { select: { recordId: true } },
				keptAfter: { select: { recordId: true } },
			},
		});
		expect(
			notes.map((note) => [
				note.keptBefore.recordId,
				note.keptAfter.recordId,
				note.removedCount,
			])
		).toEqual([
			[a[0], a[4], 3],
			[b[0], b[4], 3],
			[c[0], c[6], 5],
			[c[6], c[12], 5],
		]);
		expect(notes[0]).toMatchObject({
			firstRemovedSequence: before.get(a[1] ?? "")?.chainSequence,
			lastRemovedSequence: before.get(a[3] ?? "")?.chainSequence,
			firstRemovedAt: at(0, 10),
			lastRemovedAt: at(0, 30),
			ruleVersion: 1,
		});
		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.thinnedThroughSequence).toBe(
			before.get(c[13] ?? "")?.chainSequence
		);
	});

	it("touches nothing that arrived at or after the cut-off", async () => {
		const { owner, claim } = await setupClaim();
		const older = await appendSeries(
			owner.id,
			claim.id,
			new Date("2026-10-15T10:40:00.000Z"),
			5,
			EVERY_TEN_MINUTES
		);
		const recent = await appendSeries(
			owner.id,
			claim.id,
			new Date("2026-10-15T12:00:00.000Z"),
			5,
			EVERY_TEN_MINUTES,
			{ firstIndex: 5 }
		);
		await markMatched(claim.id);

		const result = await thin();

		expect(result.recordsRemoved).toBe(3);
		expect(await storedRecordIds(claim.id)).toEqual([
			...pick(older, [0, 4]),
			...recent,
		]);
	});
});

describe("thinHealthEvidence — what is never removed", () => {
	const NEVER_REMOVED = [
		["a fail", { overrides: { verdict: "fail" } }],
		["a marginal result", { overrides: { verdict: "marginal" } }],
		[
			"a could-not-judge result",
			{
				overrides: {
					verdict: "indeterminate",
					value: undefined,
					uncertainty: undefined,
					judged: undefined,
					comment: "No readings in the window",
				},
			},
		],
		["a result flagged as differing from the settings", { echo: "MISMATCH" }],
		["a result with no settings to compare against", { echo: "UNDECLARED" }],
		["a withdrawn result", { withdrawn: true }],
		[
			"a withdrawn and reinstated result",
			{ withdrawn: true, reinstated: true },
		],
	] as const;

	it.each(
		NEVER_REMOVED
	)("keeps %s, and it ends the run on both sides", async (_label, kind) => {
		const { owner, claim } = await setupClaim();
		const before = await appendSeries(
			owner.id,
			claim.id,
			at(0, 0),
			3,
			EVERY_FIVE_MINUTES
		);
		const odd = await appendAt(
			owner.id,
			claim.id,
			at(0, 15),
			3,
			"overrides" in kind ? kind.overrides : {}
		);
		const after = await appendSeries(
			owner.id,
			claim.id,
			at(0, 20),
			3,
			EVERY_FIVE_MINUTES,
			{ firstIndex: 4 }
		);
		await markMatched(claim.id);
		if ("echo" in kind) {
			await prisma.pluginHealthEvidence.update({
				where: { recordId: odd },
				data: { echoState: kind.echo },
			});
		}
		if ("withdrawn" in kind) {
			expectSuccess(
				await revokeHealthEvidence(owner.id, claim.id, odd, {
					cause: "evidence-defect",
					reason: "Bad run",
				})
			);
		}
		if ("reinstated" in kind) {
			expectSuccess(
				await reinstateHealthEvidence(owner.id, claim.id, odd, {
					reason: "Run was fine",
				})
			);
		}

		const result = await thin();

		// Without the odd record the six passes would shrink to their first and
		// last; with it, each side keeps the record next to it too.
		expect(result.recordsRemoved).toBe(2);
		expect(await storedRecordIds(claim.id)).toEqual([
			...pick(before, [0, 2]),
			odd,
			...pick(after, [0, 2]),
		]);
	});
});

describe("thinHealthEvidence — what makes two results the same", () => {
	const VERSIONED_CHECK = {
		name: "Unit Drift Checker",
		version: "2.1",
		scope: "unit",
	};
	const CHANGES: [string, Record<string, unknown> | "account" | "revision"][] =
		[
			["value", { value: { number: 0.32, unit: "mm" } }],
			[
				"uncertainty",
				{
					uncertainty: {
						kind: "std",
						params: { std: 0.05 },
						method: "bootstrap",
						nature: "predictive",
					},
				},
			],
			[
				"judged value",
				{ judged: { statistic: "mean", method: "bootstrap", value: 0.32 } },
			],
			["payload", { payload: { detail: "changed" } }],
			["settings revision", "revision"],
			["session", { provenance: { session: "RUN-B" } }],
			["pipeline version", { provenance: { pipeline_version: "0.5.0" } }],
			["twin version", { provenance: { twin_version: "2.4" } }],
			["run", { provenance: { run: "online" } }],
			["check version", { check: VERSIONED_CHECK }],
			["subject", { subject: { kind: "unit", id: "U-8" } }],
			[
				"rule",
				{
					rule: {
						kind: "threshold",
						direction: "minimize",
						params: { pass_values: 0.5, marginal_values: 1 },
						version: "r5",
					},
				},
			],
			["window", { window: "PT10M" }],
			["time limit", { valid_for: "P2D" }],
			["recording account", "account"],
		];

	it.each(CHANGES)("a change of %s ends a run", async (_label, change) => {
		const { owner, testCase, claim } = await setupClaim();
		const first = await appendSeries(
			owner.id,
			claim.id,
			at(0, 0),
			2,
			EVERY_FIVE_MINUTES
		);
		const writer =
			change === "account"
				? (await setupMachineWriter(owner.id, testCase.id)).systemUserId
				: owner.id;
		const second = await appendSeries(
			writer,
			claim.id,
			at(0, 10),
			2,
			EVERY_FIVE_MINUTES,
			{
				firstIndex: 2,
				overrides: typeof change === "object" ? change : {},
			}
		);
		await markMatched(claim.id);
		if (change === "revision") {
			await prisma.pluginHealthEvidence.updateMany({
				where: { recordId: { in: second } },
				data: { criteriaRevision: 2 },
			});
		}

		const result = await thin();

		expect(result.recordsRemoved).toBe(0);
		expect(await storedRecordIds(claim.id)).toEqual([...first, ...second]);
	});

	it("does not end a run when the reading lists, the comment or an extra provenance value differ", async () => {
		const { owner, claim } = await setupClaim();
		// Each record carries its own reading list, failed subject, comment and
		// simulated clock; everything else is the same.
		const ids = await appendSeries(
			owner.id,
			claim.id,
			at(0, 0),
			4,
			EVERY_FIVE_MINUTES
		);
		await markMatched(claim.id);

		const result = await thin();

		expect(result.recordsRemoved).toBe(2);
		expect(await storedRecordIds(claim.id)).toEqual(pick(ids, [0, 3]));
	});

	it("leaves a session whole while any record in the case carries a valid_while condition, and thins one that none does", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const other = await addClaim(testCase.id, owner.id);
		await appendAt(owner.id, other.id, at(0, 0), 0, {
			valid_while: { sim_state: "ok" },
			provenance: { sim_state: "ok" },
		});
		const guarded = await appendSeries(
			owner.id,
			claim.id,
			at(0, 0),
			4,
			EVERY_FIVE_MINUTES
		);
		const free = await appendSeries(
			owner.id,
			claim.id,
			at(0, 20),
			4,
			EVERY_FIVE_MINUTES,
			{
				firstIndex: 4,
				overrides: { provenance: { session: "RUN-B" } },
			}
		);
		await markMatched(claim.id);
		await markMatched(other.id);

		const result = await thin();

		expect(result.recordsRemoved).toBe(2);
		expect(await storedRecordIds(claim.id)).toEqual([
			...guarded,
			...pick(free, [0, 3]),
		]);
	});

	it("thins a session whose only valid_while is an empty object, since that sets no condition", async () => {
		const { owner, claim } = await setupClaim();
		const ids = await appendSeries(
			owner.id,
			claim.id,
			at(0, 0),
			4,
			EVERY_FIVE_MINUTES,
			{ overrides: { valid_while: {} } }
		);
		await markMatched(claim.id);
		const stored = await prisma.pluginHealthEvidence.findFirst({
			where: { claimId: claim.id },
			select: { record: true },
		});
		expect(stored?.record).toMatchObject({ valid_while: {} });

		const result = await thin();

		expect(result.recordsRemoved).toBe(2);
		expect(await storedRecordIds(claim.id)).toEqual(pick(ids, [0, 3]));
	});
});

describe("thinHealthEvidence — the claim's status does not change", () => {
	it("ends a run when a timestamp goes backwards but not when it ties, and the same record stays current", async () => {
		const { owner, testCase, claim } = await setupClaim();
		// Arrival order, by the records' own timestamps: 00:00, 00:10, 00:20, 00:20
		// (a tie), then 00:05 (backwards), 00:15.
		const ids: string[] = [];
		for (const [index, [hours, minutes]] of [
			[0, 0],
			[0, 10],
			[0, 20],
			[0, 20],
			[0, 5],
			[0, 15],
		].entries()) {
			ids.push(
				await appendAt(owner.id, claim.id, at(hours ?? 0, minutes ?? 0), index)
			);
		}
		await markMatched(claim.id);
		const statusBefore = await computeHealthStatus(claim.id, testCase.id, NOW);
		expect(statusBefore?.record_id).toBe(ids[3]);

		const result = await thin();

		expect(result.recordsRemoved).toBe(2);
		expect(await storedRecordIds(claim.id)).toEqual(pick(ids, [0, 3, 4, 5]));
		expect(await computeHealthStatus(claim.id, testCase.id, NOW)).toEqual(
			statusBefore
		);
	});

	it("gives every claim the same verdict, expiry, staleness and current record afterwards", async () => {
		const { owner, testCase, claim: expired } = await setupClaim();
		const indefinite = await addClaim(testCase.id, owner.id);
		const failing = await addClaim(testCase.id, owner.id);
		const withdrawn = await addClaim(testCase.id, owner.id);
		const claims = [expired, indefinite, failing, withdrawn];

		for (const target of claims) {
			await appendSeries(owner.id, target.id, at(0, 0), 6, EVERY_TEN_MINUTES, {
				overrides: target === indefinite ? { valid_for: "indefinite" } : {},
			});
		}
		await appendAt(owner.id, failing.id, at(1, 0), 6, { verdict: "fail" });
		const lastOfWithdrawn = await appendAt(owner.id, withdrawn.id, at(1, 0), 6);
		for (const target of claims) {
			await markMatched(target.id);
		}
		expectSuccess(
			await revokeHealthEvidence(owner.id, withdrawn.id, lastOfWithdrawn, {
				cause: "duplicate",
				reason: "Repeat",
			})
		);
		const statuses = async () =>
			await Promise.all(
				claims.map((target) => computeHealthStatus(target.id, testCase.id, NOW))
			);
		const before = await statuses();

		const result = await thin();

		expect(result.recordsRemoved).toBeGreaterThan(0);
		expect(await statuses()).toEqual(before);
		expect(before.map((status) => status?.verdict)).toEqual([
			"pass",
			"pass",
			"fail",
			"pass",
		]);
	});
});

describe("thinHealthEvidence — the chain across a gap", () => {
	it("lets a verifier recompute every kept record's hash and account for every broken link from the list alone", async () => {
		const { owner, claim } = await seedThreeRuns();
		const before = await SEQUENCE_OF(claim.id);
		const hashBySequence = new Map(
			[...before.values()].map((row) => [row.chainSequence, row.recordHash])
		);
		await thin();

		const { items } = expectSuccess(
			await listHealthEvidence(owner.id, claim.id, { limit: 200 })
		);

		expect(items).toHaveLength(8);
		for (const item of items) {
			expect(
				computeRecordHash(
					{
						record: item.record,
						createdById: item.created_by_id,
						createdAt: item.created_at,
					},
					item.previous_record_hash
				)
			).toBe(item.record_hash);
		}
		let gaps = 0;
		for (const [index, newer] of items.slice(0, -1).entries()) {
			const older = items[index + 1];
			const linked = newer.previous_record_hash === older?.record_hash;
			expect(linked).toBe(newer.thinned_before === null);
			if (newer.thinned_before) {
				gaps++;
				// The kept record after the gap still names the last removed
				// record's hash, which depends on everything removed before it.
				expect(newer.previous_record_hash).toBe(
					hashBySequence.get(newer.thinned_before.last_removed_sequence)
				);
			}
		}
		expect(gaps).toBe(4);
		expect(items.at(-1)?.previous_record_hash).toBeNull();
	});
});

describe("thinHealthEvidence — repeated and later calls", () => {
	it("removes nothing more on a second call with the same cut-off", async () => {
		const { claim } = await seedThreeRuns();
		await thin();
		const stored = await storedRecordIds(claim.id);
		const notes = await prisma.pluginHealthThinnedRun.count();

		const again = await thin();

		expect(again).toEqual({
			busy: false,
			claimsProcessed: 0,
			more: false,
			recordsRemoved: 0,
			runsRecorded: 0,
		});
		expect(await storedRecordIds(claim.id)).toEqual(stored);
		expect(await prisma.pluginHealthThinnedRun.count()).toBe(notes);
	});

	it("continues from where the last night stopped without merging gaps", async () => {
		const { owner, claim } = await setupClaim();
		// One unbroken run, every fifteen minutes from 00:00 on the 14th to 08:00 on the 15th.
		const ids = await appendSeries(
			owner.id,
			claim.id,
			at(0, 0),
			129,
			15 * MINUTE
		);
		await markMatched(claim.id);

		const firstNight = await thin({
			now: new Date("2026-10-15T12:30:00.000Z"),
		});
		const afterFirst = await prisma.pluginHealthThinnedRun.findMany({
			where: { claimId: claim.id },
			select: { id: true },
			orderBy: { firstRemovedSequence: "asc" },
		});
		const secondNight = await thin();

		// First night: up to 11:45 on the 14th; second: from 12:00 on to 08:00.
		expect(firstNight).toMatchObject({ recordsRemoved: 35, runsRecorded: 12 });
		expect(secondNight).toMatchObject({ recordsRemoved: 60, runsRecorded: 20 });
		expect(await storedRecordIds(claim.id)).toContain(ids[47]);
		const notes = await prisma.pluginHealthThinnedRun.findMany({
			where: { claimId: claim.id },
			select: {
				id: true,
				removedCount: true,
				keptBefore: { select: { recordId: true } },
			},
			orderBy: { firstRemovedSequence: "asc" },
		});
		expect(notes).toHaveLength(32);
		// The first night's notes stand as they were, and the second night's
		// first note starts at the record the first night ended on: the run
		// carries on, and no note spans the night's edge.
		expect(notes.slice(0, 12).map((note) => note.id)).toEqual(
			afterFirst.map((note) => note.id)
		);
		expect(notes[12]).toMatchObject({
			removedCount: 3,
			keptBefore: { recordId: ids[47] },
		});
	});

	it("works one batch at a time within its time budget, reports more, and finishes on later calls", async () => {
		const { owner, claim } = await setupClaim();
		const ids = await appendSeries(owner.id, claim.id, at(0, 0), 25, MINUTE);
		await markMatched(claim.id);

		const options = { batchSize: 10, timeBudgetMs: 0 };
		const first = await thin(options);
		const second = await thin(options);
		const third = await thin(options);

		expect(first).toMatchObject({
			more: true,
			recordsRemoved: 8,
			runsRecorded: 1,
		});
		expect(second).toMatchObject({
			more: true,
			recordsRemoved: 8,
			runsRecorded: 1,
		});
		expect(third).toMatchObject({
			more: false,
			recordsRemoved: 5,
			runsRecorded: 1,
		});
		// Each batch edge keeps the one record it ends on; the run carries on
		// past it, so the next batch's first record is not kept as well.
		expect(await storedRecordIds(claim.id)).toEqual(pick(ids, [0, 9, 18, 24]));
	});

	it("returns busy, doing nothing, while another call holds the lock", async () => {
		const { claim } = await seedThreeRuns();

		await prisma.$transaction(async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${THINNING_LOCK_NAME}::text))`;
			expect(await thin()).toEqual({
				busy: true,
				claimsProcessed: 0,
				more: false,
				recordsRemoved: 0,
				runsRecorded: 0,
			});
		});

		expect(await storedRecordIds(claim.id)).toHaveLength(24);
		expect((await thin()).busy).toBe(false);
	});

	it("counts what it would remove on a dry run, removes and writes nothing, and a real run then matches", async () => {
		const { claim } = await seedThreeRuns();

		const dry = await thin({ dryRun: true });

		expect(dry).toEqual({
			busy: false,
			claimsProcessed: 1,
			more: false,
			recordsRemoved: 16,
			runsRecorded: 4,
		});
		expect(await storedRecordIds(claim.id)).toHaveLength(24);
		expect(await prisma.pluginHealthThinnedRun.count()).toBe(0);
		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.thinnedThroughSequence).toBeNull();
		expect(await thin()).toEqual(dry);
	});
});

describe("thinHealthEvidence — racing a withdrawal", () => {
	/** Four passes five minutes apart, of which the middle two would go. */
	async function seedFourPasses() {
		const { owner, claim } = await setupClaim();
		const ids = await appendSeries(
			owner.id,
			claim.id,
			at(0, 0),
			4,
			EVERY_FIVE_MINUTES
		);
		await markMatched(claim.id);
		return { owner, claim, ids };
	}
	const claimLock = (claimId: string) =>
		holdRowLock(async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
		});

	it("keeps both the record and its withdrawal when the withdrawal commits first", async () => {
		const { owner, claim, ids } = await seedFourPasses();
		const held = await claimLock(claim.id);
		const withdrawing = revokeHealthEvidence(owner.id, claim.id, ids[1] ?? "", {
			cause: "duplicate",
			reason: "Repeat",
		});
		await waitForLockWait(5000, 1);
		// The job reads the batch while the withdrawal is still uncommitted.
		const thinning = thin();
		await waitForLockWait(5000, 2);
		await held.release();

		expectSuccess(await withdrawing);
		const result = await thinning;

		expect(result).toMatchObject({ recordsRemoved: 0, runsRecorded: 0 });
		expect(await storedRecordIds(claim.id)).toHaveLength(4);
		expect(
			await prisma.pluginHealthRevocation.count({
				where: { evidence: { claimId: claim.id } },
			})
		).toBe(1);
	});

	it("makes a withdrawal that arrives while the job is deleting wait, then find the record gone, rather than report success and lose it", async () => {
		const { owner, claim, ids } = await seedFourPasses();
		// Holding the table in SHARE mode lets the job read and take the claim
		// lock, then stops its delete, which is where an unlocked withdrawal
		// would slip in.
		const held = await holdRowLock(async (tx) => {
			await tx.$executeRaw`LOCK TABLE plugin_health_evidence IN SHARE MODE`;
		});
		const thinning = thin();
		await waitForLockWait(5000, 1);
		const withdrawing = revokeHealthEvidence(owner.id, claim.id, ids[1] ?? "", {
			cause: "duplicate",
			reason: "Repeat",
		});
		await Promise.race([withdrawing, waitForLockWait(5000, 2)]);
		await held.release();

		const [withdrawn, result] = await Promise.all([withdrawing, thinning]);

		expect(result).toMatchObject({ recordsRemoved: 2, runsRecorded: 1 });
		expect(withdrawn).toEqual({ error: "Record not found" });
		expect(await storedRecordIds(claim.id)).toEqual(pick(ids, [0, 3]));
		expect(await prisma.pluginHealthRevocation.count()).toBe(0);
	});
});

describe("thinHealthEvidence — deleting for good", () => {
	it("removes a purged case's evidence and its thinned-run notes together", async () => {
		const { owner, testCase, claim } = await seedThreeRuns();
		await thin();
		expect(
			await prisma.pluginHealthThinnedRun.count({
				where: { claimId: claim.id },
			})
		).toBe(4);

		const { purgeCase, softDeleteCase } = await import(
			"@/lib/services/case-trash-service"
		);
		expectSuccess(await softDeleteCase(owner.id, testCase.id));
		expectSuccess(await purgeCase(owner.id, testCase.id));

		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: claim.id } })
		).toBe(0);
		expect(
			await prisma.pluginHealthThinnedRun.count({
				where: { claimId: claim.id },
			})
		).toBe(0);
	});

	it("removes a permanently deleted claim's evidence and notes together, and refuses to remove a kept record while its note stands", async () => {
		const { claim, a } = await seedThreeRuns();
		await thin();
		await expect(
			prisma.pluginHealthEvidence.delete({
				where: { recordId: a[0] ?? "" },
			})
		).rejects.toThrow();

		await prisma.assuranceElement.delete({ where: { id: claim.id } });

		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: claim.id } })
		).toBe(0);
		expect(
			await prisma.pluginHealthThinnedRun.count({
				where: { claimId: claim.id },
			})
		).toBe(0);
	});
});
