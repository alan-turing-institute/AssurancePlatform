import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { suspendIntegration } from "@/lib/services/integration-registry-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { buildHealthCheckList } from "../fixtures/health-checks";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	importMachineRoute,
	machineGet,
} from "../utils/health-adversarial-kit";
import {
	actAs,
	addPipelineWithoutAccess,
	criteriaWorld,
	NONEXISTENT,
	type Role,
	save,
} from "../utils/health-criteria-adversarial-kit";
import {
	addPipeline,
	callCaseChecks,
	callCriteriaGet,
	callCriteriaPut,
	callHygiene,
	callMachineCaseCriteria,
	callMachineCaseStatus,
	callMachineClaimCriteria,
	callMachineClaimStatus,
	callPublishChecks,
	callRetirement,
	itemSettings,
	saveBody,
} from "../utils/health-criteria-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

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

const PLUGIN_ID = "tea.health";

const READ_ROLES: [Role, number][] = [
	["owner", 200],
	["directEdit", 200],
	["teamEdit", 200],
	["comment", 200],
	["view", 200],
	["none", 404],
	["signedOut", 401],
];

const WRITE_ROLES: [Role, number][] = [
	["owner", 200],
	["directEdit", 200],
	["teamEdit", 200],
	["comment", 404],
	["view", 404],
	["none", 404],
	["signedOut", 401],
];

async function criteriaCount(claimId: string) {
	return await prisma.pluginHealthCriteria.count({ where: { claimId } });
}

describe("session routes: who may read", () => {
	it.each(READ_ROLES)("GET criteria as %s gives %i", async (role, expected) => {
		const { claim, actors } = await criteriaWorld();
		await actAs(role, actors);
		expect((await callCriteriaGet(claim.id)).status).toBe(expected);
	});

	it.each(
		READ_ROLES
	)("GET case check lists as %s gives %i", async (role, expected) => {
		const { testCase, actors } = await criteriaWorld();
		await actAs(role, actors);
		expect((await callCaseChecks(testCase.id)).status).toBe(expected);
	});

	it.each(READ_ROLES)("GET hygiene as %s gives %i", async (role, expected) => {
		const { testCase, actors } = await criteriaWorld();
		await actAs(role, actors);
		expect((await callHygiene(testCase.id)).status).toBe(expected);
	});
});

describe("session routes: who may change settings", () => {
	it.each(
		WRITE_ROLES
	)("PUT criteria as %s gives %i and stores only when allowed", async (role, expected) => {
		const { claim, integration, actors } = await criteriaWorld();
		await actAs(role, actors);
		const response = await callCriteriaPut(
			claim.id,
			saveBody(integration.id, itemSettings(), true)
		);
		expect(response.status).toBe(expected);
		expect(await criteriaCount(claim.id)).toBe(expected === 200 ? 1 : 0);
	});

	it.each(
		WRITE_ROLES
	)("retirement as %s gives %i and changes nothing when refused", async (role, expected) => {
		const { claim, integration, actors, owner } = await criteriaWorld();
		await mockAuth(owner.id);
		await save(claim.id, integration.id);
		await actAs(role, actors);
		const response = await callRetirement(claim.id, { reason: "Done" });
		expect(response.status).toBe(expected);
		const row = await prisma.pluginHealthCriteria.findUnique({
			where: { claimId: claim.id },
		});
		expect(row?.state).toBe(expected === 200 ? "INACTIVE" : "ACCEPTED");
	});
});

