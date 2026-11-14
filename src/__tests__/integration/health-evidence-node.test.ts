import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import { getPublishedItemBySlug } from "@/lib/services/discover-service";
import { deleteElement } from "@/lib/services/element-service";
import { isConcurrentChange } from "@/lib/services/health-criteria-service";
import { readHealthStatus } from "@/lib/services/health-status-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { Prisma } from "@/src/generated/prisma";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
} from "../fixtures/health-checks";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { addClaim, appendRecord } from "../utils/health-adversarial-kit";
import {
	callAddEvidenceNode,
	callCriteriaGet,
	callCriteriaPut,
	callEvidenceNodes,
	callRetirement,
	itemSettings,
	saveBody,
	setupCriteriaCase,
} from "../utils/health-criteria-kit";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
	enableTestPlugin,
} from "../utils/prisma-factories";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

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

const CASE_CHANGED = "The case changed while you were saving. Try again.";
const CLAIM_NOT_FOUND = "Claim not found";
const CASE_NOT_FOUND = "Case not found";
const NOT_ACCEPTED = "These settings are not accepted";
const LIVE_NODE_EXISTS = "This claim already has a live evidence node";

const ITEM_TEXT = `Results from the ${ITEM_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: Is the surface of the item free of visible marks?`;
const NUMERIC_TEXT = `Results from the ${NUMERIC_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: How far the edge of the item sits from its expected position.`;

const NUMERIC_SETTINGS = {
	check: { name: NUMERIC_CHECK_NAME, version: "1.1" },
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

beforeEach(async () => {
	await mockNoAuth();
	vi.mocked(emitSSEEvent).mockClear();
});

async function asUser(user: { id: string; username: string; email: string }) {
	await mockAuth(user.id, user.username, user.email);
}

async function signedInWith(
	caseId: string,
	grantedById: string,
	permission: "VIEW" | "COMMENT" | "EDIT"
) {
	const user = await createTestUser();
	await enableTestPlugin(user.id, "tea.health");
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
	await enableTestPlugin(user.id, "tea.health");
	const team = await createTestTeam(grantedById);
	await addTeamMember(team.id, user.id, "MEMBER");
	await createTestTeamPermission(caseId, team.id, grantedById, permission);
	await asUser(user);
	return user;
}

async function setup() {
	const context = await setupCriteriaCase();
	await asUser(context.owner);
	return context;
}

type Context = Awaited<ReturnType<typeof setup>>;

/** Sends a settings save as the signed-in person and returns the status and body. */
async function put(
	context: Context,
	options: {
		accept?: boolean;
		extra?: Record<string, unknown>;
		settings?: Record<string, unknown>;
	} = {}
) {
	const response = await callCriteriaPut(context.claim.id, {
		...saveBody(
			context.integration.id,
			options.settings ?? itemSettings(),
			options.accept ?? true
		),
		...options.extra,
	});
	return { status: response.status, body: await response.json() };
}

/** Accepts the demo settings and asks for the node. */
async function acceptWithNode(context: Context) {
	const saved = await put(context, { extra: { add_evidence_node: true } });
	if (saved.status !== 200) {
		throw new Error(
			`accept answered ${saved.status}: ${JSON.stringify(saved.body)}`
		);
	}
	return saved.body;
}

async function retire(
	context: Context,
	choice?: "keep" | "remove",
	reason: string | null = "Superseded by new settings"
) {
	const response = await callRetirement(context.claim.id, {
		...(reason === null ? {} : { reason }),
		...(choice ? { evidence_node: choice } : {}),
	});
	return { status: response.status, body: await response.json() };
}

const evidenceIn = (caseId: string) =>
	prisma.assuranceElement.findMany({
		where: { caseId, elementType: "EVIDENCE" },
		orderBy: { createdAt: "asc" },
	});

const criteriaOf = (claimId: string) =>
	prisma.pluginHealthCriteria.findUniqueOrThrow({ where: { claimId } });

async function liveNodes(caseId: string) {
	const response = await callEvidenceNodes(caseId);
	if (response.status !== 200) {
		throw new Error(`the list answered ${response.status}`);
	}
	return (await response.json()) as {
		id: string;
		name: string | null;
		claim_id: string;
		claim_name: string | null;
		status: { verdict: string | null } | null;
	}[];
}

async function nodeStateOf(claimId: string) {
	const response = await callCriteriaGet(claimId);
	return (await response.json()).evidence_node;
}

/** POST /api/cases/[id]/batch, the JSON editor's save. */
async function postBatch(caseId: string, changes: unknown[]) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
			method: "POST",
			body: JSON.stringify({ changes }),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

describe("accepting settings adds the evidence node", () => {
	it("adds one evidence node under the claim, created by the accepting person, in the same save", async () => {
		const context = await setup();
		await createTestElement(context.testCase.id, context.owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
		});
		const editor = await signedInWith(
			context.testCase.id,
			context.owner.id,
			"EDIT"
		);

		const body = await acceptWithNode(context);

		const nodes = (await evidenceIn(context.testCase.id)).filter(
			(node) => node.createdById === editor.id
		);
		expect(nodes).toHaveLength(1);
		const [node] = nodes;
		expect(node).toMatchObject({
			name: "E2",
			description: ITEM_TEXT,
			url: null,
			inSandbox: false,
			deletedAt: null,
		});
		expect(
			await prisma.evidenceLink.findMany({ where: { evidenceId: node?.id } })
		).toMatchObject([{ claimId: context.claim.id }]);
		expect((await criteriaOf(context.claim.id)).evidenceElementId).toBe(
			node?.id
		);
		expect(body.evidence_node).toEqual({
			id: node?.id,
			name: "E2",
			state: "live",
		});
	});

	it("tells open browsers about the new element before it announces the health change", async () => {
		const context = await setup();

		await acceptWithNode(context);

		const events = vi.mocked(emitSSEEvent).mock.calls.map((call) => call[0]);
		expect(events).toEqual(["element:created", "tea.health/state-changed"]);
	});

	it("adds no node without the field, and none when it is false", async () => {
		const context = await setup();

		const plain = await put(context);
		expect(plain.body.evidence_node).toBeNull();
		const unticked = await put(context, {
			extra: { add_evidence_node: false },
		});

		expect(unticked.status).toBe(200);
		expect(await evidenceIn(context.testCase.id)).toHaveLength(0);
		expect((await criteriaOf(context.claim.id)).evidenceElementId).toBeNull();
	});

	it("adds nothing when the save is refused", async () => {
		const context = await setup();
		const unknownCheck = itemSettings({
			check: { name: "No Such Check", version: "9" },
		});

		const refused = await put(context, {
			settings: unknownCheck,
			extra: { add_evidence_node: true },
		});

		expect(refused.status).toBe(400);
		expect(await evidenceIn(context.testCase.id)).toHaveLength(0);
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
	});
});

