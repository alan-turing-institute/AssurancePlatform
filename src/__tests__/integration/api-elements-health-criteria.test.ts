import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { publishHealthCheckList } from "@/lib/services/health-check-catalogue-service";
import {
	deleteIntegrationRegistration,
	registerIntegration,
} from "@/lib/services/integration-registry-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { buildHealthCheckList } from "../fixtures/health-checks";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { callBoundCheck } from "../utils/health-adversarial-kit";
import {
	addPipeline,
	callCaseChecks,
	callCriteriaGet,
	callCriteriaPut,
	callHygiene,
	callRetirement,
	itemSettings,
	saveBody,
	setupCriteriaCase,
} from "../utils/health-criteria-kit";
import {
	addTeamMember,
	createTestPermission,
	createTestPluginState,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

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

const CLAIM_NOT_FOUND = "Claim not found";
const CASE_NOT_FOUND = "Case not found";
const NOT_OFFERED = "Check not offered for this case";
const UNAUTHORISED_STATUS = 401;

beforeEach(async () => {
	await mockNoAuth();
	vi.mocked(emitSSEEvent).mockClear();
});

async function asUser(user: { id: string; username: string; email: string }) {
	await mockAuth(user.id, user.username, user.email);
}

/** A user holding `permission` on the case directly, signed in. */
async function signedInWith(
	caseId: string,
	grantedById: string,
	permission: "VIEW" | "COMMENT" | "EDIT"
) {
	const user = await createTestUser();
	await createTestPermission(caseId, user.id, grantedById, permission);
	await asUser(user);
	return user;
}

async function signedInThroughTeam(
	caseId: string,
	grantedById: string,
	permission: "VIEW" | "EDIT"
) {
	const user = await createTestUser();
	const team = await createTestTeam(grantedById);
	await addTeamMember(team.id, user.id, "MEMBER");
	await createTestTeamPermission(caseId, team.id, grantedById, permission);
	await asUser(user);
	return user;
}

async function signedInStranger() {
	const user = await createTestUser();
	await asUser(user);
	return user;
}

/** Saves the demo settings as the case owner and returns the parsed body. */
async function save(
	claimId: string,
	integrationId: string,
	settings: Record<string, unknown> = itemSettings(),
	accept = false
) {
	const response = await callCriteriaPut(
		claimId,
		saveBody(integrationId, settings, accept)
	);
	if (response.status !== 200) {
		throw new Error(
			`save answered ${response.status}: ${JSON.stringify(await response.json())}`
		);
	}
	return await response.json();
}

async function setup() {
	const context = await setupCriteriaCase();
	await asUser(context.owner);
	return context;
}

describe("access to the settings routes", () => {
	type Who = "owner" | "VIEW" | "COMMENT" | "EDIT" | "team VIEW" | "team EDIT";

	async function signIn(who: Who, context: Awaited<ReturnType<typeof setup>>) {
		const { testCase, owner } = context;
		switch (who) {
			case "owner":
				return await asUser(owner);
			case "team VIEW":
				return await signedInThroughTeam(testCase.id, owner.id, "VIEW");
			case "team EDIT":
				return await signedInThroughTeam(testCase.id, owner.id, "EDIT");
			default:
				return await signedInWith(testCase.id, owner.id, who);
		}
	}

	it.each([
		["owner", 200],
		["VIEW", 200],
		["COMMENT", 200],
		["EDIT", 200],
		["team VIEW", 200],
		["team EDIT", 200],
	] as const)("GET: %s sees the settings (%i)", async (who, status) => {
		const context = await setup();
		await signIn(who, context);
		const response = await callCriteriaGet(context.claim.id);
		expect(response.status).toBe(status);
		expect((await response.json()).criteria).toBeNull();
	});

	it.each([
		["owner", 200],
		["EDIT", 200],
		["team EDIT", 200],
		["VIEW", 404],
		["COMMENT", 404],
		["team VIEW", 404],
	] as const)("PUT: %s saves (%i)", async (who, status) => {
		const context = await setup();
		await signIn(who, context);
		const response = await callCriteriaPut(
			context.claim.id,
			saveBody(context.integration.id)
		);
		expect(response.status).toBe(status);
		expect(await prisma.pluginHealthCriteria.count()).toBe(
			status === 200 ? 1 : 0
		);
	});

	it.each([
		["owner", 200],
		["EDIT", 200],
		["VIEW", 404],
		["COMMENT", 404],
	] as const)("POST retirement: %s (%i)", async (who, status) => {
		const context = await setup();
		await save(context.claim.id, context.integration.id);
		await signIn(who, context);
		const response = await callRetirement(context.claim.id);
		expect(response.status).toBe(status);
	});

	it("gives a person without access the same answer as for a missing claim", async () => {
		const context = await setup();
		await signedInStranger();
		const missing = "7acd824e-0000-4000-8000-0000000000aa";
		for (const claimId of [context.claim.id, missing]) {
			const get = await callCriteriaGet(claimId);
			expect(get.status).toBe(404);
			expect(await get.json()).toMatchObject({ error: CLAIM_NOT_FOUND });
			const put = await callCriteriaPut(
				claimId,
				saveBody(context.integration.id)
			);
			expect(put.status).toBe(404);
			expect((await put.json()).error).toBe(CLAIM_NOT_FOUND);
			const retire = await callRetirement(claimId);
			expect(retire.status).toBe(404);
			expect((await retire.json()).error).toBe(CLAIM_NOT_FOUND);
		}
	});

	it("learns nothing about a pipeline's checks before the access check", async () => {
		const context = await setup();
		await signedInStranger();
		const response = await callCriteriaPut(
			context.claim.id,
			saveBody(
				context.integration.id,
				itemSettings({ check: { name: "No Such Check", version: "9" } })
			)
		);
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe(CLAIM_NOT_FOUND);
	});

	it("refuses every settings route to a person who has switched the plugin off", async () => {
		const context = await setup();
		await createTestPluginState(context.owner.id, {
			pluginId: "tea.health",
			enabled: false,
		});
		const notEnabled = "Plugin 'tea.health' is not enabled";
		const responses = [
			await callCriteriaGet(context.claim.id),
			await callCriteriaPut(context.claim.id, saveBody(context.integration.id)),
			await callRetirement(context.claim.id),
			await callCaseChecks(context.testCase.id),
			await callHygiene(context.testCase.id),
		];
		for (const response of responses) {
			expect(response.status).toBe(403);
			expect((await response.json()).error).toBe(notEnabled);
		}
	});

	it("refuses an unauthenticated request", async () => {
		const context = await setup();
		await mockNoAuth();
		expect((await callCriteriaGet(context.claim.id)).status).toBe(
			UNAUTHORISED_STATUS
		);
		expect(
			(
				await callCriteriaPut(
					context.claim.id,
					saveBody(context.integration.id)
				)
			).status
		).toBe(UNAUTHORISED_STATUS);
		expect((await callRetirement(context.claim.id)).status).toBe(
			UNAUTHORISED_STATUS
		);
		expect((await callCaseChecks(context.testCase.id)).status).toBe(
			UNAUTHORISED_STATUS
		);
		expect((await callHygiene(context.testCase.id)).status).toBe(
			UNAUTHORISED_STATUS
		);
	});

	it("refuses a machine token on every session route", async () => {
		const context = await setup();
		await mockNoAuth();
		const { secret } = context;
		expect((await callCriteriaGet(context.claim.id, secret)).status).toBe(
			UNAUTHORISED_STATUS
		);
		expect(
			(
				await callCriteriaPut(
					context.claim.id,
					saveBody(context.integration.id),
					secret
				)
			).status
		).toBe(UNAUTHORISED_STATUS);
		expect(
			(await callRetirement(context.claim.id, undefined, secret)).status
		).toBe(UNAUTHORISED_STATUS);
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
	});

	it("gives the same case answer for a missing case and an inaccessible one", async () => {
		const context = await setup();
		await signedInStranger();
		const missing = "7acd824e-0000-4000-8000-0000000000bb";
		for (const caseId of [context.testCase.id, missing]) {
			for (const call of [callCaseChecks, callHygiene]) {
				const response = await call(caseId);
				expect(response.status).toBe(404);
				expect((await response.json()).error).toBe(CASE_NOT_FOUND);
			}
		}
	});

	it("lets a viewer read the check lists and the hygiene figures", async () => {
		const context = await setup();
		await signedInWith(context.testCase.id, context.owner.id, "VIEW");
		expect((await callCaseChecks(context.testCase.id)).status).toBe(200);
		expect((await callHygiene(context.testCase.id)).status).toBe(200);
	});
});

describe("saving, accepting and reading settings", () => {
	it("stores a suggestion without version labels beyond the first, and reads it back", async () => {
		const { claim, integration } = await setup();
		const body = await save(claim.id, integration.id);

		expect(body.criteria).toMatchObject({
			state: "suggested",
			revision: 1,
			rule: { version: "r1" },
			reduction: { version: "d1", rule: { version: "d1" } },
			aggregation: { version: "a1" },
			source: { kind: "recommended" },
			accepted_at: null,
		});
		expect(body.accepted_by).toBeNull();
		expect(body.integration).toEqual({
			id: integration.id,
			name: integration.name,
		});
		expect(body.check_offer).toBe("current");
		expect(body.last_change).toMatchObject({ action: "suggested" });
		expect(body.pipeline_read).toBeNull();
		expect(body.latest_result).toBeNull();
		expect(vi.mocked(emitSSEEvent)).toHaveBeenCalledWith(
			"tea.health/state-changed",
			expect.any(String),
			expect.objectContaining({ claimId: claim.id })
		);
	});

	it("labels settings accepted on the first save r1, d1 and a1, and binds the claim", async () => {
		const { claim, integration, owner } = await setup();
		const body = await save(claim.id, integration.id, itemSettings(), true);

		expect(body.criteria.state).toBe("accepted");
		expect(body.accepted_by).toEqual({
			name: owner.username,
			owns_integration: true,
		});
		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.boundCheckName).toBe("Surface Finish Check");
		const changes = await prisma.pluginHealthBindingChange.findMany({
			where: { claimId: claim.id },
		});
		expect(changes.map((change) => change.source)).toEqual(["DECLARATION"]);
	});

	it("raises only the rule's label when only the rule changes, suggested or accepted", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id);
		const edited = itemSettings({
			rule: { kind: "identity", params: { note: 1 } },
		});
		const suggested = await save(claim.id, integration.id, edited);
		expect(suggested.criteria).toMatchObject({
			rule: { version: "r2" },
			reduction: { version: "d1" },
			aggregation: { version: "a1" },
			source: { kind: "edited", rule: "edited", timing: "recommended" },
		});

		const accepted = await save(
			claim.id,
			integration.id,
			itemSettings({ rule: { kind: "identity", params: { note: 2 } } }),
			true
		);
		expect(accepted.criteria.rule.version).toBe("r3");
	});

	it("raises all three labels when the check's name changes", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id, itemSettings(), true);
		const numeric = {
			check: { name: "Edge Alignment Measure", version: "1.1" },
			rule: {
				kind: "threshold",
				direction: "minimize",
				params: { pass_values: 0.5, marginal_values: 1 },
			},
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
			},
			window: "PT5M",
			valid_for: "PT30M",
		};
		const body = await save(claim.id, integration.id, numeric, true);
		expect(body.criteria).toMatchObject({
			rule: { version: "r2" },
			aggregation: { version: "a2" },
		});
		expect(body.criteria.reduction).toBeUndefined();
		const changes = await prisma.pluginHealthBindingChange.findMany({
			where: { claimId: claim.id },
			orderBy: { createdAt: "asc" },
		});
		expect(
			changes.map((change) => [change.toCheckName, change.source])
		).toEqual([
			["Surface Finish Check", "DECLARATION"],
			["Edge Alignment Measure", "DECLARATION"],
		]);
	});

	it("continues the revision and the counters across discard and a new suggestion", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id);
		const discarded = await callRetirement(claim.id, {});
		expect(discarded.status).toBe(200);
		expect((await discarded.json()).criteria.state).toBe("inactive");

		const again = await save(
			claim.id,
			integration.id,
			itemSettings({ rule: { kind: "identity", params: { note: 1 } } })
		);
		expect(again.criteria.revision).toBe(3);
		expect(again.criteria.rule.version).toBe("r2");
		const actions = await prisma.pluginHealthCriteriaRevision.findMany({
			where: { claimId: claim.id },
			orderBy: { revision: "asc" },
		});
		expect(actions.map((row) => row.action)).toEqual([
			"SUGGESTED",
			"DISCARDED",
			"SUGGESTED",
		]);
	});

	it("continues the counters when accepted settings are retired and set up again", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id, itemSettings(), true);
		expect((await callRetirement(claim.id)).status).toBe(200);
		const again = await save(claim.id, integration.id, itemSettings(), true);
		expect(again.criteria).toMatchObject({
			state: "accepted",
			revision: 3,
			rule: { version: "r1" },
		});
		const rows = await prisma.pluginHealthCriteriaRevision.findMany({
			where: { claimId: claim.id },
			orderBy: { revision: "asc" },
		});
		expect(rows.map((row) => row.action)).toEqual([
			"ACCEPTED",
			"RETIRED",
			"ACCEPTED",
		]);
	});

	it("writes one history row per change, holding the settings as served and the actor", async () => {
		const { claim, integration, owner } = await setup();
		await save(claim.id, integration.id);
		await save(claim.id, integration.id, itemSettings(), true);
		await save(
			claim.id,
			integration.id,
			itemSettings({ window: "PT2M" }),
			true
		);
		await callRetirement(claim.id, { reason: "Not needed" });

		const rows = await prisma.pluginHealthCriteriaRevision.findMany({
			where: { claimId: claim.id },
			orderBy: { revision: "asc" },
		});
		expect(rows.map((row) => [row.revision, row.action])).toEqual([
			[1, "SUGGESTED"],
			[2, "ACCEPTED"],
			[3, "EDITED"],
			[4, "RETIRED"],
		]);
		expect(rows[2]?.declaration).toMatchObject({
			window: "PT2M",
			rule: { version: "r1" },
		});
		expect(rows.every((row) => row.actorId === owner.id)).toBe(true);
		expect(rows[3]?.reason).toBe("Not needed");
		expect(rows[0]?.integrationName).toBe(integration.name);
		expect(rows[0]?.pipelineName).toBe("Inspection pipeline (demo)");
	});

	it("lets one person accept what another suggested, and says who owns the integration", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id);
		const editor = await signedInWith(
			context.testCase.id,
			context.owner.id,
			"EDIT"
		);
		const accepted = await save(
			context.claim.id,
			context.integration.id,
			itemSettings(),
			true
		);
		expect(accepted.accepted_by).toEqual({
			name: editor.username,
			owns_integration: false,
		});
		expect(accepted.last_change).toMatchObject({
			action: "accepted",
			by_name: editor.username,
		});

		// The owner of the integration accepting from a suggestion is marked as its owner.
		const other = await createClaim(context);
		await asUser(editor);
		await save(other.id, context.integration.id);
		await asUser(context.owner);
		const byOwner = await save(
			other.id,
			context.integration.id,
			itemSettings(),
			true
		);
		expect(byOwner.accepted_by.owns_integration).toBe(true);
	});

	it("does not rewrite who accepted when the integration changes owner", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);
		const newOwner = await createTestUser();
		await prisma.integration.update({
			where: { id: context.integration.id },
			data: { ownerId: newOwner.id },
		});
		const body = await (await callCriteriaGet(context.claim.id)).json();
		expect(body.accepted_by.owns_integration).toBe(true);
	});

	it("keeps accepted settings accepted on a later save and records who saved", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);
		const editor = await signedInWith(
			context.testCase.id,
			context.owner.id,
			"EDIT"
		);
		const body = await save(
			context.claim.id,
			context.integration.id,
			itemSettings({ valid_for: "PT10M" }),
			true
		);
		expect(body.criteria.state).toBe("accepted");
		expect(body.accepted_by.name).toBe(context.owner.username);
		const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});
		expect(row.updatedById).toBe(editor.id);
		expect(row.acceptedById).toBe(context.owner.id);
	});

	it("refuses to save accepted settings as a suggestion", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);
		const response = await callCriteriaPut(
			context.claim.id,
			saveBody(context.integration.id, itemSettings({ window: "PT2M" }), false)
		);
		expect(response.status).toBe(409);
		expect((await response.json()).error).toBe(
			"Accepted settings cannot be saved as a suggestion"
		);
	});

	it("answers a missing id with a 400 and a body that is not JSON with a 400", async () => {
		const context = await setup();
		expect((await callCriteriaGet("not-a-uuid")).status).toBe(400);
		const response = await callCriteriaPut(context.claim.id, "{not json");
		expect(response.status).toBe(400);
	});
});

