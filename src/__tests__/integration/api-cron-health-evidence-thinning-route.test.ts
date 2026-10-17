import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupClaim } from "../utils/health-adversarial-kit";
import {
	appendSeries,
	markMatched,
	pick,
	storedRecordIds,
} from "../utils/health-thinning-kit";

const CRON_SECRET = "test-cron-secret";
const FIVE_MINUTES = 5 * 60_000;
const HALF_HOUR = 30 * 60_000;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const THREE_DAYS = 3 * DAY;

beforeEach(() => {
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

function thinningRequest(
	options: { dryRun?: boolean; query?: string; token?: string | null } = {}
): Request {
	const url = new URL(
		"http://localhost:3000/api/cron/health-evidence-thinning"
	);
	if (options.dryRun) {
		url.searchParams.set("dryRun", "1");
	}
	if (options.query) {
		url.search = options.query;
	}
	const headers = new Headers();
	if (options.token) {
		headers.set("authorization", `Bearer ${options.token}`);
	}
	return new Request(url, { method: "POST", headers });
}

async function callRoute(options: {
	dryRun?: boolean;
	query?: string;
	token?: string | null;
}) {
	const { POST } = await import(
		"@/app/api/cron/health-evidence-thinning/route"
	);
	return await POST(thinningRequest(options));
}

/** Four passes five minutes apart that began three days ago, of which the middle two would go. */
async function seedOldPasses() {
	const { owner, claim } = await setupClaim();
	const ids = await appendSeries(
		owner.id,
		claim.id,
		new Date(Date.now() - THREE_DAYS),
		4,
		FIVE_MINUTES
	);
	await markMatched(claim.id);
	return { claim, ids };
}

describe("POST /api/cron/health-evidence-thinning — auth", () => {
	it("returns a 401 envelope with no Authorization header, and thins nothing", async () => {
		const { claim } = await seedOldPasses();

		const response = await callRoute({});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Unauthorised",
			code: "UNAUTHORISED",
		});
		expect(await storedRecordIds(claim.id)).toHaveLength(4);
	});

	it("returns a 401 envelope for the wrong bearer token", async () => {
		const response = await callRoute({ token: "wrong-secret" });

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Unauthorised",
			code: "UNAUTHORISED",
		});
	});

	it("returns a 500 envelope when CRON_SECRET is not configured (INTERNAL, not UNAUTHORISED)", async () => {
		vi.unstubAllEnvs();

		const response = await callRoute({ token: CRON_SECRET });

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "Server configuration error",
			code: "INTERNAL",
		});
	});
});

describe("POST /api/cron/health-evidence-thinning — work", () => {
	it("thins the log and reports what it did", async () => {
		const { claim, ids } = await seedOldPasses();

		const response = await callRoute({ token: CRON_SECRET });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			dryRun: false,
			busy: false,
			claimsProcessed: 1,
			more: false,
			recordsRemoved: 2,
			runsRecorded: 1,
		});
		expect(await storedRecordIds(claim.id)).toEqual([ids[0], ids[3]]);
	});

	it("reports the same counts on a dry run and removes nothing", async () => {
		const { claim } = await seedOldPasses();

		const response = await callRoute({ token: CRON_SECRET, dryRun: true });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			dryRun: true,
			busy: false,
			claimsProcessed: 1,
			more: false,
			recordsRemoved: 2,
			runsRecorded: 1,
		});
		expect(await storedRecordIds(claim.id)).toHaveLength(4);
	});
});

describe("POST /api/cron/health-evidence-thinning — the query", () => {
	it("measures the cut-off from an earlier now", async () => {
		const { owner, claim } = await setupClaim();
		// Eight passes five minutes apart from twenty minutes before an hour
		// boundary three days ago, so the boundary falls after the fourth.
		const boundary = Math.floor((Date.now() - THREE_DAYS) / HOUR) * HOUR;
		const ids = await appendSeries(
			owner.id,
			claim.id,
			new Date(boundary - 4 * FIVE_MINUTES),
			8,
			FIVE_MINUTES
		);
		await markMatched(claim.id);
		// Half an hour into the boundary hour, a day on: the cut-off is the
		// boundary. The server's own time would put it much later and thin all eight.
		const earlier = new Date(boundary + DAY + HALF_HOUR).toISOString();

		const response = await callRoute({
			token: CRON_SECRET,
			query: `now=${earlier}`,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			dryRun: false,
			recordsRemoved: 2,
			runsRecorded: 1,
		});
		expect(await storedRecordIds(claim.id)).toEqual(
			pick(ids, [0, 3, 4, 5, 6, 7])
		);
	});

	it("treats a now later than the server's time as the server's time", async () => {
		const { owner, claim } = await setupClaim();
		// Passes from the last hour are inside the day nothing is removed from,
		// but a cut-off measured from three days ahead would reach them.
		await appendSeries(
			owner.id,
			claim.id,
			new Date(Date.now() - HOUR),
			4,
			FIVE_MINUTES
		);
		await markMatched(claim.id);
		const later = new Date(Date.now() + THREE_DAYS).toISOString();

		const response = await callRoute({
			token: CRON_SECRET,
			query: `now=${later}`,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ recordsRemoved: 0 });
		expect(await storedRecordIds(claim.id)).toHaveLength(4);
	});

	it("refuses a now that is not an ISO 8601 date-time, and removes nothing", async () => {
		const { claim } = await seedOldPasses();

		for (const value of ["yesterday", "2026-10-15", "1760000000", ""]) {
			const response = await callRoute({
				token: CRON_SECRET,
				query: `now=${value}`,
			});

			expect(response.status).toBe(400);
			expect((await response.json()).code).toBe("VALIDATION");
		}

		expect(await storedRecordIds(claim.id)).toHaveLength(4);
	});

	it("takes dryRun=true as a dry run, and removes nothing", async () => {
		const { claim } = await seedOldPasses();

		const response = await callRoute({
			token: CRON_SECRET,
			query: "dryRun=true",
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			dryRun: true,
			recordsRemoved: 2,
		});
		expect(await storedRecordIds(claim.id)).toHaveLength(4);
	});

	it.each(["0", "false"])("runs for real with dryRun=%s", async (value) => {
		const { claim, ids } = await seedOldPasses();

		const response = await callRoute({
			token: CRON_SECRET,
			query: `dryRun=${value}`,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			dryRun: false,
			recordsRemoved: 2,
		});
		expect(await storedRecordIds(claim.id)).toEqual([ids[0], ids[3]]);
	});

	it("refuses any other dryRun, an unknown parameter and a repeated one, and removes nothing", async () => {
		const { claim } = await seedOldPasses();

		for (const query of [
			"dryRun=yes",
			"dryRun=TRUE",
			"dryRun=2",
			"dryRun=",
			"dryrun=1",
			"dryRun=1&dryRun=0",
			"dryRun=0&now=2026-10-15T03:00:00Z&now=2026-10-14T03:00:00Z",
			"limit=5",
		]) {
			const response = await callRoute({ token: CRON_SECRET, query });

			expect(response.status, query).toBe(400);
			expect((await response.json()).code, query).toBe("VALIDATION");
		}

		expect(await storedRecordIds(claim.id)).toHaveLength(4);
	});
});
