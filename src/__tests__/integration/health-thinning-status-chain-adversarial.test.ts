import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { purgeExpiredCases } from "@/lib/services/case-trash-service";
import { sweepHealthStaleness } from "@/lib/services/health-staleness-sweep-service";
import { computeHealthStatus } from "@/lib/services/health-status-service";
import { getPluginDisableConsequences } from "@/lib/services/plugin-consequences-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	type Contexts,
	CUTOFF,
	captureLog,
	chainProblems,
	DAY,
	expectedRemoval,
	fillRandomly,
	HOUR,
	type Log,
	listAll,
	MINUTE,
	NOW,
	nextContexts,
	noteProblems,
	put,
	putRun,
	type Row,
	readRows,
	removalProblems,
	rng,
	rulebookProblems,
	SECOND,
	sessionsWithConditions,
	setupWorld,
	statusInstants,
	statusPicture,
	storeFingerprint,
	thin,
	totalRemoved,
	unionLog,
	type World,
	withdraw,
} from "../utils/health-thinning-adversarial-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

const CRON_SECRET = "thinning-test-secret";

beforeEach(async () => {
	await mockNoAuth();
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
	vi.mocked(emitSSEEvent).mockClear();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

const markOf = async (claimId: string) =>
	(
		await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId },
		})
	).thinnedThroughSequence;

async function withdrawSome(
	world: World,
	random: () => number,
	log: Log,
	perClaim: number,
	allow: (row: Row) => boolean
) {
	for (const [claimIndex, claim] of world.claims.entries()) {
		const candidates = (log.get(claim.id) ?? []).filter(
			(row) => !row.everWithdrawn && allow(row)
		);
		for (let i = 0; i < perClaim && candidates.length > 0; i++) {
			const [pick] = candidates.splice(
				Math.floor(random() * candidates.length),
				1
			);
			if (pick) {
				await withdraw(world, claimIndex, pick.recordId);
			}
		}
	}
}

const latestTimestamp = (log: Log) =>
	Math.max(...[...log.values()].flatMap((rows) => rows.map((row) => row.ts)));

// ---------------------------------------------------------------------------
// A run that spans several nights
// ---------------------------------------------------------------------------

describe("a log thinned over several nights", () => {
	it.each([
		5, 19, 29,
	])("follows the rule night by night, never removes a record it has kept, and changes no status (seed %i)", async (seed) => {
		const world = await setupWorld({ claims: 3, pipelines: 2 });
		const random = rng(seed * 7919);
		await fillRandomly(world, seed, {
			count: 70,
			start: CUTOFF - 30 * HOUR,
			end: CUTOFF + 3 * HOUR,
		});
		const nights = [NOW, NOW + 6 * HOUR, NOW + 14 * HOUR];
		let everything: Log | null = null;
		let contexts: Contexts = new Map();
		let keptByNight: Map<string, string[]> = new Map();
		let totalAcrossNights = 0;

		for (const [night, now] of nights.entries()) {
			if (night > 0) {
				// Withdrawals land between calls: some in the part already thinned, some
				// in the part not yet examined. Then more records arrive.
				const present = await captureLog(world);
				await withdrawSome(world, random, present, 2, () => true);
				await fillRandomly(world, seed + night, {
					count: 25,
					start: CUTOFF + (night === 1 ? 3 : 9) * HOUR,
					end: CUTOFF + (night === 1 ? 9 : 16) * HOUR,
				});
			}
			const current = await captureLog(world);
			everything = unionLog(everything, current);
			const cutoff = Math.floor(now / HOUR) * HOUR - DAY;
			const expected = await expectedRemoval(world, current, cutoff, contexts);
			const instants = [
				...statusInstants(latestTimestamp(current)),
				now,
				now + 10 * HOUR,
			];
			const picture = await statusPicture(world, instants);

			const result = await thin(now);

			expect(await removalProblems(world, current, expected)).toEqual([]);
			expect(await noteProblems(world, everything)).toEqual([]);
			expect(await chainProblems(world)).toEqual([]);
			expect(result.recordsRemoved).toBe(totalRemoved(expected));
			expect(result.more).toBe(false);
			expect(await statusPicture(world, instants)).toEqual(picture);

			// Everything kept on earlier nights is still there.
			const nowPresent = new Set(
				[...(await captureLog(world)).values()].flatMap((rows) =>
					rows.map((r) => r.id)
				)
			);
			for (const [claimId, ids] of keptByNight) {
				for (const id of ids) {
					expect(nowPresent.has(id), `kept record ${id} of ${claimId}`).toBe(
						true
					);
				}
			}
			keptByNight = new Map();
			for (const claim of world.claims) {
				const mark = await markOf(claim.id);
				keptByNight.set(
					claim.id,
					(await readRows(claim.id))
						.filter((row) => mark !== null && row.seq <= mark)
						.map((row) => row.id)
				);
			}
			contexts = nextContexts(expected, contexts);
			totalAcrossNights += result.recordsRemoved;
		}
		expect(totalAcrossNights).toBeGreaterThan(10);
	}, 180_000);
});

