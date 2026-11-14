import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { ITEM_CHECK_NAME } from "../fixtures/health-checks";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	criteriaWorld,
	itemSettingsWith,
	postResult,
	save,
} from "../utils/health-criteria-adversarial-kit";
import {
	callCriteriaPut,
	callRetirement,
	itemSettings,
	saveBody,
} from "../utils/health-criteria-kit";
import { createTestElement } from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

beforeEach(async () => {
	await mockNoAuth();
});

const ROUNDS = 6;

async function setup() {
	const world = await criteriaWorld();
	await mockAuth(world.owner.id, world.owner.username, world.owner.email);
	return world;
}

function newClaim(caseId: string, ownerId: string) {
	return createTestElement(caseId, ownerId, { elementType: "PROPERTY_CLAIM" });
}

const echoOfFirstSave = {
	check: {
		name: ITEM_CHECK_NAME,
		version: "0.3",
		scope: "item",
		params: { camera_line: "ALL" },
	},
	rule: { kind: "identity", version: "r1" },
	reduction: {
		kind: "mean",
		params: { avail_floor: 0.8 },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.8, marginal_values: 0.5 },
			version: "d1",
		},
		version: "d1",
	},
	aggregation: {
		kind: "proportion",
		params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
		version: "a1",
	},
	window: "PT1M",
	valid_for: "PT5M",
};

async function historyRevisions(claimId: string) {
	const rows = await prisma.pluginHealthCriteriaRevision.findMany({
		where: { claimId },
		orderBy: { revision: "asc" },
	});
	return rows.map((row) => row.revision);
}

describe("an acceptance racing a claim's first result", () => {
	it("leaves one state row, one binding history and a result compared with the old state or the new, never a mixture", async () => {
		const { owner, testCase, integration, secret } = await setup();
		for (let round = 0; round < ROUNDS; round++) {
			const claim = await newClaim(testCase.id, owner.id);
			const [accepted, posted] = await Promise.all([
				callCriteriaPut(
					claim.id,
					saveBody(integration.id, itemSettings(), true)
				),
				postResult(claim.id, secret, echoOfFirstSave),
			]);
			expect(accepted.status).toBe(200);
			expect(posted.status).toBe(201);
			expect(
				await prisma.pluginHealthClaimState.count({
					where: { claimId: claim.id },
				})
			).toBe(1);
			expect(
				await prisma.pluginHealthBindingChange.count({
					where: { claimId: claim.id },
				})
			).toBe(1);
			const echo = await prisma.pluginHealthEvidence.findFirstOrThrow({
				where: { recordId: posted.recordId },
			});
			if (echo.echoState === "MATCH") {
				expect(echo.criteriaRevision).toBe(1);
				expect(echo.echoDifferences).toBeNull();
			} else {
				expect(echo.echoState).toBe("UNDECLARED");
				expect(echo.criteriaRevision).toBeNull();
				expect(echo.echoDifferences).toBeNull();
			}
			expect(await historyRevisions(claim.id)).toEqual([1]);
		}
	});

	it("when the result names another check, either re-binds after it or refuses it, never errors", async () => {
		const { owner, testCase, integration, secret } = await setup();
		for (let round = 0; round < ROUNDS; round++) {
			const claim = await newClaim(testCase.id, owner.id);
			const [accepted, posted] = await Promise.all([
				callCriteriaPut(
					claim.id,
					saveBody(integration.id, itemSettings(), true)
				),
				postResult(claim.id, secret, echoOfFirstSave, {
					check: { name: "Elsewhere Checker", version: "1", scope: "item" },
				}),
			]);
			expect(accepted.status).toBe(200);
			expect([201, 422]).toContain(posted.status);
			const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
				where: { claimId: claim.id },
			});
			expect(state.boundCheckName).toBe(ITEM_CHECK_NAME);
			const changes = await prisma.pluginHealthBindingChange.findMany({
				where: { claimId: claim.id },
				orderBy: { createdAt: "asc" },
			});
			if (posted.status === 201) {
				expect(changes.map((c) => c.source)).toEqual([
					"FIRST_RECORD",
					"DECLARATION",
				]);
			} else {
				expect(changes.map((c) => c.source)).toEqual(["DECLARATION"]);
			}
		}
	});

	it("compares a result racing a settings edit with exactly one revision, and the comparison is true for that revision", async () => {
		const { owner, testCase, integration, secret } = await setup();
		for (let round = 0; round < ROUNDS; round++) {
			const claim = await newClaim(testCase.id, owner.id);
			await save(claim.id, integration.id);
			const [edited, posted] = await Promise.all([
				callCriteriaPut(
					claim.id,
					saveBody(
						integration.id,
						itemSettingsWith((s) => {
							s.rule = { kind: "identity", params: { n: round } };
						}),
						true
					)
				),
				postResult(claim.id, secret, echoOfFirstSave),
			]);
			expect(edited.status).toBe(200);
			expect(posted.status).toBe(201);
			const echo = await prisma.pluginHealthEvidence.findFirstOrThrow({
				where: { recordId: posted.recordId },
			});
			if (echo.criteriaRevision === 1) {
				expect(echo.echoState).toBe("MATCH");
			} else {
				expect(echo.criteriaRevision).toBe(2);
				expect(echo.echoState).toBe("MISMATCH");
				expect(echo.echoDifferences).toEqual([
					{ field: "rule.version", declared: "r2", used: "r1" },
				]);
			}
		}
	});
});

