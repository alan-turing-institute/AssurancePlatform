// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
import { Client, type Pool, type PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { captureLogs } from "../helpers/capture-logs";
import {
	duringOutage,
	errorDuringOutage,
	type OutageKind,
	startDriverFailure,
} from "../utils/database-outage-kit";
import { createTestUser } from "../utils/prisma-factories";

/**
 * GET /api/health is public. When the database check fails it must answer
 * with fixed text, whatever the driver said, and the log must hold the error's
 * class and nothing it said. The failures here are real: the app's own pool is
 * pointed at a closed port, a database that does not exist, or a role the
 * server does not know, and Prisma's own error comes back.
 */

const FIXED_TEXT = "Database connection failed";
const OUTAGES: OutageKind[] = ["refused", "unknown-database", "unknown-role"];
const POOL_ERROR_TEXT = "timeout exceeded when trying to connect";

interface Answer {
	body: {
		checks: { database: Record<string, unknown> };
		status: string;
		timestamp: string;
	};
	headers: string;
	status: number;
	statusText: string;
}

async function ask(): Promise<Answer> {
	const response = await GET();
	const headers: string[] = [];
	response.headers.forEach((value, name) => {
		headers.push(`${name}: ${value}`);
	});
	return {
		status: response.status,
		statusText: response.statusText,
		headers: headers.join("\n"),
		body: await response.json(),
	};
}

/** Everything the caller of the endpoint can see. */
function visible(answer: Answer): string {
	return `${answer.statusText}\n${answer.headers}\n${JSON.stringify(answer.body)}`;
}

/** The lines of a driver message that carry detail, one per non-empty line. */
function detailLines(message: string): string[] {
	return message
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length >= 12);
}

function expectNoneOf(shown: string, forbidden: string[]) {
	for (const piece of forbidden) {
		expect(shown, `shown text must not hold "${piece}"`).not.toContain(piece);
	}
}

function expectFailureShape(answer: Answer) {
	expect(answer.status).toBe(503);
	expect(Object.keys(answer.body).sort()).toEqual([
		"checks",
		"status",
		"timestamp",
	]);
	expect(answer.body.status).toBe("unhealthy");
	expect(Object.keys(answer.body.checks)).toEqual(["database"]);
	expect(Object.keys(answer.body.checks.database).sort()).toEqual([
		"error",
		"status",
	]);
	expect(answer.body.checks.database.status).toBe("unhealthy");
	expect(answer.body.checks.database.error).toBe(FIXED_TEXT);
	expect(Number.isNaN(Date.parse(answer.body.timestamp))).toBe(false);
}

describe("GET /api/health when the database check passes", () => {
	it("answers 200 with the status, a latency, and no error field", async () => {
		await createTestUser();

		const answer = await ask();

		expect(answer.status).toBe(200);
		expect(answer.body.status).toBe("healthy");
		expect(Object.keys(answer.body).sort()).toEqual([
			"checks",
			"status",
			"timestamp",
		]);
		expect(Object.keys(answer.body.checks.database).sort()).toEqual([
			"latencyMs",
			"status",
		]);
		expect(answer.body.checks.database.status).toBe("healthy");
		expect(answer.body.checks.database.latencyMs).toEqual(expect.any(Number));
	});

	it("answers 200 degraded, with a latency and no error field, when the check takes over a second", async () => {
		const locker = new Client({ connectionString: process.env.DATABASE_URL });
		await locker.connect();
		try {
			await locker.query("BEGIN");
			await locker.query("LOCK TABLE users IN ACCESS EXCLUSIVE MODE");
			const pending = ask();
			await new Promise((resolve) => setTimeout(resolve, 1300));
			await locker.query("COMMIT");

			const answer = await pending;

			expect(answer.status).toBe(200);
			expect(answer.body.status).toBe("degraded");
			expect(answer.body.checks.database.status).toBe("degraded");
			expect(answer.body.checks.database.latencyMs).toBeGreaterThan(1000);
			expect(answer.body.checks.database).not.toHaveProperty("error");
		} finally {
			await locker.query("ROLLBACK").catch(() => undefined);
			await locker.end();
		}
	});
});

