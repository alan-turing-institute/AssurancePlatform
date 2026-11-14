import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	batchUpdate,
	KINDS,
	openWorld,
	postBatch,
	postElement,
	putElement,
	RAW_PATHS,
	seedPlaceholderClaim,
	stored,
	type World,
	WRITE_PATHS,
} from "../utils/placeholder-kit";
import {
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The markers a pattern leaves on a case: `modifiedFromPattern` follows text
 * changes on an element that came from a pattern, and neither it nor
 * `fromPattern` can be set by a client. Who may change a placeholder marker.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const PATHS = WRITE_PATHS.map((path) => [path.label, path] as const);

describe.each(
	PATHS
)("text written through %s to an element from a pattern", (_label, path) => {
	it.each(
		KINDS
	)("marks the element as modified when its description changes, in a %s", async (kind) => {
		const world = await openWorld(kind);
		const claim = await world.seedClaim({
			name: "P1",
			description: "From the pattern",
			fromPattern: true,
		});

		await path.write(world, claim.id, { description: "Changed by the user" });

		expect(await stored(claim.id)).toMatchObject({
			fromPattern: true,
			modifiedFromPattern: true,
		});
	});

	it.each([
		["assumption", { assumption: "A new assumption" }],
		["justification", { justification: "A new justification" }],
	])("marks the element as modified when its %s changes", async (_field, fields) => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({
			name: "P1",
			description: "From the pattern",
			fromPattern: true,
		});

		await path.write(world, claim.id, fields);

		expect((await stored(claim.id)).modifiedFromPattern).toBe(true);
	});

	it("leaves the element unmodified when the same description is written again", async () => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({
			name: "P1",
			description: "From the pattern",
			fromPattern: true,
		});

		await path.write(world, claim.id, { description: "From the pattern" });

		expect((await stored(claim.id)).modifiedFromPattern).toBe(false);
	});

	it("leaves an element that did not come from a pattern unmodified when its text changes", async () => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({
			name: "P1",
			description: "Written here",
		});

		await path.write(world, claim.id, { description: "Rewritten here" });

		expect(await stored(claim.id)).toMatchObject({
			fromPattern: false,
			modifiedFromPattern: false,
		});
	});

	it("both fills in and marks as modified a placeholder that came from a pattern", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world, { fromPattern: true });

		await path.write(world, claim.id, { description: "Filled in by the user" });

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			modifiedFromPattern: true,
		});
	});
});

describe.each(
	RAW_PATHS.map((path) => [path.label, path] as const)
)("fields written through %s to an element from a pattern", (_label, path) => {
	async function fromPatternClaim(world: World) {
		return await world.seedClaim({
			name: "P1",
			description: "From the pattern",
			fromPattern: true,
		});
	}

	it("leaves the element unmodified when only its name changes", async () => {
		const world = await openWorld("CASE");
		const claim = await fromPatternClaim(world);

		const response = await path.send(world, claim.id, { name: "P2" });

		expect(response.status).toBe(200);
		expect((await stored(claim.id)).modifiedFromPattern).toBe(false);
	});

	it("leaves the element unmodified when the edit dialog's usual extras arrive empty over empty stored text", async () => {
		const world = await openWorld("CASE");
		const claim = await fromPatternClaim(world);

		await path.send(world, claim.id, {
			description: "From the pattern",
			assumption: "",
			justification: "",
			context: [],
		});

		expect((await stored(claim.id)).modifiedFromPattern).toBe(false);
	});

	it("marks the element as modified when its context changes", async () => {
		const world = await openWorld("CASE");
		const claim = await fromPatternClaim(world);

		await path.send(world, claim.id, { context: ["Only in the lab"] });

		expect((await stored(claim.id)).modifiedFromPattern).toBe(true);
	});

	it("keeps a placeholder from a pattern marked, though modified, when the same request asks for the marker", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world, { fromPattern: true });

		await path.send(world, claim.id, {
			description: "Filled in",
			isPlaceholder: true,
		});

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			modifiedFromPattern: true,
		});
	});
});

