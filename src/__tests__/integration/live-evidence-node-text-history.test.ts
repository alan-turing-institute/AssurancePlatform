import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { deleteElement } from "@/lib/services/element-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "../fixtures/health-checks";
import { mockNoAuth } from "../utils/auth-helpers";
import { systemSettings } from "../utils/health-criteria-adversarial-kit";
import { itemSettings } from "../utils/health-criteria-kit";
import {
	acceptWithNode,
	checkList,
	element,
	eventTypes,
	evidenceIn,
	ITEM_NODE_TEXT,
	type NodeWorld,
	NUMERIC_NODE_TEXT,
	nodeWorld,
	numericSettings,
	pointerOf,
	readView,
	republish,
	retire,
	save,
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

const SYSTEM_NODE_TEXT = `Results from the ${SYSTEM_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: How many items the line processes each minute.`;
const UPDATE = { update_evidence_node_text: true };

function must(result: { body: unknown; status: number }) {
	if (result.status !== 200) {
		throw new Error(
			`step answered ${result.status}: ${JSON.stringify(result.body)}`
		);
	}
}

/** A claim accepted with its node on the first check, then stopped with the node kept. */
async function keptNode() {
	const world = await nodeWorld();
	await acceptWithNode(world);
	const [node] = await evidenceIn(world.kase.id);
	if (!node) {
		throw new Error("no node was made");
	}
	must(await retire(world.claim.id));
	return { world, node };
}

/** Everything a refused request must leave exactly as it was. */
async function stored(world: NodeWorld) {
	return {
		criteria: await prisma.pluginHealthCriteria.findUnique({
			where: { claimId: world.claim.id },
		}),
		history: await prisma.pluginHealthCriteriaRevision.findMany({
			where: { claimId: world.claim.id },
			orderBy: { revision: "asc" },
			select: { revision: true, action: true },
		}),
		nodes: await prisma.assuranceElement.findMany({
			where: { caseId: world.kase.id, elementType: "EVIDENCE" },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				description: true,
				deletedAt: true,
				updatedAt: true,
			},
		}),
		links: await prisma.evidenceLink.findMany({
			where: { claimId: world.claim.id },
			select: { evidenceId: true },
		}),
	};
}

/** Sends `body` as a save and requires a 400 that names the option and changes nothing. */
async function expectRefusedWithoutWriting(
	world: NodeWorld,
	settings: Record<string, unknown>,
	accept = true,
	extra: Record<string, unknown> = UPDATE,
	option = "update_evidence_node_text"
) {
	const before = await stored(world);
	vi.mocked(emitSSEEvent).mockClear();
	const result = await save(world, world.claim.id, extra, settings, accept);
	// biome-ignore lint/suspicious/noMisplacedAssertion: helper called from within it() blocks
	expect(result.status).toBe(400);
	// biome-ignore lint/suspicious/noMisplacedAssertion: helper called from within it() blocks
	expect(JSON.stringify(result.body)).toContain(option);
	// biome-ignore lint/suspicious/noMisplacedAssertion: helper called from within it() blocks
	expect(await stored(world)).toEqual(before);
	// biome-ignore lint/suspicious/noMisplacedAssertion: helper called from within it() blocks
	expect(eventTypes()).toEqual([]);
}

describe("accepting stopped settings: the text update follows the check the node's text names", () => {
	it("rewrites the kept node, and makes no second one, when the check differs", async () => {
		const { world, node } = await keptNode();

		const result = await save(world, world.claim.id, UPDATE, numericSettings());

		expect(result.status).toBe(200);
		expect((await evidenceIn(world.kase.id)).map((row) => row.id)).toEqual([
			node.id,
		]);
		expect((await element(node.id)).description).toBe(NUMERIC_NODE_TEXT);
		expect(await pointerOf(world.claim.id)).toBe(node.id);
		expect(result.body.evidence_node).toMatchObject({
			id: node.id,
			state: "live",
		});
		expect(eventTypes()).toContain("element:updated");
	});

	it("rewrites the kept node when the request also asks to add one", async () => {
		const { world, node } = await keptNode();

		const result = await save(
			world,
			world.claim.id,
			{ add_evidence_node: true, ...UPDATE },
			numericSettings()
		);

		expect(result.status).toBe(200);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect((await element(node.id)).description).toBe(NUMERIC_NODE_TEXT);
	});

	it("reuses the kept node and leaves its text alone when no update is asked for", async () => {
		const { world, node } = await keptNode();

		const result = await save(
			world,
			world.claim.id,
			{ add_evidence_node: true },
			numericSettings()
		);

		expect(result.status).toBe(200);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect((await element(node.id)).description).toBe(ITEM_NODE_TEXT);
	});

	it("refuses the update when the check is the one the text already names", async () => {
		const { world } = await keptNode();

		await expectRefusedWithoutWriting(world, itemSettings());
	});

	it("refuses the update the first time anything is accepted", async () => {
		const world = await nodeWorld();

		await expectRefusedWithoutWriting(world, itemSettings());
	});

	it("refuses the update when no acceptance has ever been recorded for the claim", async () => {
		const world = await nodeWorld();
		must(await save(world, world.claim.id, {}, itemSettings(), false));

		await expectRefusedWithoutWriting(world, numericSettings());
	});
});