async function createClaim(context: Awaited<ReturnType<typeof setup>>) {
	const { createTestElement } = await import("../utils/prisma-factories");
	return createTestElement(context.testCase.id, context.owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
}

describe("refused settings", () => {
	const numericBase = {
		check: { name: "Edge Alignment Measure", version: "1.1" },
		rule: {
			kind: "threshold",
			direction: "minimize",
			params: { pass_values: 0.5, marginal_values: 1 },
		},
		aggregation: {
			kind: "proportion",
			params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
		},
		window: "PT5M",
		valid_for: "PT30M",
	};
	const systemBase = {
		check: { name: "Line Throughput Monitor", version: "2.0" },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 40, marginal_values: 25 },
		},
		window: "PT10M",
		valid_for: "PT1H",
	};
	const { aggregation: _aggregation, ...itemWithoutAggregation } =
		itemSettings();

	it.each([
		[
			"a check not in the list",
			itemSettings({ check: { name: "No Such Check", version: "1" } }),
			"settings.check.name",
		],
		[
			"a check version the list does not offer",
			itemSettings({
				check: { name: "Surface Finish Check", version: "9.9" },
			}),
			"settings.check.name",
		],
		[
			"a rule kind that does not fit the value type",
			{ ...numericBase, rule: { kind: "identity" } },
			"settings.rule.kind",
		],
		[
			"direction target",
			{
				...numericBase,
				rule: {
					kind: "threshold",
					direction: "target",
					params: { pass_values: 1 },
				},
			},
			"settings.rule.direction",
		],
		[
			"an aggregation other than proportion",
			{
				...numericBase,
				aggregation: { kind: "worst-of", params: { threshold: 0.9 } },
			},
			"settings.aggregation.kind",
		],
		[
			"use_verdict false",
			{
				...numericBase,
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.9, use_verdict: false },
				},
			},
			"settings.aggregation.params.use_verdict",
		],
		[
			"a marginal threshold",
			{
				...numericBase,
				aggregation: {
					kind: "proportion",
					params: {
						threshold: 0.9,
						use_verdict: true,
						marginal_threshold: 0.8,
					},
				},
			},
			"settings.aggregation.params.marginal_threshold",
		],
		[
			"a reduction on a whole-system check",
			{ ...systemBase, reduction: { kind: "last" } },
			"settings.reduction",
		],
		[
			"an aggregation on a whole-system check",
			{
				...systemBase,
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.9, use_verdict: true },
				},
			},
			"settings.aggregation",
		],
		[
			"no aggregation on another check",
			itemWithoutAggregation,
			"settings.aggregation",
		],
		[
			"a yes-or-no rule with an averaging reduction and no rule of its own",
			itemSettings({ reduction: { kind: "mean" } }),
			"settings.reduction.rule",
		],
		[
			"a check setting the check does not describe",
			itemSettings({
				check: {
					name: "Surface Finish Check",
					version: "0.3",
					params: { unknown_setting: 1 },
				},
			}),
			"settings.check.params.unknown_setting",
		],
		[
			"a duration in months",
			itemSettings({ window: "P1M" }),
			"settings.window",
		],
		[
			"a duration in years",
			itemSettings({ valid_for: "P1Y" }),
			"settings.valid_for",
		],
		[
			"a duration over 100 years",
			itemSettings({ valid_for: "P40000D" }),
			"settings.valid_for",
		],
		[
			"a value for source sent by the browser",
			itemSettings({ source: { kind: "recommended" } }),
			"settings.source",
		],
		[
			"a check scope that differs from the list's",
			itemSettings({
				check: {
					name: "Surface Finish Check",
					version: "0.3",
					scope: "region",
				},
			}),
			"settings.check.scope",
		],
	])("refuses %s with the field named and stores nothing", async (_name, settings, field) => {
		const { claim, integration } = await setup();
		const response = await callCriteriaPut(
			claim.id,
			saveBody(integration.id, settings as Record<string, unknown>, true)
		);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("VALIDATION");
		expect(Object.keys(body.fieldErrors)).toContain(field);
		expect(body.error.startsWith(`${field}:`)).toBe(true);
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
		expect(await prisma.pluginHealthCriteriaRevision.count()).toBe(0);
		expect(await prisma.pluginHealthClaimState.count()).toBe(0);
	});

	it("refuses any reduction on a check that returns text", async () => {
		const context = await setup();
		const { systemUserId, integration } = await addPipeline(
			context.owner.id,
			context.testCase.id,
			{ publish: false }
		);
		const { publishHealthCheckList } = await import(
			"@/lib/services/health-check-catalogue-service"
		);
		expectSuccess(
			await publishHealthCheckList(
				{ integrationId: integration.id, systemUserId },
				{
					pipeline: "Text pipeline",
					checks: [
						{
							name: "Label Text Check",
							version: "1",
							scope: "item",
							value: { type: "string" },
						},
					],
				}
			)
		);
		const settings = {
			check: { name: "Label Text Check", version: "1" },
			rule: { kind: "membership", params: { pass_values: ["ok"] } },
			reduction: { kind: "last" },
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.9, use_verdict: true },
			},
			window: "PT1M",
			valid_for: "PT5M",
		};
		const response = await callCriteriaPut(
			context.claim.id,
			saveBody(integration.id, settings, true)
		);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.fieldErrors["settings.reduction"]).toContain("text");
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
	});

	it("gives the same 400 for an unknown integration, a pipeline without access, and a check it does not offer", async () => {
		const context = await setup();
		const { owner } = context;
		const noAccess = expectSuccess(
			await registerIntegration(
				{
					name: `no-access-${Math.random().toString(36).slice(2)}`,
					scopes: ["case:read"],
				},
				owner.id
			)
		);
		// It publishes a list, so the refusal can only come from the missing EDIT.
		expectSuccess(
			await publishHealthCheckList(
				{
					integrationId: noAccess.integration.id,
					systemUserId: noAccess.systemUserId,
				},
				buildHealthCheckList() as never
			)
		);
		const unknownIntegration = "7acd824e-0000-4000-8000-0000000000cc";
		const bodies: unknown[] = [];
		for (const [integrationId, settings] of [
			[unknownIntegration, itemSettings()],
			[noAccess.integration.id, itemSettings()],
			[
				context.integration.id,
				itemSettings({ check: { name: "No Such Check", version: "1" } }),
			],
		] as const) {
			const response = await callCriteriaPut(
				context.claim.id,
				saveBody(integrationId, settings)
			);
			expect(response.status).toBe(400);
			bodies.push(await response.json());
		}
		expect(bodies[0]).toEqual(bodies[1]);
		expect(bodies[1]).toEqual(bodies[2]);
		expect(bodies[0]).toMatchObject({
			error: `settings.check.name: ${NOT_OFFERED}`,
			fieldErrors: { "settings.check.name": NOT_OFFERED },
		});
	});

	it("refuses a pipeline that has not published a check list", async () => {
		const context = await setup();
		const silent = await addPipeline(context.owner.id, context.testCase.id, {
			publish: false,
		});
		const response = await callCriteriaPut(
			context.claim.id,
			saveBody(silent.integration.id)
		);
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			`settings.check.name: ${NOT_OFFERED}`
		);
	});
});

