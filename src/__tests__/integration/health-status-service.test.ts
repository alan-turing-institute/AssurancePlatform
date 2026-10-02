import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { healthEvidenceRecordSchema } from "@/lib/schemas/health-evidence";
import {
	appendHealthEvidence,
	reinstateHealthEvidence,
	revokeHealthEvidence,
} from "@/lib/services/health-evidence-service";
import {
	computeHealthStatus,
	readHealthStatus,
	refreshHealthSummary,
} from "@/lib/services/health-status-service";
import {
	buildHealthRecords,
	type HealthRecordName,
	withOverrides,
} from "../fixtures/health-records";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

const PLUGIN_ID = "tea.health";
const NOT_FOUND_PATTERN = /Claim not found/;
const NOT_ENABLED_PATTERN = /is not enabled/;
const MINUTE = 60_000;

afterEach(() => {
	vi.unstubAllEnvs();
});

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	return { owner, testCase, claim };
}

async function addClaim(caseId: string, ownerId: string) {
	return await createTestElement(caseId, ownerId, {
		elementType: "PROPERTY_CLAIM",
	});
}

/** Appends a fixture record, with `overrides`, and returns the validated record. */
async function append(
	ownerId: string,
	claimId: string,
	name: HealthRecordName,
	overrides: Record<string, unknown> = {}
) {
	const record = healthEvidenceRecordSchema.parse(
		withOverrides(buildHealthRecords(claimId)[name], overrides)
	);
	expectSuccess(await appendHealthEvidence(ownerId, claimId, record));
	return record;
}

const minutesAgo = (minutes: number) =>
	new Date(Date.now() - minutes * MINUTE).toISOString();

describe("computeHealthStatus — current record", () => {
	it("is null for a claim that has never had a record accepted", async () => {
		const { testCase, claim } = await setup();
		expect(await computeHealthStatus(claim.id, testCase.id)).toBeNull();
	});

	it("shows the verdict, record id, timestamp, expiry and bound check of the latest record", async () => {
		const { owner, testCase, claim } = await setup();
		const record = await append(owner.id, claim.id, "failingSummary");

		const status = await computeHealthStatus(claim.id, testCase.id);
		expect(status).toEqual({
			verdict: "fail",
			stale: false,
			stale_reason: null,
			stale_since: null,
			expires_at: new Date(
				new Date(record.timestamp).getTime() + 60 * MINUTE
			).toISOString(),
			record_id: record.record_id,
			timestamp: record.timestamp,
			bound_check: "Sensor Range Checker",
			rejected_since_last_accept: 0,
		});
	});

	it("follows the latest timestamp, not the latest arrival", async () => {
		const { owner, testCase, claim } = await setup();
		await append(owner.id, claim.id, "populationPass", {
			timestamp: minutesAgo(1),
		});
		// Arrives later but is an older reading: must not displace the newer one.
		await append(owner.id, claim.id, "failingSummary", {
			timestamp: minutesAgo(30),
		});

		const status = await computeHealthStatus(claim.id, testCase.id);
		expect(status?.verdict).toBe("pass");
	});

	it.each([
		["pass", "populationPass"],
		["marginal", "marginalSummary"],
		["fail", "failingSummary"],
		["indeterminate", "indeterminate"],
	] as const)("reports the %s verdict", async (verdict, name) => {
		const { owner, testCase, claim } = await setup();
		await append(owner.id, claim.id, name);

		expect((await computeHealthStatus(claim.id, testCase.id))?.verdict).toBe(
			verdict
		);
	});
});

