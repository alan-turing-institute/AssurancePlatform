import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
} from "../fixtures/health-checks";
import { mockNoAuth } from "../utils/auth-helpers";
import { callCriteriaPut, itemSettings } from "../utils/health-criteria-kit";
import {
	acceptWithNode,
	addClaim,
	checkList,
	collaborator,
	element,
	eventTypes,
	evidenceIn,
	failOn,
	ITEM_NODE_TEXT,
	linksOf,
	linksTo,
	liveIds,
	type NodeWorld,
	NUMERIC_NODE_TEXT,
	nodeWorld,
	numericSettings,
	pointerOf,
	readView,
	republish,
	retire,
	revisionCount,
	save,
	saveBodyOf,
	signIn,
	storedState,
} from "../utils/live-node-kit";
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
	vi.mocked(emitSSEEvent).mockClear();
});

/** How many settings rows, history rows and evidence elements the world holds. */
async function stored(world: NodeWorld) {
	return {
		settings: await prisma.pluginHealthCriteria.count({
			where: { claim: { caseId: world.kase.id } },
		}),
		history: await prisma.pluginHealthCriteriaRevision.count({
			where: { claim: { caseId: world.kase.id } },
		}),
		evidence: (await evidenceIn(world.kase.id)).length,
	};
}

const NOTHING = { settings: 0, history: 0, evidence: 0 };

/**
 * Proves, on a case of its own, that both options work when the state allows
 * them, so a refusal in the test that calls it is the state's doing and not a
 * server that does not know the options at all.
 */
async function optionsAreSupported() {
	const other = await nodeWorld();
	const added = await save(other, other.claim.id, { add_evidence_node: true });
	const rewritten = await save(
		other,
		other.claim.id,
		{ update_evidence_node_text: true },
		numericSettings()
	);
	if (added.status !== 200 || rewritten.status !== 200) {
		throw new Error(
			`the options are not supported: ${added.status} then ${rewritten.status}`
		);
	}
}

