import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	changeBoundCheck,
	reinstateHealthEvidence,
	revokeHealthEvidence,
} from "@/lib/services/health-evidence-service";
import {
	computeHealthStatus,
	readHealthStatus,
} from "@/lib/services/health-status-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	addClaim,
	appendRecord,
	isoAgo,
	MINUTE,
	setupClaim,
} from "../utils/health-adversarial-kit";
import {
	createTestCase,
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

beforeEach(() => {
	vi.clearAllMocks();
});

const provenance = (session: string, twin: string) => ({
	session,
	pipeline_version: "0.4.0",
	twin_version: twin,
	members: [crypto.randomUUID()],
});

const revoke = async (userId: string, claimId: string, recordId: string) =>
	expectSuccess(
		await revokeHealthEvidence(userId, claimId, recordId, {
			cause: "other",
			reason: "test",
		})
	);

describe("status: which record is current", () => {
	it("follows the latest timestamp, not the latest arrival", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const newest = await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: isoAgo(1 * MINUTE),
		});
		await appendRecord(owner.id, claim.id, "failingSummary", {
			timestamp: isoAgo(30 * MINUTE),
		});

		const status = await computeHealthStatus(claim.id, testCase.id);

		expect(status?.record_id).toBe(newest.record_id);
		expect(status?.verdict).toBe("pass");
	});

	it("breaks a timestamp tie by arrival order, deterministically", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const timestamp = isoAgo(2 * MINUTE);
		await appendRecord(owner.id, claim.id, "populationPass", { timestamp });
		const second = await appendRecord(owner.id, claim.id, "failingSummary", {
			timestamp,
		});

		const status = await computeHealthStatus(claim.id, testCase.id);

		expect(status?.record_id).toBe(second.record_id);
		expect(status?.verdict).toBe("fail");
	});

	it("falls back to the previous record when the latest is revoked, and returns to it on reinstatement", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const older = await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: isoAgo(10 * MINUTE),
		});
		const latest = await appendRecord(owner.id, claim.id, "failingSummary", {
			timestamp: isoAgo(2 * MINUTE),
		});

		await revoke(owner.id, claim.id, latest.record_id);
		expect((await computeHealthStatus(claim.id, testCase.id))?.record_id).toBe(
			older.record_id
		);

		expectSuccess(
			await reinstateHealthEvidence(owner.id, claim.id, latest.record_id, {
				reason: "fine",
			})
		);
		expect((await computeHealthStatus(claim.id, testCase.id))?.record_id).toBe(
			latest.record_id
		);
	});

	it("revoking a record that is not the latest does not change the status", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const older = await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: isoAgo(10 * MINUTE),
		});
		const latest = await appendRecord(owner.id, claim.id, "failingSummary", {
			timestamp: isoAgo(2 * MINUTE),
		});

		await revoke(owner.id, claim.id, older.record_id);

		expect((await computeHealthStatus(claim.id, testCase.id))?.record_id).toBe(
			latest.record_id
		);
	});

	it("has a verdict-less stale status with reason all-revoked once every record is revoked, and recovers on reinstatement", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const a = await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: isoAgo(10 * MINUTE),
		});
		const b = await appendRecord(owner.id, claim.id, "failingSummary", {
			timestamp: isoAgo(2 * MINUTE),
		});
		await revoke(owner.id, claim.id, a.record_id);
		await revoke(owner.id, claim.id, b.record_id);

		const status = await computeHealthStatus(claim.id, testCase.id);

		expect(status).toMatchObject({
			verdict: null,
			stale: true,
			stale_reason: "all-revoked",
			record_id: null,
		});

		expectSuccess(
			await reinstateHealthEvidence(owner.id, claim.id, a.record_id, {
				reason: "ok",
			})
		);
		expect(await computeHealthStatus(claim.id, testCase.id)).toMatchObject({
			verdict: "pass",
			stale: false,
		});
	});

	it("returns null for a claim with nothing, and a verdict-less non-stale status for a claim a person bound before any record", async () => {
		const { owner, testCase, claim } = await setupClaim();
		expect(await computeHealthStatus(claim.id, testCase.id)).toBeNull();

		expectSuccess(
			await changeBoundCheck(owner.id, claim.id, {
				name: "Chosen Checker",
				reason: "Planned",
			})
		);
		const status = await computeHealthStatus(claim.id, testCase.id);

		expect(status).toMatchObject({
			verdict: null,
			stale: false,
			stale_reason: null,
			record_id: null,
			bound_check: "Chosen Checker",
		});
	});

	it("gives two users with different stored plugin settings the same status", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const other = await createTestUser();
		await createTestPluginState(owner.id, {
			pluginId: "tea.health",
			scopeType: "USER",
			settings: {
				validityWindowSeconds: 1,
				verdictScores: { PASS: 0, FAIL: 1, DEGRADED: 1 },
			},
		});
		await createTestPluginState(other.id, {
			pluginId: "tea.health",
			scopeType: "USER",
			settings: {
				validityWindowSeconds: 999_999_999,
				verdictScores: { PASS: 1, FAIL: 0, DEGRADED: 0 },
			},
		});
		await appendRecord(owner.id, claim.id, "failingSummary", {
			timestamp: isoAgo(30 * MINUTE),
			valid_for: "PT1H",
		});
		// Give the second person view access to the same case.
		const { createTestPermission } = await import("../utils/prisma-factories");
		await createTestPermission(testCase.id, other.id, owner.id, "VIEW");

		const forOwner = expectSuccess(await readHealthStatus(owner.id, claim.id));
		const forOther = expectSuccess(await readHealthStatus(other.id, claim.id));

		expect(forOther).toEqual(forOwner);
		expect(forOwner).toMatchObject({ verdict: "fail", stale: false });
	});
});

