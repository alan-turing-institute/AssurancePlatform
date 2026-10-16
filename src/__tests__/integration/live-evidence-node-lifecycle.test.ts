import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	deleteElement,
	detachElement,
	moveElement,
	restoreElement,
} from "@/lib/services/element-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { ITEM_CHECK_NAME } from "../fixtures/health-checks";
import { mockNoAuth } from "../utils/auth-helpers";
import { appendRecord } from "../utils/health-adversarial-kit";
import {
	acceptWithNode,
	addClaim,
	collaborator,
	element,
	eventTypes,
	evidenceIn,
	linksOf,
	linksTo,
	listNodes,
	liveIds,
	type NodeWorld,
	nodeWorld,
	numericSettings,
	pointerOf,
	postNode,
	readClaimHealth,
	readStatus,
	readView,
	retire,
	revisionCount,
	save,
	signIn,
	storedState,
} from "../utils/live-node-kit";

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
	vi.mocked(emitSSEEvent).mockClear();
});

/** The world's first claim accepted with a node. */
async function acceptedWorld() {
	const world = await nodeWorld();
	await acceptWithNode(world);
	const [node] = await evidenceIn(world.kase.id);
	if (!node) {
		throw new Error("no node was made");
	}
	return { world, node };
}

/** Throws unless a step that sets a test up answered 200. */
function must(result: { body: unknown; status: number }) {
	if (result.status !== 200) {
		throw new Error(
			`step answered ${result.status}: ${JSON.stringify(result.body)}`
		);
	}
}

function ok(result: { data: unknown } | { error: string }) {
	if ("error" in result) {
		throw new Error(result.error);
	}
}

// ---------------------------------------------------------------------------
// The five conditions of liveness, one at a time
// ---------------------------------------------------------------------------

interface Breaker {
	breakIt: (world: NodeWorld, nodeId: string, other: string) => Promise<void>;
	label: string;
	/** The node stays where it was; only the settings make it plain, so the settings read still places it. */
	settingsOnly?: true;
	undo: (world: NodeWorld, nodeId: string, other: string) => Promise<void>;
	/** The state the settings read gives the node while it is not live; null when it only needs to be not live. */
	viewState: string | null;
}

const BREAKERS: Breaker[] = [
	{
		label: "the claim's settings are retired",
		settingsOnly: true,
		viewState: null,
		breakIt: async (world) => {
			must(await retire(world.claim.id));
		},
		undo: async (world) => {
			must(await save(world, world.claim.id));
		},
	},
	{
		label: "the claim's settings are only a suggestion",
		settingsOnly: true,
		viewState: null,
		breakIt: async (world) => {
			must(await retire(world.claim.id));
			must(await save(world, world.claim.id, {}, undefined, false));
		},
		undo: async (world) => {
			must(await save(world, world.claim.id));
		},
	},
	{
		label: "the node is in the trash",
		viewState: "trashed",
		breakIt: async (world, nodeId) => {
			ok(await deleteElement(world.owner.id, nodeId));
		},
		undo: async (world, nodeId) => {
			ok(await restoreElement(world.owner.id, nodeId));
		},
	},
	{
		label: "the node is in the sandbox",
		viewState: null,
		breakIt: async (world, nodeId) => {
			ok(await detachElement(world.owner.id, nodeId));
		},
		undo: async (_world, nodeId) => {
			await prisma.assuranceElement.update({
				where: { id: nodeId },
				data: { inSandbox: false },
			});
		},
	},
	{
		label: "the node has been made a defeater",
		viewState: null,
		breakIt: async (_world, nodeId) => {
			await prisma.assuranceElement.update({
				where: { id: nodeId },
				data: { isDefeater: true },
			});
		},
		undo: async (_world, nodeId) => {
			await prisma.assuranceElement.update({
				where: { id: nodeId },
				data: { isDefeater: false },
			});
		},
	},
	{
		label: "the node has moved to another claim",
		viewState: "moved",
		breakIt: async (world, nodeId, other) => {
			ok(await moveElement(world.owner.id, nodeId, other));
		},
		undo: async (world, nodeId) => {
			ok(await moveElement(world.owner.id, nodeId, world.claim.id));
		},
	},
	{
		label: "the node's link to the claim has been removed",
		viewState: null,
		breakIt: async (world, nodeId) => {
			await prisma.evidenceLink.deleteMany({
				where: { evidenceId: nodeId, claimId: world.claim.id },
			});
		},
		undo: async (world, nodeId) => {
			await prisma.evidenceLink.create({
				data: { evidenceId: nodeId, claimId: world.claim.id },
			});
		},
	},
	{
		label: "the claim is in the trash",
		viewState: null,
		breakIt: async (world) => {
			ok(await deleteElement(world.owner.id, world.claim.id));
		},
		undo: async (world) => {
			ok(await restoreElement(world.owner.id, world.claim.id));
		},
	},
	{
		label: "the node and the claim are in different cases",
		viewState: null,
		breakIt: async (world, nodeId) => {
			const elsewhere = await prisma.assuranceCase.create({
				data: {
					name: "Elsewhere",
					description: "x",
					createdById: world.owner.id,
				},
			});
			await prisma.assuranceElement.update({
				where: { id: nodeId },
				data: { caseId: elsewhere.id },
			});
		},
		undo: async (world, nodeId) => {
			await prisma.assuranceElement.update({
				where: { id: nodeId },
				data: { caseId: world.kase.id },
			});
		},
	},
];

