import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { sweepHealthStaleness } from "@/lib/services/health-staleness-sweep-service";
import { upsertCaseLevelPluginData } from "@/lib/services/plugin-data-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPluginData,
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

// Wrapped (not stubbed): defaults to the REAL implementation for every case
// except the one test below that overrides it per-caseId to simulate a
// marker-persist failure for a single case.
vi.mock("@/lib/services/plugin-data-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/plugin-data-service")>();
	return {
		...actual,
		upsertCaseLevelPluginData: vi.fn(actual.upsertCaseLevelPluginData),
	};
});

const PLUGIN_ID = "tea.health";
const CRON_SECRET = "test-cron-secret";
const ONE_OF_TWO_CASES_FAILED_PATTERN =
	/Failed to sweep staleness for 1 of 2 case/;

beforeEach(() => {
	vi.mocked(emitSSEEvent).mockClear();
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

function staleHealthData(
	secondsPastWindow: number,
	validityWindowSeconds = 60
) {
	return {
		score: 1,
		lastEvaluatedAt: new Date(
			Date.now() - (validityWindowSeconds + secondsPastWindow) * 1000
		).toISOString(),
		validityWindowSeconds,
	};
}

function freshHealthData(validityWindowSeconds = 60) {
	return {
		score: 1,
		lastEvaluatedAt: new Date().toISOString(),
		validityWindowSeconds,
	};
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
	it("notifies a claim that has just crossed into staleness", async () => {
		const { testCase, claim } = await setup();
		await createTestPluginData(testCase.id, {
			pluginId: PLUGIN_ID,
			elementId: claim.id,
			data: staleHealthData(60), // well past the window
		});

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result.staleClaimsNotified).toBe(1);
		expect(result.casesNotified).toBe(1);
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			expect.objectContaining({ claimId: claim.id, stale: true })
		);
	});

	it("does NOT notify a claim still inside its validity window", async () => {
		const { testCase, claim } = await setup();
		await createTestPluginData(testCase.id, {
			pluginId: PLUGIN_ID,
			elementId: claim.id,
			data: freshHealthData(),
		});

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result.staleClaimsNotified).toBe(0);
		expect(result.casesNotified).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("never touches a different plugin's PluginData row for the same element", async () => {
		const { testCase, claim } = await setup();
		await createTestPluginData(testCase.id, {
			pluginId: "tea.other-plugin",
			elementId: claim.id,
			data: { untouched: true },
		});

		expectSuccess(await sweepHealthStaleness(CRON_SECRET));

		const otherRow = await prisma.pluginData.findFirst({
			where: {
				pluginId: "tea.other-plugin",
				caseId: testCase.id,
				elementId: claim.id,
			},
		});
		expect(otherRow?.data).toEqual({ untouched: true });
	});
});

