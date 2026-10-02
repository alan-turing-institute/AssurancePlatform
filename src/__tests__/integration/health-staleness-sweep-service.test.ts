import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { healthEvidenceRecordSchema } from "@/lib/schemas/health-evidence";
import {
	appendHealthEvidence,
	changeBoundCheck,
	revokeHealthEvidence,
} from "@/lib/services/health-evidence-service";
import { sweepHealthStaleness } from "@/lib/services/health-staleness-sweep-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { buildHealthRecords, withOverrides } from "../fixtures/health-records";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return {
		...actual,
		emitSSEEvent: vi.fn(),
	};
});

const CRON_SECRET = "test-cron-secret";
const ONE_OF_TWO_CASES_FAILED_PATTERN =
	/Failed to sweep staleness for 1 of 2 case/;
const MINUTE = 60_000;

beforeEach(() => {
	vi.mocked(emitSSEEvent).mockReset();
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

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

/** Appends a fixture record whose reading was `ageMinutes` ago and is valid for `validFor`. */
async function append(
	ownerId: string,
	claimId: string,
	ageMinutes: number,
	validFor: string
) {
	const record = healthEvidenceRecordSchema.parse(
		withOverrides(buildHealthRecords(claimId).populationPass, {
			timestamp: new Date(Date.now() - ageMinutes * MINUTE).toISOString(),
			valid_for: validFor,
		})
	);
	expectSuccess(await appendHealthEvidence(ownerId, claimId, record));
	return record;
}

describe("sweepHealthStaleness — auth", () => {
	it("refuses with no CRON_SECRET configured", async () => {
		vi.unstubAllEnvs();
		expectError(
			await sweepHealthStaleness("anything"),
			"Server configuration error"
		);
	});

	it("refuses a missing token", async () => {
		expectError(await sweepHealthStaleness(null), "Unauthorised");
	});

	it("refuses a wrong token", async () => {
		expectError(await sweepHealthStaleness("wrong-secret"), "Unauthorised");
	});

	it("accepts the correct token", async () => {
		expectSuccess(await sweepHealthStaleness(CRON_SECRET));
	});
});

describe("sweepHealthStaleness — detecting newly-stale claims", () => {
	it("notifies a claim whose current record has expired", async () => {
		const { owner, testCase, claim } = await setup();
		await append(owner.id, claim.id, 10, "PT1M");

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result).toEqual({ casesNotified: 1, staleClaimsNotified: 1 });
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			expect.objectContaining({
				claimId: claim.id,
				stale: true,
				status: expect.objectContaining({
					stale: true,
					stale_reason: "expired",
				}),
			})
		);
	});

	it("does NOT notify a claim whose record is still valid or never expires", async () => {
		const first = await setup();
		await append(first.owner.id, first.claim.id, 1, "PT1H");
		const second = await setup();
		await append(second.owner.id, second.claim.id, 600, "indefinite");

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result.staleClaimsNotified).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("notifies a claim whose records have all been revoked", async () => {
		const { owner, claim } = await setup();
		const record = await append(owner.id, claim.id, 1, "PT1H");
		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, record.record_id, {
				cause: "evidence-defect",
				reason: "Bad run",
			})
		);

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result.staleClaimsNotified).toBe(1);
	});

	it("does not treat a claim bound to a check but with no record as stale", async () => {
		const { owner, claim } = await setup();
		expectSuccess(
			await changeBoundCheck(owner.id, claim.id, {
				name: "Sensor Range Checker",
				reason: "Bind ahead of the first record",
			})
		);

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result.staleClaimsNotified).toBe(0);
	});

	it("ignores a claim that has never had a record", async () => {
		await setup();

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result.staleClaimsNotified).toBe(0);
	});
});

describe("sweepHealthStaleness — notifies once", () => {
	it("a second immediate run notifies nothing new for an already-notified claim", async () => {
		const { owner, claim } = await setup();
		await append(owner.id, claim.id, 10, "PT1M");
		expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		vi.mocked(emitSSEEvent).mockClear();

		const second = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(second.staleClaimsNotified).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("keeps the marker on the claim's state row", async () => {
		const { owner, claim } = await setup();
		await append(owner.id, claim.id, 10, "PT1M");
		expectSuccess(await sweepHealthStaleness(CRON_SECRET));

		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.staleNotifiedAt).not.toBeNull();
	});

	it("notifies again when the claim has been fresh in between", async () => {
		const { owner, claim } = await setup();
		await append(owner.id, claim.id, 10, "PT1M");
		expectSuccess(await sweepHealthStaleness(CRON_SECRET));

		// A newer, valid record makes the claim fresh; the sweep clears the marker.
		const fresh = await append(owner.id, claim.id, 0, "PT1H");
		const cleared = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(cleared.staleClaimsNotified).toBe(0);
		expect(
			(
				await prisma.pluginHealthClaimState.findUniqueOrThrow({
					where: { claimId: claim.id },
				})
			).staleNotifiedAt
		).toBeNull();

		// Revoking it leaves the expired record current again: stale a second time.
		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, fresh.record_id, {
				cause: "evidence-defect",
				reason: "Bad run",
			})
		);
		vi.mocked(emitSSEEvent).mockClear();
		const again = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(again.staleClaimsNotified).toBe(1);
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
	});
});

describe("sweepHealthStaleness — per-case error isolation", () => {
	it("isolates one case's failure so the other case is still processed and notified", async () => {
		const failing = await setup();
		const healthy = await setup();
		await append(failing.owner.id, failing.claim.id, 10, "PT1M");
		await append(healthy.owner.id, healthy.claim.id, 10, "PT1M");

		vi.mocked(emitSSEEvent).mockImplementation((_type, caseId) => {
			if (caseId === failing.testCase.id) {
				throw new Error("simulated broadcast failure");
			}
		});

		expectError(
			await sweepHealthStaleness(CRON_SECRET),
			ONE_OF_TWO_CASES_FAILED_PATTERN
		);

		const healthyState = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: healthy.claim.id },
		});
		expect(healthyState.staleNotifiedAt).not.toBeNull();
		// The failed claim is not marked, so the next run announces it again.
		const failedState = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: failing.claim.id },
		});
		expect(failedState.staleNotifiedAt).toBeNull();
	});
});