describe("computeHealthStatus — staleness", () => {
	it("is stale once timestamp plus valid_for has passed, and not before", async () => {
		const { owner, testCase, claim } = await setup();
		const record = await append(owner.id, claim.id, "populationPass", {
			valid_for: "PT5M",
		});
		const timestamp = new Date(record.timestamp).getTime();

		const before = await computeHealthStatus(
			claim.id,
			testCase.id,
			new Date(timestamp + 5 * MINUTE - 1000)
		);
		expect(before?.stale).toBe(false);

		const after = await computeHealthStatus(
			claim.id,
			testCase.id,
			new Date(timestamp + 5 * MINUTE + 1000)
		);
		expect(after).toMatchObject({
			verdict: "pass",
			stale: true,
			stale_reason: "expired",
			stale_since: new Date(timestamp + 5 * MINUTE).toISOString(),
		});
	});

	it("never expires by clock when valid_for is indefinite", async () => {
		const { owner, testCase, claim } = await setup();
		await append(owner.id, claim.id, "populationPass", {
			valid_for: "indefinite",
		});

		const status = await computeHealthStatus(
			claim.id,
			testCase.id,
			new Date(Date.now() + 3650 * 24 * 60 * MINUTE)
		);
		expect(status).toMatchObject({
			stale: false,
			expires_at: null,
			verdict: "pass",
		});
	});

	describe("valid_while", () => {
		/** A record bound to twin_version 2.3, and a second claim in the same case. */
		async function setupConditional() {
			const context = await setup();
			await append(context.owner.id, context.claim.id, "singleSubject");
			const other = await addClaim(context.testCase.id, context.owner.id);
			return { ...context, other };
		}

		it("is fresh while the variable still has the expected value", async () => {
			const { testCase, claim } = await setupConditional();
			expect((await computeHealthStatus(claim.id, testCase.id))?.stale).toBe(
				false
			);
		});

		it("goes stale when a newer record in the same case and session carries a different value", async () => {
			const { owner, testCase, claim, other } = await setupConditional();
			const changer = await append(owner.id, other.id, "populationPass", {
				timestamp: minutesAgo(0),
				provenance: {
					...(buildHealthRecords(other.id).populationPass.provenance as object),
					twin_version: "2.4",
				},
			});

			const status = await computeHealthStatus(claim.id, testCase.id);
			expect(status).toMatchObject({
				verdict: "pass",
				stale: true,
				stale_reason: "condition",
				stale_since: changer.timestamp,
			});
		});

		it("does not go stale for a record in another session", async () => {
			const { owner, testCase, claim, other } = await setupConditional();
			await append(owner.id, other.id, "populationPass", {
				timestamp: minutesAgo(0),
				provenance: {
					...(buildHealthRecords(other.id).populationPass.provenance as object),
					session: "RUN-B",
					twin_version: "2.4",
				},
			});

			expect((await computeHealthStatus(claim.id, testCase.id))?.stale).toBe(
				false
			);
		});

		it("does not go stale for the same session name used in another case", async () => {
			const { claim, testCase } = await setupConditional();
			const elsewhere = await setup();
			await append(elsewhere.owner.id, elsewhere.claim.id, "populationPass", {
				timestamp: minutesAgo(0),
				provenance: {
					...(buildHealthRecords(elsewhere.claim.id).populationPass
						.provenance as object),
					twin_version: "2.4",
				},
			});

			expect((await computeHealthStatus(claim.id, testCase.id))?.stale).toBe(
				false
			);
		});

		it("ignores a differing value carried by a revoked record", async () => {
			const { owner, testCase, claim, other } = await setupConditional();
			const changer = await append(owner.id, other.id, "populationPass", {
				timestamp: minutesAgo(0),
				provenance: {
					...(buildHealthRecords(other.id).populationPass.provenance as object),
					twin_version: "2.4",
				},
			});
			expectSuccess(
				await revokeHealthEvidence(owner.id, other.id, changer.record_id, {
					cause: "evidence-defect",
					reason: "Wrong twin version",
				})
			);

			expect((await computeHealthStatus(claim.id, testCase.id))?.stale).toBe(
				false
			);
		});
	});
});

