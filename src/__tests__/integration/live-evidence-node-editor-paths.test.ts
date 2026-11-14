import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementChange } from "@/lib/case/tree-diff";
import prisma from "@/lib/prisma";
import { applyBatchUpdate } from "@/lib/services/case-batch-update-service";
import { updateElement } from "@/lib/services/element-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	acceptWithNode,
	element,
	evidenceIn,
	linksOf,
	listNodes,
	type NodeWorld,
	nodeWorld,
	pointerOf,
	postNode,
	readView,
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

async function acceptedWorld() {
	const world = await nodeWorld();
	await acceptWithNode(world);
	const [node] = await evidenceIn(world.kase.id);
	if (!node) {
		throw new Error("no node was made");
	}
	return { world, node };
}

async function batch(world: NodeWorld, changes: ElementChange[]) {
	const result = await applyBatchUpdate(world.owner.id, world.kase.id, changes);
	if ("error" in result) {
		throw new Error(result.error);
	}
}

/** The list's answer for the case, and the name it gives each node. */
async function listed(world: NodeWorld) {
	const result = await listNodes(world.kase.id);
	return result.body as { id: string; name: string | null }[];
}

describe("what the JSON editor does to a live node", () => {
	it("editing the node's text keeps the look and keeps the author's words", async () => {
		const { world, node } = await acceptedWorld();
		await batch(world, [
			{
				type: "update",
				elementId: node.id,
				data: { description: "Reworded in the editor" },
			},
		]);
		expect((await element(node.id)).description).toBe("Reworded in the editor");
		expect((await listed(world)).map((item) => item.id)).toEqual([node.id]);
		expect((await readView(world.claim.id)).body.evidence_node).toMatchObject({
			id: node.id,
			state: "live",
		});
	});

	it("deleting the node clears the pointer, draws nothing, and lets a new node be added", async () => {
		const { world, node } = await acceptedWorld();
		await batch(world, [{ type: "delete", elementId: node.id }]);

		expect(await pointerOf(world.claim.id)).toBeNull();
		expect(await listed(world)).toEqual([]);
		const view = await readView(world.claim.id);
		expect(view.body.criteria.state).toBe("accepted");
		expect(view.body.evidence_node?.state ?? null).not.toBe("live");

		const again = await postNode(world.claim.id);
		expect(again.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(1);
		expect(evidence[0]?.id).not.toBe(node.id);
		expect((await listed(world)).map((item) => item.id)).toEqual([
			evidence[0]?.id,
		]);
	});

	it("deleting the claim takes the settings with it and leaves the node as plain evidence", async () => {
		const { world, node } = await acceptedWorld();
		await batch(world, [{ type: "delete", elementId: world.claim.id }]);

		expect(
			await prisma.pluginHealthCriteria.count({
				where: { claimId: world.claim.id },
			})
		).toBe(0);
		const stored = await element(node.id);
		expect(stored.deletedAt).toBeNull();
		expect(stored.description).toContain("Results from the");
		expect(await listed(world)).toEqual([]);
	});

	it("unlinking the node from its claim draws it plain, and linking it again brings the look back", async () => {
		const { world, node } = await acceptedWorld();
		await batch(world, [
			{
				type: "unlink_evidence",
				evidenceId: node.id,
				claimId: world.claim.id,
			},
		]);
		expect(await listed(world)).toEqual([]);
		expect((await readView(world.claim.id)).body.evidence_node).toMatchObject({
			id: node.id,
			state: "moved",
		});
		expect(await linksOf(node.id)).toHaveLength(0);

		await batch(world, [
			{ type: "link_evidence", evidenceId: node.id, claimId: world.claim.id },
		]);
		expect((await listed(world)).map((item) => item.id)).toEqual([node.id]);
	});

	it("turning the node into a defeater and back keeps one node, whose name the list and the settings read both give as the case shows it", async () => {
		const { world, node } = await acceptedWorld();

		const flipped = await updateElement(world.owner.id, node.id, {
			isDefeater: true,
		} as never);
		expect("data" in flipped).toBe(true);
		expect(await listed(world)).toEqual([]);

		const back = await updateElement(world.owner.id, node.id, {
			isDefeater: false,
		} as never);
		expect("data" in back).toBe(true);
		const current = await element(node.id);
		expect(current.isDefeater).toBe(false);
		const items = await listed(world);
		expect(items).toEqual([{ ...items[0], id: node.id, name: current.name }]);
		expect((await readView(world.claim.id)).body.evidence_node).toEqual({
			id: node.id,
			name: current.name,
			state: "live",
		});
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
	});

	it("a JSON-editor save that names the case's version from before an acceptance is told the case changed", async () => {
		const world = await nodeWorld();
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: world.kase.id },
		});
		await new Promise((resolve) => setTimeout(resolve, 15));
		await acceptWithNode(world);
		const result = await applyBatchUpdate(world.owner.id, world.kase.id, [], {
			expectedVersion: before.updatedAt.toISOString(),
		});
		expect(result).toMatchObject({ conflictDetected: true });
	});
});
