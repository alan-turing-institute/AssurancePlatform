import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	acceptWithNode,
	addClaim,
	element,
	eventTypes,
	evidenceIn,
	failOn,
	ITEM_NODE_TEXT,
	linksOf,
	nodeWorld,
	numericSettings,
	pointerOf,
	postNode,
	retire,
	revisionCount,
	save,
	storedState,
} from "../utils/live-node-kit";
import { createTestUser } from "../utils/prisma-factories";
import {
	type TestTransactionClient,
	waitForLockWait,
} from "../utils/row-lock-test-utils";

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

const TRY_AGAIN = "The case changed while you were saving. Try again.";

/** A body that says the case changed, not that the save failed. */
function expectTryAgain(result: { body: { error?: string }; status: number }) {
	// biome-ignore lint/suspicious/noMisplacedAssertion: called only from within tests
	expect(result.status).toBe(409);
	// biome-ignore lint/suspicious/noMisplacedAssertion: called only from within tests
	expect(result.body.error).toBe(TRY_AGAIN);
}

type Step = (
	world: Awaited<ReturnType<typeof nodeWorld>>,
	nodeId: string
) => Promise<{ body: { error?: string }; status: number }>;

const RETIRE_REMOVE: Step = (world) =>
	retire(world.claim.id, { reason: "x", evidence_node: "remove" });
const REWRITE_TEXT: Step = (world) =>
	save(
		world,
		world.claim.id,
		{ update_evidence_node_text: true },
		numericSettings()
	);

/**
 * Runs `step` while a transaction that plays the part of the JSON editor
 * holds the node's row and then asks for the claim's row, the other way round
 * from the health steps. `whileHeld` runs in that transaction once the step is
 * waiting for the node.
 */