describe("GET /api/health when the database check throws", () => {
	it.each(
		OUTAGES
	)("answers 503 with only the fixed text after a %s failure", async (kind) => {
		await duringOutage(kind, async (outage) => {
			const reference = await errorDuringOutage();
			// The failure is a revealing one: the driver's own message names it.
			expect(reference.message).toContain(outage.revealing[0]);

			const answer = await ask();

			expectFailureShape(answer);
			expectNoneOf(visible(answer), [
				reference.message,
				...detailLines(reference.message),
				...outage.revealing,
				outage.password,
				"127.0.0.1",
				"Invalid `prisma",
				"invocation",
				".ts:",
			]);
		});
	});

	it("gives the same text for different causes, so the text says nothing about which", async () => {
		const texts: unknown[] = [];
		for (const kind of OUTAGES) {
			await duringOutage(kind, async () => {
				texts.push((await ask()).body.checks.database.error);
			});
		}

		expect(texts).toEqual([FIXED_TEXT, FIXED_TEXT, FIXED_TEXT]);
	});

	it("shows nothing of a message that holds a whole connection string and its password", async () => {
		const connection =
			"postgresql://tea_admin:Pr0d-S3cret!@db-prod.internal:5432/tea";
		const outage = await startDriverFailure(
			new Error(`connection to ${connection} refused (SELECT 1 FROM users)`)
		);
		try {
			const answer = await ask();

			expectFailureShape(answer);
			expectNoneOf(visible(answer), [
				connection,
				"Pr0d-S3cret",
				"tea_admin",
				"db-prod.internal",
				"5432",
				"SELECT",
			]);
		} finally {
			outage.end();
		}
	});

	it.each([
		["a string", "connection to db-prod.internal:5432 refused"],
		[
			"a plain object",
			{ message: "connection to db-prod.internal:5432 refused" },
		],
		["null", null],
		[
			"an error with no message and a cause that names the host",
			new Error(undefined, { cause: new Error("db-prod.internal:5432") }),
		],
	])("answers the same fixed text when the thrown value is %s", async (_label, failure) => {
		const outage = await startDriverFailure(failure);
		try {
			const answer = await ask();

			expectFailureShape(answer);
			expectNoneOf(visible(answer), ["db-prod.internal", "5432"]);
		} finally {
			outage.end();
		}
	});

	it("answers the same fixed text when no connection can be had from a full pool", async () => {
		await createTestUser();
		await import("@/lib/prisma");
		const pool = (globalThis as unknown as { pgPool: Pool }).pgPool;
		const clients: PoolClient[] = [];
		try {
			for (let i = 0; i < (pool.options.max ?? 10); i++) {
				clients.push(await pool.connect());
			}

			const answer = await ask();

			expectFailureShape(answer);
			expect(visible(answer)).not.toContain(POOL_ERROR_TEXT);
		} finally {
			for (const client of clients) {
				client.release();
			}
		}
	});

	it("logs the error's class and nothing the error said", async () => {
		const logs = captureLogs();
		try {
			for (const kind of OUTAGES) {
				await duringOutage(kind, async (outage) => {
					logs.entries.length = 0;
					const reference = await errorDuringOutage();

					await ask();

					const logged = JSON.stringify(logs.entries);
					expect(logs.entries.length).toBeGreaterThan(0);
					expectNoneOf(logged, [
						reference.message,
						...detailLines(reference.message),
						...outage.revealing,
						outage.password,
						"127.0.0.1",
						"Invalid `prisma",
						".ts:",
					]);
					const failure = logs.entries.filter(
						(entry) => entry.level === "error" || entry.level === "warn"
					);
					expect(failure.length).toBeGreaterThan(0);
					expect(failure.map((entry) => entry.errorName)).toContain(
						reference.name
					);
					for (const entry of failure) {
						expect(entry).not.toHaveProperty("error");
						expect(entry).not.toHaveProperty("stack");
						expect(entry).not.toHaveProperty("message");
					}
				});
			}
		} finally {
			logs.restore();
		}
	});

	it("logs no message text for a thrown value that is not an error", async () => {
		const logs = captureLogs();
		const outage = await startDriverFailure({
			message: "connection to db-prod.internal:5432 refused",
		});
		try {
			const answer = await ask();

			expectFailureShape(answer);
			expectNoneOf(JSON.stringify(logs.entries), ["db-prod.internal", "5432"]);
		} finally {
			outage.end();
			logs.restore();
		}
	});
});
