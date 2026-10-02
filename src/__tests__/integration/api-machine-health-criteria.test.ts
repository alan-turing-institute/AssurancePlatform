import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { buildHealthCheckList } from "../fixtures/health-checks";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	appendRecord,
	importMachineRoute,
	machineGet,
	machinePost,
	wireRecord,
} from "../utils/health-adversarial-kit";
import {
	addPipeline,
	callCaseChecks,
	callCriteriaPut,
	callMachineCaseCriteria,
	callMachineCaseStatus,
	callMachineClaimCriteria,
	callMachineClaimStatus,
	callPublishChecks,
	callRetirement,
	itemSettings,
	saveBody,
	setupCriteriaCase,
} from "../utils/health-criteria-kit";
import {
	createTestElement,
	createTestPluginState,
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

const AUTH_FAILURE = "Invalid or expired token";
const CLAIM_NOT_FOUND = "Claim not found";

beforeEach(async () => {
	await mockNoAuth();
	vi.mocked(emitSSEEvent).mockClear();
});

async function setup() {
	const context = await setupCriteriaCase();
	await mockAuth(context.owner.id, context.owner.username, context.owner.email);
	return context;
}

async function accept(
	claimId: string,
	integrationId: string,
	settings: Record<string, unknown> = itemSettings()
) {
	const response = await callCriteriaPut(
		claimId,
		saveBody(integrationId, settings, true)
	);
	if (response.status !== 200) {
		throw new Error(`accept answered ${response.status}`);
	}
	return await response.json();
}

/** A record for the claim that echoes the accepted settings the pipeline read back. */
async function echoingRecord(
	claimId: string,
	secret: string,
	overrides: Record<string, unknown> = {}
) {
	const item = await (await callMachineClaimCriteria(claimId, secret)).json();
	return wireRecord(claimId, "populationPass", {
		check: item.check,
		rule: item.rule,
		reduction: item.reduction,
		aggregation: item.aggregation,
		window: item.window,
		valid_for: item.valid_for,
		...overrides,
	});
}

async function post(
	claimId: string,
	secret: string,
	record: Record<string, unknown>
) {
	const { POST } = await importMachineRoute();
	const response = await POST(machinePost(claimId, record, secret), {
		params: Promise.resolve({ id: claimId }),
	});
	return { response, body: await response.json() };
}

async function listEvidence(claimId: string, secret: string, query = "") {
	const { GET } = await importMachineRoute();
	const response = await GET(machineGet(claimId, secret, query), {
		params: Promise.resolve({ id: claimId }),
	});
	return (await response.json()).evidence as Record<string, unknown>[];
}

describe("PUT /api/machine/health/checks", () => {
	it("stores the list, replaces the previous one, and changes no claim's settings", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		const before = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});

		const first = await callPublishChecks(
			{ pipeline: "Replacement pipeline", checks: [] },
			context.secret
		);
		expect(first.status).toBe(200);
		expect(await first.json()).toEqual({ checks: 0, warnings: [] });

		const list = buildHealthCheckList();
		const second = await callPublishChecks(list, context.secret);
		expect(await second.json()).toEqual({ checks: 3, warnings: [] });
		const rows = await prisma.pluginHealthCheckCatalogue.findMany({
			where: { integrationId: context.integration.id },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]?.pipeline).toBe(list.pipeline);
		expect(rows[0]?.checks).toHaveLength(3);

		const after = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});
		expect(after).toEqual(before);
		const checks = await (await callCaseChecks(context.testCase.id)).json();
		expect(checks[0].pipeline).toBe(list.pipeline);
	});

	it("stores a recommendation that would not pass as settings and names it in warnings", async () => {
		const context = await setup();
		const list = buildHealthCheckList();
		const [first] = list.checks;
		const response = await callPublishChecks(
			{
				pipeline: "Warned pipeline",
				checks: [
					{
						...first,
						name: "Warned Check",
						recommended: {
							rule: { kind: "identity" },
							aggregation: {
								kind: "proportion",
								params: { threshold: 0.9, use_verdict: false },
							},
							window: "P1M",
						},
					},
					{
						name: "Text Check",
						version: "1",
						scope: "item",
						value: { type: "string" },
						recommended: { reduction: { kind: "last" } },
					},
				],
			},
			context.secret
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.checks).toBe(2);
		expect(body.warnings).toEqual([
			{
				check: "Warned Check",
				problem: "recommended.aggregation.params.use_verdict: must be true",
			},
			{
				check: "Warned Check",
				problem: "recommended.window: is not a valid duration",
			},
			{
				check: "Text Check",
				problem:
					"recommended.reduction: is not used by a check that returns text",
			},
		]);
		expect(await prisma.pluginHealthCheckCatalogue.count()).toBe(1);
	});

	it("refuses over 200 checks, a duplicate name and an unknown key with the field named", async () => {
		const context = await setup();
		const check = (name: string) => ({
			name,
			version: "1",
			scope: "item",
			value: { type: "boolean" },
		});
		const tooMany = await callPublishChecks(
			{
				pipeline: "p",
				checks: Array.from({ length: 201 }, (_, i) => check(`c${i}`)),
			},
			context.secret
		);
		expect(tooMany.status).toBe(400);
		expect((await tooMany.json()).error).toContain("checks:");

		const duplicate = await callPublishChecks(
			{ pipeline: "p", checks: [check("a"), check("a")] },
			context.secret
		);
		expect(duplicate.status).toBe(400);
		expect(await duplicate.json()).toMatchObject({
			error: "checks.1.name: is listed more than once",
		});

		const unknown = await callPublishChecks(
			{ pipeline: "p", checks: [], colour: "red" },
			context.secret
		);
		expect(unknown.status).toBe(400);
		expect((await unknown.json()).error).toBe(
			"colour: is not a recognised field"
		);
		expect(await prisma.pluginHealthCheckCatalogue.count()).toBe(1);
	});

	it("refuses a body over 256 KB with a 413", async () => {
		const context = await setup();
		const response = await callPublishChecks(
			{
				pipeline: "p",
				checks: [
					{
						name: "Big",
						version: "1",
						scope: "item",
						description: "x".repeat(300 * 1024),
						value: { type: "boolean" },
					},
				],
			},
			context.secret
		);
		expect(response.status).toBe(413);
	});

	it("refuses a missing token, a token without the scope, and a person's session", async () => {
		const context = await setup();
		const noScope = await addPipeline(context.owner.id, context.testCase.id, {
			scopes: ["case:read", "health:evidence:write"],
			publish: false,
		});
		const list = buildHealthCheckList();
		for (const token of [undefined, noScope.secret, "teap_not_a_token"]) {
			const response = await callPublishChecks(list, token);
			expect(response.status).toBe(401);
			expect((await response.json()).error).toBe(AUTH_FAILURE);
		}
	});

	it("refuses an integration whose plugin is switched off", async () => {
		const context = await setup();
		await createTestPluginState(context.systemUserId, {
			pluginId: "tea.health",
			enabled: false,
		});
		const response = await callPublishChecks(
			buildHealthCheckList(),
			context.secret
		);
		expect(response.status).toBe(403);
		expect((await response.json()).error).toBe(
			"Plugin 'tea.health' is not enabled"
		);
	});
});