describe("accepting with add_evidence_node", () => {
	it("creates exactly one evidence element under the claim, made by the person who accepts, with the check's text", async () => {
		const world = await nodeWorld();
		for (const name of ["E1", "E2"]) {
			await createTestElement(world.kase.id, world.owner.id, {
				elementType: "EVIDENCE",
				name,
				description: `Existing ${name}`,
			});
		}
		const editor = await collaborator(world, "EDIT");
		await signIn(editor);

		const result = await save(world, world.claim.id, {
			add_evidence_node: true,
		});

		expect(result.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(3);
		const node = evidence[2];
		expect(node).toMatchObject({
			elementType: "EVIDENCE",
			name: "E3",
			description: ITEM_NODE_TEXT,
			createdById: editor.id,
			caseId: world.kase.id,
			parentId: null,
			inSandbox: false,
			isDefeater: false,
			deletedAt: null,
		});
		expect(await linksTo(world.claim.id)).toEqual([
			expect.objectContaining({ evidenceId: node?.id }),
		]);
		expect(await pointerOf(world.claim.id)).toBe(node?.id);
		expect(result.body.evidence_node).toEqual({
			id: node?.id,
			name: "E3",
			state: "live",
		});
		expect(await revisionCount(world.claim.id)).toBe(1);
	});

	it("names the pipeline from its check list, not the integration's registered name", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		expect(node?.description).toContain(`run by ${HEALTH_CHECK_PIPELINE}.`);
		const integration = await prisma.integration.findUniqueOrThrow({
			where: { id: world.integration.id },
		});
		expect(node?.description).not.toContain(integration.name);
	});

	it("builds the node like one made through the ordinary create path", async () => {
		const world = await nodeWorld();
		const other = await addClaim(world, "P2");
		const { createElement } = await import("@/lib/services/element-service");
		const ordinary = await createElement(world.owner.id, {
			caseId: world.kase.id,
			elementType: "EVIDENCE",
			description: "An ordinary node",
			parentId: other.id,
		} as never);
		expect("data" in ordinary).toBe(true);
		await acceptWithNode(world);
		const [ordinaryRow, nodeRow] = await evidenceIn(world.kase.id);
		const shape = (row: typeof ordinaryRow) => ({
			role: row?.role,
			parentId: row?.parentId,
			url: row?.url,
			urls: row?.urls,
			level: row?.level,
			assumption: row?.assumption,
			justification: row?.justification,
			context: row?.context,
			assertionStatus: row?.assertionStatus,
			fromPattern: row?.fromPattern,
			moduleReferenceId: row?.moduleReferenceId,
			citedElementId: row?.citedElementId,
			defeatsElementId: row?.defeatsElementId,
		});
		expect(shape(nodeRow)).toEqual(shape(ordinaryRow));
		expect(ordinaryRow?.name).toBe("E1");
		expect(nodeRow?.name).toBe("E2");
	});

	it.each([
		["the field is absent", {}],
		["the field is false", { add_evidence_node: false }],
	])("creates no element when %s", async (_label, extra) => {
		const world = await nodeWorld();
		const result = await save(world, world.claim.id, extra);
		expect(result.status).toBe(200);
		expect(result.body.criteria.state).toBe("accepted");
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
		expect(await pointerOf(world.claim.id)).toBeNull();
		expect(result.body.evidence_node).toBeNull();
		expect(eventTypes().some((type) => type.startsWith("element:"))).toBe(
			false
		);
	});

	it("leaves out the sentence on what the check measures when the check has no description", async () => {
		const list = checkList((l) => {
			for (const check of l.checks) {
				// biome-ignore lint/performance/noDelete: the field must be absent from the list
				delete (check as { description?: string }).description;
			}
		});
		const world = await nodeWorld({ list });
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		expect(node?.description).toBe(
			`Results from the ${ITEM_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}.`
		);
	});

	it("announces the new element before the health change, naming the element and the person", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const types = eventTypes();
		expect(types).toContain("element:created");
		expect(types).toContain("tea.health/state-changed");
		expect(types.indexOf("element:created")).toBeLessThan(
			types.indexOf("tea.health/state-changed")
		);
		const [node] = await evidenceIn(world.kase.id);
		const created = vi
			.mocked(emitSSEEvent)
			.mock.calls.find((call) => call[0] === "element:created");
		expect(created?.[1]).toBe(world.kase.id);
		expect(created?.[2]).toMatchObject({
			elementName: node?.name,
			userId: world.owner.id,
			element: expect.objectContaining({
				id: node?.id,
				propertyClaimId: [world.claim.id],
			}),
		});
	});

	it("makes the case's last-changed time move, so an open JSON editor is told to reload", async () => {
		const world = await nodeWorld();
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: world.kase.id },
		});
		await new Promise((resolve) => setTimeout(resolve, 15));
		await acceptWithNode(world);
		const after = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: world.kase.id },
		});
		expect(after.updatedAt.getTime()).toBeGreaterThan(
			before.updatedAt.getTime()
		);
		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);
		const stale = await applyBatchUpdate(world.owner.id, world.kase.id, [], {
			expectedVersion: before.updatedAt.toISOString(),
		});
		expect(stale).toMatchObject({ conflictDetected: true });
	});
});

describe("the whole acceptance is one transaction", () => {
	it("stores no settings and no node when the pointer to the node cannot be written", async () => {
		const world = await nodeWorld();
		const undo = await failOn(
			"plugin_health_criteria",
			"NEW.evidence_element_id IS NOT NULL"
		);
		try {
			const result = await save(world, world.claim.id, {
				add_evidence_node: true,
			});
			expect(result.status).toBe(500);
		} finally {
			await undo();
		}
		expect(await stored(world)).toEqual(NOTHING);
		expect(await prisma.pluginHealthClaimState.count()).toBe(0);
		expect(eventTypes()).not.toContain("element:created");
	});

	it("stores no node when the history row cannot be written", async () => {
		const world = await nodeWorld();
		const undo = await failOn("plugin_health_criteria_revisions", "true");
		try {
			const result = await save(world, world.claim.id, {
				add_evidence_node: true,
			});
			expect(result.status).toBe(500);
		} finally {
			await undo();
		}
		expect(await stored(world)).toEqual(NOTHING);
	});

	it("stores no settings when the node cannot be created", async () => {
		const world = await nodeWorld();
		const undo = await failOn(
			"assurance_elements",
			"NEW.element_type = 'EVIDENCE'"
		);
		try {
			const result = await save(world, world.claim.id, {
				add_evidence_node: true,
			});
			expect(result.status).toBe(500);
		} finally {
			await undo();
		}
		expect(await stored(world)).toEqual(NOTHING);
	});
});

