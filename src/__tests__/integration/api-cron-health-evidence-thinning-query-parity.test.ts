import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CUTOFF,
	HOUR,
	MINUTE,
	putRun,
	setupWorld,
} from "../utils/health-thinning-adversarial-kit";

// The world-building kit signs in as its owner; the route itself needs no session.
vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const CRON_SECRET = "thinning-query-secret";
const URL_BASE = "http://localhost:3000/api/cron/health-evidence-thinning";

beforeEach(() => {
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

afterEach(() => {
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

const DRY_RUN_MESSAGE = "dryRun must be one of 1, true, 0 or false";
const NOW_MESSAGE = "now must be an ISO 8601 date-time";

/**
 * The refusals and their exact messages as the route gave them before the
 * dry-run schema was shared with the retention route, including which issue
 * is reported when a query has more than one.
 */
const REFUSALS: [query: string, error: string][] = [
	["?dryRun=yes", DRY_RUN_MESSAGE],
	["?dryRun=TRUE", DRY_RUN_MESSAGE],
	["?dryRun=", DRY_RUN_MESSAGE],
	["?dryRun", DRY_RUN_MESSAGE],
	["?dryRun=1&dryRun=1", DRY_RUN_MESSAGE],
	["?dryRun=1&dryRun=0", DRY_RUN_MESSAGE],
	["?dryRun[]=1", 'Unrecognized key: "dryRun[]"'],
	["?DryRun=1", 'Unrecognized key: "DryRun"'],
	["?now=bad", NOW_MESSAGE],
	["?now=", NOW_MESSAGE],
	["?now=2026-01-01T00%3A00%3A00", NOW_MESSAGE],
	["?now=2026-01-01", NOW_MESSAGE],
	["?now=2026-01-01T00%3A00%3A00Z&now=2026-01-02T00%3A00%3A00Z", NOW_MESSAGE],
	["?dryRun=1&now=2026-02-30T00%3A00%3A00Z", NOW_MESSAGE],
	["?dryRun=1&now=2026-01-01T24%3A00%3A00Z", NOW_MESSAGE],
	["?dryRun=1&now=2026-01-01T00%3A00%3A00%2B0100", NOW_MESSAGE],
	["?dryRun=1&now=%202026-01-01T00%3A00%3A00Z", NOW_MESSAGE],
	["?foo=1", 'Unrecognized key: "foo"'],
	["?dryRun=1&foo=1", 'Unrecognized key: "foo"'],
	["?foo=1&bar=2", 'Unrecognized keys: "foo", "bar"'],
	["?constructor=1", 'Unrecognized key: "constructor"'],
	// More than one thing wrong: the first in the order dryRun, now, unknown.
	["?dryRun=yes&now=bad", DRY_RUN_MESSAGE],
	["?dryRun=yes&foo=1", DRY_RUN_MESSAGE],
	["?now=bad&foo=1", NOW_MESSAGE],
];

describe("POST /api/cron/health-evidence-thinning — its query is unchanged by the shared dry-run schema", () => {
	it.each(
		REFUSALS
	)("refuses %s with the same 400 body as before", async (query, error) => {
		const { POST } = await importRoute();

		const response = await POST(thinningRequest({ query, token: CRON_SECRET }));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error, code: "VALIDATION" });
	});

	it.each([
		["?dryRun=1", true],
		["?dryRun=true", true],
		["?dryRun=0", false],
		["?dryRun=false", false],
		["", false],
		["?dryRun=1&now=2026-01-01T00%3A00%3A00%2B01%3A00", true],
		["?dryRun=1&now=2026-01-01T00%3A00%3A00.123Z", true],
		["?dryRun=true&now=2026-01-01T00%3A00%3A00Z", true],
		["?now=2999-01-01T00%3A00%3A00Z&dryRun=1", true],
		["?now=2026-01-01T00%3A00%3A00Z", false],
		["?dryRun=false&now=2026-01-01T00%3A00%3A00Z", false],
	])("accepts %s and reports dryRun as %s", async (query, dryRun) => {
		const { POST } = await importRoute();

		const response = await POST(thinningRequest({ query, token: CRON_SECRET }));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			dryRun,
			busy: false,
			claimsProcessed: 0,
			recordsRemoved: 0,
			runsRecorded: 0,
			more: false,
		});
	});

	it("still checks the secret before the query", async () => {
		const { POST } = await importRoute();

		for (const query of ["?dryRun=yes", "?now=bad", "?foo=1"]) {
			const none = await POST(thinningRequest({ query }));
			const wrong = await POST(thinningRequest({ query, token: "wrong" }));
			for (const response of [none, wrong]) {
				expect(response.status, query).toBe(401);
				expect(await response.json()).toEqual({
					error: "Unauthorised",
					code: "UNAUTHORISED",
				});
			}
		}
	});

	it("still answers 500 before it looks at the query when the secret is not configured", async () => {
		vi.unstubAllEnvs();
		const { POST } = await importRoute();

		const response = await POST(
			thinningRequest({ query: "?dryRun=yes", token: CRON_SECRET })
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "Server configuration error",
			code: "INTERNAL",
		});
	});
});

describe("POST /api/cron/health-evidence-thinning — now still sets the cut-off", () => {
	/** The records a trial run with this query says it would remove; a refusal gives -1. */
	async function dryRunRemoving(query: string): Promise<number> {
		const { POST } = await importRoute();
		const response = await POST(thinningRequest({ query, token: CRON_SECRET }));
		const body = await response.json();
		return response.status === 200 && body.dryRun === true
			? body.recordsRemoved
			: -1;
	}

	it("thins by the server's time without now, and by an earlier now when one is given", async () => {
		const world = await setupWorld({ claims: 1 });
		// Forty results five minutes apart on 9 January 2026, long before the
		// server's own time.
		await putRun(world, 0, CUTOFF - 10 * HOUR, 40, 5 * MINUTE);

		const byServerTime = await dryRunRemoving("?dryRun=1");
		const byEarlierNow = await dryRunRemoving(
			"?dryRun=1&now=2026-01-09T00%3A00%3A00Z"
		);
		const byLaterNow = await dryRunRemoving(
			"?dryRun=1&now=2099-01-01T00%3A00%3A00Z"
		);
		const byOffsetNow = await dryRunRemoving(
			"?dryRun=1&now=2026-01-09T01%3A00%3A00%2B01%3A00"
		);

		expect(byServerTime).toBeGreaterThan(0);
		// A day before this now is before every result: nothing is old enough.
		expect(byEarlierNow).toBe(0);
		expect(byOffsetNow).toBe(0);
		// A later now is held to the server's time.
		expect(byLaterNow).toBe(byServerTime);
	});

	it("holds a now ahead of the server's time to the server's time, for results from the last hours", async () => {
		const world = await setupWorld({ claims: 1 });
		// Results from the last three and a half hours are inside the day that
		// nothing is removed from; a cut-off measured from a later now would
		// reach them.
		await putRun(world, 0, Date.now() - 4 * HOUR, 40, 5 * MINUTE);
		const threeDaysOn = encodeURIComponent(
			new Date(Date.now() + 3 * 24 * HOUR).toISOString()
		);

		const byServerTime = await dryRunRemoving("?dryRun=1");
		const byLaterNow = await dryRunRemoving(`?dryRun=1&now=${threeDaysOn}`);

		expect(byServerTime).toBe(0);
		expect(byLaterNow).toBe(0);
	});
});