describe("machine reads of the accepted settings", () => {
	it("returns only accepted settings, with version labels, and never a suggestion", async () => {
		const context = await setup();
		await callCriteriaPut(
			context.claim.id,
			saveBody(context.integration.id, itemSettings(), false)
		);
		expect(
			(await callMachineClaimCriteria(context.claim.id, context.secret)).status
		).toBe(404);
		const empty = await callMachineCaseCriteria(
			context.testCase.id,
			context.secret
		);
		expect(await empty.json()).toEqual({
			case_id: context.testCase.id,
			criteria: [],
		});

		await accept(context.claim.id, context.integration.id);
		const one = await callMachineClaimCriteria(
			context.claim.id,
			context.secret
		);
		expect(one.status).toBe(200);
		expect(await one.json()).toMatchObject({
			claim_ref: context.claim.id,
			state: "accepted",
			revision: 2,
			check: { name: "Surface Finish Check", version: "0.3", scope: "item" },
			rule: { kind: "identity", version: "r1" },
			reduction: { kind: "mean", version: "d1", rule: { version: "d1" } },
			aggregation: { kind: "proportion", version: "a1" },
			window: "PT1M",
			valid_for: "PT5M",
			source: { kind: "recommended" },
		});
		const all = await (
			await callMachineCaseCriteria(context.testCase.id, context.secret)
		).json();
		expect(all.criteria).toHaveLength(1);
		expect(all.criteria[0]).not.toHaveProperty("accepted_by");
	});

	it("returns only settings whose check came from the calling integration's list", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		const other = await addPipeline(context.owner.id, context.testCase.id);
		const second = await createTestElement(
			context.testCase.id,
			context.owner.id,
			{
				elementType: "PROPERTY_CLAIM",
			}
		);
		await accept(second.id, other.integration.id);

		const mine = await (
			await callMachineCaseCriteria(context.testCase.id, context.secret)
		).json();
		expect(
			mine.criteria.map((item: { claim_ref: string }) => item.claim_ref)
		).toEqual([context.claim.id]);
		const theirs = await (
			await callMachineCaseCriteria(context.testCase.id, other.secret)
		).json();
		expect(
			theirs.criteria.map((item: { claim_ref: string }) => item.claim_ref)
		).toEqual([second.id]);
		expect(
			(await callMachineClaimCriteria(second.id, context.secret)).status
		).toBe(404);
	});

	it("records the read and the revision served without changing updated_at", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		const before = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});
		expect(before.lastReadAt).toBeNull();

		const served = await (
			await callMachineClaimCriteria(context.claim.id, context.secret)
		).json();
		const after = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});
		expect(after.lastReadAt).not.toBeNull();
		expect(after.lastReadRevision).toBe(served.revision);
		expect(after.updatedAt).toEqual(before.updatedAt);
		expect(served.updated_at).toBe(before.updatedAt.toISOString());

		await callMachineCaseCriteria(context.testCase.id, context.secret);
		const viaCase = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});
		expect(viaCase.lastReadAt?.getTime()).toBeGreaterThanOrEqual(
			after.lastReadAt?.getTime() ?? 0
		);
	});

	it("shows a person when the pipeline read, and an earlier revision after an edit", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		await callMachineClaimCriteria(context.claim.id, context.secret);
		const edited = await accept(
			context.claim.id,
			context.integration.id,
			itemSettings({ valid_for: "PT10M" })
		);
		expect(edited.pipeline_read.revision).toBe(1);
		expect(edited.criteria.revision).toBe(2);
		expect(edited.pipeline_read.at).toEqual(expect.any(String));
	});

	it("refuses a token without the scope, no token, a claim it cannot view, and a missing claim alike", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		const noScope = await addPipeline(context.owner.id, context.testCase.id, {
			scopes: ["case:read"],
		});
		for (const token of [undefined, noScope.secret]) {
			expect(
				(await callMachineClaimCriteria(context.claim.id, token)).status
			).toBe(401);
			expect(
				(await callMachineCaseCriteria(context.testCase.id, token)).status
			).toBe(401);
		}

		await prisma.casePermission.deleteMany({
			where: { userId: context.systemUserId },
		});
		const missing = "7acd824e-0000-4000-8000-0000000000dd";
		for (const claimId of [context.claim.id, missing]) {
			const response = await callMachineClaimCriteria(claimId, context.secret);
			expect(response.status).toBe(404);
			expect((await response.json()).error).toBe(CLAIM_NOT_FOUND);
		}
		for (const caseId of [context.testCase.id, missing]) {
			const response = await callMachineCaseCriteria(caseId, context.secret);
			expect(response.status).toBe(404);
			expect((await response.json()).error).toBe("Case not found");
		}
	});

	it("serves a VIEW-only integration the settings it may read", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		await prisma.casePermission.updateMany({
			where: { userId: context.systemUserId },
			data: { permission: "VIEW" },
		});
		expect(
			(await callMachineClaimCriteria(context.claim.id, context.secret)).status
		).toBe(200);
	});

	it("stops serving retired settings", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		await callRetirement(context.claim.id, { reason: "Stopped" });
		expect(
			(await callMachineClaimCriteria(context.claim.id, context.secret)).status
		).toBe(404);
	});
});