describe("a claim has at most one live node", () => {
	it("refuses add_evidence_node on a suggestion and on an edit of accepted settings, and stores nothing", async () => {
		const context = await setup();

		const suggestion = await put(context, {
			accept: false,
			extra: { add_evidence_node: true },
		});
		expect(suggestion.status).toBe(400);
		expect(suggestion.body.fieldErrors).toHaveProperty("add_evidence_node");
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);

		await put(context);
		const edit = await put(context, { extra: { add_evidence_node: true } });
		expect(edit.status).toBe(400);
		expect(edit.body.fieldErrors).toHaveProperty("add_evidence_node");
		expect(await evidenceIn(context.testCase.id)).toHaveLength(0);
		expect((await criteriaOf(context.claim.id)).revision).toBe(1);
	});

	it("does not add a second node to a claim that already has a live one", async () => {
		const context = await setup();
		await acceptWithNode(context);
		await retire(context, "keep");

		const again = await acceptWithNode(context);

		expect(await evidenceIn(context.testCase.id)).toHaveLength(1);
		expect(again.evidence_node).toMatchObject({ state: "live" });
	});

	it("brings back the kept node when settings are accepted again, with or without the field", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		await retire(context);
		expect((await liveNodes(context.testCase.id)).length).toBe(0);

		const plain = await put(context);

		expect(plain.body.evidence_node).toEqual(first.evidence_node);
		expect(await evidenceIn(context.testCase.id)).toHaveLength(1);
		expect((await liveNodes(context.testCase.id)).map((n) => n.id)).toEqual([
			first.evidence_node.id,
		]);
	});

	it.each([
		["with the node option", { add_evidence_node: true }],
		["without the node option", {}],
	])("rewrites the kept node's text when stopped settings are accepted again with a different check, %s", async (_label, node) => {
		const context = await setup();
		const first = await acceptWithNode(context);
		await retire(context, "keep");
		vi.mocked(emitSSEEvent).mockClear();

		const again = await put(context, {
			settings: NUMERIC_SETTINGS,
			extra: { ...node, update_evidence_node_text: true },
		});

		expect(again.status).toBe(200);
		expect(again.body.evidence_node).toEqual(first.evidence_node);
		const nodes = await evidenceIn(context.testCase.id);
		expect(nodes).toHaveLength(1);
		expect(nodes[0]).toMatchObject({
			id: first.evidence_node.id,
			description: NUMERIC_TEXT,
		});
		expect((await criteriaOf(context.claim.id)).checkName).toBe(
			NUMERIC_CHECK_NAME
		);
		expect(vi.mocked(emitSSEEvent).mock.calls.map((call) => call[0])).toEqual([
			"element:updated",
			"tea.health/state-changed",
		]);
	});

	it("refuses to rewrite the kept node's text when stopped settings are accepted again with the same check, and stores nothing", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		await retire(context, "keep");
		const before = await criteriaOf(context.claim.id);

		const refused = await put(context, {
			extra: { add_evidence_node: true, update_evidence_node_text: true },
		});

		expect(refused.status).toBe(400);
		expect(refused.body.fieldErrors).toHaveProperty(
			"update_evidence_node_text"
		);
		const after = await criteriaOf(context.claim.id);
		expect(after.state).toBe("INACTIVE");
		expect(after.revision).toBe(before.revision);
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});
		expect(node.description).toBe(ITEM_TEXT);
	});

	it("replaces the pointer with a new node when the kept node was trashed or moved", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		await retire(context);
		expectSuccess(
			await deleteElement(context.owner.id, first.evidence_node.id)
		);

		const second = await acceptWithNode(context);

		expect(second.evidence_node.id).not.toBe(first.evidence_node.id);
		expect((await criteriaOf(context.claim.id)).evidenceElementId).toBe(
			second.evidence_node.id
		);

		const other = await addClaim(context.testCase.id, context.owner.id);
		await prisma.evidenceLink.deleteMany({
			where: { evidenceId: second.evidence_node.id },
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: second.evidence_node.id, claimId: other.id },
		});
		await retire(context);

		const third = await acceptWithNode(context);

		expect(third.evidence_node.id).not.toBe(second.evidence_node.id);
		expect(
			await prisma.evidenceLink.count({
				where: { evidenceId: second.evidence_node.id, claimId: other.id },
			})
		).toBe(1);
	});
});