describe("sweepHealthStaleness — malformed rows (safeParse-skip contract)", () => {
	it("skips a row missing validityWindowSeconds without crashing, notifying nothing", async () => {
		const { testCase, claim } = await setup();
		await createTestPluginData(testCase.id, {
			pluginId: PLUGIN_ID,
			elementId: claim.id,
			data: {
				score: 1,
				lastEvaluatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
				// validityWindowSeconds deliberately omitted — fails healthStateSchema.
			},
		});

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result.staleClaimsNotified).toBe(0);
		expect(result.casesNotified).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("skips a row with a non-numeric score without crashing, notifying nothing", async () => {
		const { testCase, claim } = await setup();
		await createTestPluginData(testCase.id, {
			pluginId: PLUGIN_ID,
			elementId: claim.id,
			data: {
				score: "not-a-number",
				lastEvaluatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
				validityWindowSeconds: 60,
			},
		});

		const result = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(result.staleClaimsNotified).toBe(0);
		expect(result.casesNotified).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});
});

describe("sweepHealthStaleness — idempotency", () => {
	it("a second immediate run notifies nothing new for an already-notified claim", async () => {
		const { testCase, claim } = await setup();
		await createTestPluginData(testCase.id, {
			pluginId: PLUGIN_ID,
			elementId: claim.id,
			data: staleHealthData(60),
		});

		const first = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(first.staleClaimsNotified).toBe(1);
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);

		vi.mocked(emitSSEEvent).mockClear();

		const second = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(second.staleClaimsNotified).toBe(0);
		expect(second.casesNotified).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("persists the notified marker as a case-level PluginData row under tea.health", async () => {
		const { testCase, claim } = await setup();
		await createTestPluginData(testCase.id, {
			pluginId: PLUGIN_ID,
			elementId: claim.id,
			data: staleHealthData(60),
		});

		expectSuccess(await sweepHealthStaleness(CRON_SECRET));

		const markerRow = await prisma.pluginData.findFirst({
			where: { pluginId: PLUGIN_ID, caseId: testCase.id, elementId: null },
		});
		expect(markerRow).not.toBeNull();
		expect(markerRow?.data).toMatchObject({
			notifiedStaleClaimIds: { [claim.id]: expect.any(String) },
		});
	});

	it("re-notifies a claim that went fresh again (new evidence) and later goes stale a second time", async () => {
		const { testCase, claim } = await setup();
		const dataRow = await createTestPluginData(testCase.id, {
			pluginId: PLUGIN_ID,
			elementId: claim.id,
			data: staleHealthData(60),
		});

		expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		vi.mocked(emitSSEEvent).mockClear();

		// New evidence arrives — health is fresh again.
		await prisma.pluginData.update({
			where: { id: dataRow.id },
			data: { data: freshHealthData() },
		});
		expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(emitSSEEvent).not.toHaveBeenCalled();

		const markerAfterFresh = await prisma.pluginData.findFirst({
			where: { pluginId: PLUGIN_ID, caseId: testCase.id, elementId: null },
		});
		expect(markerAfterFresh?.data).toMatchObject({
			notifiedStaleClaimIds: {},
		});

		// Goes stale again.
		await prisma.pluginData.update({
			where: { id: dataRow.id },
			data: { data: staleHealthData(60) },
		});
		const third = expectSuccess(await sweepHealthStaleness(CRON_SECRET));
		expect(third.staleClaimsNotified).toBe(1);
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
	});
});

describe("sweepHealthStaleness — per-case error isolation", () => {
	it("isolates one case's marker-persist failure so the other case is still processed and notified", async () => {
		const { testCase: caseA, claim: claimA } = await setup();
		const { testCase: caseB, claim: claimB } = await setup();
		await createTestPluginData(caseA.id, {
			pluginId: PLUGIN_ID,
			elementId: claimA.id,
			data: staleHealthData(60),
		});
		await createTestPluginData(caseB.id, {
			pluginId: PLUGIN_ID,
			elementId: claimB.id,
			data: staleHealthData(60),
		});

		const { upsertCaseLevelPluginData: actualUpsert } = await vi.importActual<
			typeof import("@/lib/services/plugin-data-service")
		>("@/lib/services/plugin-data-service");

		vi.mocked(upsertCaseLevelPluginData).mockImplementation(
			(pluginId, caseId, data) => {
				if (caseId === caseA.id) {
					return Promise.reject(new Error("simulated marker-persist failure"));
				}
				return actualUpsert(pluginId, caseId, data);
			}
		);

		try {
			const result = await sweepHealthStaleness(CRON_SECRET);
			expectError(result, ONE_OF_TWO_CASES_FAILED_PATTERN);

			// Case B was still processed and notified, despite case A's failure —
			// the loop does not abort partway through.
			expect(emitSSEEvent).toHaveBeenCalledWith(
				"tea.health/state-changed",
				caseB.id,
				expect.objectContaining({ claimId: claimB.id, stale: true })
			);

			const markerB = await prisma.pluginData.findFirst({
				where: { pluginId: PLUGIN_ID, caseId: caseB.id, elementId: null },
			});
			expect(markerB?.data).toMatchObject({
				notifiedStaleClaimIds: { [claimB.id]: expect.any(String) },
			});

			// Case A's marker never persisted (the mocked write rejected), so a
			// future scheduled run naturally retries it — a failed case is
			// never silently dropped.
			const markerA = await prisma.pluginData.findFirst({
				where: { pluginId: PLUGIN_ID, caseId: caseA.id, elementId: null },
			});
			expect(markerA).toBeNull();
		} finally {
			// Restore the mock to the real implementation for every other test.
			vi.mocked(upsertCaseLevelPluginData).mockImplementation(actualUpsert);
		}
	});
});