describe("a request to add a node that the save cannot use", () => {
	it("is refused, and stores nothing, when the settings are already accepted", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);

		await expectRefusedWithoutWriting(
			world,
			itemSettings({ window: "PT2M" }),
			true,
			{ add_evidence_node: true },
			"add_evidence_node"
		);
	});

	it("is refused, and stores nothing, when the settings are only saved as a suggestion", async () => {
		const world = await nodeWorld();

		await expectRefusedWithoutWriting(
			world,
			itemSettings(),
			false,
			{ add_evidence_node: true },
			"add_evidence_node"
		);
	});

	it("is refused, and stores nothing, when a kept node's settings are saved again as a suggestion", async () => {
		const { world } = await keptNode();

		await expectRefusedWithoutWriting(
			world,
			numericSettings(),
			false,
			{ add_evidence_node: true },
			"add_evidence_node"
		);
	});
});

describe("a suggestion saved in between never changes which check the text names", () => {
	it("allows the update when a suggestion of the new check was saved and is then accepted", async () => {
		const { world, node } = await keptNode();
		must(await save(world, world.claim.id, {}, numericSettings(), false));

		const result = await save(world, world.claim.id, UPDATE, numericSettings());

		expect(result.status).toBe(200);
		expect((await element(node.id)).description).toBe(NUMERIC_NODE_TEXT);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
	});

	it("refuses the update for the old check when a suggestion of another check is stored", async () => {
		const { world, node } = await keptNode();
		must(await save(world, world.claim.id, {}, numericSettings(), false));

		await expectRefusedWithoutWriting(world, itemSettings());

		expect((await element(node.id)).description).toBe(ITEM_NODE_TEXT);
	});

	it("does not count an edit made to the suggestion", async () => {
		const { world, node } = await keptNode();
		must(await save(world, world.claim.id, {}, numericSettings(), false));
		must(await save(world, world.claim.id, {}, systemSettings(), false));

		await expectRefusedWithoutWriting(world, itemSettings());
		const result = await save(world, world.claim.id, UPDATE, systemSettings());

		expect(result.status).toBe(200);
		expect((await element(node.id)).description).toBe(SYSTEM_NODE_TEXT);
	});

	it("compares with the check the text names after the suggestion is discarded", async () => {
		const { world, node } = await keptNode();
		must(await save(world, world.claim.id, {}, numericSettings(), false));
		must(await retire(world.claim.id, {}));

		await expectRefusedWithoutWriting(world, itemSettings());
		const result = await save(world, world.claim.id, UPDATE, numericSettings());

		expect(result.status).toBe(200);
		expect((await element(node.id)).description).toBe(NUMERIC_NODE_TEXT);
	});
});

describe("an edit made while the settings were accepted counts", () => {
	it("moves the check the text names when the edit changes the check and rewrites the text", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		if (!node) {
			throw new Error("no node was made");
		}
		must(await save(world, world.claim.id, UPDATE, numericSettings()));
		expect((await element(node.id)).description).toBe(NUMERIC_NODE_TEXT);
		must(await retire(world.claim.id));

		await expectRefusedWithoutWriting(world, numericSettings());
		const result = await save(world, world.claim.id, UPDATE, systemSettings());

		expect(result.status).toBe(200);
		expect((await element(node.id)).description).toBe(SYSTEM_NODE_TEXT);
	});

	it("takes the check of the newest edit as the one to compare with, whether or not that edit rewrote the text", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		must(await save(world, world.claim.id, {}, numericSettings()));
		must(await retire(world.claim.id));

		await expectRefusedWithoutWriting(world, numericSettings());
		const result = await save(world, world.claim.id, UPDATE, itemSettings());

		expect(result.status).toBe(200);
	});

	it("rewrites the text of accepted settings when the check changes, and refuses it when the check is the same", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		if (!node) {
			throw new Error("no node was made");
		}

		await expectRefusedWithoutWriting(
			world,
			itemSettings({ window: "PT2M" }),
			true
		);
		const result = await save(world, world.claim.id, UPDATE, numericSettings());

		expect(result.status).toBe(200);
		expect((await element(node.id)).description).toBe(NUMERIC_NODE_TEXT);
	});
});

