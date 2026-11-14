import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	KINDS,
	openWorld,
	RAW_PATHS,
	seedPlaceholderClaim,
	stored,
	type World,
	WRITE_PATHS,
} from "../utils/placeholder-kit";

/**
 * When writing an element's description takes its "to fill in" marker off, and
 * when it does not, through every way text reaches an element: the element
 * route, the batch route and the Case Assistant's apply. In a case a new,
 * non-empty description clears the marker; in a pattern nothing does.
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
)("a placeholder in a case, written through %s", (_label, path) => {
	let world: World;

	beforeEach(async () => {
		world = await openWorld("CASE");
	});

	it("takes the marker off when a non-empty description is written over empty text", async () => {
		const claim = await seedPlaceholderClaim(world);

		expect(
			await path.write(world, claim.id, {
				description: "Operators are trained",
			})
		).toBe(true);

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			description: "Operators are trained",
		});
	});

	it("takes the marker off when a different description is written over text that was already there", async () => {
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await path.write(world, claim.id, { description: "A better draft" });

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			description: "A better draft",
		});
	});

	it("keeps the marker when the same description is written again", async () => {
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await path.write(world, claim.id, { description: "A first draft" });

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			description: "A first draft",
		});
	});

	it("keeps the marker when an empty description is written", async () => {
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await path.write(world, claim.id, { description: "" });

		expect((await stored(claim.id)).isPlaceholder).toBe(true);
	});

	it("keeps the marker when a description of only spaces is written", async () => {
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await path.write(world, claim.id, { description: "   " });

		expect((await stored(claim.id)).isPlaceholder).toBe(true);
	});

	it("keeps the marker, and the empty text, when only the assumption is written", async () => {
		const claim = await seedPlaceholderClaim(world);

		await path.write(world, claim.id, { assumption: "Training is yearly" });

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			description: "",
			assumption: "Training is yearly",
		});
	});

	it("keeps the marker when only the justification is written", async () => {
		const claim = await seedPlaceholderClaim(world);

		await path.write(world, claim.id, { justification: "Per the audit" });

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			description: "",
			justification: "Per the audit",
		});
	});

	it("keeps the marker when the description is unchanged and another field is written beside it", async () => {
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await path.write(world, claim.id, {
			description: "A first draft",
			assumption: "Training is yearly",
		});

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			assumption: "Training is yearly",
		});
	});

	it("clears only the placeholder whose description was written, leaving its sibling marked", async () => {
		const written = await seedPlaceholderClaim(world, { name: "P1" });
		const untouched = await seedPlaceholderClaim(world, { name: "P2" });

		await path.write(world, written.id, { description: "Now written" });

		expect((await stored(written.id)).isPlaceholder).toBe(false);
		expect((await stored(untouched.id)).isPlaceholder).toBe(true);
	});

	it("does not mark an element that was never a placeholder", async () => {
		const claim = await world.seedClaim({
			name: "P1",
			description: "Already written",
		});

		await path.write(world, claim.id, { description: "Rewritten" });

		expect((await stored(claim.id)).isPlaceholder).toBe(false);
	});
});

describe.each(
	PATHS
)("a placeholder in a pattern, written through %s", (_label, path) => {
	let world: World;

	beforeEach(async () => {
		world = await openWorld("PATTERN");
	});

	it("stays a placeholder when a non-empty description is written", async () => {
		const claim = await seedPlaceholderClaim(world);

		expect(
			await path.write(world, claim.id, { description: "An example claim" })
		).toBe(true);

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			description: "An example claim",
		});
	});

	it("stays a placeholder when a different description replaces existing text", async () => {
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});

		await path.write(world, claim.id, { description: "A second draft" });

		expect((await stored(claim.id)).isPlaceholder).toBe(true);
	});
});

describe.each(
	RAW_PATHS.map((path) => [path.label, path] as const)
)("a request through %s that sets the marker itself", (_label, path) => {
	it("keeps a placeholder in a case marked when it asks for the marker and writes a description", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world);

		const response = await path.send(world, claim.id, {
			description: "Written, but still to review",
			isPlaceholder: true,
		});

		expect(response.status).toBe(200);
		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			description: "Written, but still to review",
		});
	});

	it("takes the marker off a placeholder in a case when the request asks for that and leaves the text alone", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world, {
			description: "Already written",
		});

		const response = await path.send(world, claim.id, {
			isPlaceholder: false,
		});

		expect(response.status).toBe(200);
		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			description: "Already written",
		});
	});

	it("takes the marker off in a case when the request asks for that beside a new description", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world);

		await path.send(world, claim.id, {
			description: "Written",
			isPlaceholder: false,
		});

		expect((await stored(claim.id)).isPlaceholder).toBe(false);
	});

	it("marks an element of a case that has text, so that it blocks publishing until it is written", async () => {
		const world = await openWorld("CASE");
		const claim = await world.seedClaim({
			name: "P1",
			description: "Already written",
		});

		const response = await path.send(world, claim.id, {
			isPlaceholder: true,
			placeholderHint: "Check this against the audit",
		});

		expect(response.status).toBe(200);
		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			description: "Already written",
			placeholderHint: "Check this against the audit",
		});
	});

	it("switches a placeholder in a pattern on and off, and the text is not needed to do either", async () => {
		const world = await openWorld("PATTERN");
		const claim = await world.seedClaim({ name: "P1" });

		await path.send(world, claim.id, { isPlaceholder: true });
		expect((await stored(claim.id)).isPlaceholder).toBe(true);

		await path.send(world, claim.id, { isPlaceholder: false });
		expect((await stored(claim.id)).isPlaceholder).toBe(false);
	});

	it.each(
		KINDS
	)("trims the hint and clears it when it is sent empty, in a %s", async (kind) => {
		const world = await openWorld(kind);
		const claim = await seedPlaceholderClaim(world);

		await path.send(world, claim.id, { placeholderHint: "  Trim me  " });
		expect((await stored(claim.id)).placeholderHint).toBe("Trim me");

		await path.send(world, claim.id, { placeholderHint: "   " });
		expect((await stored(claim.id)).placeholderHint).toBeNull();
	});

	it("refuses a hint of more than 500 characters and keeps the one it had", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world, {
			placeholderHint: "The first hint",
		});

		const response = await path.send(world, claim.id, {
			placeholderHint: "x".repeat(501),
		});

		expect(response.status).toBe(400);
		expect((await stored(claim.id)).placeholderHint).toBe("The first hint");
	});

	it("accepts a hint of exactly 500 characters", async () => {
		const world = await openWorld("CASE");
		const claim = await seedPlaceholderClaim(world);

		const response = await path.send(world, claim.id, {
			placeholderHint: "x".repeat(500),
		});

		expect(response.status).toBe(200);
		expect((await stored(claim.id)).placeholderHint).toHaveLength(500);
	});
});