describe("changing the check of accepted settings", () => {
	it("leaves the node's text alone when the check changes without the option", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		vi.mocked(emitSSEEvent).mockClear();

		await put(context, { settings: NUMERIC_SETTINGS });
		const unticked = await put(context, {
			settings: itemSettings(),
			extra: { update_evidence_node_text: false },
		});

		expect(unticked.status).toBe(200);
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});
		expect(node.description).toBe(ITEM_TEXT);
		expect(
			vi.mocked(emitSSEEvent).mock.calls.map((call) => call[0])
		).not.toContain("element:updated");
	});

	it("rewrites the description to the new check's text", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);

		const rewritten = await put(context, {
			settings: NUMERIC_SETTINGS,
			extra: { update_evidence_node_text: true },
		});

		expect(rewritten.status).toBe(200);
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});
		expect(node.description).toBe(NUMERIC_TEXT);
		expect(rewritten.body.evidence_node).toMatchObject({ state: "live" });
		expect(vi.mocked(emitSSEEvent).mock.calls.map((call) => call[0])).toEqual([
			"element:created",
			"tea.health/state-changed",
			"element:updated",
			"tea.health/state-changed",
		]);
	});

	it("refuses update_evidence_node_text when the check does not change, and stores nothing", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);

		const refused = await put(context, {
			extra: { update_evidence_node_text: true },
		});

		expect(refused.status).toBe(400);
		expect(refused.body.fieldErrors).toHaveProperty(
			"update_evidence_node_text"
		);
		expect((await criteriaOf(context.claim.id)).revision).toBe(1);
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});
		expect(node.description).toBe(ITEM_TEXT);
	});

	it("refuses update_evidence_node_text when the claim has no node, or the node is not live", async () => {
		const noNode = await setup();
		await put(noNode);
		const withoutNode = await put(noNode, {
			settings: NUMERIC_SETTINGS,
			extra: { update_evidence_node_text: true },
		});
		expect(withoutNode.status).toBe(400);
		expect(withoutNode.body.fieldErrors).toHaveProperty(
			"update_evidence_node_text"
		);

		const trashed = await setup();
		const first = await acceptWithNode(trashed);
		expectSuccess(
			await deleteElement(trashed.owner.id, first.evidence_node.id)
		);
		const refused = await put(trashed, {
			settings: NUMERIC_SETTINGS,
			extra: { update_evidence_node_text: true },
		});
		expect(refused.status).toBe(400);
		expect((await criteriaOf(trashed.claim.id)).checkName).toBe(
			ITEM_CHECK_NAME
		);
	});

	it("refuses update_evidence_node_text on a first acceptance", async () => {
		const context = await setup();

		const refused = await put(context, {
			extra: { update_evidence_node_text: true },
		});

		expect(refused.status).toBe(400);
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
	});
});