describe("the echo check through the machine route", () => {
	it("stores a record that echoes the settings as a match", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		const { response, body } = await post(
			context.claim.id,
			context.secret,
			await echoingRecord(context.claim.id, context.secret)
		);
		expect(response.status).toBe(201);
		expect(body.status.mismatch).toBeNull();

		const [item] = await listEvidence(context.claim.id, context.secret);
		expect(item).toMatchObject({
			echo_state: "match",
			echo_differences: null,
			criteria_revision: 1,
		});
	});

	it("treats PT60S against a declared PT1M as a match", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		const { response } = await post(
			context.claim.id,
			context.secret,
			await echoingRecord(context.claim.id, context.secret, {
				window: "PT60S",
				valid_for: "PT300S",
			})
		);
		expect(response.status).toBe(201);
		const [item] = await listEvidence(context.claim.id, context.secret);
		expect(item?.echo_state).toBe("match");
	});

	it("stores a record with an old rule version, flagged, and lists the difference", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		await accept(
			context.claim.id,
			context.integration.id,
			itemSettings({ rule: { kind: "identity", params: { note: 1 } } })
		);
		const record = await echoingRecord(context.claim.id, context.secret);
		const { response, body } = await post(context.claim.id, context.secret, {
			...record,
			rule: { kind: "identity", version: "r1" },
		});
		expect(response.status).toBe(201);
		expect(body.status.mismatch).toEqual({
			state: "mismatch",
			differences: [{ field: "rule.version", declared: "r2", used: "r1" }],
		});
		const [item] = await listEvidence(context.claim.id, context.secret);
		expect(item).toMatchObject({
			echo_state: "mismatch",
			echo_differences: [{ field: "rule.version", declared: "r2", used: "r1" }],
			criteria_revision: 2,
		});
	});

	it("lists a different window and a different check setting", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		const record = (await echoingRecord(context.claim.id, context.secret, {
			window: "PT2M",
		})) as { check: Record<string, unknown> };
		const { response } = await post(context.claim.id, context.secret, {
			...record,
			check: { ...record.check, params: { camera_line: "B" } },
		});
		expect(response.status).toBe(201);
		const [item] = await listEvidence(context.claim.id, context.secret);
		expect(item?.echo_differences).toEqual([
			{
				field: "check.params",
				declared: { camera_line: "ALL" },
				used: { camera_line: "B" },
			},
			{ field: "window", declared: "PT1M", used: "PT2M" },
		]);
	});

	it("stores a record for a claim with no accepted settings as undeclared", async () => {
		const context = await setup();
		const record = wireRecord(context.claim.id, "populationPass", {
			check: { name: "Surface Finish Check", version: "0.3", scope: "item" },
		});
		const { response, body } = await post(
			context.claim.id,
			context.secret,
			record
		);
		expect(response.status).toBe(201);
		expect(body.status.mismatch).toEqual({ state: "undeclared" });
		const [item] = await listEvidence(context.claim.id, context.secret);
		expect(item).toMatchObject({
			echo_state: "undeclared",
			echo_differences: null,
			criteria_revision: null,
		});
	});

	it("does not compare against a suggestion", async () => {
		const context = await setup();
		await callCriteriaPut(
			context.claim.id,
			saveBody(context.integration.id, itemSettings(), false)
		);
		await post(
			context.claim.id,
			context.secret,
			wireRecord(context.claim.id, "populationPass")
		);
		const [item] = await listEvidence(context.claim.id, context.secret);
		expect(item?.echo_state).toBe("undeclared");
	});

	it("keeps what was stored when the settings change afterwards", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		await post(
			context.claim.id,
			context.secret,
			await echoingRecord(context.claim.id, context.secret)
		);
		await accept(
			context.claim.id,
			context.integration.id,
			itemSettings({ window: "PT3M" })
		);
		const [item] = await listEvidence(context.claim.id, context.secret);
		expect(item?.echo_state).toBe("match");
	});
});

