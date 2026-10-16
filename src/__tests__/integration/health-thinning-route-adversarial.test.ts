import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	importMachineRoute,
	machineGet,
} from "../utils/health-adversarial-kit";
import {
	CUTOFF,
	chainProblems,
	HOUR,
	MINUTE,
	NOW,
	put,
	putRun,
	readRows,
	SECOND,
	setupWorld,
	storeFingerprint,
	thin,
	verifyFromItems,
	withdraw,
} from "../utils/health-thinning-adversarial-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const CRON_SECRET = "thinning-route-secret";
const URL_BASE = "http://localhost:3000/api/cron/health-evidence-thinning";

beforeEach(async () => {
	await mockNoAuth();
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

function thinningRequest(
	options: { query?: string; token?: string | null } = {}
): Request {
	const headers = new Headers();
	if (options.token) {
		headers.set("authorization", `Bearer ${options.token}`);
	}
	return new Request(`${URL_BASE}${options.query ?? ""}`, {
		method: "POST",
		headers,
	});
}

const importRoute = () =>
	import("@/app/api/cron/health-evidence-thinning/route");

/** A log with plenty to thin: every arrival is long before any cut-off the real clock gives. */
async function worldWithOldRuns() {
	const world = await setupWorld({ claims: 2 });
	await putRun(world, 0, CUTOFF - 10 * HOUR, 40, 5 * MINUTE);
	await putRun(world, 1, CUTOFF - 10 * HOUR, 40, 5 * MINUTE);
	return world;
}

// ---------------------------------------------------------------------------
// The route refuses without the secret
// ---------------------------------------------------------------------------

describe("POST /api/cron/health-evidence-thinning — who may call it", () => {
	it("refuses with no header, a wrong secret, an empty one and a near miss, and changes nothing", async () => {
		await worldWithOldRuns();
		const store = await storeFingerprint();
		const { POST } = await importRoute();

		for (const request of [
			thinningRequest(),
			thinningRequest({ token: "wrong-secret" }),
			thinningRequest({ token: `${CRON_SECRET}x` }),
			thinningRequest({ token: CRON_SECRET.slice(0, -1) }),
			thinningRequest({ token: CRON_SECRET.toUpperCase() }),
			new Request(URL_BASE, {
				method: "POST",
				headers: { authorization: "Bearer " },
			}),
			// A refusal comes before a trial run too.
			thinningRequest({ query: "?dryRun=1" }),
		]) {
			const response = await POST(request);
			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({
				error: "Unauthorised",
				code: "UNAUTHORISED",
			});
		}

		expect(await storeFingerprint()).toEqual(store);
	});

	it("answers to POST only", async () => {
		const route = await importRoute();

		expect(Object.keys(route)).toEqual(["POST"]);
	});

	it("answers a server error, not an open door, when the secret is not configured", async () => {
		await worldWithOldRuns();
		const store = await storeFingerprint();
		vi.unstubAllEnvs();
		const { POST } = await importRoute();

		const response = await POST(thinningRequest({ token: CRON_SECRET }));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "Server configuration error",
			code: "INTERNAL",
		});
		expect(await storeFingerprint()).toEqual(store);
	});

	it("does nothing for an empty bearer token even if the secret is configured as empty", async () => {
		await worldWithOldRuns();
		vi.stubEnv("CRON_SECRET", "");
		const store = await storeFingerprint();
		const { POST } = await importRoute();

		const response = await POST(
			new Request(URL_BASE, {
				method: "POST",
				headers: { authorization: "Bearer " },
			})
		);

		expect([401, 500]).toContain(response.status);
		expect(await storeFingerprint()).toEqual(store);
	});
});

// ---------------------------------------------------------------------------
// What it answers and does
// ---------------------------------------------------------------------------