describe("retiring settings that have a node", () => {
	it("removes a live node by trashing it and forgetting it, and says so before the health change", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		vi.mocked(emitSSEEvent).mockClear();

		const retired = await retire(context, "remove");

		expect(retired.status).toBe(200);
		expect(retired.body.evidence_node).toBeNull();
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});
		expect(node.deletedAt).not.toBeNull();
		expect(node.deletedById).toBe(context.owner.id);
		expect((await criteriaOf(context.claim.id)).evidenceElementId).toBeNull();
		expect(vi.mocked(emitSSEEvent).mock.calls.map((call) => call[0])).toEqual([
			"element:deleted",
			"tea.health/state-changed",
		]);
	});

	it("only takes this claim's link off a node that supports another claim", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const other = await addClaim(context.testCase.id, context.owner.id);
		await prisma.evidenceLink.create({
			data: { evidenceId: first.evidence_node.id, claimId: other.id },
		});

		const retired = await retire(context, "remove");

		expect(retired.body.evidence_node).toBeNull();
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});
		expect(node.deletedAt).toBeNull();
		const links = await prisma.evidenceLink.findMany({
			where: { evidenceId: first.evidence_node.id },
		});
		expect(links.map((link) => link.claimId)).toEqual([other.id]);
		expect((await criteriaOf(context.claim.id)).evidenceElementId).toBeNull();
	});

	it("trashes a node whose only other link is to a claim in the trash", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const other = await addClaim(context.testCase.id, context.owner.id);
		await prisma.evidenceLink.create({
			data: { evidenceId: first.evidence_node.id, claimId: other.id },
		});
		await prisma.assuranceElement.update({
			where: { id: other.id },
			data: { deletedAt: new Date() },
		});

		const retired = await retire(context, "remove");

		expect(retired.status).toBe(200);
		expect(retired.body.evidence_node).toBeNull();
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});
		expect(node.deletedAt).not.toBeNull();
		expect((await criteriaOf(context.claim.id)).evidenceElementId).toBeNull();
	});

	it("leaves the node as it was with keep or with no choice", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const nodeId = first.evidence_node.id;

		const kept = await retire(context, "keep");
		expect(kept.body.evidence_node).toEqual(first.evidence_node);
		await put(context);
		const unchosen = await retire(context);

		expect(unchosen.body.evidence_node).toEqual(first.evidence_node);
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: nodeId },
		});
		expect(node.deletedAt).toBeNull();
		expect(
			await prisma.evidenceLink.count({ where: { evidenceId: nodeId } })
		).toBe(1);
	});

	it("does nothing about the node when it is not live, or the settings were only a suggestion", async () => {
		const trashed = await setup();
		const first = await acceptWithNode(trashed);
		expectSuccess(
			await deleteElement(trashed.owner.id, first.evidence_node.id)
		);
		const before = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});

		const retired = await retire(trashed, "remove");

		expect(retired.status).toBe(200);
		expect(retired.body.evidence_node).toMatchObject({ state: "trashed" });
		expect((await criteriaOf(trashed.claim.id)).evidenceElementId).toBe(
			first.evidence_node.id
		);
		const after = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: first.evidence_node.id },
		});
		expect(after.deletedAt).toEqual(before.deletedAt);

		const suggestion = await setup();
		const kept = await acceptWithNode(suggestion);
		await retire(suggestion, "keep");
		await put(suggestion, { accept: false });
		const discarded = await retire(suggestion, "remove", null);
		expect(discarded.status).toBe(200);
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: kept.evidence_node.id },
		});
		expect(node.deletedAt).toBeNull();
	});

	it("refuses an evidence_node choice other than keep or remove", async () => {
		const context = await setup();
		await acceptWithNode(context);

		const response = await callRetirement(context.claim.id, {
			reason: "Superseded by new settings",
			evidence_node: "delete",
		});

		expect(response.status).toBe(400);
		expect(await prisma.pluginHealthCriteria.count()).toBe(1);
		expect((await prisma.pluginHealthCriteria.findFirstOrThrow()).state).toBe(
			"ACCEPTED"
		);
	});
});