// ---------------------------------------------------------------------------
// A call of limited size
// ---------------------------------------------------------------------------

describe("a call of limited size", () => {
	it("does one batch of work when it has no time, says so, and a loop of such calls ends with a log the rule allows", async () => {
		const world = await setupWorld({ claims: 3, pipelines: 2 });
		await fillRandomly(world, 77, { count: 110, start: CUTOFF - 36 * HOUR });
		const before = await captureLog(world);
		const protectedSessions = await sessionsWithConditions(world.caseId);
		const everyone = (await expectedRemoval(world, before, CUTOFF)).values();
		let singlePass = 0;
		for (const result of everyone) {
			singlePass += result.removed.size;
		}
		const latest = latestTimestamp(before);
		const instants = statusInstants(latest);
		const picture = await statusPicture(world, instants);

		const calls: Awaited<ReturnType<typeof thin>>[] = [];
		for (let i = 0; i < 400; i++) {
			const result = await thin(NOW, { batchSize: 7, timeBudgetMs: 0 });
			calls.push(result);
			if (!result.more) {
				break;
			}
		}

		expect(calls.length).toBeGreaterThan(5);
		expect(calls.at(-1)?.more).toBe(false);
		expect(calls.slice(0, -1).every((call) => call.more)).toBe(true);
		// A call with no time to spare works on one batch only.
		expect(calls.every((call) => call.recordsRemoved <= 7)).toBe(true);
		expect(calls.every((call) => call.busy === false)).toBe(true);

		const after = await captureLog(world);
		const survivors = new Map(
			[...after].map(([claimId, rows]) => [
				claimId,
				new Set(rows.map((r) => r.id)),
			])
		);
		expect(rulebookProblems(before, protectedSessions, survivors)).toEqual([]);
		expect(await noteProblems(world, before)).toEqual([]);
		expect(await chainProblems(world)).toEqual([]);
		expect(await statusPicture(world, instants)).toEqual(picture);
		// Edges between batches keep a few extra records, never a runaway number.
		const removed = calls.reduce(
			(total, call) => total + call.recordsRemoved,
			0
		);
		expect(removed).toBeGreaterThan(singlePass / 2);
		const totalBefore = [...before.values()].reduce(
			(n, rows) => n + rows.length,
			0
		);
		const batches = Math.ceil(totalBefore / 6);
		expect(singlePass - removed).toBeLessThanOrEqual(2 * batches);

		// The loop reached a fixed point.
		expect(await thin(NOW, { batchSize: 7 })).toMatchObject({
			recordsRemoved: 0,
			runsRecorded: 0,
			more: false,
		});
	}, 180_000);

	it("works on one claim at a time when it has no time, and says more is left until the last", async () => {
		const world = await setupWorld({ claims: 4 });
		for (let claim = 0; claim < 4; claim++) {
			await putRun(world, claim, CUTOFF - 6 * HOUR, 10, MINUTE);
		}

		const calls: Awaited<ReturnType<typeof thin>>[] = [];
		for (let i = 0; i < 20; i++) {
			const result = await thin(NOW, { timeBudgetMs: 0 });
			calls.push(result);
			if (!result.more) {
				break;
			}
		}

		expect(calls.length).toBeGreaterThanOrEqual(4);
		expect(calls.every((call) => call.claimsProcessed <= 1)).toBe(true);
		expect(calls.every((call) => call.recordsRemoved <= 8)).toBe(true);
		expect(calls.reduce((total, call) => total + call.recordsRemoved, 0)).toBe(
			32
		);
		expect(calls.at(-1)?.more).toBe(false);
	});

	it("loses no withdrawal that lands between the calls of a long run", async () => {
		const world = await setupWorld({ claims: 2, pipelines: 2 });
		await fillRandomly(world, 4242, { count: 100, start: CUTOFF - 36 * HOUR });
		const before = await captureLog(world);
		const protectedSessions = await sessionsWithConditions(world.caseId);
		const random = rng(99);
		const withdrawnAlready = await prisma.pluginHealthRevocation.count();
		const withdrawn: Array<{ claimIndex: number; recordId: string }> = [];

		for (let call = 0; call < 500; call++) {
			const present = await captureLog(world);
			for (const [claimIndex, claim] of world.claims.entries()) {
				const candidates = (present.get(claim.id) ?? []).filter(
					(row) => !row.everWithdrawn
				);
				if (candidates.length > 0 && random() < 0.7) {
					const pick = candidates[Math.floor(random() * candidates.length)];
					if (pick) {
						const result = await withdraw(world, claimIndex, pick.recordId);
						if (!result.error) {
							withdrawn.push({ claimIndex, recordId: pick.recordId });
						}
					}
				}
			}
			const result = await thin(NOW, { batchSize: 6, timeBudgetMs: 0 });
			if (!result.more) {
				break;
			}
		}

		expect(withdrawn.length).toBeGreaterThan(10);
		for (const { claimIndex, recordId } of withdrawn) {
			const rows = await readRows(world.claims[claimIndex]?.id ?? "");
			const row = rows.find((candidate) => candidate.recordId === recordId);
			expect(row?.everWithdrawn, `withdrawn record ${recordId}`).toBe(true);
		}
		expect(await prisma.pluginHealthRevocation.count()).toBe(
			withdrawnAlready + withdrawn.length
		);
		const after = await captureLog(world);
		const survivors = new Map(
			[...after].map(([id, rows]) => [id, new Set(rows.map((r) => r.id))])
		);
		expect(rulebookProblems(before, protectedSessions, survivors)).toEqual([]);
		expect(await noteProblems(world, before)).toEqual([]);
		expect(await chainProblems(world)).toEqual([]);
	}, 180_000);

	it("finishes the same work in one call when it has the time", async () => {
		const world = await setupWorld({ claims: 2 });
		await fillRandomly(world, 91, { count: 60, start: CUTOFF - 30 * HOUR });
		const before = await captureLog(world);
		const expected = await expectedRemoval(world, before, CUTOFF);

		const result = await thin(NOW, { timeBudgetMs: 60_000 });

		// With the default batch size the whole log is one batch per claim.
		expect(result).toMatchObject({
			more: false,
			recordsRemoved: totalRemoved(expected),
		});
		expect(await removalProblems(world, before, expected)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// The trial run
// ---------------------------------------------------------------------------

describe("a trial run", () => {
	it("writes nothing, and reports the counts the real run then matches", async () => {
		const world = await setupWorld({ claims: 2, pipelines: 2 });
		await fillRandomly(world, 61, { count: 80, start: CUTOFF - 36 * HOUR });
		const store = await storeFingerprint();

		const dry = await thin(NOW, { dryRun: true });
		const dryBatched = await thin(NOW, { dryRun: true, batchSize: 9 });

		expect(await storeFingerprint()).toEqual(store);
		expect(dry.recordsRemoved).toBeGreaterThan(10);
		expect(dry.runsRecorded).toBeGreaterThan(0);

		const real = await thin(NOW);
		expect(real.recordsRemoved).toBe(dry.recordsRemoved);
		expect(real.runsRecorded).toBe(dry.runsRecorded);
		expect(real.claimsProcessed).toBe(dry.claimsProcessed);
		// A trial run in small batches counts the extra records an edge keeps, the
		// same as a real run in small batches would.
		expect(dryBatched.recordsRemoved).toBeLessThanOrEqual(
			dry.recordsRemoved + 2
		);
		expect(await storeFingerprint()).not.toEqual(store);
	});

	it("counts, partway through a log, what a real run would then do", async () => {
		const world = await setupWorld({ claims: 2 });
		await fillRandomly(world, 63, { count: 80, start: CUTOFF - 36 * HOUR });
		// The first batch of real work moves the marks part of the way.
		const first = await thin(NOW, { batchSize: 8, timeBudgetMs: 0 });
		expect(first.more).toBe(true);
		const store = await storeFingerprint();

		const dry = await thin(NOW, { dryRun: true, batchSize: 8 });
		expect(await storeFingerprint()).toEqual(store);
		const real = await thin(NOW, { batchSize: 8 });

		expect(real.recordsRemoved).toBe(dry.recordsRemoved);
		expect(real.runsRecorded).toBe(dry.runsRecorded);
	});
});

// ---------------------------------------------------------------------------
// What a verifier and later writers see
// ---------------------------------------------------------------------------

describe("after a claim's log has been thinned", () => {
	it("lets a new record chain to the kept tail and a verifier walk the whole list", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await putRun(world, 0, CUTOFF - 5 * HOUR, 30, 5 * MINUTE);
		const tail = (await readRows(claimId)).at(-1);

		const result = await thin(NOW);
		expect(result.recordsRemoved).toBeGreaterThan(10);
		await put(world, 0, {
			ts: NOW - MINUTE,
			arrived: NOW - MINUTE,
		});

		const items = await listAll(world, claimId);
		const newest = items[0];
		expect(newest?.previous_record_hash).toBe(tail?.hash);
		expect(newest?.thinned_before).toBeNull();
		expect(await chainProblems(world)).toEqual([]);
	});

	it("accepts the id of a removed record again as a new record, keeps it later, and leaves the current record alone", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await putRun(world, 0, CUTOFF - 5 * HOUR, 12, 5 * MINUTE);
		await thin(NOW);
		const removed = ids[5] ?? "";
		expect(
			(await readRows(claimId)).some((row) => row.recordId === removed)
		).toBe(false);

		// The pipeline sends the same result again an hour ago, with its old timestamp.
		await put(world, 0, {
			ts: CUTOFF - 5 * HOUR + 5 * 5 * MINUTE,
			arrived: NOW - HOUR,
			mutate: (record) => {
				record.record_id = removed;
			},
		});
		expect((await readRows(claimId)).at(-1)?.recordId).toBe(removed);
		const instants = [CUTOFF, NOW, NOW + 30 * DAY];
		const picture = await statusPicture(world, instants);

		await thin(NOW + DAY);

		expect((await readRows(claimId)).at(-1)?.recordId).toBe(removed);
		expect(await statusPicture(world, instants)).toEqual(picture);
		expect(await chainProblems(world)).toEqual([]);
	});

	it("falls back to the nearest kept record when the current one is withdrawn, and cannot withdraw a record that has gone", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await putRun(world, 0, CUTOFF - 5 * HOUR, 12, 5 * MINUTE);
		await thin(NOW);
		const survivors = await readRows(claimId);
		expect(survivors.map((row) => row.recordId)).toEqual([
			ids.at(0),
			ids.at(-1),
		]);

		const gone = ids[5] ?? "";
		const refused = await withdraw(world, 0, gone);
		expect(refused).toEqual({ error: "Record not found" });

		expect((await withdraw(world, 0, ids.at(-1) ?? "")).error).toBeUndefined();
		const status = await computeHealthStatus(
			claimId,
			world.caseId,
			new Date(NOW)
		);
		expect(status?.record_id).toBe(ids[0]);
		expect(status?.verdict).toBe("pass");
		expect(status?.stale_reason).toBe("expired");
	});

	it("keeps notes and removes them with the claim or the case, and refuses to remove a kept record alone", async () => {
		const world = await setupWorld({ claims: 2 });
		const [first, second] = world.claims;
		await putRun(world, 0, CUTOFF - 5 * HOUR, 20, 5 * MINUTE);
		await putRun(world, 1, CUTOFF - 5 * HOUR, 20, 5 * MINUTE);
		await thin(NOW);
		const notes = await prisma.pluginHealthThinnedRun.findMany({
			where: { claimId: first?.id },
		});
		expect(notes.length).toBeGreaterThan(0);

		// The database refuses to remove a kept record while its note stands.
		await expect(
			prisma.pluginHealthEvidence.delete({
				where: { id: notes[0]?.keptAfterId ?? "" },
			})
		).rejects.toThrow();
		await expect(
			prisma.pluginHealthEvidence.delete({
				where: { id: notes[0]?.keptBeforeId ?? "" },
			})
		).rejects.toThrow();

		// Deleting a claim for good takes its evidence and notes with it.
		await prisma.assuranceElement.delete({ where: { id: first?.id ?? "" } });
		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: first?.id } })
		).toBe(0);
		expect(
			await prisma.pluginHealthThinnedRun.count({
				where: { claimId: first?.id },
			})
		).toBe(0);
		expect(
			await prisma.pluginHealthThinnedRun.count({
				where: { claimId: second?.id },
			})
		).toBeGreaterThan(0);

		// So does purging an expired case from the trash.
		await prisma.assuranceCase.update({
			where: { id: world.caseId },
			data: { deletedAt: new Date(Date.now() - 400 * DAY) },
		});
		const purged = expectSuccess(await purgeExpiredCases(CRON_SECRET));
		expect(purged.purgedCount).toBe(1);
		expect(await prisma.pluginHealthEvidence.count()).toBe(0);
		expect(await prisma.pluginHealthThinnedRun.count()).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Readers of the log that must not notice
// ---------------------------------------------------------------------------

describe("the staleness sweep and the other readers of the log", () => {
	it("announce nothing new and give the same answers after a call", async () => {
		const world = await setupWorld({ claims: 3 });
		const realNow = Date.now();
		// Claim 0 is fresh right now; claim 1 went stale long ago; claim 2 has a
		// failure as its newest result. All of them have old runs to thin.
		await putRun(world, 0, realNow - 40 * HOUR, 120, 15 * MINUTE);
		await putRun(world, 1, realNow - 60 * HOUR, 80, 15 * MINUTE);
		await putRun(world, 2, realNow - 40 * HOUR, 80, 15 * MINUTE);
		await put(world, 2, {
			ts: realNow - 3 * HOUR,
			arrived: realNow - 3 * HOUR,
			verdict: "fail",
		});
		const freshArrival = realNow - 2 * MINUTE;
		await put(world, 0, { ts: freshArrival, arrived: freshArrival });
		const instants = [realNow, realNow + 2 * MINUTE, realNow + HOUR];
		const picture = await statusPicture(world, instants);
		const first = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		const states = await prisma.pluginHealthClaimState.findMany({
			orderBy: { claimId: "asc" },
			select: { claimId: true, staleNotifiedAt: true },
		});
		expect(first.staleClaimsNotified).toBeGreaterThan(0);
		vi.mocked(emitSSEEvent).mockClear();

		const result = await thin(realNow);
		expect(result.recordsRemoved).toBeGreaterThan(100);

		expect(await statusPicture(world, instants)).toEqual(picture);
		const second = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(second.staleClaimsNotified).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
		const statesAfter = await prisma.pluginHealthClaimState.findMany({
			orderBy: { claimId: "asc" },
			select: { claimId: true, staleNotifiedAt: true },
		});
		expect(statesAfter).toEqual(states);
	});

	it("count the stored records, so the count the disable-plugin dialog shows follows the thinning", async () => {
		const world = await setupWorld({ claims: 2 });
		await putRun(world, 0, CUTOFF - 5 * HOUR, 30, 5 * MINUTE);
		await putRun(world, 1, CUTOFF - 5 * HOUR, 30, 5 * MINUTE);
		const before = expectSuccess(
			await getPluginDisableConsequences("tea.health", world.owner.id)
		);
		expect(before.evidenceRecordCount).toBe(60);

		const result = await thin(NOW);

		const after = expectSuccess(
			await getPluginDisableConsequences("tea.health", world.owner.id)
		);
		expect(after.evidenceRecordCount).toBe(60 - result.recordsRemoved);
		expect(after.caseCount).toBe(before.caseCount);
	});

	it("pick the same current record when two records share the newest timestamp or the newest is out of order", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const base = CUTOFF - 6 * HOUR;
		// A run whose last records tie on the newest timestamp, then an older
		// timestamp arriving last and a withdrawn newest.
		const ids: string[] = [];
		for (const offset of [0, 1, 2, 3, 3, 3]) {
			ids.push(
				await put(world, 0, {
					ts: base + offset * MINUTE,
					arrived: base + ids.length * SECOND,
				})
			);
		}
		const picture = async () =>
			statusPicture(world, [base + 10 * MINUTE, NOW, NOW + 30 * DAY]);
		const before = await picture();

		await thin(NOW);

		expect(await picture()).toEqual(before);
		const status = await computeHealthStatus(
			claimId,
			world.caseId,
			new Date(NOW)
		);
		expect(status?.record_id).toBe(ids.at(-1));
	});
});