describe("POST /api/cron/health-evidence-thinning — a call", () => {
	it("thins, and answers with the counts and nothing else", async () => {
		const world = await worldWithOldRuns();
		const { POST } = await importRoute();

		const response = await POST(thinningRequest({ token: CRON_SECRET }));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(Object.keys(body).sort()).toEqual(
			[
				"busy",
				"claimsProcessed",
				"dryRun",
				"more",
				"recordsRemoved",
				"runsRecorded",
				"success",
			].sort()
		);
		expect(body).toMatchObject({
			success: true,
			dryRun: false,
			busy: false,
			more: false,
			claimsProcessed: 2,
			recordsRemoved: 70,
			runsRecorded: 8,
		});
		// Each claim keeps its first and last result and one in every hour.
		expect(await prisma.pluginHealthEvidence.count()).toBe(10);
		expect(await prisma.pluginHealthThinnedRun.count()).toBe(8);
		expect(await chainProblems(world)).toEqual([]);
	});

	it("with dryRun=1 writes nothing and reports what the next real call does", async () => {
		await worldWithOldRuns();
		const store = await storeFingerprint();
		const { POST } = await importRoute();

		const dry = await POST(
			thinningRequest({ token: CRON_SECRET, query: "?dryRun=1" })
		);
		const dryBody = await dry.json();

		expect(dry.status).toBe(200);
		expect(dryBody).toMatchObject({ success: true, dryRun: true, busy: false });
		expect(dryBody.recordsRemoved).toBe(70);
		expect(await storeFingerprint()).toEqual(store);

		const real = await POST(thinningRequest({ token: CRON_SECRET }));
		const realBody = await real.json();
		expect(realBody).toMatchObject({
			dryRun: false,
			recordsRemoved: dryBody.recordsRemoved,
			runsRecorded: dryBody.runsRecorded,
			claimsProcessed: dryBody.claimsProcessed,
		});
	});

	it("answers 200 with zeros on an empty log", async () => {
		const { POST } = await importRoute();

		const response = await POST(thinningRequest({ token: CRON_SECRET }));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			dryRun: false,
			busy: false,
			claimsProcessed: 0,
			recordsRemoved: 0,
			runsRecorded: 0,
			more: false,
		});
	});
});

// ---------------------------------------------------------------------------
// The evidence list
// ---------------------------------------------------------------------------

const ITEM_KEYS_BEFORE_THINNING = [
	"chain_sequence",
	"created_at",
	"created_by_id",
	"criteria_revision",
	"echo_differences",
	"echo_state",
	"expires_at",
	"id",
	"previous_record_hash",
	"record",
	"record_hash",
	"revocation",
];

const NOTE_KEYS = [
	"first_removed_at",
	"first_removed_sequence",
	"last_removed_at",
	"last_removed_sequence",
	"removed_count",
	"rule_version",
	"thinned_at",
];

interface ListedItem {
	chain_sequence: number;
	record_hash: string;
	revocation: unknown;
	thinned_before: Record<string, unknown> | null;
	[key: string]: unknown;
}

async function listThroughRoute(
	claimId: string,
	secret: string,
	query = ""
): Promise<{ evidence: ListedItem[]; next_before: number | null }> {
	const { GET } = await importMachineRoute();
	const response = await GET(machineGet(claimId, secret, query), {
		params: Promise.resolve({ id: claimId }),
	});
	if (response.status !== 200) {
		throw new Error(`list answered ${response.status}`);
	}
	return await response.json();
}

