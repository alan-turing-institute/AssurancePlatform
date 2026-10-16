import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import { callRetirement, itemSettings } from "../utils/health-criteria-kit";
import {
	addClaim,
	CUTOFF,
	captureLog,
	chainProblems,
	DAY,
	expectedRemoval,
	fillRandomly,
	HOUR,
	MINUTE,
	NOW,
	noteProblems,
	put,
	putRun,
	reaccept,
	readRows,
	reinstate,
	removalProblems,
	SECOND,
	setupWorld,
	statusInstants,
	statusPicture,
	thin,
	totalRemoved,
	type World,
	withdraw,
} from "../utils/health-thinning-adversarial-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.useRealTimers();
});

type Json = Record<string, unknown>;

/** Survivors of a block, as positions in the order the block's records were stored. */
async function survivingPositions(
	claimId: string,
	ids: string[]
): Promise<number[]> {
	const present = new Set((await readRows(claimId)).map((row) => row.recordId));
	return ids.flatMap((id, index) => (present.has(id) ? [index] : []));
}

/** Where blocks of test records sit: each block is well before the cut-off and apart from the others. */
const blockStart = (block: number) => CUTOFF - 200 * HOUR + block * 4 * HOUR;

interface BlockRecord {
	arrived?: number;
	/** Offset of the record's own timestamp from the block start. */
	at: number;
	mutate?: (record: Json) => void;
	verdict?: "pass" | "marginal" | "fail" | "indeterminate";
}

/** Appends records that differ from every other block's by `payload.block`. */
async function putBlock(
	world: World,
	claimIndex: number,
	block: number,
	records: BlockRecord[]
): Promise<string[]> {
	const ids: string[] = [];
	for (const [index, spec] of records.entries()) {
		ids.push(
			await put(world, claimIndex, {
				ts: blockStart(block) + spec.at,
				arrived:
					spec.arrived ??
					Math.max(
						blockStart(block) + spec.at,
						blockStart(block) + index * SECOND
					),
				verdict: spec.verdict,
				mutate: (record) => {
					record.payload = { block };
					spec.mutate?.(record);
				},
			})
		);
	}
	return ids;
}

// ---------------------------------------------------------------------------
// A random log, compared with an independent statement of the rule
// ---------------------------------------------------------------------------

describe("a call removes exactly what the rule allows", () => {
	it.each([
		11, 23, 37, 41,
	])("on a random log with failures, odd timestamps, other accounts and sessions, withdrawals and a conditional session (seed %i)", async (seed) => {
		const world = await setupWorld({ claims: 3, pipelines: 2 });
		await addClaim(world, { accept: false });
		await fillRandomly(world, seed, { count: 130, start: CUTOFF - 36 * HOUR });

		const before = await captureLog(world);
		const expected = await expectedRemoval(world, before, CUTOFF);
		// A log that thins nothing would prove nothing.
		expect(totalRemoved(expected)).toBeGreaterThan(30);
		const latest = Math.max(
			...[...before.values()].flatMap((rows) => rows.map((row) => row.ts))
		);
		const picture = await statusPicture(world, statusInstants(latest));

		const result = await thin(NOW);

		expect(await removalProblems(world, before, expected)).toEqual([]);
		expect(await noteProblems(world, before)).toEqual([]);
		expect(await chainProblems(world)).toEqual([]);
		expect(result).toMatchObject({
			busy: false,
			more: false,
			recordsRemoved: totalRemoved(expected),
		});
		expect(await statusPicture(world, statusInstants(latest))).toEqual(picture);

		// Nothing is left to do for the same cut-off.
		const again = await thin(NOW);
		expect(again).toMatchObject({ recordsRemoved: 0, runsRecorded: 0 });
		const after = await captureLog(world);
		expect(await removalProblems(world, after, new Map())).toEqual([]);
	}, 120_000);
});

// ---------------------------------------------------------------------------
// The cut-off
// ---------------------------------------------------------------------------

describe("the cut-off", () => {
	it("touches nothing that arrived at or after the start of the hour a day ago", async () => {
		const world = await setupWorld();
		const arrivals = [
			CUTOFF - 4 * MINUTE,
			CUTOFF - 3 * MINUTE,
			CUTOFF - 2 * MINUTE,
			CUTOFF - 1,
			CUTOFF,
			CUTOFF + 1,
			CUTOFF + MINUTE,
		];
		const ids: string[] = [];
		for (const at of arrivals) {
			ids.push(await put(world, 0, { ts: at }));
		}

		await thin(NOW);

		// The record arriving exactly at the cut-off is not examined, so the one
		// before it is the last of the examined run.
		expect(await survivingPositions(world.claims[0]?.id ?? "", ids)).toEqual([
			0, 3, 4, 5, 6,
		]);
	});

	it("measures the cut-off from the start of the hour of the time it is given", async () => {
		const world = await setupWorld();
		const ids: string[] = [];
		for (const at of [10, 20, 30, 40].map((m) => CUTOFF + m * MINUTE)) {
			ids.push(await put(world, 0, { ts: at }));
		}
		const claimId = world.claims[0]?.id ?? "";

		// Still the same hour, thirty-five minutes in: the same cut-off.
		await thin(CUTOFF + DAY + 35 * MINUTE);
		expect((await readRows(claimId)).length).toBe(4);
		// The last millisecond of that hour: still the same cut-off.
		await thin(CUTOFF + DAY + HOUR - 1);
		expect((await readRows(claimId)).length).toBe(4);

		// The next hour starts: records that arrived in that hour a day ago
		// are now examined, and the middle two repeat their neighbours.
		await thin(CUTOFF + DAY + HOUR);
		expect(await survivingPositions(claimId, ids)).toEqual([0, 3]);
	});
});