describe("missing and inaccessible resources look the same", () => {
	async function sameAnswers(
		call: (id: string) => Promise<Response>,
		realId: string
	) {
		const real = await call(realId);
		const missing = await call(NONEXISTENT);
		const realAnswer = { status: real.status, body: await real.json() };
		const missingAnswer = {
			status: missing.status,
			body: await missing.json(),
		};
		return { realAnswer, missingAnswer };
	}

	async function statusIfSame(
		call: (id: string) => Promise<Response>,
		realId: string
	) {
		const { realAnswer, missingAnswer } = await sameAnswers(call, realId);
		return realAnswer.status === missingAnswer.status &&
			JSON.stringify(realAnswer.body) === JSON.stringify(missingAnswer.body)
			? realAnswer.status
			: `differs: ${JSON.stringify(realAnswer)} vs ${JSON.stringify(missingAnswer)}`;
	}

	it("a person without access gets the same answer for a real claim and a missing one, on every claim route", async () => {
		const { claim, integration, actors } = await criteriaWorld();
		await mockAuth(actors.none.id);
		const body = saveBody(integration.id, itemSettings(), true);
		expect(await statusIfSame((id) => callCriteriaGet(id), claim.id)).toBe(404);
		expect(
			await statusIfSame((id) => callCriteriaPut(id, body), claim.id)
		).toBe(404);
		expect(
			await statusIfSame((id) => callRetirement(id, { reason: "x" }), claim.id)
		).toBe(404);
	});

	it("a person without access gets the same answer for a real case and a missing one, on both case routes", async () => {
		const { testCase, actors } = await criteriaWorld();
		await mockAuth(actors.none.id);
		expect(await statusIfSame((id) => callCaseChecks(id), testCase.id)).toBe(
			404
		);
		expect(await statusIfSame((id) => callHygiene(id), testCase.id)).toBe(404);
	});

	it("a view-only person gets the same answer to a save as for a missing claim", async () => {
		const { claim, integration, actors } = await criteriaWorld();
		await mockAuth(actors.view.id);
		const body = saveBody(integration.id, itemSettings(), true);
		expect(
			await statusIfSame((id) => callCriteriaPut(id, body), claim.id)
		).toBe(404);
	});

	it("an element that is not a property claim is refused as a missing one is", async () => {
		const { owner, testCase, integration } = await criteriaWorld();
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		await mockAuth(owner.id);
		const body = saveBody(integration.id, itemSettings(), true);
		expect(await statusIfSame((id) => callCriteriaGet(id), goal.id)).toBe(404);
		expect(await statusIfSame((id) => callCriteriaPut(id, body), goal.id)).toBe(
			404
		);
		expect(
			await statusIfSame((id) => callRetirement(id, { reason: "x" }), goal.id)
		).toBe(404);
		expect(await criteriaCount(goal.id)).toBe(0);
	});

	it("a soft-deleted claim is refused as a missing one is, for the owner", async () => {
		const { owner, claim, integration } = await criteriaWorld();
		await mockAuth(owner.id);
		await save(claim.id, integration.id);
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { deletedAt: new Date() },
		});
		const body = saveBody(integration.id, itemSettings(), true);
		expect(await statusIfSame((id) => callCriteriaGet(id), claim.id)).toBe(404);
		expect(
			await statusIfSame((id) => callCriteriaPut(id, body), claim.id)
		).toBe(404);
		expect(
			await statusIfSame((id) => callRetirement(id, { reason: "x" }), claim.id)
		).toBe(404);
	});

	it("a soft-deleted case is refused as a missing one is, for the owner, on every route", async () => {
		const { owner, testCase, claim, integration } = await criteriaWorld();
		await mockAuth(owner.id);
		await save(claim.id, integration.id);
		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: { deletedAt: new Date() },
		});
		const body = saveBody(integration.id, itemSettings(), true);
		expect(await statusIfSame((id) => callCriteriaGet(id), claim.id)).toBe(404);
		expect(
			await statusIfSame((id) => callCriteriaPut(id, body), claim.id)
		).toBe(404);
		expect(
			await statusIfSame((id) => callRetirement(id, { reason: "x" }), claim.id)
		).toBe(404);
		expect(await statusIfSame((id) => callCaseChecks(id), testCase.id)).toBe(
			404
		);
		expect(await statusIfSame((id) => callHygiene(id), testCase.id)).toBe(404);
	});

	it("a malformed id is a clean client error, never a 500", async () => {
		const { owner } = await criteriaWorld();
		await mockAuth(owner.id);
		for (const call of [
			() => callCriteriaGet("not-a-uuid"),
			() => callCaseChecks("not-a-uuid"),
			() => callHygiene("not-a-uuid"),
			() => callRetirement("not-a-uuid", { reason: "x" }),
		]) {
			const status = (await call()).status;
			expect(status).toBeGreaterThanOrEqual(400);
			expect(status).toBeLessThan(500);
		}
	});
});

