import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import { importCase } from "@/lib/services/case-import-service";
import { detectChanges } from "@/lib/services/change-detection-service";
import { deleteElement } from "@/lib/services/element-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { ITEM_CHECK_NAME } from "../fixtures/health-checks";
import { mockNoAuth } from "../utils/auth-helpers";
import { appendRecord } from "../utils/health-adversarial-kit";
import {
	acceptWithNode,
	addClaim,
	assistantTools,
	evidenceIn,
	ITEM_NODE_TEXT,
	liveIds,
	nodeWorld,
	readCase,
	readClaimHealth,
	retire,
	save,
	signIn,
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

interface Branch {
	children?: Branch[];
	description?: string;
	id: string;
	type?: string;
	[key: string]: unknown;
}

function findIn(
	branch: Branch,
	id: string
): { node: Branch; parent: Branch | null } | null {
	if (branch.id === id) {
		return { node: branch, parent: null };
	}
	for (const child of branch.children ?? []) {
		const inside = findIn(child, id);
		if (inside) {
			return { node: inside.node, parent: inside.parent ?? branch };
		}
	}
	return null;
}

/** Every key that appears anywhere in a JSON value. */
function allKeys(value: unknown, into = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		for (const item of value) {
			allKeys(item, into);
		}
	} else if (value && typeof value === "object") {
		for (const [key, inner] of Object.entries(value)) {
			into.add(key);
			allKeys(inner, into);
		}
	}
	return into;
}

const HEALTH_WORDS = [
	"tea.health",
	"pluginData",
	"evidence_element_id",
	"evidenceElementId",
	"evidence_node",
	"echo_state",
	"echo_differences",
	"criteria_revision",
	"bound_check",
	"accepted_by",
	"camera_line",
	"proportion",
	"valid_for",
	"verdict",
	"stale",
];

const HEALTH_KEY = /health|plugin|live|criteria|bound/i;

/** A world with one accepted claim, its node, and a result recorded against it. */
async function worldWithNodeAndResult() {
	const world = await nodeWorld();
	await acceptWithNode(world);
	await appendRecord(world.owner.id, world.claim.id, "populationPass", {
		check: { name: ITEM_CHECK_NAME, version: "0.3", scope: "item" },
	});
	const [node] = await evidenceIn(world.kase.id);
	if (!node) {
		throw new Error("no node");
	}
	return { world, node };
}

