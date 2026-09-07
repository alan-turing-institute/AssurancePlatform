import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { runRetentionSweep } from "@/lib/services/retention-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
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

/** The lastActivity time at which the 30-day warning threshold falls exactly now. */
function warn30ThresholdActivity(now: Date): Date {
	return addDays(addYears(now, -2), 30);
}

describe("runRetentionSweep — auth", () => {
	it("refuses with no CRON_SECRET configured", async () => {
		vi.unstubAllEnvs();
		expectError(
			await runRetentionSweep("anything"),
			"Server configuration error"
		);
	});

	it("refuses a missing token", async () => {
		expectError(await runRetentionSweep(null), "Unauthorised");
	});

	it("refuses a wrong token", async () => {
		expectError(await runRetentionSweep("wrong-secret"), "Unauthorised");
	});

	it("accepts the correct token", async () => {
		expectSuccess(await runRetentionSweep(CRON_SECRET));
	});
});

describe("runRetentionSweep — 30-day warning fencepost", () => {
	it("does not warn a user who is one day short of the 30-day-before threshold", async () => {
		const now = new Date();
		const lastLoginAt = addDays(warn30ThresholdActivity(now), 1);
		const user = await createTestUser({ lastLoginAt });

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(result.warned30).toBe(0);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb?.retentionWarning30SentAt).toBeNull();
	});

	it("warns a user who is one day past the 30-day-before threshold", async () => {
		const now = new Date();
		const lastLoginAt = addDays(warn30ThresholdActivity(now), -1);
		const user = await createTestUser({ lastLoginAt });

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(result.warned30).toBe(1);
		expect(result.deleted).toBe(0);
		expect(result.warned7).toBe(0);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb?.retentionWarning30SentAt).not.toBeNull();
	});

	it("falls back to createdAt when lastLoginAt is null", async () => {
		const now = new Date();
		const createdAt = addDays(warn30ThresholdActivity(now), -1);
		const user = await createTestUser({ lastLoginAt: null, createdAt });

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(result.warned30).toBe(1);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb?.retentionWarning30SentAt).not.toBeNull();
	});
});

describe("runRetentionSweep — 7-day reminder gate", () => {
	it("does not send the 7-day reminder before the 30-day warning is 23 days old", async () => {
		const now = new Date();
		// Very overdue, so now is already past the 7-day-before threshold too.
		const lastLoginAt = addYears(now, -5);
		const user = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -5), // only 5 days old, not 23
		});

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(result.warned7).toBe(0);
		expect(result.warned30).toBe(0); // already sent, so not sent again
		expect(result.deleted).toBe(0);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb?.retentionWarning7SentAt).toBeNull();
	});

	it("sends the 7-day reminder once the 30-day warning is at least 23 days old", async () => {
		const now = new Date();
		const lastLoginAt = addYears(now, -5);
		const user = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -23),
		});

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(result.warned7).toBe(1);
		expect(result.deleted).toBe(0);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb?.retentionWarning7SentAt).not.toBeNull();
	});
});

describe("runRetentionSweep — deletion gate", () => {
	it("does not delete before the 7-day reminder is 7 days old", async () => {
		const now = new Date();
		const lastLoginAt = addYears(now, -5);
		const user = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -30),
			retentionWarning7SentAt: addDays(now, -3),
		});

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(result.deleted).toBe(0);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb).not.toBeNull();
	});

	it("deletes once the 7-day reminder is at least 7 days old", async () => {
		const now = new Date();
		const lastLoginAt = addYears(now, -5);
		const user = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -30),
			retentionWarning7SentAt: addDays(now, -7),
		});

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(result.deleted).toBe(1);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb).toBeNull();
	});
});

describe("runRetentionSweep — SYSTEM exclusion", () => {
	it("never sweeps a SYSTEM auth-provider user, however overdue", async () => {
		const now = new Date();
		const user = await createTestUser({
			authProvider: "SYSTEM",
			lastLoginAt: addYears(now, -10),
		});

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb).not.toBeNull();
		expect(inDb?.retentionWarning30SentAt).toBeNull();
		expect(result.deleted).toBe(0);
	});
});

describe("runRetentionSweep — first-run safety property", () => {
	it("an account already 5 years inactive on its first sweep gets a warning, never a deletion", async () => {
		const now = new Date();
		const user = await createTestUser({ lastLoginAt: addYears(now, -5) });

		const result = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(result.warned30).toBe(1);
		expect(result.warned7).toBe(0);
		expect(result.deleted).toBe(0);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb).not.toBeNull();
		expect(inDb?.retentionWarning30SentAt).not.toBeNull();
		expect(inDb?.retentionWarning7SentAt).toBeNull();
	});
});

describe("runRetentionSweep — idempotency", () => {
	it("a second immediate run sends nothing new for an already-warned user", async () => {
		const now = new Date();
		const user = await createTestUser({ lastLoginAt: addYears(now, -5) });

		const first = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(first.warned30).toBe(1);

		const second = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(second.warned30).toBe(0);
		expect(second.warned7).toBe(0);
		expect(second.deleted).toBe(0);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb).not.toBeNull();
	});
});

describe("runRetentionSweep — dry run", () => {
	it("computes counts without writing a warning timestamp or sending anything", async () => {
		const now = new Date();
		const lastLoginAt = addDays(warn30ThresholdActivity(now), -1);
		const user = await createTestUser({ lastLoginAt });

		const result = expectSuccess(
			await runRetentionSweep(CRON_SECRET, { dryRun: true })
		);
		expect(result.warned30).toBe(1);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb?.retentionWarning30SentAt).toBeNull();
	});

	it("does not delete an account due for deletion", async () => {
		const now = new Date();
		const lastLoginAt = addYears(now, -5);
		const user = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -30),
			retentionWarning7SentAt: addDays(now, -7),
		});

		const result = expectSuccess(
			await runRetentionSweep(CRON_SECRET, { dryRun: true })
		);
		expect(result.deleted).toBe(1);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb).not.toBeNull();
	});
});
