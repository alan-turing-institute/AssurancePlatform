import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupClaim } from "../utils/health-adversarial-kit";
import {
	appendSeries,
	markMatched,
	storedRecordIds,
} from "../utils/health-thinning-kit";

const CRON_SECRET = "test-cron-secret";
const FIVE_MINUTES = 5 * 60_000;
const THREE_DAYS = 3 * 24 * 60 * 60_000;

beforeEach(() => {
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

function thinningRequest(
	options: { dryRun?: boolean; token?: string | null } = {}
): Request {
	const url = new URL(
		"http://localhost:3000/api/cron/health-evidence-thinning"
	);
	if (options.dryRun) {
		url.searchParams.set("dryRun", "1");
	}
	const headers = new Headers();
	if (options.token) {
		headers.set("authorization", `Bearer ${options.token}`);
	}
	return new Request(url, { method: "POST", headers });
}

async function callRoute(options: { dryRun?: boolean; token?: string | null }) {
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