describe("exports carry the node as plain evidence", () => {
	it("puts the node under its claim like any evidence, at format version 1.0, with no health data", async () => {
		const { world, node } = await worldWithNodeAndResult();

		const exported = await exportCase(world.owner.id, world.kase.id);

		if ("error" in exported) {
			throw new Error(exported.error);
		}
		expect(exported.data.version).toBe("1.0");
		const found = findIn(exported.data.tree as unknown as Branch, node.id);
		expect(found?.node).toMatchObject({
			type: "EVIDENCE",
			name: node.name,
			description: ITEM_NODE_TEXT,
		});
		expect(found?.parent?.id).toBe(world.claim.id);
		const text = JSON.stringify(exported.data);
		for (const word of HEALTH_WORDS) {
			expect(text).not.toContain(word);
		}
		for (const key of allKeys(exported.data)) {
			expect(key).not.toMatch(HEALTH_KEY);
		}
	});

	it("gives the node exactly the fields any other evidence has, and the export the same top-level fields", async () => {
		const { world, node } = await worldWithNodeAndResult();
		const other = await addClaim(world, "P2");
		const ordinary = await createTestElement(world.kase.id, world.owner.id, {
			elementType: "EVIDENCE",
			name: "E9",
			description: "Ordinary evidence",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: ordinary.id, claimId: other.id },
		});
		const exported = await exportCase(world.owner.id, world.kase.id);
		if ("error" in exported) {
			throw new Error(exported.error);
		}
		const tree = exported.data.tree as unknown as Branch;
		const nodeKeys = Object.keys(findIn(tree, node.id)?.node ?? {}).sort();
		const ordinaryKeys = Object.keys(
			findIn(tree, ordinary.id)?.node ?? {}
		).sort();
		expect(nodeKeys).toEqual(ordinaryKeys);

		const plain = await nodeWorld();
		await signIn(plain.owner);
		const plainExport = await exportCase(plain.owner.id, plain.kase.id);
		if ("error" in plainExport) {
			throw new Error(plainExport.error);
		}
		expect(Object.keys(exported.data).sort()).toEqual(
			Object.keys(plainExport.data).sort()
		);
	});

	it("is identical whether the settings are accepted, retired with keep, or still in place", async () => {
		const { world, node } = await worldWithNodeAndResult();
		const first = await exportCase(world.owner.id, world.kase.id);
		await retire(world.claim.id, { reason: "x", evidence_node: "keep" });
		const second = await exportCase(world.owner.id, world.kase.id);
		if ("error" in first || "error" in second) {
			throw new Error("export failed");
		}
		const pick = (data: typeof first.data) =>
			findIn(data.tree as unknown as Branch, node.id)?.node;
		expect(pick(second.data)).toEqual(pick(first.data));
	});

	it("leaves a removed node out of the export, as any trashed evidence is", async () => {
		const { world, node } = await worldWithNodeAndResult();
		await retire(world.claim.id, { reason: "x", evidence_node: "remove" });
		const exported = await exportCase(world.owner.id, world.kase.id);
		if ("error" in exported) {
			throw new Error(exported.error);
		}
		expect(findIn(exported.data.tree as unknown as Branch, node.id)).toBeNull();
	});

	it("a copy made from an export holds the evidence and no settings, so nothing in it is live", async () => {
		const { world } = await worldWithNodeAndResult();
		const exported = await exportCase(world.owner.id, world.kase.id);
		if ("error" in exported) {
			throw new Error(exported.error);
		}

		const copy = await importCase(world.owner.id, exported.data);

		if (!("data" in copy)) {
			throw new Error(`import failed: ${JSON.stringify(copy)}`);
		}
		const copied = await prisma.assuranceElement.findMany({
			where: { caseId: copy.data.caseId, elementType: "EVIDENCE" },
		});
		expect(copied.map((row) => row.description)).toEqual([ITEM_NODE_TEXT]);
		expect(
			await prisma.pluginHealthCriteria.count({
				where: { claim: { caseId: copy.data.caseId } },
			})
		).toBe(0);
		await signIn(world.owner);
		expect(await liveIds(copy.data.caseId)).toEqual([]);
	});
});