describe("where the node is, and when it is live", () => {
	async function stateAfter(
		change: (context: Context, nodeId: string) => Promise<void>
	) {
		const context = await setup();
		const first = await acceptWithNode(context);
		const nodeId = first.evidence_node.id;
		await change(context, nodeId);
		const listed = (await liveNodes(context.testCase.id)).map((n) => n.id);
		return {
			state: (await nodeStateOf(context.claim.id))?.state,
			live: listed.includes(nodeId),
		};
	}

	it.each([
		[
			"it is in the trash",
			"trashed",
			async (context: Context, nodeId: string) => {
				expectSuccess(await deleteElement(context.owner.id, nodeId));
			},
		],
		[
			"it is linked to another claim",
			"moved",
			async (context: Context, nodeId: string) => {
				const other = await addClaim(context.testCase.id, context.owner.id);
				await prisma.evidenceLink.deleteMany({ where: { evidenceId: nodeId } });
				await prisma.evidenceLink.create({
					data: { evidenceId: nodeId, claimId: other.id },
				});
			},
		],
		[
			"it is detached to the sandbox",
			"moved",
			async (_context: Context, nodeId: string) => {
				await prisma.assuranceElement.update({
					where: { id: nodeId },
					data: { inSandbox: true },
				});
			},
		],
		[
			"it is made a defeater",
			"moved",
			async (_context: Context, nodeId: string) => {
				await prisma.assuranceElement.update({
					where: { id: nodeId },
					data: { isDefeater: true },
				});
			},
		],
	] as const)("is not live when %s, and is live again when it is undone", async (_when, expected, change) => {
		const broken = await stateAfter(change);
		expect(broken).toEqual({ state: expected, live: false });

		const context = await setup();
		const first = await acceptWithNode(context);
		expect(await nodeStateOf(context.claim.id)).toMatchObject({
			id: first.evidence_node.id,
			state: "live",
		});
		expect((await liveNodes(context.testCase.id)).map((n) => n.id)).toEqual([
			first.evidence_node.id,
		]);
	});

	it("is live again when a trashed node is restored", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const nodeId = first.evidence_node.id;
		expectSuccess(await deleteElement(context.owner.id, nodeId));
		expect(await liveNodes(context.testCase.id)).toEqual([]);

		await prisma.assuranceElement.update({
			where: { id: nodeId },
			data: { deletedAt: null, deletedById: null },
		});

		expect((await liveNodes(context.testCase.id)).map((n) => n.id)).toEqual([
			nodeId,
		]);
	});

	it("reports no node when the node row is gone, because the database clears the pointer", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);

		await prisma.assuranceElement.delete({
			where: { id: first.evidence_node.id },
		});

		expect(await nodeStateOf(context.claim.id)).toBeNull();
		expect(await liveNodes(context.testCase.id)).toEqual([]);
		expect((await criteriaOf(context.claim.id)).evidenceElementId).toBeNull();
	});

	it("is not live while the settings are retired or the claim is in the trash", async () => {
		const retired = await setup();
		const first = await acceptWithNode(retired);
		await retire(retired);
		expect(await liveNodes(retired.testCase.id)).toEqual([]);
		expect(await nodeStateOf(retired.claim.id)).toMatchObject({
			id: first.evidence_node.id,
			state: "live",
		});

		const trashed = await setup();
		await acceptWithNode(trashed);
		await prisma.assuranceElement.update({
			where: { id: trashed.claim.id },
			data: { deletedAt: new Date() },
		});
		expect(await liveNodes(trashed.testCase.id)).toEqual([]);
	});

	it("never counts a node in another case", async () => {
		const context = await setup();
		await acceptWithNode(context);
		const elsewhere = await createTestCase(context.owner.id);
		const stranger = await createTestElement(elsewhere.id, context.owner.id, {
			elementType: "EVIDENCE",
			name: "E7",
		});
		await prisma.pluginHealthCriteria.update({
			where: { claimId: context.claim.id },
			data: { evidenceElementId: stranger.id },
		});

		expect(await liveNodes(context.testCase.id)).toEqual([]);
		expect(await nodeStateOf(context.claim.id)).toEqual({
			id: stranger.id,
			name: null,
			state: "missing",
		});
	});

	it("lists each live node with its claim and the status the claim's badge shows", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const bare = await addClaim(context.testCase.id, context.owner.id);
		await appendRecord(
			context.systemUserId,
			context.claim.id,
			"populationPass",
			{
				check: { name: ITEM_CHECK_NAME, version: "0.3", scope: "item" },
			}
		);

		const listed = await liveNodes(context.testCase.id);

		const status = expectSuccess(
			await readHealthStatus(context.owner.id, context.claim.id)
		);
		expect(listed).toEqual([
			{
				id: first.evidence_node.id,
				name: first.evidence_node.name,
				claim_id: context.claim.id,
				claim_name: context.claim.name,
				status,
			},
		]);
		expect(listed.some((item) => item.claim_id === bare.id)).toBe(false);
		expect(status?.verdict).toBe("pass");
	});
});

describe("GET /api/cases/[id]/health/evidence-nodes", () => {
	it.each([
		["owner"],
		["VIEW"],
		["COMMENT"],
		["EDIT"],
		["team VIEW"],
		["team EDIT"],
	] as const)("lets %s read the list", async (who) => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const { testCase, owner } = context;
		if (who === "team VIEW" || who === "team EDIT") {
			await signedInThroughTeam(
				testCase.id,
				owner.id,
				who === "team VIEW" ? "VIEW" : "EDIT"
			);
		} else if (who !== "owner") {
			await signedInWith(testCase.id, owner.id, who);
		}

		const response = await callEvidenceNodes(testCase.id);

		expect(response.status).toBe(200);
		expect((await response.json()).map((n: { id: string }) => n.id)).toEqual([
			first.evidence_node.id,
		]);
	});

	it("gives a person without access the same answer as for a missing case", async () => {
		const context = await setup();
		await acceptWithNode(context);
		const stranger = await createTestUser();
		await enableTestPlugin(stranger.id, "tea.health");
		await asUser(stranger);
		const missing = "7acd824e-0000-4000-8000-0000000000cc";

		for (const caseId of [context.testCase.id, missing]) {
			const response = await callEvidenceNodes(caseId);
			expect(response.status).toBe(404);
			expect((await response.json()).error).toBe(CASE_NOT_FOUND);
		}
	});

	it("refuses an unauthenticated request, a machine token and a person who has switched the plugin off", async () => {
		const context = await setup();
		await acceptWithNode(context);

		await mockNoAuth();
		expect((await callEvidenceNodes(context.testCase.id)).status).toBe(401);
		expect(
			(await callEvidenceNodes(context.testCase.id, context.secret)).status
		).toBe(401);

		await asUser(context.owner);
		await setPluginEnabledForUser("tea.health", context.owner.id, {
			enabled: false,
		});
		const off = await callEvidenceNodes(context.testCase.id);
		expect(off.status).toBe(403);
		expect((await off.json()).error).toBe("Plugin 'tea.health' is not enabled");
	});
});