describe("add_evidence_node is refused unless the save starts to accept", () => {
	it("refuses it on a suggestion, naming the field, and stores nothing", async () => {
		await optionsAreSupported();
		const world = await nodeWorld();
		const result = await save(
			world,
			world.claim.id,
			{ add_evidence_node: true },
			itemSettings(),
			false
		);
		expect(result.status).toBe(400);
		expect(JSON.stringify(result.body)).toContain("add_evidence_node");
		expect(await stored(world)).toEqual(NOTHING);
	});

	it("refuses it on an edit of settings that were accepted without a node", async () => {
		await optionsAreSupported();
		const world = await nodeWorld();
		expect((await save(world, world.claim.id)).status).toBe(200);
		const result = await save(
			world,
			world.claim.id,
			{ add_evidence_node: true },
			itemSettings({ window: "PT2M" })
		);
		expect(result.status).toBe(400);
		expect(JSON.stringify(result.body)).toContain("add_evidence_node");
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
		expect(await revisionCount(world.claim.id)).toBe(1);
	});

	it("refuses it on an edit of settings that already have a node, and adds no second one", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const result = await save(
			world,
			world.claim.id,
			{ add_evidence_node: true },
			itemSettings({ window: "PT2M" })
		);
		expect(result.status).toBe(400);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(await revisionCount(world.claim.id)).toBe(1);
	});

	it("refuses it on a re-save of the very same accepted settings", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const result = await save(world, world.claim.id, {
			add_evidence_node: true,
		});
		expect(result.status).toBe(400);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
	});

	it("allows it when a suggestion is accepted", async () => {
		const world = await nodeWorld();
		expect(
			(await save(world, world.claim.id, {}, itemSettings(), false)).status
		).toBe(200);
		const result = await save(world, world.claim.id, {
			add_evidence_node: true,
		});
		expect(result.status).toBe(200);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(result.body.evidence_node?.state).toBe("live");
	});

	it("allows it when retired settings are accepted again", async () => {
		const world = await nodeWorld();
		expect((await save(world, world.claim.id)).status).toBe(200);
		expect((await retire(world.claim.id)).status).toBe(200);
		const result = await save(world, world.claim.id, {
			add_evidence_node: true,
		});
		expect(result.status).toBe(200);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
	});

	it.each([
		["a string", "yes"],
		["a number", 1],
		["null", null],
	])("rejects %s for the field as a 400", async (_label, value) => {
		await optionsAreSupported();
		const world = await nodeWorld();
		const result = await save(world, world.claim.id, {
			add_evidence_node: value,
		});
		expect(result.status).toBe(400);
		expect(await stored(world)).toEqual(NOTHING);
	});

	it("still rejects a field it does not know", async () => {
		const world = await nodeWorld();
		const result = await save(world, world.claim.id, {
			add_evidence_nodes: true,
		});
		expect(result.status).toBe(400);
		expect(await stored(world)).toEqual(NOTHING);
	});
});