describe("GET /api/machine/health/elements/[id]/evidence — thinned_before", () => {
	it("is null on every item of a log that was never thinned, and the other fields are the ones it always had", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await putRun(world, 0, CUTOFF - HOUR, 5, MINUTE);

		const { evidence } = await listThroughRoute(
			claimId,
			world.pipelines[0]?.secret ?? ""
		);

		expect(evidence).toHaveLength(5);
		for (const item of evidence) {
			expect(Object.keys(item).sort()).toEqual(
				[...ITEM_KEYS_BEFORE_THINNING, "thinned_before"].sort()
			);
			expect(item.thinned_before).toBeNull();
		}
	});

	it("carries the note on the kept record after each gap and null elsewhere, with exactly the note's fields", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const first = await putRun(world, 0, CUTOFF - 8 * HOUR, 30, 5 * MINUTE);
		// A failure splits the log into two stretches that are each thinned.
		await put(world, 0, {
			ts: CUTOFF - 5 * HOUR,
			arrived: CUTOFF - 5 * HOUR,
			verdict: "fail",
		});
		const second = await putRun(world, 0, CUTOFF - 4 * HOUR, 30, 5 * MINUTE);
		await thin(NOW);

		const { evidence } = await listThroughRoute(
			claimId,
			world.pipelines[0]?.secret ?? ""
		);

		const noted = evidence.filter((item) => item.thinned_before !== null);
		expect(noted.length).toBeGreaterThan(2);
		expect(noted).toHaveLength(
			await prisma.pluginHealthThinnedRun.count({ where: { claimId } })
		);
		for (const item of noted) {
			expect(Object.keys(item.thinned_before ?? {}).sort()).toEqual(NOTE_KEYS);
			// It says when the thinning happened: just now, by the real clock.
			const thinnedAt = Date.parse(String(item.thinned_before?.thinned_at));
			expect(Math.abs(thinnedAt - Date.now())).toBeLessThan(60_000);
		}
		for (const item of evidence) {
			expect(Object.keys(item).sort()).toEqual(
				[...ITEM_KEYS_BEFORE_THINNING, "thinned_before"].sort()
			);
		}
		const rows = await readRows(claimId);
		expect(rows.map((row) => row.recordId)).toContain(first[0]);
		expect(rows.map((row) => row.recordId)).toContain(second.at(-1));
		// The note is on the record after the gap, and says how much is missing.
		const bySequence = new Map(
			evidence.map((item) => [item.chain_sequence, item])
		);
		for (const note of await prisma.pluginHealthThinnedRun.findMany({
			where: { claimId },
			include: { keptAfter: true },
		})) {
			const item = bySequence.get(note.keptAfter.chainSequence);
			expect(item?.thinned_before).toEqual({
				removed_count: note.removedCount,
				first_removed_at: note.firstRemovedAt.toISOString(),
				first_removed_sequence: note.firstRemovedSequence,
				last_removed_at: note.lastRemovedAt.toISOString(),
				last_removed_sequence: note.lastRemovedSequence,
				rule_version: note.ruleVersion,
				thinned_at: note.thinnedAt.toISOString(),
			});
		}
		expect(
			noted.reduce(
				(total, item) => total + Number(item.thinned_before?.removed_count),
				0
			)
		).toBe(61 - rows.length);
	});

	it("gives a verifier everything it needs, across pages of any size and a gap on a page edge", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await putRun(world, 0, CUTOFF - 8 * HOUR, 40, 5 * MINUTE);
		await put(world, 0, {
			ts: CUTOFF - 4 * HOUR,
			arrived: CUTOFF - 4 * HOUR,
			verdict: "marginal",
		});
		await putRun(world, 0, CUTOFF - 3 * HOUR, 40, 5 * MINUTE);
		await thin(NOW);
		const secret = world.pipelines[0]?.secret ?? "";
		const all = await listThroughRoute(claimId, secret, "?limit=200");
		expect(all.next_before).toBeNull();
		const sequences = all.evidence.map((item) => item.chain_sequence);
		expect([...sequences].sort((a, b) => b - a)).toEqual(sequences);

		for (const limit of [1, 2, 3, 4, 7]) {
			const pages: ListedItem[] = [];
			let before: number | null = null;
			for (let guard = 0; guard < 100; guard++) {
				const query: string =
					before === null
						? `?limit=${limit}`
						: `?limit=${limit}&before=${before}`;
				const page = await listThroughRoute(claimId, secret, query);
				pages.push(...page.evidence);
				if (page.next_before === null) {
					break;
				}
				before = page.next_before;
			}
			expect(pages.map((item) => item.chain_sequence)).toEqual(sequences);
			expect(pages.filter((item) => item.thinned_before !== null).length).toBe(
				all.evidence.filter((item) => item.thinned_before !== null).length
			);
		}
		expect(
			verifyFromItems(
				all.evidence as unknown as Parameters<typeof verifyFromItems>[0]
			)
		).toEqual([]);
	});

	it("shows the note of a kept record that is withdrawn, and leaves the note out of the live list when that record is not live", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await putRun(world, 0, CUTOFF - 8 * HOUR, 20, 5 * MINUTE);
		await put(world, 0, {
			ts: CUTOFF - 5 * HOUR,
			arrived: CUTOFF - 5 * HOUR,
			verdict: "fail",
		});
		const run = await putRun(world, 0, CUTOFF - 4 * HOUR, 20, 5 * MINUTE);
		await thin(NOW);
		const secret = world.pipelines[0]?.secret ?? "";
		const target = (await readRows(claimId)).find(
			(row) => row.recordId === run[0]
		);
		expect(target).toBeDefined();
		await withdraw(world, 0, run[0] ?? "");

		const all = await listThroughRoute(claimId, secret, "?limit=200");
		const live = await listThroughRoute(
			claimId,
			secret,
			"?limit=200&live=true"
		);

		const afterWithdrawal = all.evidence.find(
			(item) => item.chain_sequence === target?.seq
		);
		expect(afterWithdrawal?.revocation).not.toBeNull();
		expect(
			live.evidence.find((item) => item.chain_sequence === target?.seq)
		).toBeUndefined();
		for (const item of live.evidence) {
			expect(item).toHaveProperty("thinned_before");
		}
	});

	it("is null on every item of the live list when no gap has been thinned", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		// Recent enough to be live: a time limit of five minutes has not run out.
		await putRun(world, 0, Date.now() - 100 * SECOND, 4, 5 * SECOND);
		const secret = world.pipelines[0]?.secret ?? "";

		const live = await listThroughRoute(claimId, secret, "?live=true");

		expect(live.evidence).toHaveLength(4);
		for (const item of live.evidence) {
			expect(item.thinned_before).toBeNull();
		}
	});
});