describe("the mismatch state of a claim's status", () => {
	it("is null with no result, undeclared without settings, and flagged at once when settings change", async () => {
		const context = await setup();
		const claimId = context.claim.id;
		const status = async () =>
			(await (await callMachineClaimStatus(claimId, context.secret)).json())
				.status;

		expect(await status()).toBeNull();
		await appendRecord(context.systemUserId, claimId, "populationPass", {
			check: { name: "Surface Finish Check", version: "0.3", scope: "item" },
		});
		expect((await status()).mismatch).toEqual({ state: "undeclared" });

		await accept(claimId, context.integration.id);
		const flagged = (await status()).mismatch;
		expect(flagged.state).toBe("mismatch");
		expect(
			flagged.differences.map((d: { field: string }) => d.field)
		).toContain("valid_for");

		const { response } = await post(
			claimId,
			context.secret,
			await echoingRecord(claimId, context.secret, {
				timestamp: new Date(Date.now() - 1000).toISOString(),
			})
		);
		expect(response.status).toBe(201);
		expect((await status()).mismatch).toBeNull();

		await accept(
			claimId,
			context.integration.id,
			itemSettings({ window: "PT3M" })
		);
		expect((await status()).mismatch).toMatchObject({
			state: "mismatch",
			differences: [{ field: "window", declared: "PT3M", used: "PT1M" }],
		});

		await callRetirement(claimId, { reason: "Stopped" });
		expect((await status()).mismatch).toEqual({ state: "undeclared" });
	});

	it("is on the session status route, the case status route and the live-update event", async () => {
		const context = await setup();
		await accept(context.claim.id, context.integration.id);
		vi.mocked(emitSSEEvent).mockClear();
		await post(
			context.claim.id,
			context.secret,
			await echoingRecord(context.claim.id, context.secret, {
				rule: { kind: "identity", version: "r9" },
			})
		);
		expect(vi.mocked(emitSSEEvent)).toHaveBeenCalledWith(
			"tea.health/state-changed",
			context.testCase.id,
			expect.objectContaining({
				status: expect.objectContaining({
					mismatch: expect.objectContaining({ state: "mismatch" }),
				}),
			})
		);

		const { callStatus } = await import("../utils/health-adversarial-kit");
		const session = (await (await callStatus(context.claim.id)).json()).status;
		expect(session.mismatch.state).toBe("mismatch");

		const caseStatus = await (
			await callMachineCaseStatus(context.testCase.id, context.secret)
		).json();
		expect(caseStatus.case_id).toBe(context.testCase.id);
		expect(caseStatus.statuses).toHaveLength(1);
		expect(caseStatus.statuses[0].claim_ref).toBe(context.claim.id);
		expect(caseStatus.statuses[0].status.mismatch.state).toBe("mismatch");
	});

	it("refuses the status routes to a token without the scope and to a missing or inaccessible target alike", async () => {
		const context = await setup();
		const noScope = await addPipeline(context.owner.id, context.testCase.id, {
			scopes: ["case:read"],
		});
		expect(
			(await callMachineClaimStatus(context.claim.id, noScope.secret)).status
		).toBe(401);
		expect((await callMachineCaseStatus(context.testCase.id)).status).toBe(401);

		const stranger = await createTestUser();
		const elsewhere = await addPipeline(
			stranger.id,
			(await outsideCase(stranger.id)).id
		);
		const missing = "7acd824e-0000-4000-8000-0000000000ee";
		const inaccessible = await callMachineClaimStatus(
			context.claim.id,
			elsewhere.secret
		);
		const absent = await callMachineClaimStatus(missing, elsewhere.secret);
		expect(inaccessible.status).toBe(404);
		expect(await inaccessible.json()).toEqual(await absent.json());
	});
});