describe("machine routes: who may call", () => {
	it("a machine token on a session route is refused as no session", async () => {
		const { claim, integration, secret, testCase } = await criteriaWorld();
		await mockNoAuth();
		const body = saveBody(integration.id, itemSettings(), true);
		expect((await callCriteriaGet(claim.id, secret)).status).toBe(401);
		expect((await callCriteriaPut(claim.id, body, secret)).status).toBe(401);
		expect(
			(await callRetirement(claim.id, { reason: "x" }, secret)).status
		).toBe(401);
		expect((await callCaseChecks(testCase.id)).status).toBe(401);
		expect(await criteriaCount(claim.id)).toBe(0);
	});

	it("a person's session on a machine-only route is refused", async () => {
		const { claim, owner, testCase } = await criteriaWorld();
		await mockAuth(owner.id);
		expect((await callMachineCaseCriteria(testCase.id)).status).toBe(401);
		expect((await callMachineClaimCriteria(claim.id)).status).toBe(401);
		expect((await callMachineClaimStatus(claim.id)).status).toBe(401);
		expect((await callMachineCaseStatus(testCase.id)).status).toBe(401);
		expect((await callPublishChecks(buildHealthCheckList())).status).toBe(401);
	});

	it("a token without the needed scope gets the same generic 401 on each machine route", async () => {
		const { claim, owner, testCase } = await criteriaWorld();
		const bare = await addPipeline(owner.id, testCase.id, {
			scopes: ["case:read"],
		});
		const responses = [
			await callMachineCaseCriteria(testCase.id, bare.secret),
			await callMachineClaimCriteria(claim.id, bare.secret),
			await callMachineClaimStatus(claim.id, bare.secret),
			await callMachineCaseStatus(testCase.id, bare.secret),
			await callPublishChecks(buildHealthCheckList(), bare.secret),
		];
		const bodies: unknown[] = [];
		for (const response of responses) {
			expect(response.status).toBe(401);
			bodies.push(await response.json());
		}
		for (const body of bodies) {
			expect(body).toEqual(bodies[0]);
		}
	});

	it("each machine route needs its own scope: a token holding the others is refused", async () => {
		const { claim, owner, testCase } = await criteriaWorld();
		const only = async (scope: string) =>
			(await addPipeline(owner.id, testCase.id, { scopes: [scope] })).secret;
		const readOnlyChecks = await only("health:checks:write");
		const readOnlyCriteria = await only("health:criteria:read");
		const readOnlyStatus = await only("health:evidence:read");
		expect(
			(await callMachineCaseCriteria(testCase.id, readOnlyChecks)).status
		).toBe(401);
		expect(
			(await callMachineCaseCriteria(testCase.id, readOnlyStatus)).status
		).toBe(401);
		expect(
			(await callMachineClaimStatus(claim.id, readOnlyCriteria)).status
		).toBe(401);
		expect(
			(await callMachineCaseStatus(testCase.id, readOnlyChecks)).status
		).toBe(401);
		expect(
			(await callPublishChecks(buildHealthCheckList(), readOnlyCriteria)).status
		).toBe(401);
		expect(
			(await callMachineCaseCriteria(testCase.id, readOnlyCriteria)).status
		).toBe(200);
		expect(
			(await callMachineCaseStatus(testCase.id, readOnlyStatus)).status
		).toBe(200);
		expect(
			(await callPublishChecks(buildHealthCheckList(), readOnlyChecks)).status
		).toBe(200);
	});

	it("an unreachable claim or case gives the pipeline the same answer as a missing one", async () => {
		const { claim, owner, testCase } = await criteriaWorld();
		// A pipeline with the right scopes but no permission on the case.
		const { registerIntegration, issueToken } = await import(
			"@/lib/services/integration-registry-service"
		);
		const registered = await registerIntegration(
			{
				name: `crit-nopermission-${Math.random().toString(36).slice(2)}`,
				scopes: [
					"health:criteria:read",
					"health:evidence:read",
					"health:checks:write",
				],
			},
			owner.id
		);
		if (!("data" in registered)) {
			throw new Error("registration failed");
		}
		const issued = await issueToken(registered.data.integration.id, owner.id);
		if (!("data" in issued)) {
			throw new Error("token failed");
		}
		const token = issued.data.secret;
		const pairs: [Response, Response][] = [
			[
				await callMachineCaseCriteria(testCase.id, token),
				await callMachineCaseCriteria(NONEXISTENT, token),
			],
			[
				await callMachineClaimCriteria(claim.id, token),
				await callMachineClaimCriteria(NONEXISTENT, token),
			],
			[
				await callMachineClaimStatus(claim.id, token),
				await callMachineClaimStatus(NONEXISTENT, token),
			],
			[
				await callMachineCaseStatus(testCase.id, token),
				await callMachineCaseStatus(NONEXISTENT, token),
			],
		];
		for (const [real, missing] of pairs) {
			expect(real.status).toBe(404);
			expect(missing.status).toBe(404);
			expect(await real.json()).toEqual(await missing.json());
		}
	});

	it("a pipeline with VIEW only can read settings but cannot be offered to a person as able to edit", async () => {
		const { claim, owner, testCase, integration, secret, systemUserId } =
			await criteriaWorld();
		await mockAuth(owner.id);
		expect((await save(claim.id, integration.id)).status).toBe(200);
		// Downgrade the system user to VIEW.
		await prisma.casePermission.deleteMany({
			where: { caseId: testCase.id, userId: systemUserId },
		});
		const { createTestPermission } = await import("../utils/prisma-factories");
		await createTestPermission(testCase.id, systemUserId, owner.id, "VIEW");
		expect((await callMachineCaseCriteria(testCase.id, secret)).status).toBe(
			200
		);
		// Its check list is no longer offered for the case.
		const lists = await (await callCaseChecks(testCase.id)).json();
		expect(lists).toEqual([]);
		const retry = await save(claim.id, integration.id);
		expect(retry.status).toBe(400);
	});

	it("a soft-deleted claim is not served to the pipeline, singly or in the case list", async () => {
		const { claim, owner, testCase, integration, secret } =
			await criteriaWorld();
		await mockAuth(owner.id);
		await save(claim.id, integration.id);
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { deletedAt: new Date() },
		});
		const list = await (
			await callMachineCaseCriteria(testCase.id, secret)
		).json();
		expect(list.criteria).toEqual([]);
		expect((await callMachineClaimCriteria(claim.id, secret)).status).toBe(404);
	});

	it("a claim that is not a property claim is not served by the single read", async () => {
		const { owner, testCase, secret } = await criteriaWorld();
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const real = await callMachineClaimCriteria(goal.id, secret);
		const missing = await callMachineClaimCriteria(NONEXISTENT, secret);
		expect(real.status).toBe(404);
		expect(await real.json()).toEqual(await missing.json());
	});
});