describe("POST /api/elements/[id]/health/evidence-node", () => {
	/** Accepted settings with no node, the state every claim accepted before this change is in. */
	async function acceptedWithoutNode() {
		const context = await setup();
		await put(context);
		return context;
	}

	it.each([
		["owner", 200],
		["EDIT", 200],
		["team EDIT", 200],
		["VIEW", 404],
		["COMMENT", 404],
		["team VIEW", 404],
	] as const)("%s adds the node (%i)", async (who, status) => {
		const context = await acceptedWithoutNode();
		const { testCase, owner } = context;
		if (who === "team VIEW" || who === "team EDIT") {
			await signedInThroughTeam(
				testCase.id,
				owner.id,
				who === "team VIEW" ? "VIEW" : "EDIT"
			);
		} else if (who !== "owner") {
			await signedInWith(testCase.id, owner.id, who);
		}

		const response = await callAddEvidenceNode(context.claim.id);

		expect(response.status).toBe(status);
		expect(await evidenceIn(testCase.id)).toHaveLength(status === 200 ? 1 : 0);
	});

	it("gives a person without access the same answer as for a missing claim", async () => {
		const context = await acceptedWithoutNode();
		const stranger = await createTestUser();
		await enableTestPlugin(stranger.id, "tea.health");
		await asUser(stranger);
		const missing = "7acd824e-0000-4000-8000-0000000000dd";

		for (const claimId of [context.claim.id, missing]) {
			const response = await callAddEvidenceNode(claimId);
			expect(response.status).toBe(404);
			expect((await response.json()).error).toBe(CLAIM_NOT_FOUND);
		}
		expect(await evidenceIn(context.testCase.id)).toHaveLength(0);
	});

	it("refuses an unauthenticated request, a machine token and a person who has switched the plugin off", async () => {
		const context = await acceptedWithoutNode();

		await mockNoAuth();
		expect((await callAddEvidenceNode(context.claim.id)).status).toBe(401);
		expect(
			(await callAddEvidenceNode(context.claim.id, context.secret)).status
		).toBe(401);

		await asUser(context.owner);
		await setPluginEnabledForUser("tea.health", context.owner.id, {
			enabled: false,
		});
		const off = await callAddEvidenceNode(context.claim.id);
		expect(off.status).toBe(403);
		expect(await evidenceIn(context.testCase.id)).toHaveLength(0);
	});

	it("adds the node to a claim accepted without one, as the person asking, and changes nothing else", async () => {
		const context = await acceptedWithoutNode();
		const before = await criteriaOf(context.claim.id);
		vi.mocked(emitSSEEvent).mockClear();

		const response = await callAddEvidenceNode(context.claim.id);

		expect(response.status).toBe(200);
		const [node] = await evidenceIn(context.testCase.id);
		expect(node).toMatchObject({
			name: "E1",
			description: ITEM_TEXT,
			createdById: context.owner.id,
		});
		expect((await response.json()).evidence_node).toEqual({
			id: node?.id,
			name: "E1",
			state: "live",
		});
		const after = await criteriaOf(context.claim.id);
		expect(after.evidenceElementId).toBe(node?.id);
		expect(after.revision).toBe(before.revision);
		expect(after.updatedAt).toEqual(before.updatedAt);
		expect(vi.mocked(emitSSEEvent).mock.calls.map((call) => call[0])).toEqual([
			"element:created",
			"tea.health/state-changed",
		]);
	});

	it("refuses with 409 when the settings are not accepted", async () => {
		const none = await setup();
		const noSettings = await callAddEvidenceNode(none.claim.id);
		expect(noSettings.status).toBe(409);
		expect((await noSettings.json()).error).toBe(NOT_ACCEPTED);

		const suggested = await setup();
		await put(suggested, { accept: false });
		const suggestion = await callAddEvidenceNode(suggested.claim.id);
		expect(suggestion.status).toBe(409);

		const retired = await setup();
		await put(retired);
		await retire(retired);
		const inactive = await callAddEvidenceNode(retired.claim.id);
		expect(inactive.status).toBe(409);

		for (const { testCase } of [none, suggested, retired]) {
			expect(await evidenceIn(testCase.id)).toHaveLength(0);
		}
	});

	it("refuses with 409 when the claim already has a live node", async () => {
		const context = await setup();
		await acceptWithNode(context);

		const response = await callAddEvidenceNode(context.claim.id);

		expect(response.status).toBe(409);
		expect((await response.json()).error).toBe(LIVE_NODE_EXISTS);
		expect(await evidenceIn(context.testCase.id)).toHaveLength(1);
	});

	it("replaces a pointer to a node that is no longer live", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		expectSuccess(
			await deleteElement(context.owner.id, first.evidence_node.id)
		);

		const response = await callAddEvidenceNode(context.claim.id);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.evidence_node.id).not.toBe(first.evidence_node.id);
		expect(body.evidence_node.state).toBe("live");
		expect((await criteriaOf(context.claim.id)).evidenceElementId).toBe(
			body.evidence_node.id
		);
	});
});