describe("no path makes a second node while one is live", () => {
	it("repeated edits of accepted settings leave the one node, untouched", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [before] = await evidenceIn(world.kase.id);
		for (const window of ["PT2M", "PT3M"]) {
			const result = await save(
				world,
				world.claim.id,
				{},
				itemSettings({ window })
			);
			expect(result.status).toBe(200);
		}
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(1);
		expect(evidence[0]?.id).toBe(before?.id);
		expect(evidence[0]?.description).toBe(before?.description);
		expect(await linksTo(world.claim.id)).toHaveLength(1);
	});

	it("accepting again after retirement with keep reuses the kept node and keeps its maker", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [first] = await evidenceIn(world.kase.id);
		expect(
			(await retire(world.claim.id, { reason: "Pause", evidence_node: "keep" }))
				.status
		).toBe(200);
		const editor = await collaborator(world, "EDIT");
		await signIn(editor);

		const again = await save(world, world.claim.id, {
			add_evidence_node: true,
		});

		expect(again.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(1);
		expect(evidence[0]?.id).toBe(first?.id);
		expect(evidence[0]?.createdById).toBe(world.owner.id);
		expect(await pointerOf(world.claim.id)).toBe(first?.id);
		expect(await linksTo(world.claim.id)).toHaveLength(1);
		expect(again.body.evidence_node).toMatchObject({
			id: first?.id,
			state: "live",
		});
		expect(await liveIds(world.kase.id)).toEqual([first?.id]);
	});

	it("accepting again after retirement without the field brings the kept node back to life", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [first] = await evidenceIn(world.kase.id);
		expect((await retire(world.claim.id)).status).toBe(200);
		expect(await liveIds(world.kase.id)).toEqual([]);

		expect((await save(world, world.claim.id)).status).toBe(200);

		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(await liveIds(world.kase.id)).toEqual([first?.id]);
	});

	it("two acceptances at the same moment make exactly one node", async () => {
		const world = await nodeWorld();
		const body = saveBodyOf(world, { add_evidence_node: true });
		const statuses = (
			await Promise.all([
				callCriteriaPut(world.claim.id, body),
				callCriteriaPut(world.claim.id, body),
			])
		).map((response) => response.status);
		expect(statuses.sort()).toEqual([200, 400]);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(await linksTo(world.claim.id)).toHaveLength(1);
	});

	it("gives each claim its own node when two claims are accepted", async () => {
		const world = await nodeWorld();
		const second = await addClaim(world, "P2");
		await acceptWithNode(world);
		await acceptWithNode(world, second.id);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(2);
		expect(await pointerOf(world.claim.id)).not.toBe(
			await pointerOf(second.id)
		);
		expect(new Set(evidence.map((row) => row.name)).size).toBe(2);
		expect((await liveIds(world.kase.id)).sort()).toEqual(
			evidence.map((row) => row.id).sort()
		);
	});

	it("replaces a kept node that has moved to another claim, and leaves the moved one where it is", async () => {
		const world = await nodeWorld();
		const other = await addClaim(world, "P2");
		await acceptWithNode(world);
		const [kept] = await evidenceIn(world.kase.id);
		expect((await retire(world.claim.id)).status).toBe(200);
		const { moveElement } = await import("@/lib/services/element-service");
		expect(
			"data" in (await moveElement(world.owner.id, kept?.id ?? "", other.id))
		).toBe(true);

		const again = await save(world, world.claim.id, {
			add_evidence_node: true,
		});

		expect(again.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(2);
		const fresh = evidence.find((row) => row.id !== kept?.id);
		expect(await pointerOf(world.claim.id)).toBe(fresh?.id);
		expect((await linksOf(kept?.id ?? "")).map((l) => l.claimId)).toEqual([
			other.id,
		]);
		expect((await linksOf(fresh?.id ?? "")).map((l) => l.claimId)).toEqual([
			world.claim.id,
		]);
		expect(await liveIds(world.kase.id)).toEqual([fresh?.id]);
	});

	it("replaces a kept node that is in the trash, and leaves the trashed one there", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [kept] = await evidenceIn(world.kase.id);
		expect((await retire(world.claim.id)).status).toBe(200);
		const { deleteElement } = await import("@/lib/services/element-service");
		expect(
			"data" in (await deleteElement(world.owner.id, kept?.id ?? ""))
		).toBe(true);

		const again = await save(world, world.claim.id, {
			add_evidence_node: true,
		});

		expect(again.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(2);
		expect((await element(kept?.id ?? "")).deletedAt).not.toBeNull();
		const fresh = evidence.find((row) => row.id !== kept?.id);
		expect(fresh?.deletedAt).toBeNull();
		expect(await pointerOf(world.claim.id)).toBe(fresh?.id);
	});

	it("a kept node that is in the trash stays plain when the claim is accepted again without the field", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [kept] = await evidenceIn(world.kase.id);
		expect((await retire(world.claim.id)).status).toBe(200);
		const { deleteElement } = await import("@/lib/services/element-service");
		await deleteElement(world.owner.id, kept?.id ?? "");

		const again = await save(world, world.claim.id);

		expect(again.status).toBe(200);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(again.body.evidence_node).toMatchObject({ state: "trashed" });
		expect(await liveIds(world.kase.id)).toEqual([]);
	});
});