describe("status: expiry", () => {
	it("is current at the expiry instant and stale one millisecond later", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const record = await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: isoAgo(2 * MINUTE),
			valid_for: "PT5M",
		});
		const expiry = new Date(record.timestamp).getTime() + 5 * MINUTE;

		const before = await computeHealthStatus(
			claim.id,
			testCase.id,
			new Date(expiry - 1)
		);
		const at = await computeHealthStatus(
			claim.id,
			testCase.id,
			new Date(expiry)
		);
		const after = await computeHealthStatus(
			claim.id,
			testCase.id,
			new Date(expiry + 1)
		);

		expect(before?.stale).toBe(false);
		expect(at?.stale).toBe(false);
		expect(after).toMatchObject({
			stale: true,
			stale_reason: "expired",
			verdict: "pass",
			stale_since: new Date(expiry).toISOString(),
		});
		expect(after?.expires_at).toBe(new Date(expiry).toISOString());
	});

	it("never expires by clock when valid_for is indefinite", async () => {
		const { owner, testCase, claim } = await setupClaim();
		await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: isoAgo(2 * MINUTE),
			valid_for: "indefinite",
		});
		const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * MINUTE);

		const status = await computeHealthStatus(claim.id, testCase.id, farFuture);

		expect(status).toMatchObject({
			stale: false,
			expires_at: null,
			verdict: "pass",
		});
	});

	it("judges expiry on the current record only: an expired older record does not matter", async () => {
		const { owner, testCase, claim } = await setupClaim();
		await appendRecord(owner.id, claim.id, "failingSummary", {
			timestamp: isoAgo(60 * MINUTE),
			valid_for: "PT1M",
		});
		await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: isoAgo(1 * MINUTE),
			valid_for: "PT1H",
		});

		const status = await computeHealthStatus(claim.id, testCase.id);

		expect(status).toMatchObject({ verdict: "pass", stale: false });
	});
});

