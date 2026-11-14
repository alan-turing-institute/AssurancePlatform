import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { requireCaseInformationComplete } from "@/lib/services/case-information-service";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import {
	publishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	openWorld,
	putElement,
	seedElement,
	seedPlaceholderClaim,
	stored,
	type World,
} from "../utils/placeholder-kit";
import {
	createTestCaseInformation,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The publish gate: a case with an element still to fill in cannot be
 * published or republished, on the publish route and on the status route; a
 * pattern is never held back. The count is of the argument that would be
 * published, so a detached sandbox element, a deleted one and a repeated
 * view of the same evidence do not add to it.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

async function publishCase(caseId: string) {
	const { POST } = await import("@/app/api/cases/[id]/publish/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/publish`, {
			method: "POST",
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function setStatus(caseId: string, targetStatus: "DRAFT" | "PUBLISHED") {
	const { PATCH } = await import("@/app/api/cases/[id]/status/route");
	return await PATCH(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/status`, {
			method: "PATCH",
			body: JSON.stringify({ targetStatus }),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

/** Both routes that can move a case to PUBLISHED. */
const ROUTES = [
	["the publish route", publishCase],
	["the status route", (caseId: string) => setStatus(caseId, "PUBLISHED")],
] as const;

/** A case or pattern whose case information is complete, so only the argument can hold it back. */
async function readyWorld(kind: "CASE" | "PATTERN" = "CASE"): Promise<World> {
	const world = await openWorld(kind);
	await createTestCaseInformation(world.caseId);
	return world;
}

function snapshotCount(caseId: string) {
	return prisma.publishedAssuranceCase.count({
		where: { assuranceCaseId: caseId },
	});
}

async function publishStatusOf(caseId: string) {
	return (
		await prisma.assuranceCase.findUniqueOrThrow({ where: { id: caseId } })
	).publishStatus;
}

describe.each(ROUTES)("publishing a case through %s", (_label, publish) => {
	it("refuses a case with one placeholder, saying how many are left, and publishes nothing", async () => {
		const world = await readyWorld();
		await seedPlaceholderClaim(world);

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
		expect(await snapshotCount(world.caseId)).toBe(0);
		expect(await publishStatusOf(world.caseId)).toBe("DRAFT");
	});

	it("counts every placeholder in the argument, whatever its depth or type", async () => {
		const world = await readyWorld();
		const strategy = await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "STRATEGY",
			name: "S1",
			parentId: world.goalId,
			description: "Argue over the hazards",
			isPlaceholder: true,
		});
		const claim = await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: strategy.id,
			description: "A claim that is already written",
		});
		await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: claim.id,
			isPlaceholder: true,
		});

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("2 elements still to fill in");
	});

	it("counts a placeholder that already has some text", async () => {
		const world = await readyWorld();
		await seedPlaceholderClaim(world, { description: "A first draft" });

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
	});

	it("counts the top-level goal when that is the placeholder", async () => {
		const world = await readyWorld();
		await prisma.assuranceElement.update({
			where: { id: world.goalId },
			data: { isPlaceholder: true, description: "" },
		});

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
	});

	it("counts a piece of evidence once though it supports two claims", async () => {
		const world = await readyWorld();
		const first = await world.seedClaim({ name: "P1", description: "One" });
		const second = await world.seedClaim({ name: "P2", description: "Two" });
		const evidence = await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "EVIDENCE",
			name: "E1",
			isPlaceholder: true,
		});
		for (const claim of [first, second]) {
			await prisma.evidenceLink.create({
				data: { evidenceId: evidence.id, claimId: claim.id },
			});
		}

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
	});

	it("does not count a placeholder in the sandbox, which is not part of what is published", async () => {
		const world = await readyWorld();
		await seedPlaceholderClaim(world, { inSandbox: true, parentId: undefined });

		const response = await publish(world.caseId);

		expect(response.status).toBe(200);
	});

	it("does not count a placeholder that has been deleted", async () => {
		const world = await readyWorld();
		const claim = await seedPlaceholderClaim(world);
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { deletedAt: new Date() },
		});

		const response = await publish(world.caseId);

		expect(response.status).toBe(200);
	});

	it("publishes once the last placeholder has been written", async () => {
		const world = await readyWorld();
		const claim = await seedPlaceholderClaim(world);
		expect((await publish(world.caseId)).status).toBe(400);

		expect(
			(await putElement(claim.id, { description: "Operators are trained" }))
				.status
		).toBe(200);
		const response = await publish(world.caseId);

		expect(response.status).toBe(200);
		expect(await snapshotCount(world.caseId)).toBe(1);
	});

	it("does not publish after writing only the assumption of a placeholder", async () => {
		const world = await readyWorld();
		const claim = await seedPlaceholderClaim(world);
		await putElement(claim.id, { assumption: "Training is yearly" });

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
	});

	it("publishes a pattern that still holds placeholders", async () => {
		const world = await readyWorld("PATTERN");
		await seedPlaceholderClaim(world);

		const response = await publish(world.caseId);

		expect(response.status).toBe(200);
		expect(await snapshotCount(world.caseId)).toBe(1);
	});

	it("reports the missing case information before the placeholders, with its field errors", async () => {
		const world = await openWorld("CASE");
		await seedPlaceholderClaim(world);

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.fieldErrors).toBeDefined();
		expect(body.error).not.toContain("still to fill in");
	});

	it("refuses a user with only VIEW access and publishes nothing", async () => {
		const world = await readyWorld();
		await seedPlaceholderClaim(world);
		const viewer = await createTestUser();
		await createTestPermission(world.caseId, viewer.id, world.ownerId, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const response = await publish(world.caseId);

		expect(response.status).not.toBe(200);
		expect(await snapshotCount(world.caseId)).toBe(0);
	});
});

describe("republishing a published case", () => {
	async function publishedWorld(): Promise<World> {
		const world = await readyWorld();
		const first = await publishCase(world.caseId);
		if (first.status !== 200) {
			throw new Error(`The first publish failed with ${first.status}`);
		}
		return world;
	}

	it.each(
		ROUTES
	)("refuses on %s once an element has been marked, and keeps the published version as it was", async (_label, publish) => {
		const world = await publishedWorld();
		const before = await snapshotCount(world.caseId);
		await putElement(world.goalId, { isPlaceholder: true });

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
		expect(await snapshotCount(world.caseId)).toBe(before);
	});

	it("republishes through the status route once the marked element is written", async () => {
		const world = await publishedWorld();
		await putElement(world.goalId, { isPlaceholder: true });
		expect((await setStatus(world.caseId, "PUBLISHED")).status).toBe(400);

		await putElement(world.goalId, { description: "The system is safe" });
		const response = await setStatus(world.caseId, "PUBLISHED");

		expect(response.status).toBe(200);
	});

	it("still unpublishes a published case whose elements are marked", async () => {
		const world = await publishedWorld();
		await putElement(world.goalId, { isPlaceholder: true });

		const response = await setStatus(world.caseId, "DRAFT");

		expect(response.status).toBe(200);
		expect(await publishStatusOf(world.caseId)).toBe("DRAFT");
	});
});

describe("a case converted to a pattern and back", () => {
	it("keeps its placeholders, so it is still refused publication", async () => {
		const world = await readyWorld();
		const claim = await seedPlaceholderClaim(world, {
			placeholderHint: "Say what this claim asserts",
		});

		expect(
			"data" in (await convertCaseKind(world.ownerId, world.caseId, "PATTERN"))
		).toBe(true);
		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Say what this claim asserts",
		});
		expect(
			"data" in (await convertCaseKind(world.ownerId, world.caseId, "CASE"))
		).toBe(true);
		const response = await publishCase(world.caseId);

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Say what this claim asserts",
		});
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
	});

	it("is not held back while it is a pattern, whatever it held as a case", async () => {
		const world = await readyWorld();
		await seedPlaceholderClaim(world);
		await convertCaseKind(world.ownerId, world.caseId, "PATTERN");

		const response = await publishCase(world.caseId);

		expect(response.status).toBe(200);
	});
});

describe("a case that changes after the gate has passed", () => {
	const STILL_TO_FILL_IN = { error: "1 element still to fill in" };

	it("is refused when a pattern is converted to a case, and publishes nothing", async () => {
		const world = await readyWorld("PATTERN");
		await seedPlaceholderClaim(world);
		expect(
			await requireCaseInformationComplete(world.ownerId, world.caseId)
		).toEqual({ data: true });
		expect(
			"data" in (await convertCaseKind(world.ownerId, world.caseId, "CASE"))
		).toBe(true);

		const result = await publishAssuranceCase(world.ownerId, world.caseId);

		expect(result).toEqual(STILL_TO_FILL_IN);
		expect(await snapshotCount(world.caseId)).toBe(0);
		expect(await publishStatusOf(world.caseId)).toBe("DRAFT");
	});

	it("is refused on a first publish when an element is marked, and publishes nothing", async () => {
		const world = await readyWorld();
		expect(
			await requireCaseInformationComplete(world.ownerId, world.caseId)
		).toEqual({ data: true });
		expect(
			(await putElement(world.goalId, { isPlaceholder: true })).status
		).toBe(200);

		const result = await publishAssuranceCase(world.ownerId, world.caseId);

		expect(result).toEqual(STILL_TO_FILL_IN);
		expect(await snapshotCount(world.caseId)).toBe(0);
		expect(await publishStatusOf(world.caseId)).toBe("DRAFT");
	});

	it("is refused on a republish when an element is marked, and keeps the published version as it was", async () => {
		const world = await readyWorld();
		expect((await publishCase(world.caseId)).status).toBe(200);
		expect(
			await requireCaseInformationComplete(world.ownerId, world.caseId)
		).toEqual({ data: true });
		expect(
			(await putElement(world.goalId, { isPlaceholder: true })).status
		).toBe(200);

		const result = await updatePublishedCase(world.ownerId, world.caseId);

		expect(result).toEqual(STILL_TO_FILL_IN);
		expect(await snapshotCount(world.caseId)).toBe(1);
	});
});
