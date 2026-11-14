import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { mockNoAuth } from "../utils/auth-helpers";
import { callCriteriaPut } from "../utils/health-criteria-kit";
import {
	acceptWithNode,
	addClaim,
	collaborator,
	element,
	evidenceIn,
	listNodes,
	liveIds,
	type NodeWorld,
	nodeWorld,
	numericSettings,
	pointerOf,
	postNode,
	readClaimHealth,
	readView,
	retire,
	revisionCount,
	save,
	saveBodyOf,
	signIn,
	storedState,
} from "../utils/live-node-kit";
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

const REFERENTIAL_ACTIONS =
	/ON (DELETE|UPDATE) (SET NULL|CASCADE|RESTRICT|NO ACTION)/gi;
const FOREIGN_KEY = /foreign key/i;
const WRITES = /\b(insert|update|delete|drop|truncate)\b/i;
const NOT_NULL = /\bnot null\b/i;
const MISSING = "7acd824e-0000-4000-8000-0000000000aa";

type Who =
	| "owner"
	| "VIEW"
	| "COMMENT"
	| "EDIT"
	| "ADMIN"
	| "team VIEW"
	| "team EDIT"
	| "stranger"
	| "nobody";

async function actAs(who: Who, world: NodeWorld) {
	if (who === "nobody") {
		await mockNoAuth();
		return;
	}
	if (who === "owner") {
		await signIn(world.owner);
		return;
	}
	if (who === "stranger") {
		const stranger = await createTestUser();
		await enableTestPlugin(stranger.id, "tea.health");
		await signIn(stranger);
		return;
	}
	if (who === "team VIEW" || who === "team EDIT") {
		const user = await createTestUser();
		await enableTestPlugin(user.id, "tea.health");
		const team = await createTestTeam(world.owner.id);
		await addTeamMember(team.id, user.id, "MEMBER");
		await createTestTeamPermission(
			world.kase.id,
			team.id,
			world.owner.id,
			who === "team VIEW" ? "VIEW" : "EDIT"
		);
		await signIn(user);
		return;
	}
	await signIn(await collaborator(world, who));
}

/** A world whose first claim is accepted without a node. */
async function acceptedWithoutNode() {
	const world = await nodeWorld();
	const saved = await save(world, world.claim.id);
	if (saved.status !== 200) {
		throw new Error(`accept answered ${saved.status}`);
	}
	return world;
}

describe("POST …/health/evidence-node: who may add a node", () => {
	it.each([
		["owner", 200],
		["EDIT", 200],
		["ADMIN", 200],
		["team EDIT", 200],
		["VIEW", 404],
		["COMMENT", 404],
		["team VIEW", 404],
		["stranger", 404],
		["nobody", 401],
	] as const)("%s: %i", async (who, status) => {
		const world = await acceptedWithoutNode();
		await actAs(who, world);

		const result = await postNode(world.claim.id);

		expect(result.status).toBe(status);
		const made = await evidenceIn(world.kase.id);
		expect(made).toHaveLength(status === 200 ? 1 : 0);
		expect(await pointerOf(world.claim.id)).toBe(
			status === 200 ? (made[0]?.id ?? null) : null
		);
	});

	it("gives a person without access the same answer as for a claim that does not exist", async () => {
		const world = await acceptedWithoutNode();
		await actAs("stranger", world);
		const real = await postNode(world.claim.id);
		const missing = await postNode(MISSING);
		expect(real.status).toBe(404);
		expect(missing.status).toBe(404);
		expect(real.body).toEqual(missing.body);
	});

	it("refuses a person who has the health plugin switched off", async () => {
		const world = await acceptedWithoutNode();
		await setPluginEnabledForUser("tea.health", world.owner.id, {
			enabled: false,
		});
		const result = await postNode(world.claim.id);
		expect(result.status).toBe(403);
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
	});

	it("rejects an id that is not a UUID with a 400", async () => {
		const world = await acceptedWithoutNode();
		const result = await postNode("not-a-uuid");
		expect(result.status).toBe(400);
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
	});

	it.each([
		["a goal", "goal"],
		["an evidence element", "evidence"],
		["a claim in the trash", "trashed"],
	])("answers 404 when the id is %s", async (_label, what) => {
		const world = await acceptedWithoutNode();
		let id = world.goal.id;
		if (what === "evidence") {
			id = (
				await createTestElement(world.kase.id, world.owner.id, {
					elementType: "EVIDENCE",
					name: "E9",
				})
			).id;
		}
		if (what === "trashed") {
			await prisma.assuranceElement.update({
				where: { id: world.claim.id },
				data: { deletedAt: new Date() },
			});
			id = world.claim.id;
		}
		const before = (await evidenceIn(world.kase.id)).length;
		const result = await postNode(id);
		expect(result.status).toBe(404);
		expect(await evidenceIn(world.kase.id)).toHaveLength(before);
	});

	it("a claim in another case that the person cannot edit stays untouched", async () => {
		const mine = await nodeWorld();
		const theirs = await acceptedWithoutNode();
		await signIn(mine.owner);
		const result = await postNode(theirs.claim.id);
		expect(result.status).toBe(404);
		expect(await evidenceIn(theirs.kase.id)).toHaveLength(0);
	});
});

