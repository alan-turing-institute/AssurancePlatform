import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
} from "../fixtures/health-checks";

import { mockNoAuth } from "../utils/auth-helpers";
import { itemSettings } from "../utils/health-criteria-kit";
import {
	acceptWithNode,
	checkList,
	ITEM_NODE_TEXT,
	NUMERIC_NODE_TEXT,
	nodeWorld,
	numericSettings,
	postNode,
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

const REWRITE = { update_evidence_node_text: true };

async function nodeTextOf(world: { kase: { id: string } }) {
	const [node] = await prisma.assuranceElement.findMany({
		where: { caseId: world.kase.id, elementType: "EVIDENCE" },
	});
	return node?.description;
}

/** Throws unless a step that sets a test up answered 200. */
function must(result: { body: unknown; status: number }) {
	if (result.status !== 200) {
		throw new Error(
			`step answered ${result.status}: ${JSON.stringify(result.body)}`
		);
	}
}

/** A claim accepted with its node, then stopped with the node kept. */
async function keptNodeWorld() {
	const world = await nodeWorld();
	await acceptWithNode(world);
	must(
		await retire(world.claim.id, {
			reason: "Superseded",
			evidence_node: "keep",
		})
	);
	return world;
}

describe("accepting a suggestion over a kept node", () => {
	it("allows the text update when the suggestion names a different check, which the settings row no longer shows", async () => {
		const world = await keptNodeWorld();
		expect(
			(await save(world, world.claim.id, {}, numericSettings(), false)).status
		).toBe(200);

		const accepted = await save(
			world,
			world.claim.id,
			REWRITE,
			numericSettings()
		);

		expect(accepted.status).toBe(200);
		expect(await nodeTextOf(world)).toBe(NUMERIC_NODE_TEXT);
		expect(accepted.body.evidence_node).toMatchObject({ state: "live" });
	});

	it("refuses the text update when the check accepted is the one the node's text already names", async () => {
		const world = await keptNodeWorld();
		await save(world, world.claim.id, {}, numericSettings(), false);

		const refused = await save(world, world.claim.id, REWRITE, itemSettings());

		expect(refused.status).toBe(400);
		expect(refused.body.fieldErrors).toHaveProperty(
			"update_evidence_node_text"
		);
		expect(await nodeTextOf(world)).toBe(ITEM_NODE_TEXT);
	});

	it("does not count an edit of the suggestion as the check the text was written for", async () => {
		const world = await keptNodeWorld();
		await save(world, world.claim.id, {}, numericSettings(), false);
		const edited = await save(
			world,
			world.claim.id,
			{},
			numericSettings({ window: "PT2M" }),
			false
		);
		expect(edited.status).toBe(200);

		const accepted = await save(
			world,
			world.claim.id,
			REWRITE,
			numericSettings({ window: "PT2M" })
		);

		expect(accepted.status).toBe(200);
		expect(await nodeTextOf(world)).toBe(NUMERIC_NODE_TEXT);
	});

	it("compares with the check of the newest edit of accepted settings", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		await save(world, world.claim.id, REWRITE, numericSettings(), true);
		await retire(world.claim.id, { reason: "Superseded" });
		await save(world, world.claim.id, {}, itemSettings(), false);

		const same = await save(world, world.claim.id, REWRITE, numericSettings());
		expect(same.status).toBe(400);

		const different = await save(
			world,
			world.claim.id,
			REWRITE,
			itemSettings()
		);
		expect(different.status).toBe(200);
		expect(await nodeTextOf(world)).toBe(ITEM_NODE_TEXT);
	});

	it("allows the text update after a discarded suggestion, when the check differs from the node's", async () => {
		const world = await keptNodeWorld();
		await save(world, world.claim.id, {}, numericSettings(), false);
		expect((await retire(world.claim.id, {})).status).toBe(200);

		const accepted = await save(
			world,
			world.claim.id,
			REWRITE,
			numericSettings()
		);

		expect(accepted.status).toBe(200);
		expect(await nodeTextOf(world)).toBe(NUMERIC_NODE_TEXT);
	});

	it("stores nothing when the update is refused", async () => {
		const world = await keptNodeWorld();
		await save(world, world.claim.id, {}, numericSettings(), false);
		const before = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: world.claim.id },
		});

		await save(world, world.claim.id, REWRITE, itemSettings());

		const after = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: world.claim.id },
		});
		expect(after.revision).toBe(before.revision);
		expect(after.state).toBe("SUGGESTED");
	});
});

describe("the settings read of a kept node", () => {
	it("serves the node's text and the check that text names, so a form can offer the update", async () => {
		const world = await keptNodeWorld();
		await save(world, world.claim.id, {}, numericSettings(), false);

		const view = await readView(world.claim.id);

		expect(view.body.evidence_node).toMatchObject({ state: "live" });
		expect(view.body.evidence_node_text).toEqual({
			description: ITEM_NODE_TEXT,
			written_for: { check: ITEM_CHECK_NAME, pipeline: HEALTH_CHECK_PIPELINE },
		});
	});

	it("serves neither once the node is in the trash", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		await prisma.assuranceElement.updateMany({
			where: { caseId: world.kase.id, elementType: "EVIDENCE" },
			data: { deletedAt: new Date() },
		});

		const view = await readView(world.claim.id);

		expect(view.body.evidence_node).toMatchObject({ state: "trashed" });
		expect(view.body.evidence_node_text).toBeNull();
	});

	it("serves no text for a claim without a node", async () => {
		const world = await nodeWorld();
		must(await save(world, world.claim.id));

		const view = await readView(world.claim.id);

		expect(view.body.evidence_node).toBeNull();
		expect(view.body.evidence_node_text).toBeNull();
	});
});

describe("adding the node afterwards, when the pipeline's check list is gone", () => {
	/** Settings accepted without a node, then the check list (or the whole integration) removed. */
	async function worldWithoutPipeline(
		remove: "check list" | "integration",
		afterRename = false
	) {
		const world = await nodeWorld();
		must(await save(world, world.claim.id));
		if (afterRename) {
			await republish(
				world,
				checkList((list) => {
					list.pipeline = "Renamed pipeline";
				})
			);
			must(
				await save(world, world.claim.id, {}, itemSettings({ window: "PT2M" }))
			);
		}
		if (remove === "check list") {
			await prisma.pluginHealthCheckCatalogue.deleteMany({
				where: { integrationId: world.integration.id },
			});
		} else {
			await prisma.integration.delete({ where: { id: world.integration.id } });
		}
		return world;
	}

	it.each([
		"check list",
		"integration",
	] as const)("names the pipeline recorded on the newest revision when the %s is deleted", async (remove) => {
		const world = await worldWithoutPipeline(remove);

		const added = await postNode(world.claim.id);

		expect(added.status).toBe(200);
		expect(await nodeTextOf(world)).toBe(ITEM_NODE_TEXT);
	});

	it("takes the name from the newest revision, not an older one", async () => {
		const world = await worldWithoutPipeline("check list", true);

		const added = await postNode(world.claim.id);

		expect(added.status).toBe(200);
		expect(await nodeTextOf(world)).toContain("run by Renamed pipeline.");
		expect(await nodeTextOf(world)).not.toContain(HEALTH_CHECK_PIPELINE);
	});
});
