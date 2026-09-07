import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { sendRetentionWarningEmail } from "@/lib/services/email-service";
import { runRetentionSweep } from "@/lib/services/retention-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

// Wrapped (not stubbed): defaults to the REAL implementation, overridden
// per-test to simulate a send failure after the atomic claim.
vi.mock("@/lib/services/email-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/email-service")>();
	return {
		...actual,
		sendRetentionWarningEmail: vi.fn(actual.sendRetentionWarningEmail),
	};
});

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

/** The lastActivity time at which the 7-day reminder threshold falls exactly now. */
function warn7ThresholdActivity(now: Date): Date {
	return addDays(addYears(now, -2), 7);
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

/**
 * QA round 1, D2: the dry-run `delete` branch used to report "deleted"
 * unconditionally, without running the same pre-checks
 * (`checkDeletable`) the real path does — so dry-run and real counts
 * disagreed on exactly the accounts the rollout dry-run check exists to
 * catch (an owned integration blocks real deletion via `ON DELETE
 * RESTRICT`).
 */
describe("runRetentionSweep — dry-run matches the real path (QA round 1, D2)", () => {
	it("reports skipped, not deleted, in DRY-RUN for a user who owns an integration", async () => {
		const now = new Date();
		const lastLoginAt = addYears(now, -5);
		const user = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -30),
			retentionWarning7SentAt: addDays(now, -7),
		});
		await createTestIntegrationWithSystemUser(user.id);

		const dryRunResult = expectSuccess(
			await runRetentionSweep(CRON_SECRET, { dryRun: true })
		);
		expect(dryRunResult.deleted).toBe(0);
		expect(dryRunResult.skipped).toBe(1);
	});

	it("agrees with the REAL run: both skip, neither deletes, for the same integration-owning user", async () => {
		const now = new Date();
		const lastLoginAt = addYears(now, -5);
		const user = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -30),
			retentionWarning7SentAt: addDays(now, -7),
		});
		await createTestIntegrationWithSystemUser(user.id);

		const dryRunResult = expectSuccess(
			await runRetentionSweep(CRON_SECRET, { dryRun: true })
		);
		const realResult = expectSuccess(await runRetentionSweep(CRON_SECRET));

		expect(dryRunResult.deleted).toBe(realResult.deleted);
		expect(dryRunResult.skipped).toBe(realResult.skipped);

		const inDb = await prisma.user.findUnique({ where: { id: user.id } });
		expect(inDb).not.toBeNull();
	});

	it("agrees on an integration owner (skipped) AND a D1-shaped user (deleted) in the SAME batch (QA round 2, item b)", async () => {
		const now = new Date();
		const lastLoginAt = addYears(now, -5);

		const integrationOwner = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -30),
			retentionWarning7SentAt: addDays(now, -7),
		});
		await createTestIntegrationWithSystemUser(integrationOwner.id);

		const d1User = await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -30),
			retentionWarning7SentAt: addDays(now, -7),
		});
		const viewer = await createTestUser();
		const sharedCase = await createTestCase(d1User.id, {
			name: "D1-shaped user's shared case",
		});
		await createTestPermission(sharedCase.id, viewer.id, d1User.id, "VIEW");

		const dryRunResult = expectSuccess(
			await runRetentionSweep(CRON_SECRET, { dryRun: true })
		);
		expect(dryRunResult.skipped).toBe(1);
		expect(dryRunResult.deleted).toBe(1);

		const realResult = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(realResult.skipped).toBe(dryRunResult.skipped);
		expect(realResult.deleted).toBe(dryRunResult.deleted);

		expect(
			await prisma.user.findUnique({ where: { id: integrationOwner.id } })
		).not.toBeNull();
		expect(
			await prisma.user.findUnique({ where: { id: d1User.id } })
		).toBeNull();
	});
});

/**
 * QA round 1 gap: overlapping sweeps could double-send a warning email
 * because the "already sent?" check and the "stamp it sent" write were two
 * separate operations. `claimWarning30`/`claimWarning7` close the gap with
 * an atomic `updateMany` guarded on the field still being `null`.
 */
describe("runRetentionSweep — double-send guard", () => {
	it("sends the 30-day warning exactly once when two sweeps race for the same user", async () => {
		const now = new Date();
		const lastLoginAt = addDays(warn30ThresholdActivity(now), -1);
		await createTestUser({ lastLoginAt });

		const [first, second] = await Promise.all([
			runRetentionSweep(CRON_SECRET),
			runRetentionSweep(CRON_SECRET),
		]);

		const firstData = expectSuccess(first);
		const secondData = expectSuccess(second);
		expect(firstData.warned30 + secondData.warned30).toBe(1);
	});

	it("sends the 7-day reminder exactly once when two sweeps race for the same user (QA round 2, item d)", async () => {
		const now = new Date();
		const lastLoginAt = addDays(warn7ThresholdActivity(now), -1);
		await createTestUser({
			lastLoginAt,
			retentionWarning30SentAt: addDays(now, -23),
		});

		const [first, second] = await Promise.all([
			runRetentionSweep(CRON_SECRET),
			runRetentionSweep(CRON_SECRET),
		]);

		const firstData = expectSuccess(first);
		const secondData = expectSuccess(second);
		expect(firstData.warned7 + secondData.warned7).toBe(1);
	});
});

/**
 * Vincent, review round 2 (should-fix): stamp-then-send meant a send
 * failure after the atomic claim was never retried — the user ends up
 * "warned on record" but never actually warned. The stamp must be undone
 * on a send failure so the next sweep retries.
 */
describe("runRetentionSweep — resets the stamp when the send fails after the claim", () => {
	afterEach(() => {
		vi.mocked(sendRetentionWarningEmail).mockRestore();
	});

	it("resets retentionWarning30SentAt to null and counts skipped when the email throws, then succeeds on the next sweep", async () => {
		const now = new Date();
		const lastLoginAt = addDays(warn30ThresholdActivity(now), -1);
		const user = await createTestUser({ lastLoginAt });

		vi.mocked(sendRetentionWarningEmail).mockImplementationOnce(() => {
			throw new Error("simulated send failure");
		});

		const first = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(first.warned30).toBe(0);
		expect(first.skipped).toBe(1);

		const afterFailure = await prisma.user.findUnique({
			where: { id: user.id },
		});
		expect(afterFailure?.retentionWarning30SentAt).toBeNull();

		// Mock restored (afterEach on the PREVIOUS test would not have run
		// yet for this assertion, but mockImplementationOnce already reverted
		// to the wrapped real implementation) — the next sweep sends for real.
		const second = expectSuccess(await runRetentionSweep(CRON_SECRET));
		expect(second.warned30).toBe(1);

		const afterRetry = await prisma.user.findUnique({
			where: { id: user.id },
		});
		expect(afterRetry?.retentionWarning30SentAt).not.toBeNull();
	});
});