describe("the plugin switched off", () => {
	it("a person who switched it off is refused on every session route, with the same answer for a real and a missing id", async () => {
		const { claim, testCase, integration, owner } = await criteriaWorld();
		await setPluginEnabledForUser(PLUGIN_ID, owner.id, { enabled: false });
		await mockAuth(owner.id);
		const body = saveBody(integration.id, itemSettings(), true);
		const pairs: [Response, Response][] = [
			[await callCriteriaGet(claim.id), await callCriteriaGet(NONEXISTENT)],
			[
				await callCriteriaPut(claim.id, body),
				await callCriteriaPut(NONEXISTENT, body),
			],
			[
				await callRetirement(claim.id, { reason: "x" }),
				await callRetirement(NONEXISTENT, { reason: "x" }),
			],
			[await callCaseChecks(testCase.id), await callCaseChecks(NONEXISTENT)],
			[await callHygiene(testCase.id), await callHygiene(NONEXISTENT)],
		];
		for (const [real, missing] of pairs) {
			expect(real.status).toBe(403);
			expect(missing.status).toBe(403);
			expect(await real.json()).toEqual(await missing.json());
		}
		expect(await criteriaCount(claim.id)).toBe(0);
	});

	it("an integration whose system user has switched it off cannot publish or read", async () => {
		const { claim, testCase, systemUserId, secret } = await criteriaWorld();
		await setPluginEnabledForUser(PLUGIN_ID, systemUserId, { enabled: false });
		expect(
			(await callPublishChecks(buildHealthCheckList(), secret)).status
		).toBe(403);
		expect((await callMachineCaseCriteria(testCase.id, secret)).status).toBe(
			403
		);
		expect((await callMachineClaimCriteria(claim.id, secret)).status).toBe(403);
		expect((await callMachineClaimStatus(claim.id, secret)).status).toBe(403);
		expect((await callMachineCaseStatus(testCase.id, secret)).status).toBe(403);
	});
});