describe("two saves racing", () => {
	it("two first saves leave contiguous unique revisions, one row, and no error", async () => {
		const { owner, testCase, integration } = await setup();
		for (let round = 0; round < ROUNDS; round++) {
			const claim = await newClaim(testCase.id, owner.id);
			const [a, b] = await Promise.all([
				callCriteriaPut(
					claim.id,
					saveBody(integration.id, itemSettings(), true)
				),
				callCriteriaPut(
					claim.id,
					saveBody(
						integration.id,
						itemSettingsWith((s) => {
							s.rule = { kind: "identity", params: { n: 1 } };
						}),
						true
					)
				),
			]);
			expect([a.status, b.status]).toEqual([200, 200]);
			expect(await historyRevisions(claim.id)).toEqual([1, 2]);
			const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
				where: { claimId: claim.id },
			});
			expect(row.revision).toBe(2);
			expect(row.ruleVersion).toBe(2);
			const last = await prisma.pluginHealthCriteriaRevision.findFirstOrThrow({
				where: { claimId: claim.id, revision: 2 },
			});
			expect(
				(last.declaration as { rule: { version: string } }).rule.version
			).toBe("r2");
			expect(
				await prisma.pluginHealthBindingChange.count({
					where: { claimId: claim.id },
				})
			).toBe(1);
		}
	});

	it("many simultaneous saves each get their own revision and counters never repeat for different content", async () => {
		const { owner, testCase, integration } = await setup();
		const claim = await newClaim(testCase.id, owner.id);
		const count = 8;
		const responses = await Promise.all(
			Array.from({ length: count }, (_, i) =>
				callCriteriaPut(
					claim.id,
					saveBody(
						integration.id,
						itemSettingsWith((s) => {
							s.rule = { kind: "identity", params: { n: i } };
						}),
						true
					)
				)
			)
		);
		expect(responses.map((r) => r.status)).toEqual(
			Array.from({ length: count }, () => 200)
		);
		expect(await historyRevisions(claim.id)).toEqual(
			Array.from({ length: count }, (_, i) => i + 1)
		);
		const rows = await prisma.pluginHealthCriteriaRevision.findMany({
			where: { claimId: claim.id },
			orderBy: { revision: "asc" },
		});
		const labels = rows.map(
			(row) => (row.declaration as { rule: { version: string } }).rule.version
		);
		expect(labels).toEqual(
			Array.from({ length: count }, (_, i) => `r${i + 1}`)
		);
		const contents = rows.map((row) =>
			JSON.stringify((row.declaration as { rule: unknown }).rule)
		);
		expect(new Set(contents).size).toBe(count);
	});

	it("a suggestion and an acceptance racing leave a consistent state and history", async () => {
		const { owner, testCase, integration } = await setup();
		for (let round = 0; round < ROUNDS; round++) {
			const claim = await newClaim(testCase.id, owner.id);
			const [suggested, accepted] = await Promise.all([
				callCriteriaPut(
					claim.id,
					saveBody(integration.id, itemSettings(), false)
				),
				callCriteriaPut(
					claim.id,
					saveBody(integration.id, itemSettings(), true)
				),
			]);
			expect(accepted.status).toBe(200);
			expect([200, 409]).toContain(suggested.status);
			const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
				where: { claimId: claim.id },
			});
			expect(row.state).toBe("ACCEPTED");
			expect(await historyRevisions(claim.id)).toEqual(
				suggested.status === 200 ? [1, 2] : [1]
			);
			expect(
				await prisma.pluginHealthClaimState.count({
					where: { claimId: claim.id },
				})
			).toBe(1);
		}
	});
});