describe("retirement", () => {
	it("requires a reason to retire accepted settings, and none to discard a suggestion", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);
		const refused = await callRetirement(context.claim.id, {});
		expect(refused.status).toBe(400);
		expect(await refused.json()).toMatchObject({
			error: "reason: is required to stop using accepted settings",
			fieldErrors: { reason: "is required to stop using accepted settings" },
		});
		const retired = await callRetirement(context.claim.id, {
			reason: "Check replaced",
		});
		expect(retired.status).toBe(200);
		const body = await retired.json();
		expect(body.criteria.state).toBe("inactive");
		expect(body.accepted_by).toBeNull();
		expect(body.last_change).toMatchObject({
			action: "retired",
			reason: "Check replaced",
		});
		expect(body.check_offer).toBeNull();
	});

	it("refuses to retire settings that are already inactive, and a claim with none", async () => {
		const context = await setup();
		const none = await callRetirement(context.claim.id, { reason: "x" });
		expect(none.status).toBe(404);
		expect((await none.json()).error).toBe("Settings not found");

		await save(context.claim.id, context.integration.id);
		expect((await callRetirement(context.claim.id, {})).status).toBe(200);
		const again = await callRetirement(context.claim.id, { reason: "x" });
		expect(again.status).toBe(409);
		expect((await again.json()).error).toBe(
			"These settings are already inactive"
		);
	});

	it("flags the claim's current result as judged without accepted settings", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);
		await callRetirement(context.claim.id, { reason: "Stopped" });
		const { appendRecord } = await import("../utils/health-adversarial-kit");
		await appendRecord(
			context.systemUserId,
			context.claim.id,
			"populationPass",
			{
				check: {
					name: "Surface Finish Check",
					version: "0.3",
					scope: "item",
				},
			}
		);
		const { callStatus } = await import("../utils/health-adversarial-kit");
		const status = (await (await callStatus(context.claim.id)).json()).status;
		expect(status.mismatch).toEqual({ state: "undeclared" });
	});
});