async function surfaces(world: NodeWorld) {
	const view = await readView(world.claim.id);
	const health = await readClaimHealth(world);
	return {
		listed: await liveIds(world.kase.id),
		view: view.status === 200 ? view.body.evidence_node : null,
		toolNode:
			health.claims.find((claim) => claim.id === world.claim.id)
				?.evidenceNode ?? null,
	};
}

describe("one rule decides whether a node is live, for every reader", () => {
	it("agrees on a live node: the list, the settings read and the assistant all see it", async () => {
		const { world, node } = await acceptedWorld();
		const seen = await surfaces(world);
		expect(seen.listed).toEqual([node.id]);
		expect(seen.view).toEqual({ id: node.id, name: node.name, state: "live" });
		expect(seen.toolNode).toBe(node.name);
	});

	it.each(
		BREAKERS
	)("when $label, no reader treats the node as live, and each does again once it is undone", async (breaker) => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");

		await breaker.breakIt(world, node.id, other.id);
		const broken = await surfaces(world);
		expect(broken.listed).toEqual([]);
		expect(broken.toolNode).toBeNull();
		if (breaker.settingsOnly) {
			expect(broken.view).toMatchObject({ id: node.id });
		} else {
			expect(broken.view?.state).not.toBe("live");
		}
		if (breaker.viewState) {
			expect(broken.view).toMatchObject({
				id: node.id,
				state: breaker.viewState,
			});
		}
		// Nothing is deleted or rewritten when a condition fails.
		expect(await pointerOf(world.claim.id)).toBe(node.id);

		await breaker.undo(world, node.id, other.id);
		const restored = await surfaces(world);
		expect(restored.listed).toEqual([node.id]);
		expect(restored.view).toMatchObject({ id: node.id, state: "live" });
		expect(restored.toolNode).toBe(node.name);
	});

	it("still treats the node as live while it also supports a second claim", async () => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");
		await prisma.evidenceLink.create({
			data: { evidenceId: node.id, claimId: other.id },
		});
		const seen = await surfaces(world);
		expect(seen.listed).toEqual([node.id]);
		expect(seen.view?.state).toBe("live");
		const list = await listNodes(world.kase.id);
		expect(list.body).toHaveLength(1);
		expect(list.body[0].claim_id).toBe(world.claim.id);
	});

	it("does not treat a node as live for a second claim that only shares it", async () => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");
		await prisma.evidenceLink.create({
			data: { evidenceId: node.id, claimId: other.id },
		});
		expect((await save(world, other.id)).status).toBe(200);
		const list = await listNodes(world.kase.id);
		expect(
			list.body.map((item: { claim_id: string }) => item.claim_id)
		).toEqual([world.claim.id]);
		expect((await readView(other.id)).body.evidence_node).toBeNull();
	});

	it("reports a node removed from the database altogether as no node, and the pointer is cleared", async () => {
		const { world, node } = await acceptedWorld();
		await prisma.assuranceElement.delete({ where: { id: node.id } });
		expect(await pointerOf(world.claim.id)).toBeNull();
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
		const seen = await surfaces(world);
		expect(seen.listed).toEqual([]);
		expect(seen.toolNode).toBeNull();
		expect(seen.view?.state ?? null).not.toBe("live");
		const replaced = await postNode(world.claim.id);
		expect(replaced.status).toBe(200);
		expect(replaced.body.evidence_node?.state).toBe("live");
	});
});