// ---------------------------------------------------------------------------
// What a run keeps
// ---------------------------------------------------------------------------

describe("what a run keeps", () => {
	it("keeps both sides of a pause of exactly an hour, and neither side of one a millisecond shorter", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const at = (offset: number): BlockRecord => ({ at: offset });
		const exact = await putBlock(
			world,
			0,
			0,
			[0, 10 * MINUTE, 20 * MINUTE, 80 * MINUTE, 90 * MINUTE, 100 * MINUTE].map(
				at
			)
		);
		const shorter = await putBlock(
			world,
			0,
			1,
			[
				0,
				10 * MINUTE,
				20 * MINUTE,
				80 * MINUTE - 1,
				90 * MINUTE,
				100 * MINUTE,
			].map(at)
		);

		await thin(NOW);

		// 20 minutes to 80 minutes is a pause: both are kept.
		expect(await survivingPositions(claimId, exact)).toEqual([0, 2, 3, 5]);
		// A millisecond short of an hour is not a pause; the record at 80 minutes
		// less a millisecond is kept as the next hourly one, and 20 minutes goes.
		expect(await survivingPositions(claimId, shorter)).toEqual([0, 3, 5]);
	});

	it("keeps the first record at least an hour after the last one kept, counting exactly an hour", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const at = (offset: number): BlockRecord => ({ at: offset });
		const exact = await putBlock(
			world,
			0,
			0,
			[
				0,
				30 * MINUTE,
				60 * MINUTE,
				90 * MINUTE,
				120 * MINUTE,
				130 * MINUTE,
			].map(at)
		);
		const shorter = await putBlock(
			world,
			0,
			1,
			[
				0,
				30 * MINUTE,
				60 * MINUTE - 1,
				90 * MINUTE,
				120 * MINUTE - 1,
				125 * MINUTE,
			].map(at)
		);

		await thin(NOW);

		expect(await survivingPositions(claimId, exact)).toEqual([0, 2, 4, 5]);
		// 59:59.999 is not an hour after the first; 90 minutes is; 119:59.999 is not
		// an hour after 90 minutes.
		expect(await survivingPositions(claimId, shorter)).toEqual([0, 3, 5]);
	});

	it("does not end a run on records with the same timestamp, and ends it on one that goes back", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ties = await putBlock(
			world,
			0,
			0,
			[0, 0, 0, 5 * MINUTE, 5 * MINUTE].map((offset, i) => ({
				at: offset,
				arrived: blockStart(0) + i * SECOND,
			}))
		);
		const back = await putBlock(world, 0, 1, [
			{ at: 10 * MINUTE },
			{ at: 15 * MINUTE },
			{ at: 5 * MINUTE },
			{ at: 6 * MINUTE },
			{ at: 7 * MINUTE },
			{ at: 8 * MINUTE },
		]);
		// One millisecond earlier than the record before it is enough to end a run.
		const slightly = await putBlock(world, 0, 2, [
			{ at: 10 * MINUTE },
			{ at: 11 * MINUTE },
			{ at: 11 * MINUTE - 1 },
			{ at: 12 * MINUTE },
			{ at: 13 * MINUTE },
		]);

		await thin(NOW);

		expect(await survivingPositions(claimId, ties)).toEqual([0, 4]);
		// The record that went back starts a new run and is kept; the run it starts
		// keeps its first and last only.
		expect(await survivingPositions(claimId, back)).toEqual([0, 1, 2, 5]);
		expect(await survivingPositions(claimId, slightly)).toEqual([0, 1, 2, 4]);
	});

	it("never takes a record into a run across a record that ends it", async () => {
		const world = await setupWorld({ pipelines: 2 });
		const claimId = world.claims[0]?.id ?? "";
		const ids: string[] = [];
		// One account in threes with the other account in between, then strictly
		// alternating: only the middle of an unbroken three can go.
		for (const [index, account] of [
			0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1,
		].entries()) {
			ids.push(
				await put(world, 0, {
					ts: blockStart(0) + index * 10 * SECOND,
					account,
					mutate: (record) => {
						record.payload = { block: 0 };
					},
				})
			);
		}

		await thin(NOW);

		const survivors = await survivingPositions(claimId, ids);
		expect(survivors).toEqual([0, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13]);
	});

	it("starts a new run on the far side of a kept record that was withdrawn between nights", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const early = await putRun(world, 0, CUTOFF - 6 * HOUR, 8, MINUTE);
		const lastEarly = CUTOFF - 6 * HOUR + 7 * MINUTE;
		// The same result carries on, a minute at a time, but is stored after the
		// first night's cut-off and before the second's.
		const later: string[] = [];
		for (let i = 0; i < 6; i++) {
			later.push(
				await put(world, 0, {
					ts: lastEarly + (i + 1) * MINUTE,
					arrived: CUTOFF + HOUR + i * 10 * SECOND,
				})
			);
		}
		await thin(NOW);
		expect(await survivingPositions(claimId, early)).toEqual([0, 7]);

		// The record the first night stopped at is withdrawn.
		expect((await withdraw(world, 0, early[7] ?? "")).error).toBeUndefined();
		await thin(NOW + 6 * HOUR);

		// It ends the run, so the first record after it is kept, not read as the
		// middle of a run that began before the withdrawal.
		expect(await survivingPositions(claimId, later)).toEqual([0, 5]);
		expect(await survivingPositions(claimId, early)).toEqual([0, 7]);
	});

	it("keeps both edges of a value that changes for one result and changes back, or for two", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const value = (number: number) => (record: Json) => {
			record.value = { number, unit: "ratio" };
		};
		const spec = (numbers: number[]): BlockRecord[] =>
			numbers.map((number, index) => ({
				at: index * 10 * SECOND,
				mutate: value(number),
			}));
		const there = await putBlock(world, 0, 0, spec([1, 1, 1, 2, 1, 1, 1]));
		const pair = await putBlock(world, 0, 1, spec([1, 1, 2, 2, 1, 1]));
		const flicker = await putBlock(world, 0, 2, spec([1, 2, 1, 2, 1]));
		const longer = await putBlock(world, 0, 3, spec([1, 1, 1, 1, 3, 3, 3, 3]));

		await thin(NOW);

		// The result just before a change and the changed result are both kept, and
		// the one after it when the value changes back.
		expect(await survivingPositions(claimId, there)).toEqual([0, 2, 3, 4, 6]);
		expect(await survivingPositions(claimId, pair)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(await survivingPositions(claimId, flicker)).toEqual([0, 1, 2, 3, 4]);
		expect(await survivingPositions(claimId, longer)).toEqual([0, 3, 4, 7]);
	});

	it("keeps a record that has ever been withdrawn, and ends the run on both sides of it", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const open = await putBlock(
			world,
			0,
			0,
			[0, 1, 2, 3, 4, 5].map((s) => ({ at: s * 10 * SECOND }))
		);
		const closed = await putBlock(
			world,
			0,
			1,
			[0, 1, 2, 3, 4, 5].map((s) => ({ at: s * 10 * SECOND }))
		);
		const first = await putBlock(
			world,
			0,
			2,
			[0, 1, 2, 3, 4].map((s) => ({ at: s * 10 * SECOND }))
		);
		expect((await withdraw(world, 0, open[2] ?? "")).error).toBeUndefined();
		expect((await withdraw(world, 0, closed[2] ?? "")).error).toBeUndefined();
		expect((await reinstate(world, 0, closed[2] ?? "")).error).toBeUndefined();
		expect((await withdraw(world, 0, first[0] ?? "")).error).toBeUndefined();

		await thin(NOW);

		// The withdrawn record (and the reinstated one) is kept and is neither the
		// first nor the last of a run, so its neighbours are kept too.
		expect(await survivingPositions(claimId, open)).toEqual([0, 1, 2, 3, 5]);
		expect(await survivingPositions(claimId, closed)).toEqual([0, 1, 2, 3, 5]);
		expect(await survivingPositions(claimId, first)).toEqual([0, 1, 4]);
		// Every withdrawal is still there.
		expect(await prisma.pluginHealthRevocation.count()).toBe(3);
	});

	it("starts a new run when the settings are accepted again, even with the same wording", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const first = await putBlock(
			world,
			0,
			0,
			[0, 1, 2].map((s) => ({ at: s * 10 * SECOND }))
		);
		await reaccept(world, 0, itemSettings({ window: "PT3M" }));
		await reaccept(world, 0, itemSettings());
		const second = await putBlock(
			world,
			0,
			0,
			[3, 4, 5].map((s) => ({ at: s * 10 * SECOND }))
		);
		const rows = await readRows(claimId);
		expect(rows.every((row) => row.echo === "MATCH")).toBe(true);
		expect(new Set(rows.map((row) => row.revision)).size).toBe(2);

		await thin(NOW);

		// The same wording under two revisions is two results.
		expect(await survivingPositions(claimId, [...first, ...second])).toEqual([
			0, 2, 3, 5,
		]);
	});
});