describe("the check binding", () => {
	it("refuses a manual change of the bound check while settings are accepted, and allows it after they are retired", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);
		const refused = await callBoundCheck(context.claim.id, {
			name: "Another Checker",
			reason: "Renamed",
		});
		expect(refused.status).toBe(409);
		expect((await refused.json()).error).toBe(
			"This claim's check is set in its evidence settings"
		);
		await callRetirement(context.claim.id, { reason: "Stopped" });
		const allowed = await callBoundCheck(context.claim.id, {
			name: "Another Checker",
			reason: "Renamed",
		});
		expect(allowed.status).toBe(200);
	});

	it("leaves a suggestion's claim unbound", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id);
		expect(await prisma.pluginHealthClaimState.count()).toBe(0);
		const allowed = await callBoundCheck(context.claim.id, {
			name: "Another Checker",
			reason: "Renamed",
		});
		expect(allowed.status).toBe(200);
	});
});

describe("the check list offered", () => {
	it("says when a newer version of the check is offered, and when it is not offered", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);

		const { buildHealthCheckList } = await import("../fixtures/health-checks");
		const list = buildHealthCheckList();
		const publish = async (checks: typeof list.checks) => {
			const { publishHealthCheckList } = await import(
				"@/lib/services/health-check-catalogue-service"
			);
			expectSuccess(
				await publishHealthCheckList(
					{
						integrationId: context.integration.id,
						systemUserId: context.systemUserId,
					},
					{ ...list, checks } as never
				)
			);
		};
		await publish(
			list.checks.map((check) =>
				check.name === "Surface Finish Check"
					? { ...check, version: "0.4" }
					: check
			)
		);
		let body = await (await callCriteriaGet(context.claim.id)).json();
		expect(body.check_offer).toBe("newer-version");
		// Accepted settings do not move by themselves.
		expect(body.criteria.check.version).toBe("0.3");

		await publish(
			list.checks.filter((check) => check.name !== "Surface Finish Check")
		);
		body = await (await callCriteriaGet(context.claim.id)).json();
		expect(body.check_offer).toBe("not-offered");

		// Other blocks can still be edited while the check is out of the list.
		const edited = await callCriteriaPut(
			context.claim.id,
			saveBody(
				context.integration.id,
				itemSettings({ valid_for: "PT20M" }),
				true
			)
		);
		expect(edited.status).toBe(200);
		const editedBody = await edited.json();
		expect(editedBody.criteria.valid_for).toBe("PT20M");
		expect(editedBody.criteria.source.kind).toBe("edited");
		expect(editedBody.criteria.source.rule).toBe("recommended");
		expect(editedBody.criteria.source.timing).toBe("edited");
	});

	it("refuses to accept a suggestion whose check has left the list, and still allows editing accepted settings", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), false);

		const { buildHealthCheckList } = await import("../fixtures/health-checks");
		const list = buildHealthCheckList();
		expectSuccess(
			await publishHealthCheckList(
				{
					integrationId: context.integration.id,
					systemUserId: context.systemUserId,
				},
				{
					...list,
					checks: list.checks.filter(
						(check) => check.name !== "Surface Finish Check"
					),
				} as never
			)
		);

		const refused = await callCriteriaPut(
			context.claim.id,
			saveBody(context.integration.id, itemSettings(), true)
		);
		expect(refused.status).toBe(400);
		const refusedBody = await refused.json();
		expect(refusedBody.error).toBe(`settings.check.name: ${NOT_OFFERED}`);
		expect(refusedBody.fieldErrors["settings.check.name"]).toBe(NOT_OFFERED);

		// Saving it as a suggestion again is still allowed.
		const stillSuggested = await callCriteriaPut(
			context.claim.id,
			saveBody(
				context.integration.id,
				itemSettings({ valid_for: "PT20M" }),
				false
			)
		);
		expect(stillSuggested.status).toBe(200);
	});

	it("serves nothing after the integration is deleted, and restores on a save against a new one", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);
		expectSuccess(
			await deleteIntegrationRegistration(
				context.integration.id,
				context.owner.id
			)
		);

		const body = await (await callCriteriaGet(context.claim.id)).json();
		expect(body.integration).toBeNull();
		expect(body.check_offer).toBe("not-offered");
		expect(body.criteria.state).toBe("accepted");

		const fresh = await addPipeline(context.owner.id, context.testCase.id);
		const { callMachineClaimCriteria } = await import(
			"../utils/health-criteria-kit"
		);
		expect(
			(await callMachineClaimCriteria(context.claim.id, fresh.secret)).status
		).toBe(404);

		const restored = await save(
			context.claim.id,
			fresh.integration.id,
			itemSettings(),
			true
		);
		expect(restored.integration.id).toBe(fresh.integration.id);
		expect(restored.check_offer).toBe("current");
		expect(
			(await callMachineClaimCriteria(context.claim.id, fresh.secret)).status
		).toBe(200);
	});
});