describe("a node taken out of the case and brought back", () => {
	it("moved to another claim and back, it is the same node and the same look", async () => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");
		ok(await moveElement(world.owner.id, node.id, other.id));
		expect(await liveIds(world.kase.id)).toEqual([]);
		ok(await moveElement(world.owner.id, node.id, world.claim.id));
		expect(await liveIds(world.kase.id)).toEqual([node.id]);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

describe("retiring with evidence_node: remove", () => {
	it("trashes the live node, clears the pointer and retires the settings in one step", async () => {
		const { world, node } = await acceptedWorld();
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: world.kase.id },
		});
		await new Promise((resolve) => setTimeout(resolve, 15));
		vi.mocked(emitSSEEvent).mockClear();

		const result = await retire(world.claim.id, {
			reason: "No longer monitored",
			evidence_node: "remove",
		});

		expect(result.status).toBe(200);
		expect(result.body.criteria.state).toBe("inactive");
		expect(result.body.evidence_node).toBeNull();
		const stored = await element(node.id);
		expect(stored.deletedAt).not.toBeNull();
		expect(stored.deletedById).toBe(world.owner.id);
		expect(await pointerOf(world.claim.id)).toBeNull();
		expect(await storedState(world.claim.id)).toBe("INACTIVE");
		expect(await revisionCount(world.claim.id)).toBe(2);
		const after = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: world.kase.id },
		});
		expect(after.updatedAt.getTime()).toBeGreaterThan(
			before.updatedAt.getTime()
		);
		const types = eventTypes();
		expect(types).toContain("element:deleted");
		expect(types.indexOf("element:deleted")).toBeLessThan(
			types.indexOf("tea.health/state-changed")
		);
		const deleted = vi
			.mocked(emitSSEEvent)
			.mock.calls.find((call) => call[0] === "element:deleted");
		expect(deleted?.[2]).toMatchObject({
			elementId: node.id,
			userId: world.owner.id,
		});
	});

	it("leaves a node restored from the trash as plain evidence, even when the claim is accepted again", async () => {
		const { world, node } = await acceptedWorld();
		expect(
			(await retire(world.claim.id, { reason: "x", evidence_node: "remove" }))
				.status
		).toBe(200);
		ok(await restoreElement(world.owner.id, node.id));
		expect((await element(node.id)).deletedAt).toBeNull();
		expect(await linksTo(world.claim.id)).toHaveLength(1);
		expect(await liveIds(world.kase.id)).toEqual([]);

		const again = await save(world, world.claim.id);

		expect(again.status).toBe(200);
		expect(again.body.evidence_node).toBeNull();
		expect(await liveIds(world.kase.id)).toEqual([]);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
	});

	it("gives a fresh node, and leaves the restored one plain, when the claim is accepted again with the field", async () => {
		const { world, node } = await acceptedWorld();
		await retire(world.claim.id, { reason: "x", evidence_node: "remove" });
		ok(await restoreElement(world.owner.id, node.id));

		const again = await save(world, world.claim.id, {
			add_evidence_node: true,
		});

		expect(again.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(2);
		const fresh = evidence.find((row) => row.id !== node.id);
		expect(await liveIds(world.kase.id)).toEqual([fresh?.id]);
		expect(await pointerOf(world.claim.id)).toBe(fresh?.id);
	});

	it("records the person who retires as the one who trashed the node", async () => {
		const { world, node } = await acceptedWorld();
		const editor = await collaborator(world, "EDIT");
		await signIn(editor);
		const result = await retire(world.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});
		expect(result.status).toBe(200);
		expect((await element(node.id)).deletedById).toBe(editor.id);
	});

	it("on a node that supports a second claim, removes only this claim's link and does not trash it", async () => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");
		await prisma.evidenceLink.create({
			data: { evidenceId: node.id, claimId: other.id },
		});

		const result = await retire(world.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});

		expect(result.status).toBe(200);
		expect(result.body.criteria.state).toBe("inactive");
		expect((await element(node.id)).deletedAt).toBeNull();
		expect((await linksOf(node.id)).map((link) => link.claimId)).toEqual([
			other.id,
		]);
		expect(await liveIds(world.kase.id)).toEqual([]);
		expect(result.body.evidence_node?.state ?? null).not.toBe("live");

		const again = await save(world, world.claim.id, {
			add_evidence_node: true,
		});
		expect(again.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(2);
		const fresh = evidence.find((row) => row.id !== node.id);
		expect((await linksOf(node.id)).map((link) => link.claimId)).toEqual([
			other.id,
		]);
		expect(
			(await linksOf(fresh?.id ?? "")).map((link) => link.claimId)
		).toEqual([world.claim.id]);
	});

	it("touches only the retiring claim's node when another claim has its own", async () => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");
		await acceptWithNode(world, other.id);
		const rows = await evidenceIn(world.kase.id);
		const otherNode = rows.find((row) => row.id !== node.id);
		const before = await element(otherNode?.id ?? "");

		await retire(world.claim.id, { reason: "x", evidence_node: "remove" });

		expect(await element(otherNode?.id ?? "")).toEqual(before);
		expect(await liveIds(world.kase.id)).toEqual([otherNode?.id]);
		expect(await storedState(other.id)).toBe("ACCEPTED");
	});
});

