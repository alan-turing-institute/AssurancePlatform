import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The publish gate for placeholders: a case cannot be published, or its
 * published copy updated, while its argument still has elements to fill in.
 * A pattern is never held back by its own placeholders.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// The real export, except where a test makes it fail.
vi.mock("@/lib/services/case-export-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/case-export-service")>();
	return { ...actual, exportCase: vi.fn(actual.exportCase) };
});

const { exportCase } = await import("@/lib/services/case-export-service");

beforeEach(async () => {
	await mockNoAuth();
});

const JSON_HEADERS = { "Content-Type": "application/json" };

/** A case or pattern with complete case information and a written top goal, signed in as its owner. */
async function publishableCase(kind: "CASE" | "PATTERN" = "CASE") {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id, { kind });
	await createTestCaseInformation(testCase.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { caseId: testCase.id, goalId: goal.id, ownerId: owner.id };
}

function addPlaceholder(
	scene: { caseId: string; goalId: string; ownerId: string },
	name: string,
	overrides: Parameters<typeof createTestElement>[2] = {}
) {
	return createTestElement(scene.caseId, scene.ownerId, {
		elementType: "PROPERTY_CLAIM",
		name,
		parentId: scene.goalId,
		description: "",
		isPlaceholder: true,
		...overrides,
	});
}

async function publishRoute(caseId: string) {
	const { POST } = await import("@/app/api/cases/[id]/publish/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/publish`, {
			method: "POST",
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function statusRoute(caseId: string) {
	const { PATCH } = await import("@/app/api/cases/[id]/status/route");
	return await PATCH(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/status`, {
			method: "PATCH",
			body: JSON.stringify({ targetStatus: "PUBLISHED" }),
			headers: JSON_HEADERS,
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

const ROUTES = {
	"the publish route": publishRoute,
	"the status route": statusRoute,
};

describe.each(
	Object.entries(ROUTES)
)("publishing through %s", (_label, publish) => {
	it("is refused while placeholders are left, with how many", async () => {
		const scene = await publishableCase();
		await addPlaceholder(scene, "P1");
		await addPlaceholder(scene, "P2");

		const response = await publish(scene.caseId);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("VALIDATION");
		expect(body.error).toBe("2 elements still to fill in");
		const row = await prisma.assuranceCase.findUnique({
			where: { id: scene.caseId },
		});
		expect(row?.published).toBe(false);
	});

	it("says '1 element' for one, and goes ahead once it is written", async () => {
		const scene = await publishableCase();
		const placeholder = await addPlaceholder(scene, "P1");

		const refused = await publish(scene.caseId);
		await prisma.assuranceElement.update({
			where: { id: placeholder.id },
			data: { isPlaceholder: false, description: "Written" },
		});
		const accepted = await publish(scene.caseId);

		expect((await refused.json()).error).toBe("1 element still to fill in");
		expect(accepted.status).toBe(200);
	});

	it("goes ahead for a pattern that still has placeholders", async () => {
		const scene = await publishableCase("PATTERN");
		await addPlaceholder(scene, "P1");

		const response = await publish(scene.caseId);

		expect(response.status).toBe(200);
	});
});

describe("when the case cannot be exported", () => {
	it.each(
		Object.entries(ROUTES)
	)("is refused through %s for a reason other than permission or a missing case", async (_label, publish) => {
		const scene = await publishableCase();
		vi.mocked(exportCase).mockResolvedValueOnce({
			error: "Failed to export case",
		});

		const response = await publish(scene.caseId);

		expect(response.ok).toBe(false);
		const row = await prisma.assuranceCase.findUnique({
			where: { id: scene.caseId },
		});
		expect(row?.published).toBe(false);
	});
});

describe("when the case is converted while it is being exported", () => {
	it.each(
		Object.entries(ROUTES)
	)("is refused through %s, and publishes nothing, when the pattern is converted during the export", async (_label, publish) => {
		const scene = await publishableCase("PATTERN");
		await addPlaceholder(scene, "P1");
		const actual = await vi.importActual<
			typeof import("@/lib/services/case-export-service")
		>("@/lib/services/case-export-service");
		vi.mocked(exportCase).mockImplementationOnce(async (...args) => {
			const exported = await actual.exportCase(...args);
			await convertCaseKind(scene.ownerId, scene.caseId, "CASE");
			return exported;
		});

		const response = await publish(scene.caseId);

		expect(response.status).toBe(409);
		const row = await prisma.assuranceCase.findUnique({
			where: { id: scene.caseId },
		});
		expect(row).toMatchObject({ kind: "CASE", published: false });
		expect(
			await prisma.publishedAssuranceCase.count({
				where: { assuranceCaseId: scene.caseId },
			})
		).toBe(0);
	});
});

describe("what the gate counts", () => {
	it("refuses to update a published copy when a placeholder has since been added", async () => {
		const scene = await publishableCase();
		await publishRoute(scene.caseId);
		await addPlaceholder(scene, "P1");

		const response = await statusRoute(scene.caseId);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
	});

	it("leaves out a detached sandbox element and counts shared evidence once", async () => {
		const scene = await publishableCase();
		const first = await addPlaceholder(scene, "P1", { isPlaceholder: false });
		const second = await addPlaceholder(scene, "P2", { isPlaceholder: false });
		await addPlaceholder(scene, "P3", { parentId: undefined, inSandbox: true });
		const evidence = await createTestElement(scene.caseId, scene.ownerId, {
			elementType: "EVIDENCE",
			name: "E1",
			description: "",
			isPlaceholder: true,
		});
		await prisma.evidenceLink.createMany({
			data: [first, second].map((claim) => ({
				evidenceId: evidence.id,
				claimId: claim.id,
			})),
		});

		const response = await publishRoute(scene.caseId);

		expect((await response.json()).error).toBe("1 element still to fill in");
	});
});