describe("settings of a check that has left the list", () => {
	const ORDERED_CHECK = "Two Setting Check";
	const TEXT_CHECK = "Text Reader";
	const AGGREGATION = {
		kind: "proportion",
		params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
	};
	const extraChecks = [
		{
			name: ORDERED_CHECK,
			version: "1",
			scope: "item",
			value: { type: "boolean" },
			params: [
				{ key: "long_parameter_name", label: "Long", type: "string" },
				{ key: "b", label: "B", type: "string" },
			],
		},
		{
			name: TEXT_CHECK,
			version: "1",
			scope: "item",
			value: { type: "string" },
		},
	];

	function orderedSettings(
		params: Record<string, unknown>,
		overrides: Record<string, unknown> = {}
	) {
		return {
			check: { name: ORDERED_CHECK, version: "1", scope: "item", params },
			rule: { kind: "identity" },
			aggregation: AGGREGATION,
			window: "PT1M",
			valid_for: "PT5M",
			...overrides,
		};
	}

	function textSettings(overrides: Record<string, unknown> = {}) {
		return {
			check: { name: TEXT_CHECK, version: "1", scope: "item" },
			rule: { kind: "membership", params: { pass_values: ["OK"] } },
			aggregation: AGGREGATION,
			window: "PT1M",
			valid_for: "PT5M",
			...overrides,
		};
	}

	async function publishChecks(
		context: { integration: { id: string }; systemUserId: string },
		checks: unknown[]
	) {
		expectSuccess(
			await publishHealthCheckList(
				{
					integrationId: context.integration.id,
					systemUserId: context.systemUserId,
				},
				{ ...buildHealthCheckList(), checks } as never
			)
		);
	}

	/** Accepts `settings` while every check is listed, then publishes a list with no checks. */
	async function acceptedThenUnlisted(settings: Record<string, unknown>) {
		const context = await setup();
		await publishChecks(context, [
			...buildHealthCheckList().checks,
			...extraChecks,
		]);
		await save(context.claim.id, context.integration.id, settings, true);
		await publishChecks(context, []);
		return context;
	}

	it("accepts an edit that sends the check's own settings in another order than they were stored", async () => {
		const context = await acceptedThenUnlisted(
			orderedSettings({ long_parameter_name: "x", b: "y" })
		);
		// The database hands object keys back shortest first, so `b` is stored before `long_parameter_name`.
		for (const params of [
			{ long_parameter_name: "x", b: "y" },
			{ b: "y", long_parameter_name: "x" },
		]) {
			const response = await callCriteriaPut(
				context.claim.id,
				saveBody(
					context.integration.id,
					orderedSettings(params, { valid_for: "PT20M" }),
					true
				)
			);
			expect(response.status).toBe(200);
		}
	});

	it("refuses an edit that changes the check's own settings", async () => {
		const context = await acceptedThenUnlisted(
			orderedSettings({ long_parameter_name: "x", b: "y" })
		);
		const response = await callCriteriaPut(
			context.claim.id,
			saveBody(
				context.integration.id,
				orderedSettings({ long_parameter_name: "x", b: "changed" }),
				true
			)
		);
		expect(response.status).toBe(400);
		expect((await response.json()).fieldErrors).toEqual({
			"settings.check.name": NOT_OFFERED,
		});
	});

	it("stores the check's entry with the settings and returns it beside them", async () => {
		const context = await setup();
		const empty = await (await callCriteriaGet(context.claim.id)).json();
		expect(empty.check_description).toBeNull();

		const entry = buildHealthCheckList().checks.find(
			(check) => check.name === "Surface Finish Check"
		);
		const saved = await save(
			context.claim.id,
			context.integration.id,
			itemSettings(),
			true
		);
		expect(saved.check_description).toEqual(entry);

		await publishChecks(context, []);
		const edited = await save(
			context.claim.id,
			context.integration.id,
			itemSettings({ valid_for: "PT20M" }),
			true
		);
		expect(edited.check_offer).toBe("not-offered");
		expect(edited.check_description).toEqual(entry);

		const { callMachineClaimCriteria } = await import(
			"../utils/health-criteria-kit"
		);
		const read = await (
			await callMachineClaimCriteria(context.claim.id, context.secret)
		).json();
		expect(read).not.toHaveProperty("check_description");
	});

	it.each([
		[
			"removing the aggregation from a per-item check",
			() => itemSettings(),
			() => itemSettings({ aggregation: undefined }),
			"settings.aggregation",
		],
		[
			"a rule kind that does not fit the value type",
			() => itemSettings(),
			() =>
				itemSettings({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 0.5 },
					},
				}),
			"settings.rule.kind",
		],
		[
			"a reduction on a text check",
			() => textSettings(),
			() => textSettings({ reduction: { kind: "last" } }),
			"settings.reduction",
		],
		[
			"an own setting the check did not describe",
			() => orderedSettings({ long_parameter_name: "x", b: "y" }),
			() => orderedSettings({ long_parameter_name: "x", b: "y", extra: "z" }),
			"settings.check.params.extra",
		],
	])("refuses %s, names the field and stores nothing", async (_label, base, edit, field) => {
		const context = await acceptedThenUnlisted(base());
		const stored = () =>
			prisma.pluginHealthCriteria.findUniqueOrThrow({
				where: { claimId: context.claim.id },
			});
		const before = await stored();
		const response = await callCriteriaPut(
			context.claim.id,
			saveBody(context.integration.id, edit(), true)
		);
		expect(response.status).toBe(400);
		expect(Object.keys((await response.json()).fieldErrors)).toContain(field);
		expect(await stored()).toEqual(before);
		expect(
			await prisma.pluginHealthCriteriaRevision.count({
				where: { claimId: context.claim.id },
			})
		).toBe(1);
	});
});