describe("GET …/health/evidence-nodes: who may read the list", () => {
	it.each([
		["owner", 200],
		["VIEW", 200],
		["COMMENT", 200],
		["EDIT", 200],
		["ADMIN", 200],
		["team VIEW", 200],
		["team EDIT", 200],
		["stranger", 404],
		["nobody", 401],
	] as const)("%s: %i", async (who, status) => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		await actAs(who, world);

		const result = await listNodes(world.kase.id);

		expect(result.status).toBe(status);
		if (status === 200) {
			expect(result.body.map((item: { id: string }) => item.id)).toEqual([
				node?.id,
			]);
		} else {
			expect(JSON.stringify(result.body)).not.toContain(node?.id ?? "");
			expect(JSON.stringify(result.body)).not.toContain("P1");
		}
	});

	it("gives a person without access the same answer as for a case that does not exist", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		await actAs("stranger", world);
		const real = await listNodes(world.kase.id);
		const missing = await listNodes(MISSING);
		expect(real.status).toBe(404);
		expect(real.body).toEqual(missing.body);
	});

	it("is refused to a person with the health plugin off, while others still read it", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const viewer = await collaborator(world, "VIEW");
		await setPluginEnabledForUser("tea.health", viewer.id, { enabled: false });
		await signIn(viewer);
		const refused = await listNodes(world.kase.id);
		expect(refused.status).toBe(403);
		expect(JSON.stringify(refused.body)).not.toContain("P1");

		await signIn(world.owner);
		expect((await listNodes(world.kase.id)).status).toBe(200);
	});

	it("rejects an id that is not a UUID", async () => {
		await nodeWorld();
		const result = await listNodes("not-a-uuid");
		expect([400, 404]).toContain(result.status);
	});

	it("is read-only: it writes nothing and announces nothing", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: world.kase.id },
		});
		vi.mocked(emitSSEEvent).mockClear();
		await listNodes(world.kase.id);
		const after = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: world.kase.id },
		});
		expect(after.updatedAt).toEqual(before.updatedAt);
		expect(vi.mocked(emitSSEEvent)).not.toHaveBeenCalled();
	});
});

describe("write routes refuse people who may not edit", () => {
	it.each([
		["VIEW"],
		["COMMENT"],
		["team VIEW"],
		["stranger"],
	] as const)("%s cannot accept with a node, add one, or retire with remove", async (who) => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		const before = await element(node?.id ?? "");
		await actAs(who, world);

		const retired = await retire(world.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});
		const saved = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			undefined,
			true
		);

		expect(retired.status).toBe(404);
		expect(saved.status).toBe(404);
		expect(await element(node?.id ?? "")).toEqual(before);
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
		expect(await revisionCount(world.claim.id)).toBe(1);
	});

	it("an unauthenticated caller is refused by every route and nothing changes", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		await mockNoAuth();
		expect(
			(await retire(world.claim.id, { reason: "x", evidence_node: "remove" }))
				.status
		).toBe(401);
		expect(
			(await callCriteriaPut(world.claim.id, saveBodyOf(world))).status
		).toBe(401);
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
		const [node] = await evidenceIn(world.kase.id);
		expect(node?.deletedAt).toBeNull();
	});

	it("a person with the plugin off cannot retire with remove", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const editor = await collaborator(world, "EDIT");
		await setPluginEnabledForUser("tea.health", editor.id, { enabled: false });
		await signIn(editor);
		const result = await retire(world.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});
		expect(result.status).toBe(403);
		const [node] = await evidenceIn(world.kase.id);
		expect(node?.deletedAt).toBeNull();
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
	});
});