/** Makes the case's claim part of its tree, so exports and published copies include it. */
async function putClaimUnderGoal(context: Context) {
	const goal = await createTestElement(context.testCase.id, context.owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	await prisma.assuranceElement.update({
		where: { id: context.claim.id },
		data: { parentId: goal.id },
	});
}

describe("exports and published copies carry the node as plain evidence", () => {
	it("exports the node as evidence under its claim, with no health data and the same format version", async () => {
		const context = await setup();
		await putClaimUnderGoal(context);
		const first = await acceptWithNode(context);

		const exported = expectSuccess(
			await exportCase(context.owner.id, context.testCase.id)
		);

		expect(exported.version).toBe("1.0");
		const text = JSON.stringify(exported);
		expect(text).toContain(first.evidence_node.id);
		expect(text).toContain(ITEM_TEXT);
		expect(text).not.toContain("tea.health");
		expect(text).not.toContain("evidenceElementId");
	});

	it("publishes the node as plain evidence with no tea.health entry", async () => {
		const context = await setup();
		await putClaimUnderGoal(context);
		const first = await acceptWithNode(context);

		const published = expectSuccess(
			await publishAssuranceCase(context.owner.id, context.testCase.id)
		);

		const record = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.publishedId },
		});
		const snapshot = JSON.stringify(record.content);
		expect(snapshot).toContain(first.evidence_node.id);
		expect(snapshot).not.toContain("tea.health");
		expect(
			(record.content as { pluginData?: unknown }).pluginData
		).toBeUndefined();
		const publicItem = expectSuccess(await getPublishedItemBySlug(record.slug));
		expect(JSON.stringify(publicItem.content)).not.toContain("tea.health");
	});
});

describe("the migration", () => {
	it("adds a nullable, unique column that the database clears when the element is deleted, and writes no node", async () => {
		const column = await prisma.$queryRaw<
			{ is_nullable: string }[]
		>`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'plugin_health_criteria' AND column_name = 'evidence_element_id'`;
		expect(column).toEqual([{ is_nullable: "YES" }]);
		const unique = await prisma.$queryRaw<
			{ indexdef: string }[]
		>`SELECT indexdef FROM pg_indexes WHERE tablename = 'plugin_health_criteria' AND indexname = 'plugin_health_criteria_evidence_element_id_key'`;
		expect(unique[0]?.indexdef).toContain("UNIQUE");
		const fkey = await prisma.$queryRaw<
			{ confdeltype: string }[]
		>`SELECT confdeltype::text AS confdeltype FROM pg_constraint WHERE conname = 'plugin_health_criteria_evidence_element_id_fkey'`;
		expect(fkey).toEqual([{ confdeltype: "n" }]);

		const context = await setup();
		await put(context);
		expect(await evidenceIn(context.testCase.id)).toHaveLength(0);
		expect(await nodeStateOf(context.claim.id)).toBeNull();
	});
});