describe("saving with an upper-case integration id and a moved integration", () => {
	it("accepts an integration id in upper case", async () => {
		const context = await setup();
		const body = await save(
			context.claim.id,
			context.integration.id.toUpperCase(),
			itemSettings(),
			true
		);
		expect(body.integration.id).toBe(context.integration.id);
	});

	it("works out again who owns the integration when accepted settings move to another", async () => {
		const context = await setup();
		await save(context.claim.id, context.integration.id, itemSettings(), true);
		const other = await createTestUser();
		const second = await addPipeline(other.id, context.testCase.id);

		const moved = await save(
			context.claim.id,
			second.integration.id,
			itemSettings(),
			true
		);
		expect(moved.accepted_by).toEqual({
			name: context.owner.username,
			owns_integration: false,
		});
		const back = await save(
			context.claim.id,
			context.integration.id,
			itemSettings(),
			true
		);
		expect(back.accepted_by.owns_integration).toBe(true);
	});
});

describe("GET /api/cases/[id]/health/checks", () => {
	it("lists the check lists of pipelines that hold EDIT on the case", async () => {
		const context = await setup();
		const withoutAccess = await addPipeline(
			context.owner.id,
			context.testCase.id
		);
		await prisma.casePermission.deleteMany({
			where: { userId: withoutAccess.systemUserId },
		});
		const response = await callCaseChecks(context.testCase.id);
		expect(response.status).toBe(200);
		const lists = await response.json();
		expect(lists).toHaveLength(1);
		expect(lists[0]).toMatchObject({
			integration: {
				id: context.integration.id,
				name: context.integration.name,
			},
			pipeline: "Inspection pipeline (demo)",
		});
		expect(
			lists[0].checks.map((check: { name: string }) => check.name)
		).toEqual([
			"Surface Finish Check",
			"Edge Alignment Measure",
			"Line Throughput Monitor",
		]);
	});

	it("leaves out a suspended integration and a pipeline with VIEW only", async () => {
		const context = await setup();
		await prisma.integration.update({
			where: { id: context.integration.id },
			data: { status: "SUSPENDED" },
		});
		const viewOnly = await addPipeline(context.owner.id, context.testCase.id);
		await prisma.casePermission.updateMany({
			where: { userId: viewOnly.systemUserId },
			data: { permission: "VIEW" },
		});
		const lists = await (await callCaseChecks(context.testCase.id)).json();
		expect(lists).toEqual([]);
	});
});