async function outsideCase(ownerId: string) {
	const { createTestCase } = await import("../utils/prisma-factories");
	return createTestCase(ownerId);
}

describe("GET evidence with live=true", () => {
	it("returns only records that are not revoked and have not expired", async () => {
		const context = await setup();
		const claimId = context.claim.id;
		const fresh = await appendRecord(
			context.systemUserId,
			claimId,
			"singleSubject",
			{
				check: { name: "Surface Finish Check", version: "0.3", scope: "item" },
				valid_for: "PT1H",
				valid_while: undefined,
				timestamp: new Date(Date.now() - 60_000).toISOString(),
			}
		);
		const expired = await appendRecord(
			context.systemUserId,
			claimId,
			"singleSubject",
			{
				check: { name: "Surface Finish Check", version: "0.3", scope: "item" },
				valid_for: "PT1M",
				valid_while: undefined,
				timestamp: new Date(Date.now() - 3_600_000).toISOString(),
			}
		);
		const revoked = await appendRecord(
			context.systemUserId,
			claimId,
			"singleSubject",
			{
				check: { name: "Surface Finish Check", version: "0.3", scope: "item" },
				valid_for: "indefinite",
				valid_while: undefined,
				timestamp: new Date(Date.now() - 120_000).toISOString(),
			}
		);
		const forever = await appendRecord(
			context.systemUserId,
			claimId,
			"singleSubject",
			{
				check: { name: "Surface Finish Check", version: "0.3", scope: "item" },
				valid_for: "indefinite",
				valid_while: undefined,
				timestamp: new Date(Date.now() - 180_000).toISOString(),
			}
		);
		const { callRevoke } = await import("../utils/health-adversarial-kit");
		await callRevoke(claimId, revoked.record_id);

		const all = await listEvidence(context.claim.id, context.secret);
		expect(all).toHaveLength(4);
		const live = await listEvidence(claimId, context.secret, "?live=true");
		const ids = live.map(
			(item) => (item.record as { record_id: string }).record_id
		);
		expect(ids.sort()).toEqual([fresh.record_id, forever.record_id].sort());
		expect(ids).not.toContain(expired.record_id);
		const notLive = await listEvidence(claimId, context.secret, "?live=false");
		expect(notLive).toHaveLength(4);
	});
});