describe("collisions with another writer", () => {
	it("tells the person to try again when a deadlock with a JSON editor save aborts the save", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		await retire(context);
		const nodeId = first.evidence_node.id;
		const claimId = context.claim.id;

		// The editor locks the node and then wants the claim; the save locks the
		// claim and then wants the node.
		let held!: () => void;
		const editorHoldsNode = new Promise<void>((resolve) => {
			held = resolve;
		});
		let proceed!: () => void;
		const gate = new Promise<void>((resolve) => {
			proceed = resolve;
		});
		const editor = prisma
			.$transaction(
				async (tx) => {
					await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${nodeId} FOR UPDATE`;
					held();
					await gate;
					await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
				},
				{ timeout: 30_000 }
			)
			.then(
				() => "committed",
				() => "aborted"
			);
		await editorHoldsNode;
		const saving = put(context, { extra: { add_evidence_node: true } });
		await waitForLockWait();
		proceed();

		const result = await saving;

		expect(result.status).toBe(409);
		expect(result.body.error).toBe(CASE_CHANGED);
		expect(await editor).toBe("committed");
		expect(await evidenceIn(context.testCase.id)).toHaveLength(1);
		expect((await criteriaOf(claimId)).state).toBe("INACTIVE");
	});

	it("tells the person to try again when the node is deleted while the save waits for it", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		await retire(context);
		const lock = await holdRowLock(async (tx) => {
			await tx.$executeRaw`DELETE FROM assurance_elements WHERE id = ${first.evidence_node.id}`;
		});
		const saving = put(context, { extra: { add_evidence_node: true } });
		await waitForLockWait();
		await lock.release();

		const result = await saving;

		expect(result.status).toBe(409);
		expect(result.body.error).toBe(CASE_CHANGED);
		expect(await evidenceIn(context.testCase.id)).toHaveLength(0);
		expect((await criteriaOf(context.claim.id)).state).toBe("INACTIVE");
	});

	it("gives the retry message to a retirement that loses the node in the same way", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const lock = await holdRowLock(async (tx) => {
			await tx.$executeRaw`DELETE FROM assurance_elements WHERE id = ${first.evidence_node.id}`;
		});
		const retiring = retire(context, "remove");
		await waitForLockWait();
		await lock.release();

		const result = await retiring;

		expect(result.status).toBe(409);
		expect(result.body.error).toBe(CASE_CHANGED);
		expect((await criteriaOf(context.claim.id)).state).toBe("ACCEPTED");
	});

	it("gives the retry message to adding a node when the existing one is deleted while it waits", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const lock = await holdRowLock(async (tx) => {
			await tx.$executeRaw`DELETE FROM assurance_elements WHERE id = ${first.evidence_node.id}`;
		});
		const adding = callAddEvidenceNode(context.claim.id);
		await waitForLockWait();
		await lock.release();

		const response = await adding;

		expect(response.status).toBe(409);
		expect((await response.json()).error).toBe(CASE_CHANGED);
	});

	it.each([
		["a write conflict or deadlock", { code: "P2034" }],
		[
			"a deadlock reported by a raw query",
			{
				code: "P2010",
				meta: {
					driverAdapterError: {
						cause: { originalCode: "40P01", kind: "TransactionWriteConflict" },
					},
				},
			},
		],
	])("treats %s as a concurrent change, and an unrelated database error as one that is not", (_what, failure) => {
		const collision = new Prisma.PrismaClientKnownRequestError("failed", {
			...failure,
			clientVersion: "test",
		});
		const unrelated = new Prisma.PrismaClientKnownRequestError("failed", {
			code: "P2010",
			clientVersion: "test",
		});

		expect(isConcurrentChange(collision)).toBe(true);
		expect(isConcurrentChange(unrelated)).toBe(false);
		expect(isConcurrentChange(new Error("connection reset"))).toBe(false);
	});

	it.each([
		["a unique index violation", "P2002"],
		["a foreign key violation", "P2003"],
		["a record that is not found", "P2025"],
	])("does not treat %s as a concurrent change", (_what, code) => {
		const failure = new Prisma.PrismaClientKnownRequestError("failed", {
			code,
			clientVersion: "test",
		});

		expect(isConcurrentChange(failure)).toBe(false);
	});

	it("tells a JSON editor save the case changed when a deadlock with a health save aborts its batch", async () => {
		const context = await setup();
		const first = await acceptWithNode(context);
		const nodeId = first.evidence_node.id;
		const claimId = context.claim.id;

		// The health save holds the claim and then wants the node; the editor's
		// batch updates the node and then wants the claim.
		let held!: () => void;
		const saveHoldsClaim = new Promise<void>((resolve) => {
			held = resolve;
		});
		let proceed!: () => void;
		const gate = new Promise<void>((resolve) => {
			proceed = resolve;
		});
		const healthSave = prisma
			.$transaction(
				async (tx) => {
					await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
					held();
					await gate;
					await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${nodeId} FOR UPDATE`;
				},
				{ timeout: 30_000 }
			)
			.then(
				() => "committed",
				() => "aborted"
			);
		await saveHoldsClaim;
		const batching = postBatch(context.testCase.id, [
			{
				type: "update",
				elementId: nodeId,
				data: { description: "Reworded in the editor" },
			},
			{
				type: "update",
				elementId: claimId,
				data: { description: "Claim reworded in the editor" },
			},
		]);
		await waitForLockWait();
		proceed();

		const response = await batching;

		expect(response.status).toBe(409);
		expect((await response.json()).error).toBe(
			"Case has been modified by another user"
		);
		expect(await healthSave).toBe("committed");
		const node = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: nodeId },
		});
		expect(node.description).toBe(ITEM_TEXT);
	});
});

describe("the interface that exists today keeps working", () => {
	it("saves with no node fields and retires with only a reason, as before", async () => {
		const context = await setup();

		const saved = await put(context);
		expect(saved.status).toBe(200);
		expect(saved.body.evidence_node).toBeNull();
		const retired = await callRetirement(context.claim.id, {
			reason: "Superseded by new settings",
		});

		expect(retired.status).toBe(200);
		expect((await retired.json()).criteria.state).toBe("inactive");
		expect(await evidenceIn(context.testCase.id)).toHaveLength(0);
	});
});