/**
 * What a damaged row could look like: this world's claim names, and links to,
 * a node that belongs to the other world's case. The other claim lets go of it
 * first, because a node can be pointed at once.
 */
async function pointAtOtherCase(mine: NodeWorld, theirs: NodeWorld) {
	const [theirNode] = await evidenceIn(theirs.kase.id);
	if (!theirNode) {
		throw new Error("the other case has no node");
	}
	await prisma.pluginHealthCriteria.update({
		where: { claimId: theirs.claim.id },
		data: { evidenceElementId: null },
	});
	await prisma.pluginHealthCriteria.update({
		where: { claimId: mine.claim.id },
		data: { evidenceElementId: theirNode.id },
	});
	await prisma.evidenceLink.create({
		data: { evidenceId: theirNode.id, claimId: mine.claim.id },
	});
	return theirNode;
}

describe("nothing crosses from one case into another", () => {
	/** A second case, owned by someone else, with its own live node. */
	async function twoCases() {
		const mine = await nodeWorld();
		const theirs = await nodeWorld();
		await signIn(theirs.owner);
		await acceptWithNode(theirs);
		await signIn(mine.owner);
		await acceptWithNode(mine);
		return { mine, theirs };
	}

	it("the list for one case never carries another case's node or claim, even for a person who can see both", async () => {
		const { mine, theirs } = await twoCases();
		await createTestPermission(
			theirs.kase.id,
			mine.owner.id,
			theirs.owner.id,
			"VIEW"
		);
		await signIn(mine.owner);

		const first = await listNodes(mine.kase.id);
		const second = await listNodes(theirs.kase.id);

		const [mineNode] = await evidenceIn(mine.kase.id);
		const [theirNode] = await evidenceIn(theirs.kase.id);
		expect(first.body.map((i: { id: string }) => i.id)).toEqual([mineNode?.id]);
		expect(second.body.map((i: { id: string }) => i.id)).toEqual([
			theirNode?.id,
		]);
		expect(first.body[0].claim_id).toBe(mine.claim.id);
		expect(second.body[0].claim_id).toBe(theirs.claim.id);
	});

	it("a pointer set to another case's node is drawn plain and exposes nothing of that node", async () => {
		const { mine, theirs } = await twoCases();
		const theirNode = await pointAtOtherCase(mine, theirs);
		await signIn(mine.owner);

		expect(await liveIds(mine.kase.id)).not.toContain(theirNode.id);
		const view = await readView(mine.claim.id);
		expect(JSON.stringify(view.body.evidence_node ?? null)).not.toContain(
			theirNode.name ?? "never"
		);
		expect(view.body.evidence_node?.state ?? null).not.toBe("live");
		const health = await readClaimHealth(mine);
		expect(JSON.stringify(health)).not.toContain(theirNode.description);
		await signIn(theirs.owner);
		expect(await liveIds(theirs.kase.id)).toEqual([]);
	});

	it("retiring with remove never trashes a node that sits in another case", async () => {
		const { mine, theirs } = await twoCases();
		const theirNode = await pointAtOtherCase(mine, theirs);
		const before = await element(theirNode.id);
		await signIn(mine.owner);

		const result = await retire(mine.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});

		expect(result.status).toBe(200);
		expect(await element(theirNode.id)).toEqual(before);
		expect((await element(theirNode.id)).deletedAt).toBeNull();
	});

	it("rewriting the text never changes a node that sits in another case", async () => {
		const { mine, theirs } = await twoCases();
		const theirNode = await pointAtOtherCase(mine, theirs);
		await signIn(mine.owner);

		const result = await save(
			mine,
			mine.claim.id,
			{ update_evidence_node_text: true },
			numericSettings()
		);

		expect(result.status).toBe(400);
		expect((await element(theirNode.id)).description).toBe(
			theirNode.description
		);
	});

	it("adding a node for a claim whose pointer names another case's node leaves that node alone", async () => {
		const { mine, theirs } = await twoCases();
		const theirNode = await pointAtOtherCase(mine, theirs);
		const before = await element(theirNode.id);
		await signIn(mine.owner);

		const result = await postNode(mine.claim.id);

		expect(result.status).toBe(200);
		expect(await element(theirNode.id)).toEqual(before);
		const mineNow = await evidenceIn(mine.kase.id);
		expect(mineNow).toHaveLength(2);
		expect(await pointerOf(mine.claim.id)).toBe(mineNow.at(-1)?.id);
	});

	it("a claim of one case and a node of another never meet in the assistant's reading", async () => {
		const { theirs } = await twoCases();
		const health = await readClaimHealth(theirs);
		const names = health.claims.map((claim) => claim.evidenceNode);
		const [theirNode] = await evidenceIn(theirs.kase.id);
		expect(names).toEqual([theirNode?.name]);
	});
});