describe("update_evidence_node_text", () => {
	it("rewrites the node's text to name the new check, keeping its identifier, link and maker", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [before] = await evidenceIn(world.kase.id);

		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			numericSettings()
		);

		expect(result.status).toBe(200);
		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(1);
		expect(evidence[0]).toMatchObject({
			id: before?.id,
			name: before?.name,
			description: NUMERIC_NODE_TEXT,
			createdById: before?.createdById,
			deletedAt: null,
		});
		expect(await linksTo(world.claim.id)).toHaveLength(1);
		expect(result.body.evidence_node).toMatchObject({
			id: before?.id,
			state: "live",
		});
		const types = eventTypes();
		expect(types).toContain("element:updated");
		expect(types.indexOf("element:updated")).toBeLessThan(
			types.lastIndexOf("tea.health/state-changed")
		);
	});

	it("takes the new check's description from the check list as published now", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		await republish(
			world,
			checkList((list) => {
				for (const check of list.checks) {
					if (check.name === NUMERIC_CHECK_NAME) {
						check.description = "a description revised since";
					}
				}
			})
		);
		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			numericSettings()
		);
		expect(result.status).toBe(200);
		const [node] = await evidenceIn(world.kase.id);
		expect(node?.description).toBe(
			`Results from the ${NUMERIC_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: a description revised since.`
		);
	});

	it("leaves the node's text as the author left it when the option is not sent", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		await prisma.assuranceElement.update({
			where: { id: node?.id },
			data: { description: "Rewritten by the author" },
		});
		const result = await save(world, world.claim.id, {}, numericSettings());
		expect(result.status).toBe(200);
		expect((await element(node?.id ?? "")).description).toBe(
			"Rewritten by the author"
		);
	});

	it("replaces a text the author edited when the option is sent", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		await prisma.assuranceElement.update({
			where: { id: node?.id },
			data: { description: "Rewritten by the author" },
		});
		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			numericSettings()
		);
		expect(result.status).toBe(200);
		expect((await element(node?.id ?? "")).description).toBe(NUMERIC_NODE_TEXT);
	});

	it("refuses the option when the check does not change, and stores nothing", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			itemSettings({ window: "PT2M" })
		);
		expect(result.status).toBe(400);
		expect(JSON.stringify(result.body)).toContain("update_evidence_node_text");
		expect(await revisionCount(world.claim.id)).toBe(1);
		expect((await element(node?.id ?? "")).description).toBe(ITEM_NODE_TEXT);
	});

	it("refuses the option on a re-save of the very same settings", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const result = await save(world, world.claim.id, {
			update_evidence_node_text: true,
		});
		expect(result.status).toBe(400);
		expect(await revisionCount(world.claim.id)).toBe(1);
	});

	it.each([
		["has no node", "none"],
		["has a node that was moved to another claim", "moved"],
		["has a node in the trash", "trashed"],
		["has a node in the sandbox", "sandbox"],
		["has a node turned into a defeater", "defeater"],
	])("refuses the option when the claim %s, and stores nothing", async (_label, how) => {
		await optionsAreSupported();
		const world = await nodeWorld();
		const other = await addClaim(world, "P2");
		if (how === "none") {
			await save(world, world.claim.id);
		} else {
			await acceptWithNode(world);
			const [node] = await evidenceIn(world.kase.id);
			const id = node?.id ?? "";
			if (how === "moved") {
				await prisma.evidenceLink.deleteMany({ where: { evidenceId: id } });
				await prisma.evidenceLink.create({
					data: { evidenceId: id, claimId: other.id },
				});
			}
			if (how === "trashed") {
				await prisma.assuranceElement.update({
					where: { id },
					data: { deletedAt: new Date() },
				});
			}
			if (how === "sandbox") {
				await prisma.assuranceElement.update({
					where: { id },
					data: { inSandbox: true },
				});
			}
			if (how === "defeater") {
				await prisma.assuranceElement.update({
					where: { id },
					data: { isDefeater: true },
				});
			}
		}
		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			numericSettings()
		);
		expect(result.status).toBe(400);
		expect(await revisionCount(world.claim.id)).toBe(1);
		const stored = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: world.claim.id },
		});
		expect(stored.checkName).toBe(ITEM_CHECK_NAME);
		for (const row of await evidenceIn(world.kase.id)) {
			expect(row.description).toBe(ITEM_NODE_TEXT);
		}
	});

	it("refuses the option on a suggestion", async () => {
		await optionsAreSupported();
		const world = await nodeWorld();
		expect(
			(await save(world, world.claim.id, {}, itemSettings(), false)).status
		).toBe(200);
		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			numericSettings(),
			false
		);
		expect(result.status).toBe(400);
	});

	it("treats a false value as no option", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: false },
			numericSettings()
		);
		expect(result.status).toBe(200);
		const [node] = await evidenceIn(world.kase.id);
		expect(node?.description).toBe(ITEM_NODE_TEXT);
	});

	it("rejects a value that is not a boolean as a 400", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: "yes" },
			numericSettings()
		);
		expect(result.status).toBe(400);
	});
});