describe("GET /api/cases/[id]/health/hygiene", () => {
	it("counts claims and checks without a time limit, and settings accepted as recommended", async () => {
		const context = await setup();
		const { appendRecord } = await import("../utils/health-adversarial-kit");
		const second = await createClaim(context);
		const third = await createClaim(context);
		await createClaim(context);

		await appendRecord(
			context.systemUserId,
			context.claim.id,
			"populationPass",
			{
				valid_for: "indefinite",
			}
		);
		await appendRecord(context.systemUserId, second.id, "populationPass", {
			valid_for: "indefinite",
		});
		await appendRecord(context.systemUserId, third.id, "singleSubject");

		await save(context.claim.id, context.integration.id, itemSettings(), true);
		await save(
			second.id,
			context.integration.id,
			itemSettings({ window: "PT2M" }),
			true
		);

		const response = await callHygiene(context.testCase.id);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			claims_without_time_limit: { count: 2, of: 3 },
			checks_without_time_limit: { count: 1, of: 2 },
			settings_as_recommended: { count: 1, of: 2 },
		});
	});

	it("is all zeros for a case with no results and no settings", async () => {
		const context = await setup();
		expect(await (await callHygiene(context.testCase.id)).json()).toEqual({
			claims_without_time_limit: { count: 0, of: 0 },
			checks_without_time_limit: { count: 0, of: 0 },
			settings_as_recommended: { count: 0, of: 0 },
		});
	});
});