describe("the migration", () => {
	const SQL = readFileSync(
		join(
			process.cwd(),
			"prisma/migrations/20261015120000_health_criteria_evidence_node/migration.sql"
		),
		"utf8"
	);

	it("only adds: no statement writes, removes or rewrites rows", () => {
		const statements = SQL.split("\n")
			.filter((line) => !line.trim().startsWith("--"))
			.join("\n")
			.replace(REFERENTIAL_ACTIONS, "");
		expect(statements).not.toMatch(WRITES);
		expect(statements).not.toMatch(NOT_NULL);
	});

	it("adds one nullable, unique column that the database clears when its element is deleted", async () => {
		const [column] = await prisma.$queryRaw<
			{ is_nullable: string; data_type: string }[]
		>`SELECT is_nullable, data_type FROM information_schema.columns WHERE table_name = 'plugin_health_criteria' AND column_name = 'evidence_element_id'`;
		expect(column).toEqual({ is_nullable: "YES", data_type: "text" });
		const [unique] = await prisma.$queryRaw<{ indexdef: string }[]>`
			SELECT indexdef FROM pg_indexes
			WHERE tablename = 'plugin_health_criteria' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%evidence_element_id%'`;
		expect(unique?.indexdef).toContain("(evidence_element_id)");
		const [foreignKey] = await prisma.$queryRaw<{ confdeltype: string }[]>`
			SELECT c.confdeltype::text AS confdeltype FROM pg_constraint c
			JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
			WHERE c.conrelid = 'plugin_health_criteria'::regclass AND c.contype = 'f' AND a.attname = 'evidence_element_id'`;
		expect(foreignKey?.confdeltype).toBe("n");
	});

	it("refuses a second claim pointing at the same node", async () => {
		const world = await nodeWorld();
		const other = await addClaim(world, "P2");
		await acceptWithNode(world);
		await save(world, other.id);
		const [node] = await evidenceIn(world.kase.id);
		await expect(
			prisma.pluginHealthCriteria.update({
				where: { claimId: other.id },
				data: { evidenceElementId: node?.id },
			})
		).rejects.toThrow();
	});

	it("refuses a pointer to an element that does not exist", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id);
		await expect(
			prisma.pluginHealthCriteria.update({
				where: { claimId: world.claim.id },
				data: { evidenceElementId: MISSING },
			})
		).rejects.toThrow(FOREIGN_KEY);
	});

	it("leaves a claim accepted before nodes existed without one, and changes nothing about it", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id);
		expect(await pointerOf(world.claim.id)).toBeNull();
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
		const other = await createTestCase(world.owner.id);
		expect(await evidenceIn(other.id)).toHaveLength(0);
	});
});

describe("a pipeline's machine token is not a person", () => {
	it("cannot add a node, read the list, or use the node options on a save or a retirement", async () => {
		const world = await acceptedWithoutNode();
		await mockNoAuth();

		const added = await postNode(world.claim.id, world.secret);
		const listed = await listNodes(world.kase.id, world.secret);
		const saved = await callCriteriaPut(
			world.claim.id,
			saveBodyOf(world, { add_evidence_node: true }),
			world.secret
		);

		expect(added.status).toBe(401);
		expect(listed.status).toBe(401);
		expect(saved.status).toBe(401);
		expect(await evidenceIn(world.kase.id)).toHaveLength(0);
	});

	it("cannot retire with remove", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		await mockNoAuth();
		const { callRetirement } = await import("../utils/health-criteria-kit");
		const response = await callRetirement(
			world.claim.id,
			{ reason: "x", evidence_node: "remove" },
			world.secret
		);
		expect(response.status).toBe(401);
		const [node] = await evidenceIn(world.kase.id);
		expect(node?.deletedAt).toBeNull();
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
	});
});

describe("identifiers in upper case", () => {
	it("are read as the lower-case ones by the new routes", async () => {
		const world = await acceptedWithoutNode();
		const added = await postNode(world.claim.id.toUpperCase());
		expect(added.status).toBe(200);
		const listed = await listNodes(world.kase.id.toUpperCase());
		expect(listed.status).toBe(200);
		expect(listed.body).toHaveLength(1);
	});
});