async function collide(
	world: Awaited<ReturnType<typeof nodeWorld>>,
	nodeId: string,
	step: Step,
	whileHeld: (tx: TestTransactionClient) => Promise<void>
) {
	let running: ReturnType<Step> | undefined;
	const heldError = await prisma
		.$transaction(
			async (tx) => {
				await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${nodeId} FOR UPDATE`;
				running = step(world, nodeId);
				try {
					await waitForLockWait(3000);
				} catch {
					// The step did not wait for the node; what it did instead shows in its answer.
				}
				await whileHeld(tx);
			},
			{ timeout: 30_000 }
		)
		.then(
			() => null,
			(error: unknown) => error
		);
	const result = await running;
	if (heldError) {
		throw heldError;
	}
	if (!result) {
		throw new Error("the step never ran");
	}
	return result;
}

describe("two people changing a claim and its node in opposite orders", () => {
	it.each([
		["retiring with remove", RETIRE_REMOVE],
		["rewriting the node's text", REWRITE_TEXT],
	])("%s is told to try again when the other side takes the claim after the node, and nothing is stored", async (_label, step) => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		const before = await element(node?.id ?? "");
		vi.mocked(emitSSEEvent).mockClear();

		const result = await collide(world, node?.id ?? "", step, async (tx) => {
			// The other transaction now wants the claim this step already holds: a deadlock.
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${world.claim.id} FOR UPDATE`;
		});

		expectTryAgain(result);
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
		expect(await revisionCount(world.claim.id)).toBe(1);
		expect(await element(node?.id ?? "")).toEqual(before);
		expect(await pointerOf(world.claim.id)).toBe(node?.id);
		expect(eventTypes()).toEqual([]);
	});

	it("the same step succeeds when it is tried again", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		const first = await collide(
			world,
			node?.id ?? "",
			RETIRE_REMOVE,
			async (tx) => {
				await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${world.claim.id} FOR UPDATE`;
			}
		);
		expectTryAgain(first);

		const second = await RETIRE_REMOVE(world, node?.id ?? "");

		expect(second.status).toBe(200);
		expect((await element(node?.id ?? "")).deletedAt).not.toBeNull();
	});
});

describe("a node that disappears while a step waits for it", () => {
	it.each([
		["retiring with remove", RETIRE_REMOVE],
		["rewriting the node's text", REWRITE_TEXT],
	])("%s is told to try again when the node is deleted outright, and nothing is stored", async (_label, step) => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		vi.mocked(emitSSEEvent).mockClear();

		const result = await collide(world, node?.id ?? "", step, async (tx) => {
			await tx.$executeRaw`DELETE FROM assurance_elements WHERE id = ${node?.id}`;
		});

		expectTryAgain(result);
		expect(await storedState(world.claim.id)).toBe("ACCEPTED");
		expect(await revisionCount(world.claim.id)).toBe(1);
		expect(eventTypes()).toEqual([]);
	});
});

describe("a node that changes while a step waits for it is looked at again once it is locked", () => {
	it("retiring with remove does not trash a node another person has just moved to a different claim", async () => {
		const world = await nodeWorld();
		const other = await addClaim(world, "P2");
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);

		const result = await collide(
			world,
			node?.id ?? "",
			RETIRE_REMOVE,
			async (tx) => {
				await tx.$executeRaw`DELETE FROM evidence_links WHERE evidence_id = ${node?.id}`;
				await tx.$executeRaw`INSERT INTO evidence_links (id, evidence_id, claim_id) VALUES (gen_random_uuid(), ${node?.id}, ${other.id})`;
			}
		);

		expect(result.status).toBe(200);
		const stored = await element(node?.id ?? "");
		expect(stored.deletedAt).toBeNull();
		expect((await linksOf(node?.id ?? "")).map((link) => link.claimId)).toEqual(
			[other.id]
		);
	});

	it("retiring with remove leaves a node another person has just trashed exactly as they left it", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		const other = await createTestUser();

		const result = await collide(
			world,
			node?.id ?? "",
			RETIRE_REMOVE,
			async (tx) => {
				await tx.$executeRaw`UPDATE assurance_elements SET deleted_at = now(), deleted_by_id = ${other.id} WHERE id = ${node?.id}`;
			}
		);

		expect(result.status).toBe(200);
		const stored = await element(node?.id ?? "");
		expect(stored.deletedById).toBe(other.id);
	});

	it("rewriting the text is refused for a node another person has just moved to a different claim", async () => {
		const world = await nodeWorld();
		const other = await addClaim(world, "P2");
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);

		const result = await collide(
			world,
			node?.id ?? "",
			REWRITE_TEXT,
			async (tx) => {
				await tx.$executeRaw`DELETE FROM evidence_links WHERE evidence_id = ${node?.id}`;
				await tx.$executeRaw`INSERT INTO evidence_links (id, evidence_id, claim_id) VALUES (gen_random_uuid(), ${node?.id}, ${other.id})`;
			}
		);

		expect(result.status).toBe(400);
		expect((await element(node?.id ?? "")).description).toBe(ITEM_NODE_TEXT);
		expect(await revisionCount(world.claim.id)).toBe(1);
	});

	it("rewriting the text is refused for a node another person has just trashed", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);

		const result = await collide(
			world,
			node?.id ?? "",
			REWRITE_TEXT,
			async (tx) => {
				await tx.$executeRaw`UPDATE assurance_elements SET deleted_at = now() WHERE id = ${node?.id}`;
			}
		);

		expect(result.status).toBe(400);
		expect((await element(node?.id ?? "")).description).toBe(ITEM_NODE_TEXT);
		expect(await revisionCount(world.claim.id)).toBe(1);
	});
});

describe("database failures inside a save", () => {
	type Flow = "accept" | "add" | "rewrite" | "retire";

	/**
	 * Runs `flow` on a fresh case while every statement matching `when` on
	 * `table` fails with `code`, and reads what was stored before and after.
	 */
	async function failDuring(
		flow: Flow,
		table: string,
		when: string,
		code: string
	) {
		const world = await nodeWorld();
		if (flow === "add") {
			await save(world, world.claim.id);
		}
		if (flow === "retire" || flow === "rewrite") {
			await acceptWithNode(world);
		}
		const read = async () => ({
			nodes: (await evidenceIn(world.kase.id)).length,
			revisions: await revisionCount(world.claim.id),
			state: await storedState(world.claim.id),
		});
		const before = await read();
		const undo = await failOn(table, when, code);
		let result: { body: { error?: string }; status: number };
		try {
			if (flow === "accept") {
				result = await save(world, world.claim.id, { add_evidence_node: true });
			} else if (flow === "add") {
				result = await postNode(world.claim.id);
			} else if (flow === "retire") {
				result = await RETIRE_REMOVE(world, "");
			} else {
				result = await REWRITE_TEXT(world, "");
			}
		} finally {
			await undo();
		}
		return { before, after: await read(), result };
	}

	const COLLISIONS = [
		["accepting with a node", "evidence_links", "true", "40P01", "accept"],
		[
			"accepting with a node",
			"assurance_elements",
			"NEW.element_type = 'EVIDENCE'",
			"40P01",
			"accept",
		],
		["adding a node", "evidence_links", "true", "40P01", "add"],
		[
			"retiring with remove",
			"assurance_elements",
			"NEW.deleted_at IS NOT NULL",
			"40P01",
			"retire",
		],
		[
			"rewriting the text",
			"assurance_elements",
			"NEW.description LIKE 'Results from the Edge%'",
			"40P01",
			"rewrite",
		],
	] as const;

	it.each(
		COLLISIONS
	)("%s answers 409 with the try-again message when %s raises %s (%s)", async (_label, table, when, code, flow) => {
		const { before, after, result } = await failDuring(flow, table, when, code);

		expectTryAgain(result);
		expect(after).toEqual(before);
	});

	const DEFECTS = [
		["accepting with a node", "evidence_links", "true", "accept"],
		[
			"accepting with a node",
			"plugin_health_criteria",
			"NEW.evidence_element_id IS NOT NULL",
			"accept",
		],
		["adding a node", "evidence_links", "true", "add"],
	] as const;

	it.each(
		DEFECTS
	)("%s fails with a 500, not the try-again message, when %s raises a unique violation (%s)", async (_label, table, when, flow) => {
		const { before, after, result } = await failDuring(
			flow,
			table,
			when,
			"23505"
		);

		expect(result.status).toBe(500);
		expect(result.body.error).not.toBe(TRY_AGAIN);
		expect(after).toEqual(before);
	});

	it("a failure that is not a collision does not claim the case changed", async () => {
		const world = await nodeWorld();
		const undo = await failOn("evidence_links", "true");
		let result: Awaited<ReturnType<typeof save>>;
		try {
			result = await save(world, world.claim.id, { add_evidence_node: true });
		} finally {
			await undo();
		}
		expect(result.status).toBe(500);
		expect(result.body.error).not.toBe(TRY_AGAIN);
	});
});

describe("the paths that reuse or replace a node wait for it too", () => {
	const ACCEPT_AGAIN: Step = (world) =>
		save(world, world.claim.id, { add_evidence_node: true });
	const ADD_NODE: Step = (world) => postNode(world.claim.id);

	/** Accepted with a node, then retired with keep: the node waits to be reused. */
	async function keptNodeWorld() {
		const world = await nodeWorld();
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		const retired = await retire(world.claim.id, {
			reason: "Pause",
			evidence_node: "keep",
		});
		if (retired.status !== 200) {
			throw new Error(`retire answered ${retired.status}`);
		}
		vi.mocked(emitSSEEvent).mockClear();
		return { world, node };
	}

	it("accepting again with the field is told to try again when the other side takes the claim after the node, and nothing is stored", async () => {
		const { world, node } = await keptNodeWorld();

		const result = await collide(
			world,
			node?.id ?? "",
			ACCEPT_AGAIN,
			async (tx) => {
				await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${world.claim.id} FOR UPDATE`;
			}
		);

		expectTryAgain(result);
		expect(await storedState(world.claim.id)).toBe("INACTIVE");
		expect(await revisionCount(world.claim.id)).toBe(2);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(eventTypes()).toEqual([]);
	});

	it("accepting again with the field is told to try again when the kept node is deleted outright while it waits", async () => {
		const { world, node } = await keptNodeWorld();

		const result = await collide(
			world,
			node?.id ?? "",
			ACCEPT_AGAIN,
			async (tx) => {
				await tx.$executeRaw`DELETE FROM assurance_elements WHERE id = ${node?.id}`;
			}
		);

		expectTryAgain(result);
		expect(await storedState(world.claim.id)).toBe("INACTIVE");
		expect(await revisionCount(world.claim.id)).toBe(2);
		expect(eventTypes()).toEqual([]);
	});

	it("adding a node over a pointer to a node that has moved is told to try again when the other side takes the claim after that node", async () => {
		const world = await nodeWorld();
		const other = await addClaim(world, "P2");
		await acceptWithNode(world);
		const [node] = await evidenceIn(world.kase.id);
		await prisma.evidenceLink.deleteMany({ where: { evidenceId: node?.id } });
		await prisma.evidenceLink.create({
			data: { evidenceId: node?.id ?? "", claimId: other.id },
		});
		vi.mocked(emitSSEEvent).mockClear();

		const result = await collide(
			world,
			node?.id ?? "",
			ADD_NODE,
			async (tx) => {
				await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${world.claim.id} FOR UPDATE`;
			}
		);

		expectTryAgain(result);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(await pointerOf(world.claim.id)).toBe(node?.id);
		expect(eventTypes()).toEqual([]);
	});
});