describe("when the kept node is gone", () => {
	it("refuses the update after the node was removed at stopping, and a new node can be added instead", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [old] = await evidenceIn(world.kase.id);
		if (!old) {
			throw new Error("no node was made");
		}
		must(
			await retire(world.claim.id, {
				reason: "Superseded",
				evidence_node: "remove",
			})
		);
		expect(await pointerOf(world.claim.id)).toBeNull();

		await expectRefusedWithoutWriting(world, numericSettings());
		const result = await save(
			world,
			world.claim.id,
			{ add_evidence_node: true },
			numericSettings()
		);

		expect(result.status).toBe(200);
		const nodes = await evidenceIn(world.kase.id);
		expect(nodes).toHaveLength(2);
		const [, fresh] = nodes;
		expect(fresh?.description).toBe(NUMERIC_NODE_TEXT);
		expect((await element(old.id)).deletedAt).not.toBeNull();
		expect(await pointerOf(world.claim.id)).toBe(fresh?.id);
	});

	it("refuses the update when the kept node has since been put in the trash", async () => {
		const { world, node } = await keptNode();
		const trashed = await deleteElement(world.owner.id, node.id);
		expect("error" in trashed).toBe(false);

		await expectRefusedWithoutWriting(world, numericSettings());
	});

	it("refuses the update on accepted settings whose node is no longer live", async () => {
		const world = await nodeWorld();
		must(await save(world, world.claim.id, {}, itemSettings()));

		await expectRefusedWithoutWriting(world, numericSettings());
	});
});

describe("a pipeline that has been renamed", () => {
	it("allows the update for the same check, because the text names the old pipeline", async () => {
		const { world, node } = await keptNode();
		await republish(
			world,
			checkList((list) => {
				list.pipeline = "Renamed inspection pipeline";
			})
		);

		const result = await save(world, world.claim.id, UPDATE, itemSettings());

		expect(result.status).toBe(200);
		expect((await element(node.id)).description).toBe(
			ITEM_NODE_TEXT.replace(
				HEALTH_CHECK_PIPELINE,
				"Renamed inspection pipeline"
			)
		);
	});

	it("still refuses the update for the same check when the pipeline kept its name", async () => {
		const { world } = await keptNode();
		await republish(world, checkList());

		await expectRefusedWithoutWriting(world, itemSettings());
	});
});

describe("the settings read names the check the node's text was written for", () => {
	it("reports the node's text and the check and pipeline it names while the node is live", async () => {
		const { world, node } = await keptNode();

		const view = await readView(world.claim.id);

		expect(view.status).toBe(200);
		expect(view.body.evidence_node).toMatchObject({
			id: node.id,
			state: "live",
		});
		expect(view.body.evidence_node_text).toEqual({
			description: ITEM_NODE_TEXT,
			written_for: { check: ITEM_CHECK_NAME, pipeline: HEALTH_CHECK_PIPELINE },
		});
	});

	it("keeps naming the old check while a suggestion of another check is stored", async () => {
		const { world } = await keptNode();
		must(await save(world, world.claim.id, {}, numericSettings(), false));

		const view = await readView(world.claim.id);

		expect(view.body.criteria.state).toBe("suggested");
		expect(view.body.evidence_node_text.written_for.check).toBe(
			ITEM_CHECK_NAME
		);
	});

	it("names the new check after an edit that rewrote the text", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		must(await save(world, world.claim.id, UPDATE, numericSettings()));

		const view = await readView(world.claim.id);

		expect(view.body.evidence_node_text).toEqual({
			description: NUMERIC_NODE_TEXT,
			written_for: {
				check: NUMERIC_CHECK_NAME,
				pipeline: HEALTH_CHECK_PIPELINE,
			},
		});
	});

	it("reports no text once the node is out of the claim's reach", async () => {
		const { world, node } = await keptNode();
		await deleteElement(world.owner.id, node.id);

		const view = await readView(world.claim.id);

		expect(view.body.evidence_node.state).toBe("trashed");
		expect(view.body.evidence_node_text).toBeNull();
	});
});
