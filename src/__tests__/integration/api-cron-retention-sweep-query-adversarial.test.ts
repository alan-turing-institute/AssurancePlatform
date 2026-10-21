import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createTestUser } from "../utils/prisma-factories";

const CRON_SECRET = "retention-query-secret";
const URL_BASE = "http://localhost:3000/api/cron/retention-sweep";

beforeEach(() => {
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
	return new Date(Date.now() - days * DAY);
}

function yearsAgo(years: number): Date {
	const date = new Date();
	date.setUTCFullYear(date.getUTCFullYear() - years);
	return date;
}

/** An account whose two warnings are old enough that the sweep deletes it. */
function dueForDeletion() {
	return createTestUser({
		lastLoginAt: yearsAgo(3),
		retentionWarning30SentAt: daysAgo(40),
		retentionWarning7SentAt: daysAgo(10),
	});
}

/** An account the sweep would send its first warning to. */
function dueForFirstWarning() {
	return createTestUser({ lastLoginAt: yearsAgo(3) });
}

async function world() {
	const doomed = await dueForDeletion();
	const warnable = await dueForFirstWarning();
	return { doomed, warnable };
}

async function snapshot(ids: string[]) {
	const rows = await prisma.user.findMany({
		where: { id: { in: ids } },
		orderBy: { id: "asc" },
		select: {
			id: true,
			retentionWarning30SentAt: true,
			retentionWarning7SentAt: true,
			lastLoginAt: true,
		},
	});
	return rows;
}

function sweepRequest(
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

const importRoute = () => import("@/app/api/cron/retention-sweep/route");

/** Each of these has to be refused: none of them is a plain trial-run or real-run request. */
const REFUSED_QUERIES: [label: string, query: string, mentions: string][] = [
	["a word instead of a number", "?dryRun=yes", "dryRun"],
	["the word on", "?dryRun=on", "dryRun"],
	["an empty value", "?dryRun=", "dryRun"],
	["no value and no equals sign", "?dryRun", "dryRun"],
	["a capitalised true", "?dryRun=True", "dryRun"],
	["an upper-case TRUE", "?dryRun=TRUE", "dryRun"],
	["a capitalised false", "?dryRun=False", "dryRun"],
	["an upper-case FALSE", "?dryRun=FALSE", "dryRun"],
	["a number other than 0 or 1", "?dryRun=2", "dryRun"],
	["a negative number", "?dryRun=-1", "dryRun"],
	["a zero-padded one", "?dryRun=01", "dryRun"],
	["a one with a trailing space", "?dryRun=1%20", "dryRun"],
	["a one with a leading space", "?dryRun=%201", "dryRun"],
	["a list in one value", "?dryRun=1,true", "dryRun"],
	["a one followed by a newline", "?dryRun=1%0A", "dryRun"],
	[
		"the parameter repeated with the same value",
		"?dryRun=1&dryRun=1",
		"dryRun",
	],
	["the parameter repeated, trial then real", "?dryRun=1&dryRun=0", "dryRun"],
	["the parameter repeated, real then trial", "?dryRun=0&dryRun=1", "dryRun"],
	[
		"the parameter repeated, true then false",
		"?dryRun=true&dryRun=false",
		"dryRun",
	],
	["an array-style name", "?dryRun[]=1", "dryRun[]"],
	["a differently cased name", "?DryRun=1", "DryRun"],
	["an upper-case name", "?DRYRUN=1", "DRYRUN"],
	["a lower-case name", "?dryrun=1", "dryrun"],
	["a snake-case name", "?dry_run=1", "dry_run"],
	["a hyphenated name", "?dry-run=1", "dry-run"],
	[
		"the thinning route's now parameter",
		"?now=2026-01-01T00%3A00%3A00Z",
		"now",
	],
	[
		"a valid trial run with the now parameter",
		"?dryRun=1&now=2026-01-01T00%3A00%3A00Z",
		"now",
	],
	["a real run with an unknown parameter", "?dryRun=0&limit=5", "limit"],
	["an unknown parameter on its own", "?force=true", "force"],
	[
		"an unknown parameter with a valid trial run",
		"?dryRun=true&force=1",
		"force",
	],
	["a constructor key", "?constructor=1", "constructor"],
	["a toString key", "?toString=1", "toString"],
	["a hasOwnProperty key", "?hasOwnProperty=1", "hasOwnProperty"],
];

describe("POST /api/cron/retention-sweep — the secret is checked before the query", () => {
	const BAD_QUERIES = [
		"?dryRun=yes",
		"?dryRun=TRUE",
		"?dryRun=",
		"?dryRun=1&dryRun=1",
		"?now=2026-01-01T00%3A00%3A00Z",
		"?unknown=1",
	];

	it("answers 401 to a refused query sent with no header, a wrong secret or a near miss, and changes nothing", async () => {
		const { doomed, warnable } = await world();
		const before = await snapshot([doomed.id, warnable.id]);
		const { POST } = await importRoute();

		for (const query of BAD_QUERIES) {
			for (const token of [
				null,
				"wrong-secret",
				`${CRON_SECRET}x`,
				CRON_SECRET.slice(0, -1),
				CRON_SECRET.toUpperCase(),
			]) {
				const response = await POST(sweepRequest({ query, token }));
				expect(response.status, `${query} with ${token}`).toBe(401);
				expect(await response.json()).toEqual({
					error: "Unauthorised",
					code: "UNAUTHORISED",
				});
			}
		}

		expect(await snapshot([doomed.id, warnable.id])).toEqual(before);
	});

	it("answers 401 to a good query with no valid secret, as it does without a query", async () => {
		const { POST } = await importRoute();

		for (const query of ["", "?dryRun=1", "?dryRun=0", "?dryRun=true"]) {
			const response = await POST(sweepRequest({ query, token: "wrong" }));
			expect(response.status, query).toBe(401);
		}
	});

	it("answers 500, not 400, to a refused query when the secret is not configured, and changes nothing", async () => {
		const { doomed, warnable } = await world();
		const before = await snapshot([doomed.id, warnable.id]);
		vi.unstubAllEnvs();
		const { POST } = await importRoute();

		for (const query of BAD_QUERIES) {
			const response = await POST(sweepRequest({ query, token: CRON_SECRET }));
			expect(response.status, query).toBe(500);
			expect(await response.json()).toEqual({
				error: "Server configuration error",
				code: "INTERNAL",
			});
		}

		expect(await snapshot([doomed.id, warnable.id])).toEqual(before);
	});
});

describe("POST /api/cron/retention-sweep — a query that is not a plain trial run or real run", () => {
	it.each(
		REFUSED_QUERIES
	)("refuses %s with a 400 that names the parameter, and does nothing", async (_label, query, mentions) => {
		const { doomed, warnable } = await world();
		const before = await snapshot([doomed.id, warnable.id]);
		const { POST } = await importRoute();

		const response = await POST(sweepRequest({ query, token: CRON_SECRET }));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("VALIDATION");
		expect(typeof body.error).toBe("string");
		expect(body.error).toContain(mentions);
		// Not a sweep result of any kind.
		expect(body).not.toHaveProperty("success");
		expect(body).not.toHaveProperty("deleted");
		expect(await snapshot([doomed.id, warnable.id])).toEqual(before);
		expect(
			await prisma.user.count({
				where: { id: { in: [doomed.id, warnable.id] } },
			})
		).toBe(2);
	});

	it("gives the same message for a misspelt value as the thinning route gives", async () => {
		const { POST } = await importRoute();

		const response = await POST(
			sweepRequest({ query: "?dryRun=yes", token: CRON_SECRET })
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "dryRun must be one of 1, true, 0 or false",
			code: "VALIDATION",
		});
	});

	it("keeps refusing after a refused call: a refused call changes no state a later call depends on", async () => {
		const { doomed } = await world();
		const { POST } = await importRoute();

		const refused = await POST(
			sweepRequest({ query: "?dryRun=TRUE", token: CRON_SECRET })
		);
		expect(refused.status).toBe(400);

		const trial = await POST(
			sweepRequest({ query: "?dryRun=true", token: CRON_SECRET })
		);
		expect(trial.status).toBe(200);
		expect(await trial.json()).toEqual({
			success: true,
			dryRun: true,
			warned30: 1,
			warned7: 0,
			deleted: 1,
			skipped: 0,
		});
		expect(
			await prisma.user.findUnique({ where: { id: doomed.id } })
		).not.toBeNull();
	});
});

describe("POST /api/cron/retention-sweep — a trial run", () => {
	it.each([
		"?dryRun=1",
		"?dryRun=true",
	])("%s counts what would happen and sends, stamps and deletes nothing", async (query) => {
		const { doomed, warnable } = await world();
		const before = await snapshot([doomed.id, warnable.id]);
		const { POST } = await importRoute();

		const response = await POST(sweepRequest({ query, token: CRON_SECRET }));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			dryRun: true,
			warned30: 1,
			warned7: 0,
			deleted: 1,
			skipped: 0,
		});
		expect(await snapshot([doomed.id, warnable.id])).toEqual(before);
	});

	it("accepts the encoded form of 1, since it decodes to a plain 1", async () => {
		const { doomed } = await world();
		const { POST } = await importRoute();

		const response = await POST(
			sweepRequest({ query: "?dryRun=%31", token: CRON_SECRET })
		);

		expect(response.status).toBe(200);
		expect((await response.json()).dryRun).toBe(true);
		expect(
			await prisma.user.findUnique({ where: { id: doomed.id } })
		).not.toBeNull();
	});
});

