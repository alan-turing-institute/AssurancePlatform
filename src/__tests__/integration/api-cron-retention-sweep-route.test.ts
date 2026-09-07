import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createTestUser } from "../utils/prisma-factories";

const CRON_SECRET = "test-cron-secret";

beforeEach(() => {
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function addYears(date: Date, years: number): Date {
	const result = new Date(date);
	result.setUTCFullYear(result.getUTCFullYear() + years);
	return result;
}

/** A lastLoginAt that is already one day past the 30-day-warning threshold. */
function dueForWarn30(now: Date): Date {
	return addDays(addDays(addYears(now, -2), 30), -1);
}

function retentionSweepRequest(
	options: { dryRun?: boolean; token?: string | null } = {}
): Request {
	const url = new URL("http://localhost:3000/api/cron/retention-sweep");
	if (options.dryRun) {
		url.searchParams.set("dryRun", "1");
	}

	const headers = new Headers();
	if (options.token) {
		headers.set("authorization", `Bearer ${options.token}`);
	}

	return new Request(url, { method: "POST", headers });
}

describe("POST /api/cron/retention-sweep — auth", () => {
	it("returns a 401 envelope with no Authorization header", async () => {
		const { POST } = await import("@/app/api/cron/retention-sweep/route");
		const response = await POST(retentionSweepRequest());

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: "Unauthorised", code: "UNAUTHORISED" });
	});

	it("returns a 401 envelope for the wrong bearer token", async () => {
		const { POST } = await import("@/app/api/cron/retention-sweep/route");
		const response = await POST(
			retentionSweepRequest({ token: "wrong-secret" })
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: "Unauthorised", code: "UNAUTHORISED" });
	});

	it("returns a 500 envelope when CRON_SECRET is not configured (INTERNAL, not UNAUTHORISED)", async () => {
		vi.unstubAllEnvs();

		const { POST } = await import("@/app/api/cron/retention-sweep/route");
		const response = await POST(retentionSweepRequest({ token: CRON_SECRET }));

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({
			error: "Server configuration error",
			code: "INTERNAL",
		});
	});
});

describe("POST /api/cron/retention-sweep — real path", () => {
	it("returns 200 with all-zero counts when no user is due", async () => {
		const { POST } = await import("@/app/api/cron/retention-sweep/route");
		const response = await POST(retentionSweepRequest({ token: CRON_SECRET }));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			success: true,
			dryRun: false,
			warned30: 0,
			warned7: 0,
			deleted: 0,
			skipped: 0,
		});
	});

	it("warns and stamps the field for a due user on the real path", async () => {
		const user = await createTestUser({
			lastLoginAt: dueForWarn30(new Date()),
		});

		const { POST } = await import("@/app/api/cron/retention-sweep/route");
		const response = await POST(retentionSweepRequest({ token: CRON_SECRET }));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			success: true,
			dryRun: false,
			warned30: 1,
			warned7: 0,
			deleted: 0,
			skipped: 0,
		});

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb?.retentionWarning30SentAt).not.toBeNull();
	});
});

describe("POST /api/cron/retention-sweep — dry run", () => {
	it("reports counts but writes nothing for a due user with ?dryRun=1", async () => {
		const user = await createTestUser({
			lastLoginAt: dueForWarn30(new Date()),
		});

		const { POST } = await import("@/app/api/cron/retention-sweep/route");
		const response = await POST(
			retentionSweepRequest({ token: CRON_SECRET, dryRun: true })
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			success: true,
			dryRun: true,
			warned30: 1,
			warned7: 0,
			deleted: 0,
			skipped: 0,
		});

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb?.retentionWarning30SentAt).toBeNull();
	});
});