describe("computeHealthStatus — revocation", () => {
	it("falls back to the previous record when the current one is revoked, and back again on reinstatement", async () => {
		const { owner, testCase, claim } = await setup();
		await append(owner.id, claim.id, "populationPass", {
			timestamp: minutesAgo(10),
		});
		const latest = await append(owner.id, claim.id, "failingSummary", {
			timestamp: minutesAgo(1),
		});
		expect((await computeHealthStatus(claim.id, testCase.id))?.verdict).toBe(
			"fail"
		);

		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, latest.record_id, {
				cause: "evidence-defect",
				reason: "Bad run",
			})
		);
		expect((await computeHealthStatus(claim.id, testCase.id))?.verdict).toBe(
			"pass"
		);

		expectSuccess(
			await reinstateHealthEvidence(owner.id, claim.id, latest.record_id, {
				reason: "Run was fine",
			})
		);
		expect((await computeHealthStatus(claim.id, testCase.id))?.verdict).toBe(
			"fail"
		);
	});

	it("is stale with no verdict when every record is revoked", async () => {
		const { owner, testCase, claim } = await setup();
		const record = await append(owner.id, claim.id, "populationPass");
		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, record.record_id, {
				cause: "binding-defect",
				reason: "Wrong claim",
			})
		);

		const status = await computeHealthStatus(claim.id, testCase.id);
		expect(status).toMatchObject({
			verdict: null,
			stale: true,
			stale_reason: "all-revoked",
			record_id: null,
			expires_at: null,
			bound_check: "Sensor Range Checker",
		});
		expect(status?.stale_since).not.toBeNull();
	});
});

describe("computeHealthStatus — the same for everyone", () => {
	it("gives two users with different stored plugin settings the same status", async () => {
		const { owner, testCase, claim } = await setup();
		const collaborator = await createTestUser();
		await createTestPermission(testCase.id, collaborator.id, owner.id, "VIEW");
		await createTestPluginState(owner.id, {
			pluginId: PLUGIN_ID,
			enabled: true,
			settings: { validityWindowSeconds: 1, verdictScores: { PASS: 0 } },
		});
		await createTestPluginState(collaborator.id, {
			pluginId: PLUGIN_ID,
			enabled: true,
			settings: { validityWindowSeconds: 999_999 },
		});
		await append(owner.id, claim.id, "populationPass", {
			timestamp: minutesAgo(30),
		});

		const forOwner = expectSuccess(await readHealthStatus(owner.id, claim.id));
		const forCollaborator = expectSuccess(
			await readHealthStatus(collaborator.id, claim.id)
		);
		expect(forOwner).toEqual(forCollaborator);
		expect(forOwner?.stale).toBe(false);
	});
});

describe("readHealthStatus — access", () => {
	it("returns null data (not an error) for a claim with no record", async () => {
		const { owner, claim } = await setup();
		const result = await readHealthStatus(owner.id, claim.id);
		expect(result).toEqual({ data: null });
	});

	it("gives the same generic message for a missing claim, a non-claim, a soft-deleted claim and no access", async () => {
		const { owner, testCase, claim } = await setup();
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const outsider = await createTestUser();
		const deleted = await addClaim(testCase.id, owner.id);
		await prisma.assuranceElement.update({
			where: { id: deleted.id },
			data: { deletedAt: new Date() },
		});

		const attempts: [string, string][] = [
			[owner.id, "00000000-0000-0000-0000-000000000000"],
			[owner.id, goal.id],
			[owner.id, deleted.id],
			[outsider.id, claim.id],
		];
		for (const [userId, id] of attempts) {
			expectError(await readHealthStatus(userId, id), NOT_FOUND_PATTERN);
		}
	});

	it("refuses every id identically when the plugin is switched off", async () => {
		const { owner, claim } = await setup();
		vi.stubEnv("TEA_PLUGINS_DISABLED", PLUGIN_ID);

		expectError(
			await readHealthStatus(owner.id, claim.id),
			NOT_ENABLED_PATTERN
		);
		expectError(
			await readHealthStatus(owner.id, "00000000-0000-0000-0000-000000000000"),
			NOT_ENABLED_PATTERN
		);
	});
});

describe("refreshHealthSummary", () => {
	it("writes only the small summary to the claim's tea.health PluginData row", async () => {
		const { owner, testCase, claim } = await setup();
		const record = await append(owner.id, claim.id, "populationPass");

		const status = await refreshHealthSummary(owner.id, claim.id, testCase.id);

		const row = await prisma.pluginData.findFirstOrThrow({
			where: { pluginId: PLUGIN_ID, elementId: claim.id },
		});
		expect(row.data).toEqual({
			verdict: "pass",
			record_id: record.record_id,
			timestamp: record.timestamp,
			expires_at: status?.expires_at,
			bound_check: "Sensor Range Checker",
		});
	});
});
