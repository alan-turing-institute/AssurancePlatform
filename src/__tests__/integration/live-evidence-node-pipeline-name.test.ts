import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { deleteIntegrationRegistration } from "@/lib/services/integration-registry-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
} from "../fixtures/health-checks";
import { mockNoAuth } from "../utils/auth-helpers";
import { itemSettings } from "../utils/health-criteria-kit";
import {
	checkList,
	element,
	evidenceIn,
	ITEM_NODE_TEXT,
	type NodeWorld,
	nodeWorld,
	pointerOf,
	postNode,
	republish,
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

const RENAMED = "Renamed inspection pipeline";

function must(result: { body: unknown; status: number }) {
	if (result.status !== 200) {
		throw new Error(
			`step answered ${result.status}: ${JSON.stringify(result.body)}`
		);
	}
}

/** The first check accepted without a node, then the pipeline renamed and one accepted setting edited under the new name. */
async function acceptedWithoutNodeAfterRename() {
	const world = await nodeWorld();
	must(await save(world, world.claim.id));
	await republish(
		world,
		checkList((list) => {
			list.pipeline = RENAMED;
		})
	);
	must(await save(world, world.claim.id, {}, itemSettings({ window: "PT2M" })));
	return world;
}

async function theNode(world: NodeWorld) {
	const [node] = await evidenceIn(world.kase.id);
	if (!node) {
		throw new Error("no node was made");
	}
	return node;
}

describe("adding the node for settings accepted without one", () => {
	it("names the pipeline from its check list while the list is still published", async () => {
		const world = await nodeWorld();
		must(await save(world, world.claim.id));

		const result = await postNode(world.claim.id);

		expect(result.status).toBe(200);
		expect((await theNode(world)).description).toBe(ITEM_NODE_TEXT);
	});

	it("names the pipeline recorded on the newest revision once the check list is gone", async () => {
		const world = await acceptedWithoutNodeAfterRename();
		await prisma.pluginHealthCheckCatalogue.delete({
			where: { integrationId: world.integration.id },
		});

		const result = await postNode(world.claim.id);

		expect(result.status).toBe(200);
		const node = await theNode(world);
		expect(node.description).toContain(`run by ${RENAMED}.`);
		expect(node.description).not.toContain(HEALTH_CHECK_PIPELINE);
		expect(node.description).toContain(`Results from the ${ITEM_CHECK_NAME}`);
		expect(await pointerOf(world.claim.id)).toBe(node.id);
	});

	it("names the pipeline recorded on the newest revision once the integration is deleted", async () => {
		const world = await acceptedWithoutNodeAfterRename();
		const deleted = await deleteIntegrationRegistration(
			world.integration.id,
			world.owner.id
		);
		expect("error" in deleted).toBe(false);
		const settings = await prisma.pluginHealthCriteria.findUnique({
			where: { claimId: world.claim.id },
		});
		expect(settings?.integrationId).toBeNull();

		const result = await postNode(world.claim.id);

		expect(result.status).toBe(200);
		expect((await theNode(world)).description).toContain(`run by ${RENAMED}.`);
		expect(result.body.evidence_node).toMatchObject({ state: "live" });
	});

	it("skips newer revisions that recorded no pipeline name", async () => {
		const world = await acceptedWithoutNodeAfterRename();
		await prisma.pluginHealthCheckCatalogue.delete({
			where: { integrationId: world.integration.id },
		});
		await prisma.pluginHealthCriteriaRevision.updateMany({
			where: { claimId: world.claim.id, revision: 2 },
			data: { pipelineName: null },
		});

		const result = await postNode(world.claim.id);

		expect(result.status).toBe(200);
		expect((await theNode(world)).description).toContain(
			`run by ${HEALTH_CHECK_PIPELINE}.`
		);
	});

	it("falls back to a neutral wording when no revision recorded a pipeline name", async () => {
		const world = await nodeWorld();
		must(await save(world, world.claim.id));
		await prisma.pluginHealthCheckCatalogue.delete({
			where: { integrationId: world.integration.id },
		});
		await prisma.pluginHealthCriteriaRevision.updateMany({
			where: { claimId: world.claim.id },
			data: { pipelineName: null },
		});

		const result = await postNode(world.claim.id);

		expect(result.status).toBe(200);
		const { description } = await element((await theNode(world)).id);
		expect(description).toContain("run by its pipeline.");
		expect(description).toContain(`Results from the ${ITEM_CHECK_NAME}`);
	});
});