describe("POST /api/cron/retention-sweep — a real run", () => {
	it.each([
		["no query", ""],
		["dryRun=0", "?dryRun=0"],
		["dryRun=false", "?dryRun=false"],
	])("with %s warns the due account and deletes the overdue one", async (_label, query) => {
		const { doomed, warnable } = await world();
		const { POST } = await importRoute();

		const response = await POST(sweepRequest({ query, token: CRON_SECRET }));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			dryRun: false,
			warned30: 1,
			warned7: 0,
			deleted: 1,
			skipped: 0,
		});
		expect(
			await prisma.user.findUnique({ where: { id: doomed.id } })
		).toBeNull();
		const warned = await prisma.user.findUnique({ where: { id: warnable.id } });
		expect(warned?.retentionWarning30SentAt).not.toBeNull();
	});
});

describe("POST /api/cron/retention-sweep — spellings of a plain request", () => {
	it.each([
		"?dryRun=1&",
		"?&dryRun=1",
		"?dryRun=1#fragment",
		"?dryRun=1&&",
	])("takes %s as a trial run", async (query) => {
		const { doomed } = await world();
		const { POST } = await importRoute();

		const response = await POST(sweepRequest({ query, token: CRON_SECRET }));

		expect(response.status).toBe(200);
		expect((await response.json()).dryRun).toBe(true);
		expect(
			await prisma.user.findUnique({ where: { id: doomed.id } })
		).not.toBeNull();
	});

	it("takes a lone question mark as a real run", async () => {
		const { doomed } = await world();
		const { POST } = await importRoute();

		const response = await POST(
			sweepRequest({ query: "?", token: CRON_SECRET })
		);

		expect(response.status).toBe(200);
		expect((await response.json()).dryRun).toBe(false);
		expect(
			await prisma.user.findUnique({ where: { id: doomed.id } })
		).toBeNull();
	});

	it("answers to POST only", async () => {
		const route = await importRoute();

		expect(Object.keys(route)).toEqual(["POST"]);
	});
});

describe("the retention workflow's calls", () => {
	const workflow = readFileSync(
		new URL("../../../.github/workflows/retention-sweep.yml", import.meta.url),
		"utf8"
	);

	it("only ever adds dryRun=1 to the address, so every call it makes is accepted", async () => {
		const queries = [...workflow.matchAll(/\$\{url\}(\?[^"\s]*)/g)].map(
			(match) => match[1] ?? ""
		);
		expect(queries).toEqual(["?dryRun=1"]);

		await world();
		const { POST } = await importRoute();
		for (const query of ["", ...queries]) {
			const response = await POST(sweepRequest({ query, token: CRON_SECRET }));
			expect(response.status, query || "(no query)").toBe(200);
		}
	});
});
