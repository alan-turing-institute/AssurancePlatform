import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	batchUpdate,
	openWorld,
	postBatch,
	putElement,
	seedPlaceholderClaim,
	stored,
} from "../utils/placeholder-kit";

/**
 * The element route and the batch route in the corners of the clear rule: the
 * other names a request can give a description, padding, what the answers
 * say about the marker and the hint, and a batch that fails part-way.
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

async function getElement(elementId: string) {
	const { GET } = await import("@/app/api/elements/[id]/route");
	return await GET(
		new Request(`http://localhost:3000/api/elements/${elementId}`),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

describe("the other names a request can give a description", () => {
	it.each([
		"shortDescription",
		"longDescription",
	])("takes the marker off a placeholder in a case when %s is written", async (field) => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world);

		const response = await putElement(claim.id, { [field]: "Written here" });

		expect(response.status).toBe(200);
		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			description: "Written here",
		});
	});

	it("judges the text that ends up stored when two names are given, and clears for a different one", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await putElement(claim.id, {
			description: "A first draft",
			longDescription: "A longer draft",
		});

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			description: "A longer draft",
		});
	});

	it("keeps the marker when the name that wins repeats the stored text, whatever the other one says", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await putElement(claim.id, {
			description: "Something else entirely",
			longDescription: "A first draft",
		});

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			description: "A first draft",
		});
	});
});

describe("padding around a description", () => {
	it("keeps the marker when the stored text is written again with spaces around it", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await putElement(claim.id, { description: "  A first draft  " });

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			description: "A first draft",
		});
	});

	it("stores new text without its padding and takes the marker off", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world);

		await putElement(claim.id, { description: "  Written  " });

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			description: "Written",
		});
	});
});

describe("a description of only spaces sent to the element route", () => {
	it.each([
		"CASE",
		"PATTERN",
	] as const)("leaves the text of an element that is not a placeholder as it was, in a %s", async (kind) => {
		const world = await openWorld(kind);
		const claim = await world.seedClaim({
			name: "P1",
			description: "Already written",
		});

		const response = await putElement(claim.id, { description: "   " });

		expect(response.status).toBe(200);
		expect((await stored(claim.id)).description).toBe("Already written");
	});
});

describe("what the answers say about the marker and the hint", () => {
	it("returns the marker and the hint of a placeholder, and the empty text", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world);

		const body = await (await getElement(claim.id)).json();

		expect(body).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Say what this claim asserts",
			description: "",
		});
	});

	it.each([
		["the answer to the write that fills it in", "write"],
		["a read afterwards", "read"],
	])("leaves the marker and the hint out of %s", async (_when, how) => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world);

		const written = await putElement(claim.id, { description: "Written" });
		const body = await (how === "write"
			? written
			: await getElement(claim.id)
		).json();

		expect(body.description).toBe("Written");
		expect(body).not.toHaveProperty("isPlaceholder");
		expect(body).not.toHaveProperty("placeholderHint");
	});

	it("leaves out a hint left over on an element that is not a placeholder", async () => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({
			name: "P1",
			description: "Written",
			placeholderHint: "A leftover hint",
		});

		const body = await (await getElement(claim.id)).json();

		expect(body).not.toHaveProperty("isPlaceholder");
		expect(body).not.toHaveProperty("placeholderHint");
	});

	it("returns the marker and hint just set, in the answer to the write that sets them", async () => {
		const world = await openWorld("PATTERN");
		const claim = await world.seedClaim({ name: "P1", description: "Text" });

		const body = await (
			await putElement(claim.id, {
				isPlaceholder: true,
				placeholderHint: "Write the claim",
			})
		).json();

		expect(body).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Write the claim",
		});
	});
});

describe("a batch that fails part-way", () => {
	it("takes no marker off, because none of its changes is kept", async () => {
		const world = await openWorld("CASE");
		const written = await seedPlaceholderClaim(world, { name: "P1" });
		const other = await world.seedClaim({ name: "P2", description: "Text" });

		const response = await postBatch(world.caseId, [
			batchUpdate(written.id, { description: "Written" }),
			batchUpdate(other.id, {
				isDefeater: true,
				defeatsElementId: randomUUID(),
			}),
		]);

		expect(response.status).not.toBe(200);
		expect(await stored(written.id)).toMatchObject({
			isPlaceholder: true,
			description: "",
		});
	});

	it("applies each update's own rule when one batch updates several placeholders", async () => {
		const world = await openWorld("CASE");
		const filled = await seedPlaceholderClaim(world, { name: "P1" });
		const same = await seedPlaceholderClaim(world, {
			name: "P2",
			description: "Draft",
		});
		const explicit = await seedPlaceholderClaim(world, { name: "P3" });

		const response = await postBatch(world.caseId, [
			batchUpdate(filled.id, { description: "Written" }),
			batchUpdate(same.id, { description: "Draft" }),
			batchUpdate(explicit.id, {
				description: "Written, but to be reviewed",
				isPlaceholder: true,
			}),
		]);

		expect(response.status).toBe(200);
		expect((await stored(filled.id)).isPlaceholder).toBe(false);
		expect((await stored(same.id)).isPlaceholder).toBe(true);
		expect((await stored(explicit.id)).isPlaceholder).toBe(true);
	});
});