describe("no probing of integrations and checks", () => {
	it("a person without access gets one answer whatever integration and check they name", async () => {
		const { claim, integration, owner, testCase, actors } =
			await criteriaWorld();
		const noAccess = await addPipelineWithoutAccess(owner.id);
		const suspended = await addPipeline(owner.id, testCase.id);
		await suspendIntegration(suspended.integration.id, owner.id);
		const badKind = itemSettings({
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 1, marginal_values: 0 },
			},
		});
		const bodies = [
			saveBody(integration.id, itemSettings(), true),
			saveBody(integration.id, badKind, true),
			saveBody(
				integration.id,
				itemSettings({
					check: { name: "Nothing Here", version: "9", params: {} },
				}),
				true
			),
			saveBody(NONEXISTENT, itemSettings(), true),
			saveBody(noAccess.integration.id, itemSettings(), true),
			saveBody(suspended.integration.id, itemSettings(), true),
		];
		for (const who of ["none", "view", "comment"] as const) {
			await mockAuth(actors[who].id);
			const answers: { status: number; body: unknown }[] = [];
			for (const body of bodies) {
				const response = await callCriteriaPut(claim.id, body);
				answers.push({ status: response.status, body: await response.json() });
			}
			for (const answer of answers) {
				expect(answer.status).toBe(404);
				expect(answer).toEqual(answers[0]);
			}
		}
		expect(await criteriaCount(claim.id)).toBe(0);
	});

	it("a person with access gets one identical 400 for an unknown integration, one without EDIT, a suspended one, an unpublished one and an unlisted check", async () => {
		const { claim, integration, owner, testCase } = await criteriaWorld();
		await mockAuth(owner.id);
		const noEdit = await addPipelineWithoutAccess(owner.id);
		const suspended = await addPipeline(owner.id, testCase.id);
		await suspendIntegration(suspended.integration.id, owner.id);
		const unpublished = await addPipeline(owner.id, testCase.id, {
			publish: false,
		});
		const unlisted = itemSettings({
			check: {
				name: "Nothing Here",
				version: "0.3",
				scope: "item",
				params: {},
			},
		});
		const wrongVersion = itemSettings({
			check: {
				name: "Surface Finish Check",
				version: "9.9",
				scope: "item",
				params: { camera_line: "ALL" },
			},
		});
		const attempts = [
			saveBody(NONEXISTENT, itemSettings(), true),
			saveBody(noEdit.integration.id, itemSettings(), true),
			saveBody(suspended.integration.id, itemSettings(), true),
			saveBody(unpublished.integration.id, itemSettings(), true),
			saveBody(integration.id, unlisted, true),
			saveBody(integration.id, wrongVersion, true),
		];
		const answers: { status: number; body: unknown }[] = [];
		for (const body of attempts) {
			const response = await callCriteriaPut(claim.id, body);
			answers.push({ status: response.status, body: await response.json() });
		}
		for (const answer of answers) {
			expect(answer.status).toBe(400);
			expect(answer).toEqual(answers[0]);
		}
		expect(JSON.stringify(answers[0]?.body)).toContain("settings.check.name");
		expect(await criteriaCount(claim.id)).toBe(0);
	});

	it("a person with access gets one 400 whatever the case when a check's name differs only by case or edge space", async () => {
		const { claim, integration, owner } = await criteriaWorld();
		await mockAuth(owner.id);
		const lower = await callCriteriaPut(
			claim.id,
			saveBody(
				integration.id,
				itemSettings({
					check: {
						name: "surface finish check",
						version: "0.3",
						scope: "item",
						params: { camera_line: "ALL" },
					},
				}),
				true
			)
		);
		expect(lower.status).toBe(400);
		expect(await criteriaCount(claim.id)).toBe(0);
	});

	it("the case check list shows only integrations whose system user may edit this case", async () => {
		const { owner, testCase, integration, actors } = await criteriaWorld();
		const noEdit = await addPipelineWithoutAccess(owner.id);
		const suspended = await addPipeline(owner.id, testCase.id);
		await suspendIntegration(suspended.integration.id, owner.id);
		await mockAuth(actors.view.id);
		const lists = await (await callCaseChecks(testCase.id)).json();
		const ids = lists.map(
			(entry: { integration: { id: string } }) => entry.integration.id
		);
		expect(ids).toEqual([integration.id]);
		expect(ids).not.toContain(noEdit.integration.id);
		expect(ids).not.toContain(suspended.integration.id);
	});
});

