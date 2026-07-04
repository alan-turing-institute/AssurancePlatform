import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	appendHealthEvidence,
	type HealthEvidenceInput,
} from "@/lib/services/health-evidence-service";
import {
	DEFAULT_VALIDITY_WINDOW_SECONDS,
	recomputeHealthScore,
} from "@/lib/services/health-scoring-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPluginData,
	createTestUser,
} from "../utils/prisma-factories";

const PLUGIN_ID = "tea.health";
const NOT_ENABLED_PATTERN = /is not enabled/;

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	return { owner, testCase, claim };
}

function evidenceInput(
	claimId: string,
	overrides: Partial<HealthEvidenceInput> = {}
): HealthEvidenceInput {
	return {
		claimId,
		metricName: "in-distribution-rate",
		value: 0.98,
		threshold: 0.95,
		verdict: "PASS",
		oddDimensions: [],
		sourceSystem: "darter-pipeline",
		provenance: { check: "ood-monitor/kl-divergence", runId: "run-1" },
		evaluatedAt: new Date().toISOString(),
		...overrides,
	};
}

function pluginDataFor(caseId: string, elementId: string) {
	return prisma.pluginData.findFirst({
		where: { pluginId: PLUGIN_ID, caseId, elementId },
	});
}

describe("recomputeHealthScore — v1 worst-verdict-in-window rule", () => {
	it("scores 1.0 when the only evidence in-window is PASS", async () => {
		const { owner, testCase, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "PASS" })
			)
		);

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.score).toBe(1);
	});

	it("scores 0.5 when the worst in-window verdict is DEGRADED", async () => {
		const { owner, testCase, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "PASS" })
			)
		);
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "DEGRADED" })
			)
		);

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.score).toBe(0.5);
	});

	it("scores 0.0 when ANY in-window verdict is FAIL, even amid many PASSes", async () => {
		const { owner, testCase, claim } = await setup();
		for (let i = 0; i < 4; i++) {
			expectSuccess(
				await appendHealthEvidence(
					owner.id,
					evidenceInput(claim.id, { verdict: "PASS", metricName: `check-${i}` })
				)
			);
		}
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "FAIL", metricName: "check-fail" })
			)
		);

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.score).toBe(0);
	});

	it("scores using FAIL when PASS, DEGRADED, and FAIL are all in-window (kills a DEGRADED/FAIL severity swap)", async () => {
		const { owner, testCase, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "PASS", metricName: "check-pass" })
			)
		);
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, {
					verdict: "DEGRADED",
					metricName: "check-degraded",
				})
			)
		);
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "FAIL", metricName: "check-fail" })
			)
		);

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		// A severity-order swap between DEGRADED and FAIL would pick DEGRADED's
		// score (0.5) here instead of FAIL's (0) — this is the only case among
		// the tests in this file where all three verdicts are simultaneously
		// in-window, so it's the only one that can catch that specific mutant.
		expect(result.score).toBe(0);
	});

	it("scores 0.0 when there is no evidence in the window at all (conservative default)", async () => {
		const { owner, testCase, claim } = await setup();

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.score).toBe(0);
		expect(result.lastEvaluatedAt).toBeNull();
	});

	it("window edge: a FAIL just OUTSIDE the validity window does not drag down a PASS inside it", async () => {
		const { owner, testCase, claim } = await setup();
		const now = Date.now();
		const justOutsideWindow = new Date(
			now - (DEFAULT_VALIDITY_WINDOW_SECONDS + 60) * 1000
		).toISOString();
		const insideWindow = new Date(now - 60 * 1000).toISOString();

		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, {
					verdict: "FAIL",
					evaluatedAt: justOutsideWindow,
				})
			)
		);
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "PASS", evaluatedAt: insideWindow })
			)
		);

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.score).toBe(1);
	});

	it("window edge: a FAIL just INSIDE the validity window does drag down an otherwise-passing claim", async () => {
		const { owner, testCase, claim } = await setup();
		const now = Date.now();
		const justInsideWindow = new Date(
			now - (DEFAULT_VALIDITY_WINDOW_SECONDS - 60) * 1000
		).toISOString();

		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "PASS" })
			)
		);
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, {
					verdict: "FAIL",
					evaluatedAt: justInsideWindow,
				})
			)
		);

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.score).toBe(0);
	});
});