describe("a published case and its public page carry the node as plain evidence", () => {
	async function publish() {
		const { world, node } = await worldWithNodeAndResult();
		const published = await publishAssuranceCase(world.owner.id, world.kase.id);
		if (!("data" in published)) {
			throw new Error(`publish failed: ${JSON.stringify(published)}`);
		}
		const row = await prisma.publishedAssuranceCase.findFirstOrThrow({
			where: { assuranceCaseId: world.kase.id },
		});
		return { world, node, row };
	}

	it("freezes the node under its claim in the snapshot, with no health entry and no pointer", async () => {
		const { world, node, row } = await publish();
		const content = row.content as unknown as {
			pluginData?: Record<string, unknown>;
			tree: Branch;
		};
		const found = findIn(content.tree, node.id);
		expect(found?.node).toMatchObject({
			type: "EVIDENCE",
			description: ITEM_NODE_TEXT,
		});
		expect(found?.parent?.id).toBe(world.claim.id);
		expect(content.pluginData?.["tea.health"]).toBeUndefined();
		const text = JSON.stringify(row.content);
		for (const word of HEALTH_WORDS) {
			expect(text).not.toContain(word);
		}
		for (const key of allKeys(row.content)) {
			expect(key).not.toMatch(HEALTH_KEY);
		}
	});

	it("serves the node on the public page as plain evidence with no health data", async () => {
		const { node, row } = await publish();
		const { GET } = await import("@/app/api/public/discover/[slug]/route");
		const response = await GET(
			new NextRequest(`http://localhost:3000/api/public/discover/${row.slug}`),
			{ params: Promise.resolve({ slug: row.slug }) }
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		const text = JSON.stringify(body);
		expect(text).toContain(node.id);
		expect(text).toContain(ITEM_NODE_TEXT);
		for (const word of HEALTH_WORDS) {
			expect(text).not.toContain(word);
		}
		for (const key of allKeys(body)) {
			expect(key).not.toMatch(HEALTH_KEY);
		}
	});

	it("shows a published case as changed after a node is added, and not after plain settings are accepted", async () => {
		const world = await nodeWorld();
		const second = await addClaim(world, "P2");
		const published = await publishAssuranceCase(world.owner.id, world.kase.id);
		expect("data" in published).toBe(true);
		const before = await detectChanges(world.owner.id, world.kase.id, false);
		expect(before).toMatchObject({ data: { hasChanges: false } });

		expect((await save(world, second.id)).status).toBe(200);
		expect(
			await detectChanges(world.owner.id, world.kase.id, false)
		).toMatchObject({
			data: { hasChanges: false },
		});

		await acceptWithNode(world);
		expect(
			await detectChanges(world.owner.id, world.kase.id, false)
		).toMatchObject({
			data: { hasChanges: true },
		});
	});
});

describe("the assistant", () => {
	it("names the live node of a claim in read_claim_health, and of no other claim", async () => {
		const world = await nodeWorld();
		const second = await addClaim(world, "P2");
		const third = await addClaim(world, "P3");
		await acceptWithNode(world);
		await save(world, second.id);
		const [node] = await evidenceIn(world.kase.id);

		const health = await readClaimHealth(world);

		const byId = new Map(health.claims.map((claim) => [claim.id, claim]));
		expect(byId.get(world.claim.id)?.evidenceNode).toBe(node?.name);
		expect(byId.get(second.id)).toBeDefined();
		expect(byId.get(second.id)).not.toHaveProperty("evidenceNode");
		expect(byId.has(third.id)).toBe(false);
	});

	it("reports the node's identifier as the case shows it, even after the author renames nothing", async () => {
		const world = await nodeWorld();
		for (const name of ["E1", "E2", "E3"]) {
			await createTestElement(world.kase.id, world.owner.id, {
				elementType: "EVIDENCE",
				name,
				description: `Existing ${name}`,
			});
		}
		await acceptWithNode(world);
		const health = await readClaimHealth(world);
		expect(health.claims[0]?.evidenceNode).toBe("E4");
	});

	it("stops naming the node when it is trashed, and names it again when it is restored", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		await deleteElement(world.owner.id, node?.id ?? "");
		expect((await readClaimHealth(world)).claims[0]).not.toHaveProperty(
			"evidenceNode"
		);
		await prisma.assuranceElement.update({
			where: { id: node?.id },
			data: { deletedAt: null, deletedById: null },
		});
		expect((await readClaimHealth(world)).claims[0]?.evidenceNode).toBe(
			node?.name
		);
	});

	it("tells the model in the tool's description that the node's text never states a result", async () => {
		const world = await nodeWorld();
		const tools = await assistantTools(world);
		const description = tools.read_claim_health?.description ?? "";
		expect(description).toContain("evidenceNode");
	});

	it("leaves read_case as it was: the node is plain evidence under its claim, with nothing about health", async () => {
		const { world, node } = await worldWithNodeAndResult();
		const result = await readCase(world);
		const text = JSON.stringify(result);
		expect(text).toContain(node.id);
		expect(text).toContain(ITEM_NODE_TEXT);
		expect(text).not.toContain("evidenceNode");
		for (const key of allKeys(result)) {
			expect(key).not.toMatch(HEALTH_KEY);
		}
	});

	it("counts the claim as supported for the rules check once the node is there", async () => {
		const world = await nodeWorld();
		const options = { toolCallId: "t", messages: [] };
		const rulesFor = async () => {
			const tools = await assistantTools(world);
			const result = (await tools.lint_case?.execute?.(
				{},
				options
			)) as unknown as {
				findings: {
					ruleId: string;
					element?: string;
					[key: string]: unknown;
				}[];
			};
			return result.findings
				.filter((finding) => finding.ruleId === "EVID01")
				.map((finding) => JSON.stringify(finding));
		};
		const before = await rulesFor();
		expect(before.some((finding) => finding.includes("P1"))).toBe(true);

		await acceptWithNode(world);

		const after = await rulesFor();
		expect(after.some((finding) => finding.includes("P1"))).toBe(false);
	});
});