describe("status: valid_while conditions", () => {
	async function conditionBound() {
		const ctx = await setupClaim();
		const bound = await appendRecord(
			ctx.owner.id,
			ctx.claim.id,
			"singleSubject",
			{
				timestamp: isoAgo(5 * MINUTE),
				valid_for: "indefinite",
			}
		);
		return { ...ctx, bound };
	}

	const writeVariable = (
		ctx: { owner: { id: string } },
		claimId: string,
		session: string,
		twin: string,
		minutesAgo = 1
	) =>
		appendRecord(ctx.owner.id, claimId, "wholeSystem", {
			timestamp: isoAgo(minutesAgo * MINUTE),
			provenance: provenance(session, twin),
		});

	it("stays current while nothing has changed the variable", async () => {
		const { testCase, claim } = await conditionBound();

		expect(await computeHealthStatus(claim.id, testCase.id)).toMatchObject({
			stale: false,
		});
	});

	it("goes stale with reason condition when another claim in the same case and session changes the variable", async () => {
		const ctx = await conditionBound();
		const other = await addClaim(ctx.testCase.id, ctx.owner.id);
		const change = await writeVariable(ctx, other.id, "RUN-A", "2.4");

		const status = await computeHealthStatus(ctx.claim.id, ctx.testCase.id);

		expect(status).toMatchObject({
			stale: true,
			stale_reason: "condition",
			verdict: "pass",
		});
		expect(status?.stale_since).toBe(change.timestamp);
	});

	it("is not affected by a different session in the same case", async () => {
		const ctx = await conditionBound();
		const other = await addClaim(ctx.testCase.id, ctx.owner.id);
		await writeVariable(ctx, other.id, "RUN-B", "2.4");

		expect(
			(await computeHealthStatus(ctx.claim.id, ctx.testCase.id))?.stale
		).toBe(false);
	});

	it("is not affected by another case that reuses the session name", async () => {
		const ctx = await conditionBound();
		const otherCase = await createTestCase(ctx.owner.id);
		const foreign = await addClaim(otherCase.id, ctx.owner.id);
		await writeVariable(ctx, foreign.id, "RUN-A", "9.9");

		expect(
			(await computeHealthStatus(ctx.claim.id, ctx.testCase.id))?.stale
		).toBe(false);
	});

	it("is not affected by a revoked record that carries another value, and is again once it is reinstated", async () => {
		const ctx = await conditionBound();
		const other = await addClaim(ctx.testCase.id, ctx.owner.id);
		const change = await writeVariable(ctx, other.id, "RUN-A", "2.4");
		await revoke(ctx.owner.id, other.id, change.record_id);

		expect(
			(await computeHealthStatus(ctx.claim.id, ctx.testCase.id))?.stale
		).toBe(false);

		expectSuccess(
			await reinstateHealthEvidence(ctx.owner.id, other.id, change.record_id, {
				reason: "ok",
			})
		);
		expect(
			(await computeHealthStatus(ctx.claim.id, ctx.testCase.id))?.stale_reason
		).toBe("condition");
	});

	it("becomes current again when a later record restores the expected value, and ignores a differing record older than the one that carries it", async () => {
		const ctx = await conditionBound();
		const other = await addClaim(ctx.testCase.id, ctx.owner.id);
		await writeVariable(ctx, other.id, "RUN-A", "2.4", 4);
		expect(
			(await computeHealthStatus(ctx.claim.id, ctx.testCase.id))?.stale
		).toBe(true);

		await writeVariable(ctx, other.id, "RUN-A", "2.3", 2);
		expect(
			(await computeHealthStatus(ctx.claim.id, ctx.testCase.id))?.stale
		).toBe(false);

		// A differing value that arrives late but is timestamped before the
		// restoring record does not displace it.
		await writeVariable(ctx, other.id, "RUN-A", "2.5", 3);
		expect(
			(await computeHealthStatus(ctx.claim.id, ctx.testCase.id))?.stale
		).toBe(false);
	});

	it("compares by exact string equality", async () => {
		const ctx = await conditionBound();
		const other = await addClaim(ctx.testCase.id, ctx.owner.id);
		await writeVariable(ctx, other.id, "RUN-A", "2.30");

		expect(
			(await computeHealthStatus(ctx.claim.id, ctx.testCase.id))?.stale_reason
		).toBe("condition");
	});
});