describe("recomputeHealthScore — lastEvaluatedAt semantics", () => {
	it("takes the MAX evaluatedAt across the whole log, not just the most recently appended item", async () => {
		const { owner, testCase, claim } = await setup();
		const earlier = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		const later = new Date().toISOString();

		// Appended in order, but the SECOND append's evaluatedAt is actually
		// earlier in wall-clock time than the first's — a backfilled item.
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { evaluatedAt: later })
			)
		);
		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { evaluatedAt: earlier })
			)
		);

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.lastEvaluatedAt).toBe(later);
	});
});

describe("recomputeHealthScore — writes land ONLY under tea.health (namespace isolation)", () => {
	it("writes the resulting state into element-scoped PluginData under tea.health, touching no other namespace", async () => {
		const { owner, testCase, claim } = await setup();
		await createTestPluginData(testCase.id, {
			pluginId: "tea.other-plugin",
			elementId: claim.id,
			data: { untouched: true },
		});

		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "PASS" })
			)
		);
		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);

		const healthRow = await pluginDataFor(testCase.id, claim.id);
		expect(healthRow?.data).toEqual({
			score: result.score,
			lastEvaluatedAt: result.lastEvaluatedAt,
			validityWindowSeconds: result.validityWindowSeconds,
		});

		const otherRow = await prisma.pluginData.findFirst({
			where: {
				pluginId: "tea.other-plugin",
				caseId: testCase.id,
				elementId: claim.id,
			},
		});
		expect(otherRow?.data).toEqual({ untouched: true });
	});

	it("touches ONLY the directly-evidenced claim — a sibling claim's PluginData is untouched", async () => {
		const { owner, testCase, claim } = await setup();
		const sibling = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "Sibling claim",
		});
		await createTestPluginData(testCase.id, {
			pluginId: PLUGIN_ID,
			elementId: sibling.id,
			data: { score: 1, lastEvaluatedAt: null, validityWindowSeconds: 60 },
		});

		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "FAIL" })
			)
		);
		expectSuccess(await recomputeHealthScore(owner.id, claim.id, testCase.id));

		const siblingRow = await pluginDataFor(testCase.id, sibling.id);
		expect(siblingRow?.data).toEqual({
			score: 1,
			lastEvaluatedAt: null,
			validityWindowSeconds: 60,
		});
	});
});

describe("recomputeHealthScore — settings override", () => {
	it("honours a per-user validityWindowSeconds override from PluginState.settings", async () => {
		const { owner, testCase, claim } = await setup();
		// Enable (default is already enabled, but this also carries settings).
		expectSuccess(
			await setPluginEnabledForUser(PLUGIN_ID, owner.id, {
				enabled: true,
				settings: { validityWindowSeconds: 30 },
			})
		);
		const outsideShortWindow = new Date(Date.now() - 60 * 1000).toISOString();

		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, {
					verdict: "PASS",
					evaluatedAt: outsideShortWindow,
				})
			)
		);

		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.validityWindowSeconds).toBe(30);
		expect(result.score).toBe(0); // the only evidence is now outside the (shortened) window
	});

	it("falls back to defaults when settings are malformed, rather than failing the recompute", async () => {
		const { owner, testCase, claim } = await setup();
		expectSuccess(
			await setPluginEnabledForUser(PLUGIN_ID, owner.id, {
				enabled: true,
				settings: { validityWindowSeconds: "not-a-number" },
			})
		);

		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "PASS" })
			)
		);
		const result = expectSuccess(
			await recomputeHealthScore(owner.id, claim.id, testCase.id)
		);
		expect(result.validityWindowSeconds).toBe(DEFAULT_VALIDITY_WINDOW_SECONDS);
		expect(result.score).toBe(1);
	});
});

describe("recomputeHealthScore — respects plugin enablement via writePluginData", () => {
	it("refuses to write when the plugin is switched off for the acting user", async () => {
		const { owner, testCase, claim } = await setup();
		await setPluginEnabledForUser(PLUGIN_ID, owner.id, { enabled: false });

		expectError(
			await recomputeHealthScore(owner.id, claim.id, testCase.id),
			NOT_ENABLED_PATTERN
		);
	});
});