describe("the existing request shapes behave as before", () => {
	it("a save with none of the new fields accepts, binds the claim and answers with every field it used to", async () => {
		const world = await nodeWorld();
		const result = await save(world, world.claim.id);
		expect(result.status).toBe(200);
		for (const key of [
			"criteria",
			"check_description",
			"integration",
			"accepted_by",
			"last_change",
			"pipeline_read",
			"check_offer",
			"latest_result",
		]) {
			expect(result.body).toHaveProperty(key);
		}
		expect(result.body.criteria.state).toBe("accepted");
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
		expect(await prisma.pluginHealthClaimState.count()).toBe(1);
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
	});

	it("a retirement with only a reason still retires and touches no node", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [before] = await evidenceIn(world.kase.id);
		const result = await retire(world.claim.id, { reason: "Superseded" });
		expect(result.status).toBe(200);
		expect(result.body.criteria.state).toBe("inactive");
		const [after] = await evidenceIn(world.kase.id);
		expect(after).toEqual(before);
		expect(await pointerOf(world.claim.id)).toBe(before?.id);
		expect(await linksTo(world.claim.id)).toHaveLength(1);
	});

	it("a retirement still needs a reason for accepted settings", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const result = await retire(world.claim.id, { evidence_node: "remove" });
		expect(result.status).toBe(400);
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
		const [node] = await evidenceIn(world.kase.id);
		expect(node?.deletedAt).toBeNull();
	});

	it("a retirement rejects an evidence_node choice that is neither keep nor remove", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		for (const choice of ["delete", "", 1, null, true]) {
			const result = await retire(world.claim.id, {
				reason: "x",
				evidence_node: choice,
			});
			expect(result.status).toBe(400);
		}
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
	});

	it("a retirement still rejects a field it does not know", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const result = await retire(world.claim.id, {
			reason: "x",
			evidence_nodes: "remove",
		});
		expect(result.status).toBe(400);
	});

	it("the settings read of a claim that never had settings answers null for the node", async () => {
		const world = await nodeWorld();
		const view = await readView(world.claim.id);
		expect(view.status).toBe(200);
		expect(view.body.criteria).toBeNull();
		expect(view.body.evidence_node).toBeNull();
	});

	it("the settings read of a claim with settings and no node answers null for the node", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id);
		const view = await readView(world.claim.id);
		expect(view.body.evidence_node).toBeNull();
	});
});