describe("a save racing a retirement", () => {
	it("leaves contiguous revisions and a state that matches the newest history row", async () => {
		const { owner, testCase, integration } = await setup();
		for (let round = 0; round < ROUNDS; round++) {
			const claim = await newClaim(testCase.id, owner.id);
			await save(claim.id, integration.id);
			const [edited, retired] = await Promise.all([
				callCriteriaPut(
					claim.id,
					saveBody(
						integration.id,
						itemSettingsWith((s) => {
							s.window = "PT3M";
						}),
						true
					)
				),
				callRetirement(claim.id, { reason: "Stopping" }),
			]);
			expect(edited.status).toBe(200);
			expect(retired.status).toBe(200);
			expect(await historyRevisions(claim.id)).toEqual([1, 2, 3]);
			const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
				where: { claimId: claim.id },
			});
			const newest = await prisma.pluginHealthCriteriaRevision.findFirstOrThrow(
				{
					where: { claimId: claim.id },
					orderBy: { revision: "desc" },
				}
			);
			expect(row.revision).toBe(3);
			// Retire first then save: the save starts again and is accepted.
			// Save first then retire: the settings end inactive.
			expect(row.state).toBe(
				newest.action === "RETIRED" ? "INACTIVE" : "ACCEPTED"
			);
			if (row.state === "ACCEPTED") {
				expect(newest.action).toBe("ACCEPTED");
			}
		}
	});

	it("two retirements racing give one success and one conflict", async () => {
		const { owner, testCase, integration } = await setup();
		for (let round = 0; round < ROUNDS; round++) {
			const claim = await newClaim(testCase.id, owner.id);
			await save(claim.id, integration.id);
			const [a, b] = await Promise.all([
				callRetirement(claim.id, { reason: "One" }),
				callRetirement(claim.id, { reason: "Two" }),
			]);
			expect([a.status, b.status].sort()).toEqual([200, 409]);
			expect(await historyRevisions(claim.id)).toEqual([1, 2]);
		}
	});

	it("a discard racing a suggestion leaves a consistent state", async () => {
		const { owner, testCase, integration } = await setup();
		for (let round = 0; round < ROUNDS; round++) {
			const claim = await newClaim(testCase.id, owner.id);
			await save(claim.id, integration.id, itemSettings(), false);
			const [saved, discarded] = await Promise.all([
				callCriteriaPut(
					claim.id,
					saveBody(
						integration.id,
						itemSettingsWith((s) => {
							s.window = "PT4M";
						}),
						false
					)
				),
				callRetirement(claim.id, {}),
			]);
			expect(saved.status).toBe(200);
			expect(discarded.status).toBe(200);
			const revisions = await historyRevisions(claim.id);
			expect(revisions).toEqual([1, 2, 3]);
			const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
				where: { claimId: claim.id },
			});
			const newest = await prisma.pluginHealthCriteriaRevision.findFirstOrThrow(
				{
					where: { claimId: claim.id },
					orderBy: { revision: "desc" },
				}
			);
			expect(row.state).toBe(
				newest.action === "DISCARDED" ? "INACTIVE" : "SUGGESTED"
			);
		}
	});
});