describe("retiring with keep, or with no choice, leaves the node alone", () => {
	it.each([
		["keep", { reason: "Pause", evidence_node: "keep" }],
		["no choice", { reason: "Pause" }],
	])("%s: the row, its links and the pointer are exactly as they were", async (_label, body) => {
		const { world, node } = await acceptedWorld();
		const before = await element(node.id);
		const links = await linksOf(node.id);

		const result = await retire(world.claim.id, body);

		expect(result.status).toBe(200);
		expect(await element(node.id)).toEqual(before);
		expect(await linksOf(node.id)).toEqual(links);
		expect(await pointerOf(world.claim.id)).toBe(node.id);
		expect(result.body.evidence_node).toMatchObject({ id: node.id });
		expect(await liveIds(world.kase.id)).toEqual([]);
	});
});

describe("the choice does nothing when there is no live node", () => {
	async function untouched(
		world: NodeWorld,
		nodeId: string,
		body: Record<string, unknown>
	) {
		const row = await element(nodeId);
		const links = await linksOf(nodeId);
		const result = await retire(world.claim.id, body);
		// biome-ignore lint/suspicious/noMisplacedAssertion: called only from within tests
		expect(result.status).toBe(200);
		// biome-ignore lint/suspicious/noMisplacedAssertion: called only from within tests
		expect(await element(nodeId)).toEqual(row);
		// biome-ignore lint/suspicious/noMisplacedAssertion: called only from within tests
		expect(await linksOf(nodeId)).toEqual(links);
		// biome-ignore lint/suspicious/noMisplacedAssertion: called only from within tests
		expect(await storedState(world.claim.id)).toBe("INACTIVE");
	}

	it("when the node has moved to another claim", async () => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");
		ok(await moveElement(world.owner.id, node.id, other.id));
		await untouched(world, node.id, { reason: "x", evidence_node: "remove" });
		expect((await linksOf(node.id)).map((link) => link.claimId)).toEqual([
			other.id,
		]);
	});

	it("when the node is already in the trash", async () => {
		const { world, node } = await acceptedWorld();
		ok(await deleteElement(world.owner.id, node.id));
		await untouched(world, node.id, { reason: "x", evidence_node: "remove" });
	});

	it("when the node is in the sandbox", async () => {
		const { world, node } = await acceptedWorld();
		ok(await detachElement(world.owner.id, node.id));
		await untouched(world, node.id, { reason: "x", evidence_node: "remove" });
		expect((await element(node.id)).deletedAt).toBeNull();
	});

	it("when the node has been made a defeater", async () => {
		const { world, node } = await acceptedWorld();
		await prisma.assuranceElement.update({
			where: { id: node.id },
			data: { isDefeater: true },
		});
		await untouched(world, node.id, { reason: "x", evidence_node: "remove" });
	});

	it("when the claim has accepted settings and never had a node", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id);
		const other = await addClaim(world, "P2");
		await acceptWithNode(world, other.id);
		const [bystander] = await evidenceIn(world.kase.id);
		const before = await element(bystander?.id ?? "");
		vi.mocked(emitSSEEvent).mockClear();
		const result = await retire(world.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});
		expect(result.status).toBe(200);
		expect(await element(bystander?.id ?? "")).toEqual(before);
		expect(eventTypes().filter((type) => type.startsWith("element:"))).toEqual(
			[]
		);
	});

	it("when a suggestion is discarded", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id, {}, undefined, false);
		const result = await retire(world.claim.id, { evidence_node: "remove" });
		expect(result.status).toBe(200);
		expect(await storedState(world.claim.id)).toBe("INACTIVE");
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
	});

	it("when the settings are already inactive it still refuses with a 409 and touches nothing", async () => {
		const { world, node } = await acceptedWorld();
		await retire(world.claim.id, { reason: "x" });
		const before = await element(node.id);
		const again = await retire(world.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});
		expect(again.status).toBe(409);
		expect(await element(node.id)).toEqual(before);
	});
});