describe("the pipeline's own reads are unchanged", () => {
	it("the machine read of a claim's settings carries nothing about the node", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const { callMachineClaimCriteria, callMachineCaseCriteria } = await import(
			"../utils/health-criteria-kit"
		);
		for (const response of [
			await callMachineClaimCriteria(world.claim.id, world.secret),
			await callMachineCaseCriteria(world.kase.id, world.secret),
		]) {
			expect(response.status).toBe(200);
			const text = JSON.stringify(await response.json());
			expect(text).not.toContain("evidence_node");
			expect(text).not.toContain("evidence_element");
			expect(text).not.toContain("Results from the");
		}
	});
});

describe("what the node leaves alone", () => {
	it("never changes the claim's own text, status or place", async () => {
		const world = await nodeWorld();
		await prisma.assuranceElement.update({
			where: { id: world.claim.id },
			data: { assertionStatus: "NEEDS_SUPPORT" },
		});
		const before = await element(world.claim.id);

		await acceptWithNode(world);
		const afterAccept = await element(world.claim.id);
		await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			numericSettings()
		);
		await retire(world.claim.id, { reason: "x", evidence_node: "remove" });
		const afterRetire = await element(world.claim.id);

		for (const after of [afterAccept, afterRetire]) {
			expect(after.assertionStatus).toBe("NEEDS_SUPPORT");
			expect(after.description).toBe(before.description);
			expect(after.name).toBe(before.name);
			expect(after.parentId).toBe(before.parentId);
			expect(after.level).toBe(before.level);
			expect(after.deletedAt).toBeNull();
		}
	});

	it("adds its own node beside evidence the author already attached, and never adopts or removes that evidence", async () => {
		const world = await nodeWorld();
		const authored = await createTestElement(world.kase.id, world.owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
			description: "An audit report",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: authored.id, claimId: world.claim.id },
		});

		await acceptWithNode(world);

		const evidence = await evidenceIn(world.kase.id);
		expect(evidence).toHaveLength(2);
		const node = evidence.find((row) => row.id !== authored.id);
		expect(node?.name).toBe("E2");
		expect(await pointerOf(world.claim.id)).toBe(node?.id);
		expect(await liveIds(world.kase.id)).toEqual([node?.id]);

		await retire(world.claim.id, { reason: "x", evidence_node: "remove" });
		const after = await element(authored.id);
		expect(after.deletedAt).toBeNull();
		expect(after.description).toBe("An audit report");
		expect(await linksOf(authored.id)).toHaveLength(1);
	});

	it("does not adopt authored evidence when it is the only evidence and the field is absent", async () => {
		const world = await nodeWorld();
		const authored = await createTestElement(world.kase.id, world.owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
			description: "An audit report",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: authored.id, claimId: world.claim.id },
		});
		await save(world, world.claim.id);
		expect(await pointerOf(world.claim.id)).toBeNull();
		expect(await liveIds(world.kase.id)).toEqual([]);
	});
});

describe("a save that names a stale revision", () => {
	it("is refused with a 409 and adds no node", async () => {
		const world = await nodeWorld();
		const result = await save(world, world.claim.id, {
			add_evidence_node: true,
			expected_revision: 7,
		});
		expect(result.status).toBe(409);
		expect(await stored(world)).toEqual(NOTHING);
	});

	it("is accepted when the revision matches, and adds the node", async () => {
		const world = await nodeWorld();
		const result = await save(world, world.claim.id, {
			add_evidence_node: true,
			expected_revision: null,
		});
		expect(result.status).toBe(200);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
	});
});

describe("the interface description", () => {
	it("lists the new routes in the published API document", () => {
		const document = JSON.parse(
			readFileSync(join(process.cwd(), "public/openapi.json"), "utf8")
		) as { paths: Record<string, Record<string, unknown>> };
		expect(Object.keys(document.paths)).toContain(
			"/elements/{id}/health/evidence-node"
		);
		expect(Object.keys(document.paths)).toContain(
			"/cases/{id}/health/evidence-nodes"
		);
		expect(
			document.paths["/elements/{id}/health/evidence-node"]?.post
		).toBeDefined();
		expect(
			document.paths["/cases/{id}/health/evidence-nodes"]?.get
		).toBeDefined();
	});
});