// ---------------------------------------------------------------------------
// What counts as the same result
// ---------------------------------------------------------------------------

const uncertainty = (over: Json = {}): Json => ({
	kind: "interval",
	params: { lower: 0.2, upper: 0.4 },
	level: 0.95,
	method: "bootstrap",
	validated: true,
	nature: "sampling",
	...over,
});

const judged = (over: Json = {}): Json => ({
	statistic: "mean",
	method: "bootstrap",
	value: 0.5,
	...over,
});

const provenanceOf = (record: Json) => record.provenance as Json;

function reverseKeys(target: Json) {
	for (const key of Object.keys(target).reverse()) {
		const value = target[key];
		delete target[key];
		target[key] = value;
	}
}

interface Variant {
	/** Applied to every record of the block. */
	base?: (record: Json) => void;
	/** Applied to the later three. */
	change: (record: Json) => void;
	claim?: "item" | "system";
	/** `split`: two results; `merge`: one result; `kept`: the later three are never removable. */
	expect: "split" | "merge" | "kept";
	name: string;
	verdict?: "pass" | "marginal" | "fail" | "indeterminate";
}

const VARIANTS: Variant[] = [
	// A different result: the run ends and both sides of the change are kept.
	{
		name: "the measured number",
		change: (r) => {
			r.value = { number: 2, unit: "ratio" };
		},
		expect: "split",
	},
	{
		name: "the measured number by one unit in the last place",
		base: (r) => {
			r.value = { number: 0.3, unit: "ratio" };
		},
		change: (r) => {
			r.value = { number: 0.1 + 0.2, unit: "ratio" };
		},
		expect: "split",
	},
	{
		name: "the unit",
		change: (r) => {
			r.value = { number: 1, unit: "percent" };
		},
		expect: "split",
	},
	{
		name: "the unit's case or trailing space",
		change: (r) => {
			r.value = { number: 1, unit: "ratio " };
		},
		expect: "split",
	},
	{
		name: "the unit dropped",
		change: (r) => {
			r.value = { number: 1 };
		},
		expect: "split",
	},
	{
		name: "the unit written two ways that look alike",
		base: (r) => {
			r.value = { number: 1, unit: "é" };
		},
		change: (r) => {
			r.value = { number: 1, unit: "é" };
		},
		expect: "split",
	},
	{
		name: "the kind of value (a number, then a yes)",
		change: (r) => {
			r.value = true;
		},
		expect: "split",
	},
	{
		name: "the text of a text value",
		base: (r) => {
			r.value = "ok";
		},
		change: (r) => {
			r.value = "OK";
		},
		expect: "split",
	},
	{
		name: "uncertainty appearing",
		base: undefined,
		change: (r) => {
			r.uncertainty = uncertainty();
			r.judged = judged();
		},
		expect: "split",
	},
	{
		name: "the numbers inside uncertainty",
		base: (r) => {
			r.uncertainty = uncertainty();
			r.judged = judged();
		},
		change: (r) => {
			r.uncertainty = uncertainty({ params: { lower: 0.2, upper: 0.41 } });
		},
		expect: "split",
	},
	{
		name: "the level of uncertainty",
		base: (r) => {
			r.uncertainty = uncertainty();
			r.judged = judged();
		},
		change: (r) => {
			r.uncertainty = uncertainty({ level: 0.9 });
		},
		expect: "split",
	},
	{
		name: "the method of uncertainty",
		base: (r) => {
			r.uncertainty = uncertainty();
			r.judged = judged();
		},
		change: (r) => {
			r.uncertainty = uncertainty({ method: "jackknife" });
		},
		expect: "split",
	},
	{
		name: "whether uncertainty was validated",
		base: (r) => {
			r.uncertainty = uncertainty();
			r.judged = judged();
		},
		change: (r) => {
			r.uncertainty = uncertainty({ validated: false });
		},
		expect: "split",
	},
	{
		name: "the judged value",
		base: (r) => {
			r.judged = judged();
		},
		change: (r) => {
			r.judged = judged({ value: 0.6 });
		},
		expect: "split",
	},
	{
		name: "the judged statistic",
		base: (r) => {
			r.judged = judged();
		},
		change: (r) => {
			r.judged = judged({ statistic: "median" });
		},
		expect: "split",
	},
	{
		name: "the judged method",
		base: (r) => {
			r.judged = judged();
		},
		change: (r) => {
			r.judged = judged({ method: "closed-form" });
		},
		expect: "split",
	},
	{
		name: "the judged value's type",
		base: (r) => {
			r.judged = judged({ value: 1 });
		},
		change: (r) => {
			r.judged = judged({ value: "1" });
		},
		expect: "split",
	},
	{
		name: "a payload value",
		change: (r) => {
			r.payload = { block: (r.payload as Json).block, reading: 2 };
		},
		base: (r) => {
			r.payload = { block: (r.payload as Json).block, reading: 1 };
		},
		expect: "split",
	},
	{
		name: "a payload key added",
		change: (r) => {
			r.payload = { block: (r.payload as Json).block, extra: true };
		},
		expect: "split",
	},
	{
		name: "a payload value deep inside",
		base: (r) => {
			r.payload = { block: (r.payload as Json).block, a: { b: [1, { c: 1 }] } };
		},
		change: (r) => {
			r.payload = { block: (r.payload as Json).block, a: { b: [1, { c: 2 }] } };
		},
		expect: "split",
	},
	{
		name: "the window written another way",
		change: (r) => {
			r.window = "PT60S";
		},
		expect: "split",
	},
	{
		name: "the time limit written another way",
		change: (r) => {
			r.valid_for = "PT300S";
		},
		expect: "split",
	},
	{
		name: "the check's scope, which the comparison with the settings does not read",
		change: (r) => {
			r.check = { ...(r.check as Json), scope: "unit" };
		},
		expect: "split",
	},
	{
		name: "a rule parameter, with the same version label",
		change: (r) => {
			r.rule = { ...(r.rule as Json), params: { note: 2 } };
		},
		base: (r) => {
			r.rule = { ...(r.rule as Json), params: { note: 1 } };
		},
		expect: "split",
	},
	{
		name: "a reduction parameter, with the same version label",
		change: (r) => {
			const reduction = r.reduction as Json;
			r.reduction = {
				...reduction,
				params: { ...(reduction.params as Json), avail_floor: 0.7 },
			};
		},
		expect: "split",
	},
	{
		name: "an aggregation parameter, with the same version label",
		change: (r) => {
			const aggregation = r.aggregation as Json;
			r.aggregation = {
				...aggregation,
				params: { ...(aggregation.params as Json), threshold: 0.9 },
			};
		},
		expect: "split",
	},
	{
		name: "the session",
		change: (r) => {
			provenanceOf(r).session = "S1-other";
		},
		expect: "split",
	},
	{
		name: "the pipeline version",
		change: (r) => {
			provenanceOf(r).pipeline_version = "0.4.1";
		},
		expect: "split",
	},
	{
		name: "the run",
		change: (r) => {
			provenanceOf(r).run = "https://ci.example.org/runs/9";
		},
		expect: "split",
	},
	{
		name: "the run left out",
		change: (r) => {
			Reflect.deleteProperty(provenanceOf(r), "run");
		},
		expect: "split",
	},
	{
		name: "the twin version",
		change: (r) => {
			provenanceOf(r).twin_version = "2.4";
		},
		expect: "split",
	},
	{
		name: "the twin version left out",
		change: (r) => {
			Reflect.deleteProperty(provenanceOf(r), "twin_version");
		},
		expect: "split",
	},
	{
		name: "the subject",
		claim: "system",
		base: (r) => {
			r.subject = { kind: "unit", id: "U-1" };
		},
		change: (r) => {
			r.subject = { kind: "unit", id: "U-2" };
		},
		expect: "split",
	},
	{
		name: "the subject's kind",
		claim: "system",
		base: (r) => {
			r.subject = { kind: "unit", id: "U-1" };
		},
		change: (r) => {
			r.subject = { kind: "sensor", id: "U-1" };
		},
		expect: "split",
	},
	{
		name: "a subject appearing",
		claim: "system",
		change: (r) => {
			r.subject = { kind: "unit", id: "U-1" };
		},
		expect: "split",
	},
	// Never removed whatever their neighbours say.
	{
		name: "a marginal verdict",
		verdict: "marginal",
		change: () => undefined,
		expect: "kept",
	},
	{
		name: "a failing verdict",
		verdict: "fail",
		change: () => undefined,
		expect: "kept",
	},
	{
		name: "an indeterminate verdict",
		verdict: "indeterminate",
		change: () => undefined,
		expect: "kept",
	},
	{
		name: "a different setting under the check",
		change: (r) => {
			r.check = {
				...(r.check as Json),
				params: { camera_line: "B" },
			};
		},
		expect: "kept",
	},
	{
		name: "a window other than the settings",
		change: (r) => {
			r.window = "PT2M";
		},
		expect: "kept",
	},
	// The same result: only readings, the comment and extra provenance differ.
	{
		name: "only the comment, the readings and the extra provenance (the usual case)",
		change: () => undefined,
		expect: "merge",
	},
	{
		name: "the comment left out",
		change: (r) => {
			r.comment = undefined;
		},
		expect: "merge",
	},
	{
		name: "a much longer list of readings",
		change: (r) => {
			provenanceOf(r).members = Array.from(
				{ length: 60 },
				(_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`
			);
		},
		expect: "merge",
	},
	{
		name: "a list of failed subjects appearing",
		change: (r) => {
			provenanceOf(r).failed_subjects = [{ kind: "sensor", id: "S-9" }];
		},
		expect: "merge",
	},
	{
		name: "an extra provenance value dropped",
		base: (r) => {
			provenanceOf(r).sim_time = 5;
		},
		change: (r) => {
			Reflect.deleteProperty(provenanceOf(r), "sim_time");
		},
		expect: "merge",
	},
	{
		name: "an extra provenance value added",
		change: (r) => {
			provenanceOf(r).scenario = "SC-02";
		},
		expect: "merge",
	},
	{
		name: "an extra provenance value that is a nested structure",
		base: (r) => {
			provenanceOf(r).meta = { a: [1, 2], b: { c: "x" } };
		},
		change: (r) => {
			provenanceOf(r).meta = { a: [9], b: { c: "y" }, d: null };
		},
		expect: "merge",
	},
	{
		name: "the order of keys in the record and inside it",
		change: (r) => {
			reverseKeys(r);
			reverseKeys(provenanceOf(r));
			reverseKeys(r.value as Json);
			reverseKeys(r.check as Json);
		},
		expect: "merge",
	},
	{
		name: "a negative zero against a zero",
		base: (r) => {
			r.value = { number: 0, unit: "ratio" };
		},
		change: (r) => {
			r.value = { number: -0, unit: "ratio" };
		},
		expect: "merge",
	},
];

describe("what counts as the same result", () => {
	it("splits a run at every field that must match, keeps what is never removable, and ignores what may differ", async () => {
		const world = await setupWorld();
		const systemIndex = await addClaim(world, { system: true });
		const blocks: Array<{
			claimIndex: number;
			ids: string[];
			variant: Variant;
		}> = [];

		for (const [block, variant] of VARIANTS.entries()) {
			const claimIndex = variant.claim === "system" ? systemIndex : 0;
			const ids: string[] = [];
			for (let k = 0; k < 6; k++) {
				const later = k >= 3;
				ids.push(
					await put(world, claimIndex, {
						ts: blockStart(block) + k * 10 * SECOND,
						arrived: blockStart(block) + k * 10 * SECOND,
						verdict: later ? variant.verdict : undefined,
						mutate: (record) => {
							record.payload = { block };
							variant.base?.(record);
							if (later) {
								variant.change(record);
							}
						},
					})
				);
			}
			blocks.push({ claimIndex, ids, variant });
		}

		await thin(NOW);

		const expectedSurvivors = {
			split: [0, 2, 3, 5],
			merge: [0, 5],
			kept: [0, 2, 3, 4, 5],
		};
		const wrong: string[] = [];
		for (const { claimIndex, ids, variant } of blocks) {
			const claimId = world.claims[claimIndex]?.id ?? "";
			if (variant.expect !== "kept") {
				// A variant only tests the comparison of results if every record of the
				// block was a passing match for the settings.
				const stored = (await readRows(claimId)).filter((row) =>
					ids.includes(row.recordId)
				);
				if (
					!stored.every((row) => row.echo === "MATCH" && row.verdict === "PASS")
				) {
					wrong.push(
						`${variant.name}: the premise fails, a record is not a passing match`
					);
				}
			}
			const got = await survivingPositions(claimId, ids);
			const want = expectedSurvivors[variant.expect];
			if (got.join() !== want.join()) {
				wrong.push(`${variant.name}: kept [${got}], expected [${want}]`);
			}
		}
		expect(wrong).toEqual([]);
	}, 120_000);

	it("never merges numbers that differ, however they are written in the stored JSON", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await putBlock(
			world,
			0,
			0,
			[0, 1, 2, 3, 4, 5].map((s) => ({
				at: s * 10 * SECOND,
				mutate: (record: Json) => {
					record.value = { number: 1, unit: "ratio" };
				},
			}))
		);
		// Rewrite the stored JSON, as a migration or a repair might: the same
		// number with another spelling for the middle two, a different number
		// that casts to the same double for the fourth.
		const spell = async (position: number, spelling: string) => {
			await prisma.$executeRawUnsafe(
				`UPDATE plugin_health_evidence SET record = jsonb_set(record, '{value,number}', '${spelling}'::jsonb) WHERE record_id = '${ids[position]}'`
			);
		};
		await spell(1, "1.0");
		await spell(2, "1.00");
		await spell(3, "1.0000000000000000001");

		await thin(NOW);

		const survivors = await survivingPositions(claimId, ids);
		// The fourth record's number is not the same number as its neighbours':
		// it must survive with the record before it.
		expect(survivors).toContain(3);
		expect(survivors).toContain(2);
		expect(survivors).toContain(0);
		expect(survivors).toContain(5);
	});
});

// ---------------------------------------------------------------------------
// Records that are never removed
// ---------------------------------------------------------------------------

describe("records that are never removed", () => {
	it("keeps every record of a claim with no accepted settings", async () => {
		const world = await setupWorld();
		const index = await addClaim(world, { accept: false });
		const claimId = world.claims[index]?.id ?? "";
		const ids: string[] = [];
		for (let i = 0; i < 6; i++) {
			ids.push(
				await put(world, index, { ts: blockStart(0) + i * 10 * SECOND })
			);
		}
		expect(
			(await readRows(claimId)).every((r) => r.echo === "UNDECLARED")
		).toBe(true);

		await thin(NOW);

		expect(await survivingPositions(claimId, ids)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it("still thins what was stored as a match after the settings are retired, and leaves what came after whole", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const early = await putBlock(
			world,
			0,
			0,
			[0, 1, 2, 3].map((s) => ({ at: s * 10 * SECOND }))
		);
		const picture = async () =>
			statusPicture(world, statusInstants(blockStart(1) + 10 * MINUTE));
		expect(
			(await callRetirement(claimId, { reason: "Stopped using these" })).status
		).toBe(200);
		const late = await putBlock(
			world,
			0,
			1,
			[0, 1, 2].map((s) => ({ at: s * 10 * SECOND }))
		);
		const before = await picture();

		await thin(NOW);

		expect(await survivingPositions(claimId, early)).toEqual([0, 3]);
		expect(await survivingPositions(claimId, late)).toEqual([0, 1, 2]);
		expect(await picture()).toEqual(before);
	});

	it("thins a claim in the trash and a case in the trash without changing what they would show after a restore", async () => {
		const world = await setupWorld({ claims: 2 });
		const [first, second] = world.claims;
		const idsFirst = await putBlock(
			world,
			0,
			0,
			[0, 1, 2, 3, 4].map((s) => ({ at: s * 10 * SECOND }))
		);
		const idsSecond = await putBlock(
			world,
			1,
			0,
			[0, 1, 2, 3, 4].map((s) => ({ at: s * 10 * SECOND }))
		);
		const instants = statusInstants(blockStart(0) + 10 * MINUTE);
		const before = await statusPicture(world, instants);
		await prisma.assuranceElement.update({
			where: { id: first?.id ?? "" },
			data: { deletedAt: new Date(NOW - HOUR) },
		});
		await prisma.assuranceCase.update({
			where: { id: world.caseId },
			data: { deletedAt: new Date(NOW - HOUR) },
		});

		const result = await thin(NOW);

		// The schedule is the only switch: trashed work is thinned like the rest.
		expect(result.recordsRemoved).toBe(6);
		expect(await survivingPositions(first?.id ?? "", idsFirst)).toEqual([0, 4]);
		expect(await survivingPositions(second?.id ?? "", idsSecond)).toEqual([
			0, 4,
		]);
		await prisma.assuranceElement.update({
			where: { id: first?.id ?? "" },
			data: { deletedAt: null },
		});
		await prisma.assuranceCase.update({
			where: { id: world.caseId },
			data: { deletedAt: null },
		});
		expect(await statusPicture(world, instants)).toEqual(before);
		expect(await chainProblems(world)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Sessions that carry a condition
// ---------------------------------------------------------------------------

function conditional(record: Json) {
	record.valid_while = { twin_version: "2.3" };
}

describe("a session where any record carries a condition", () => {
	it("is left whole in every claim of the case", async () => {
		const world = await setupWorld({ claims: 2 });
		const claimId = world.claims[1]?.id ?? "";
		const run = await putBlock(
			world,
			1,
			0,
			[0, 1, 2, 3, 4].map((s) => ({ at: s * 10 * SECOND }))
		);
		// A record with a condition in another claim, arriving today and never old
		// enough to be examined itself.
		await put(world, 0, {
			ts: NOW - 10 * MINUTE,
			arrived: NOW - 10 * MINUTE,
			mutate: conditional,
		});
		const other = await putBlock(
			world,
			1,
			1,
			[0, 1, 2, 3, 4].map((s) => ({
				at: s * 10 * SECOND,
				mutate: (record: Json) => {
					provenanceOf(record).session = "S-other";
				},
			}))
		);

		await thin(NOW);

		expect(await survivingPositions(claimId, run)).toEqual([0, 1, 2, 3, 4]);
		// A different session of the same case is thinned as usual.
		expect(await survivingPositions(claimId, other)).toEqual([0, 4]);
	});

	it("is left whole when the record carrying the condition has been withdrawn or sits in a claim in the trash", async () => {
		const world = await setupWorld({ claims: 3 });
		const subject = world.claims[0]?.id ?? "";
		const run = await putBlock(
			world,
			0,
			0,
			[0, 1, 2, 3, 4].map((s) => ({ at: s * 10 * SECOND }))
		);
		const withdrawnCondition = await put(world, 1, {
			ts: blockStart(5),
			mutate: conditional,
		});
		await withdraw(world, 1, withdrawnCondition);
		const trashed = await put(world, 2, {
			ts: blockStart(6),
			session: "S-trashed",
			mutate: conditional,
		});
		expect(trashed).toBeTruthy();
		const trashedRun = await putBlock(
			world,
			0,
			7,
			[0, 1, 2, 3, 4].map((s) => ({
				at: s * 10 * SECOND,
				mutate: (record: Json) => {
					provenanceOf(record).session = "S-trashed";
				},
			}))
		);
		await prisma.assuranceElement.update({
			where: { id: world.claims[2]?.id ?? "" },
			data: { deletedAt: new Date(NOW - HOUR) },
		});

		await thin(NOW);

		// Either record comes back into play when it is reinstated or its claim is
		// restored, and then reads the history of the session as it stands.
		expect(await survivingPositions(subject, run)).toEqual([0, 1, 2, 3, 4]);
		expect(await survivingPositions(subject, trashedRun)).toEqual([
			0, 1, 2, 3, 4,
		]);
	});

	it("keeps the time a condition began to fail exactly as it was, because the session it reads is left whole", async () => {
		const world = await setupWorld({ claims: 2 });
		const reading = (scenario: string) => ({ scenario });
		// Claim 1 reports a scenario that changes part-way, in readings the same-result
		// rule would otherwise ignore.
		const before = await putRun(world, 1, CUTOFF - 12 * HOUR, 20, MINUTE, {
			extraProvenance: reading("SC-01"),
		});
		const after = await putRun(world, 1, CUTOFF - 9 * HOUR, 20, MINUTE, {
			extraProvenance: reading("SC-02"),
		});
		// Claim 0's only result says it holds while the scenario is SC-01; it was
		// judged between the two.
		const judgedAt = CUTOFF - 10 * HOUR;
		await put(world, 0, {
			ts: judgedAt,
			extraProvenance: reading("SC-01"),
			mutate: (record) => {
				record.valid_while = { scenario: "SC-01" };
			},
		});
		const instants = [judgedAt + MINUTE, judgedAt + 2 * MINUTE];
		const picture = await statusPicture(world, instants);
		const status = picture[
			`status ${world.claims[0]?.id} @${instants[0]}`
		] as Json;
		expect(status).toMatchObject({
			stale: true,
			stale_reason: "condition",
		});
		expect(status.stale_since).toBe(new Date(CUTOFF - 9 * HOUR).toISOString());

		const result = await thin(NOW);

		expect(result.recordsRemoved).toBe(0);
		expect(await statusPicture(world, instants)).toEqual(picture);
		const claimId = world.claims[1]?.id ?? "";
		expect(
			await survivingPositions(claimId, [...before, ...after])
		).toHaveLength(40);
	});

	it("is protected in the case that has the condition and not in another case that uses the same session name, whichever is looked at first", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const elsewhere = await setupWorld();
		const elsewhereClaim = elsewhere.claims[0]?.id ?? "";
		await put(elsewhere, 0, { ts: blockStart(0), mutate: conditional });
		const heldWhole = await putBlock(
			elsewhere,
			0,
			1,
			[0, 1, 2, 3, 4].map((s) => ({ at: s * 10 * SECOND }))
		);
		const run = await putBlock(
			world,
			0,
			1,
			[0, 1, 2, 3, 4].map((s) => ({ at: s * 10 * SECOND }))
		);

		await thin(NOW);

		expect(await survivingPositions(claimId, run)).toEqual([0, 4]);
		expect(await survivingPositions(elsewhereClaim, heldWhole)).toEqual([
			0, 1, 2, 3, 4,
		]);
	});

	it("is left alone from the night a condition arrives, and nothing already removed is claimed back", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const night1 = await putBlock(
			world,
			0,
			0,
			[0, 1, 2, 3, 4, 5].map((s) => ({ at: s * 10 * SECOND }))
		);
		await thin(NOW);
		expect(await survivingPositions(claimId, night1)).toEqual([0, 5]);
		const notes = await prisma.pluginHealthThinnedRun.findMany({
			where: { claimId },
		});
		expect(notes).toHaveLength(1);

		// Now a record with a condition arrives, and older records follow it that a
		// later night would otherwise thin.
		const arrival = CUTOFF + 2 * HOUR;
		await put(world, 0, { ts: arrival, arrived: arrival, mutate: conditional });
		const later: string[] = [];
		for (let i = 0; i < 6; i++) {
			later.push(
				await put(world, 0, {
					ts: arrival + (i + 1) * 10 * SECOND,
					arrived: arrival + (i + 1) * 10 * SECOND,
				})
			);
		}
		const before = await readRows(claimId);

		const night2 = await thin(NOW + DAY);

		expect(night2.recordsRemoved).toBe(0);
		expect((await readRows(claimId)).map((r) => r.id)).toEqual(
			before.map((r) => r.id)
		);
		expect(await survivingPositions(claimId, later)).toEqual([
			0, 1, 2, 3, 4, 5,
		]);
		// The first night's note and gap are as they were.
		expect(
			await prisma.pluginHealthThinnedRun.count({ where: { claimId } })
		).toBe(1);
		expect(await chainProblems(world)).toEqual([]);
	});
});