// ---------------------------------------------------------------------------
// Adding a node to claims already accepted
// ---------------------------------------------------------------------------

describe("POST …/health/evidence-node", () => {
	it("adds one node to a claim accepted without one, and changes neither the settings nor their history", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id);
		const editor = await collaborator(world, "EDIT");
		await signIn(editor);
		const settingsBefore = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: world.claim.id },
		});

		const result = await postNode(world.claim.id);

		expect(result.status).toBe(200);
		const [node] = await evidenceIn(world.kase.id);
		expect(node).toMatchObject({
			elementType: "EVIDENCE",
			createdById: editor.id,
			deletedAt: null,
		});
		expect(node?.description).toContain(
			`Results from the ${ITEM_CHECK_NAME} check`
		);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(await linksTo(world.claim.id)).toHaveLength(1);
		expect(result.body.evidence_node).toEqual({
			id: node?.id,
			name: node?.name,
			state: "live",
		});
		expect(await revisionCount(world.claim.id)).toBe(1);
		const settingsAfter = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: world.claim.id },
		});
		expect(settingsAfter.revision).toBe(settingsBefore.revision);
		expect(settingsAfter.settings).toEqual(settingsBefore.settings);
		expect(await liveIds(world.kase.id)).toEqual([node?.id]);
		const types = eventTypes();
		expect(types.indexOf("element:created")).toBeGreaterThanOrEqual(0);
		expect(types.indexOf("element:created")).toBeLessThan(
			types.lastIndexOf("tea.health/state-changed")
		);
	});

	it("refuses with a 409 when the claim already has a live node, and adds none", async () => {
		const { world, node } = await acceptedWorld();
		const result = await postNode(world.claim.id);
		expect(result.status).toBe(409);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(await pointerOf(world.claim.id)).toBe(node.id);
	});

	it.each([
		["suggested", "suggested"],
		["retired", "retired"],
	])("refuses with a 409 when the settings are %s", async (_label, how) => {
		const world = await nodeWorld();
		if (how === "suggested") {
			await save(world, world.claim.id, {}, undefined, false);
		} else {
			await save(world, world.claim.id);
			await retire(world.claim.id);
		}
		const result = await postNode(world.claim.id);
		expect(result.status).toBe(409);
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
		expect(await pointerOf(world.claim.id)).toBeNull();
	});

	it("refuses a claim with no settings at all and adds nothing", async () => {
		const world = await nodeWorld();
		const result = await postNode(world.claim.id);
		expect([404, 409]).toContain(result.status);
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
	});

	it.each([
		["moved to another claim", "moved"],
		["in the trash", "trashed"],
		["removed from the database", "gone"],
	])("replaces the pointer when the old node is %s, leaving the old node where it is", async (_label, how) => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");
		if (how === "moved") {
			ok(await moveElement(world.owner.id, node.id, other.id));
		}
		if (how === "trashed") {
			ok(await deleteElement(world.owner.id, node.id));
		}
		if (how === "gone") {
			await prisma.assuranceElement.delete({ where: { id: node.id } });
		}

		const result = await postNode(world.claim.id);

		expect(result.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		const fresh = evidence.find((row) => row.id !== node.id);
		expect(fresh).toBeDefined();
		expect(await pointerOf(world.claim.id)).toBe(fresh?.id);
		expect(await liveIds(world.kase.id)).toEqual([fresh?.id]);
		if (how === "moved") {
			expect((await linksOf(node.id)).map((link) => link.claimId)).toEqual([
				other.id,
			]);
		}
		if (how === "trashed") {
			expect((await element(node.id)).deletedAt).not.toBeNull();
		}
	});

	it("two requests at the same moment add exactly one node", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id);
		const statuses = (
			await Promise.all([postNode(world.claim.id), postNode(world.claim.id)])
		).map((result) => result.status);
		expect(statuses.sort()).toEqual([200, 409]);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(await linksTo(world.claim.id)).toHaveLength(1);
	});

	it("serves a claim whose settings were accepted before nodes existed: the migration made no node", async () => {
		const world = await nodeWorld();
		// Settings as they stood before the column: accepted, no pointer.
		await save(world, world.claim.id);
		expect(await pointerOf(world.claim.id)).toBeNull();
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
		const view = await readView(world.claim.id);
		expect(view.body.criteria.state).toBe("accepted");
		expect(view.body.evidence_node).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

describe("GET …/health/evidence-nodes", () => {
	it("lists a live node with its claim and the claim's status, and nothing else about the settings", async () => {
		const { world, node } = await acceptedWorld();
		await appendRecord(world.owner.id, world.claim.id, "populationPass", {
			check: { name: ITEM_CHECK_NAME, version: "0.3", scope: "item" },
		});

		const result = await listNodes(world.kase.id);

		expect(result.status).toBe(200);
		expect(result.body).toHaveLength(1);
		const item = result.body[0];
		expect(Object.keys(item).sort()).toEqual([
			"claim_id",
			"claim_name",
			"id",
			"name",
			"status",
		]);
		expect(item).toMatchObject({
			id: node.id,
			name: node.name,
			claim_id: world.claim.id,
			claim_name: "P1",
		});
		const claimStatus = await readStatus(world.claim.id);
		expect(item.status).toEqual(claimStatus.body.status);
		expect(item.status?.verdict).toBe("pass");
	});

	it("lists a live node whose claim has had no result yet", async () => {
		const { world, node } = await acceptedWorld();
		const result = await listNodes(world.kase.id);
		expect(result.body.map((item: { id: string }) => item.id)).toEqual([
			node.id,
		]);
		const claimStatus = await readStatus(world.claim.id);
		expect(result.body[0].status).toEqual(claimStatus.body.status);
	});

	it("lists a node for each claim that has one, and only the live ones", async () => {
		const { world, node } = await acceptedWorld();
		const second = await addClaim(world, "P2");
		const third = await addClaim(world, "P3");
		await acceptWithNode(world, second.id);
		await save(world, third.id);
		const rows = await evidenceIn(world.kase.id);
		const secondNode = rows.find((row) => row.id !== node.id);
		const listed = await listNodes(world.kase.id);
		expect(
			listed.body.map((item: { claim_name: string }) => item.claim_name).sort()
		).toEqual(["P1", "P2"]);

		ok(await deleteElement(world.owner.id, secondNode?.id ?? ""));
		expect(await liveIds(world.kase.id)).toEqual([node.id]);
	});

	it("reports a result in the same words as the claim's own status read", async () => {
		const { world } = await acceptedWorld();
		await appendRecord(world.owner.id, world.claim.id, "failingSummary", {
			check: { name: ITEM_CHECK_NAME, version: "0.3", scope: "item" },
		});
		const listed = await listNodes(world.kase.id);
		const claimStatus = await readStatus(world.claim.id);
		expect(listed.body[0].status).toEqual(claimStatus.body.status);
		expect(listed.body[0].status.verdict).toBe("fail");
	});
});

// ---------------------------------------------------------------------------
// The pointer is the plugin's own
// ---------------------------------------------------------------------------

describe("the pointer is never taken from a request", () => {
	it.each([
		["evidence_element_id", () => "00000000-0000-4000-8000-000000000001"],
		["evidence_node", () => ({ id: "00000000-0000-4000-8000-000000000001" })],
	])("a save carrying %s is a 400 that stores nothing", async (field, value) => {
		const { world, node } = await acceptedWorld();
		const result = await save(
			world,
			world.claim.id,
			{ [field]: value() },
			undefined,
			true
		);
		expect(result.status).toBe(400);
		expect(await pointerOf(world.claim.id)).toBe(node.id);
		expect(await revisionCount(world.claim.id)).toBe(1);
	});

	it("a retirement carrying evidence_element_id is a 400 that stores nothing", async () => {
		const { world, node } = await acceptedWorld();
		const result = await retire(world.claim.id, {
			reason: "x",
			evidence_element_id: node.id,
		});
		expect(result.status).toBe(400);
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
	});
});

// ---------------------------------------------------------------------------
// The case's last-changed time
// ---------------------------------------------------------------------------

describe("every change to the node moves the case's last-changed time", () => {
	async function changedAt(world: NodeWorld) {
		const row = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: world.kase.id },
		});
		return row.updatedAt.getTime();
	}

	async function pause() {
		await new Promise((resolve) => setTimeout(resolve, 15));
	}

	it("rewriting the node's text", async () => {
		const { world } = await acceptedWorld();
		const before = await changedAt(world);
		await pause();
		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			numericSettings()
		);
		expect(result.status).toBe(200);
		expect(await changedAt(world)).toBeGreaterThan(before);
	});

	it("adding the node afterwards", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id);
		const before = await changedAt(world);
		await pause();
		expect((await postNode(world.claim.id)).status).toBe(200);
		expect(await changedAt(world)).toBeGreaterThan(before);
	});

	it("taking a shared node off this claim only", async () => {
		const { world, node } = await acceptedWorld();
		const other = await addClaim(world, "P2");
		await prisma.evidenceLink.create({
			data: { evidenceId: node.id, claimId: other.id },
		});
		const before = await changedAt(world);
		await pause();
		const result = await retire(world.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});
		expect(result.status).toBe(200);
		expect(await changedAt(world)).toBeGreaterThan(before);
	});
});