describe("nothing is public", () => {
	it("a published case's public data and snapshot carry no settings, check list or mismatch data", async () => {
		const { owner, testCase, claim, integration, secret } =
			await criteriaWorld();
		await mockAuth(owner.id);
		await save(claim.id, integration.id);
		const { postResult, pipelineRead } = await import(
			"../utils/health-criteria-adversarial-kit"
		);
		const served = (await pipelineRead(claim.id, secret)).body;
		await postResult(claim.id, secret, served, {
			rule: { kind: "identity", version: "r99" },
		});
		const published = await publishAssuranceCase(owner.id, testCase.id);
		expect("data" in published || "error" in published).toBe(true);
		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			const text = JSON.stringify(row.content);
			for (const needle of [
				"Surface Finish Check",
				"camera_line",
				"Inspection pipeline",
				"mismatch",
				"echo_state",
				"echo_differences",
				"criteria_revision",
				"valid_for",
				"proportion",
			]) {
				expect(text).not.toContain(needle);
			}
		}
		const rowsOfPublic = rows[0];
		if (!rowsOfPublic) {
			throw new Error("no published row");
		}
		const { GET } = await import("@/app/api/public/discover/[slug]/route");
		const { NextRequest } = await import("next/server");
		const response = await GET(
			new NextRequest(
				`http://localhost:3000/api/public/discover/${rowsOfPublic.slug}`
			),
			{ params: Promise.resolve({ slug: rowsOfPublic.slug }) }
		);
		const publicText = JSON.stringify(await response.json());
		for (const needle of [
			"Surface Finish Check",
			"camera_line",
			"mismatch",
			"echo_state",
			"criteria",
		]) {
			expect(publicText).not.toContain(needle);
		}
	});
});

describe("machine reads leave the evidence list readable", () => {
	it("the evidence list route still answers a token with read scope (list items carry the echo fields)", async () => {
		const { claim, secret, owner, integration } = await criteriaWorld();
		await mockAuth(owner.id);
		await save(claim.id, integration.id);
		const { postResult, pipelineRead } = await import(
			"../utils/health-criteria-adversarial-kit"
		);
		const served = (await pipelineRead(claim.id, secret)).body;
		await postResult(claim.id, secret, served);
		const { GET } = await importMachineRoute();
		const response = await GET(machineGet(claim.id, secret), {
			params: Promise.resolve({ id: claim.id }),
		});
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.evidence[0]).toMatchObject({
			echo_state: "match",
			echo_differences: null,
			criteria_revision: 1,
		});
	});
});

describe("test setup sanity", () => {
	it("creates distinct users", async () => {
		const a = await createTestUser();
		const b = await createTestUser();
		expect(a.id).not.toBe(b.id);
	});
});