describe("what a client cannot set", () => {
	it.each([
		"fromPattern",
		"modifiedFromPattern",
	])("refuses %s on an element update and leaves the element alone", async (field) => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({ name: "P1", description: "Text" });

		const response = await putElement(claim.id, { [field]: true });

		expect(response.status).toBe(400);
		expect(await stored(claim.id)).toMatchObject({
			fromPattern: false,
			modifiedFromPattern: false,
		});
	});

	it("refuses fromPattern on a new element", async () => {
		const world = await openWorld("CASE");

		const response = await postElement(world.caseId, {
			type: "strategy",
			name: "S1",
			description: "A strategy",
			parentId: world.goalId,
			fromPattern: true,
		});

		expect(response.status).toBe(400);
	});

	it("accepts the markers in a batch update, ignores them, and applies the rest of the update", async () => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({ name: "P1", description: "Text" });

		const response = await postBatch(world.caseId, [
			batchUpdate(claim.id, {
				name: "P2",
				fromPattern: true,
				modifiedFromPattern: true,
			}),
		]);

		expect(response.status).toBe(200);
		expect(await stored(claim.id)).toMatchObject({
			name: "P2",
			fromPattern: false,
			modifiedFromPattern: false,
		});
	});

	it("does not let a batch update take the markers off an element from a pattern", async () => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({
			name: "P1",
			description: "Text",
			fromPattern: true,
			modifiedFromPattern: true,
		});

		const response = await postBatch(world.caseId, [
			batchUpdate(claim.id, {
				name: "P2",
				fromPattern: false,
				modifiedFromPattern: false,
			}),
		]);

		expect(response.status).toBe(200);
		expect(await stored(claim.id)).toMatchObject({
			name: "P2",
			fromPattern: true,
			modifiedFromPattern: true,
		});
	});

	it("accepts the markers in a batch create and stores the element without them", async () => {
		const world = await openWorld("CASE");
		const id = randomUUID();

		const response = await postBatch(world.caseId, [
			{
				type: "create",
				elementId: id,
				parentId: world.goalId,
				data: {
					id,
					type: "STRATEGY",
					name: "S1",
					description: "A strategy",
					inSandbox: false,
					fromPattern: true,
					modifiedFromPattern: true,
				},
			},
		]);

		expect(response.status).toBe(200);
		expect(await stored(id)).toMatchObject({
			fromPattern: false,
			modifiedFromPattern: false,
		});
	});

	it("lets a batch create and an element create carry a placeholder marker and its hint", async () => {
		const world = await openWorld("CASE");
		const batchId = randomUUID();

		const batched = await postBatch(world.caseId, [
			{
				type: "create",
				elementId: batchId,
				parentId: world.goalId,
				data: {
					id: batchId,
					type: "STRATEGY",
					name: "S1",
					description: "",
					inSandbox: false,
					isPlaceholder: true,
					placeholderHint: "Say how the goal is argued",
				},
			},
		]);
		const created = await postElement(world.caseId, {
			type: "strategy",
			name: "S2",
			description: "",
			parentId: world.goalId,
			isPlaceholder: true,
			placeholderHint: "Say how the goal is argued",
		});

		expect(batched.status).toBe(200);
		expect(created.status).toBe(201);
		expect(await stored(batchId)).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Say how the goal is argued",
		});
		const createdId = (await created.json()).id;
		expect(await stored(createdId)).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Say how the goal is argued",
		});
	});
});

describe("who may change a placeholder marker", () => {
	it.each([
		"VIEW",
		"COMMENT",
	] as const)("refuses a user with %s access, on both routes, and changes nothing", async (level) => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({ name: "P1", description: "Text" });
		const reader = await createTestUser();
		await createTestPermission(world.caseId, reader.id, world.ownerId, level);
		await mockAuth(reader.id, reader.username, reader.email);

		const put = await putElement(claim.id, {
			isPlaceholder: true,
			placeholderHint: "Mine",
		});
		const batch = await postBatch(world.caseId, [
			batchUpdate(claim.id, { isPlaceholder: true, placeholderHint: "Mine" }),
		]);

		expect(put.status).toBe(404);
		expect(batch.status).toBe(403);
		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			placeholderHint: null,
		});
	});

	it("lets a user with EDIT access mark and unmark an element", async () => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({ name: "P1", description: "Text" });
		const editor = await createTestUser();
		await createTestPermission(world.caseId, editor.id, world.ownerId, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		expect((await putElement(claim.id, { isPlaceholder: true })).status).toBe(
			200
		);
		expect((await stored(claim.id)).isPlaceholder).toBe(true);

		const batch = await postBatch(world.caseId, [
			batchUpdate(claim.id, { isPlaceholder: false }),
		]);
		expect(batch.status).toBe(200);
		expect((await stored(claim.id)).isPlaceholder).toBe(false);
	});

	it("answers a stranger as it answers a missing element, and changes nothing", async () => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({ name: "P1", description: "Text" });
		const stranger = await createTestUser();
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const real = await putElement(claim.id, { isPlaceholder: true });
		const missing = await putElement(randomUUID(), { isPlaceholder: true });

		expect(real.status).toBe(missing.status);
		expect((await stored(claim.id)).isPlaceholder).toBe(false);
	});

	it("never reads or writes a marker on an element of another case through a batch", async () => {
		const world = await openWorld("CASE");
		const other = await openWorld("CASE");
		const victim = await seedPlaceholderClaim(other, {
			description: "Their draft",
		});
		await mockAuth(world.ownerId, "owner", "owner@example.com");

		const response = await postBatch(world.caseId, [
			batchUpdate(victim.id, { description: "Overwritten" }),
		]);

		expect(response.status).not.toBe(200);
		expect(
			await prisma.assuranceElement.findUnique({ where: { id: victim.id } })
		).toMatchObject({
			isPlaceholder: true,
			description: "Their draft",
		});
	});
});
