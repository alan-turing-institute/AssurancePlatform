import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth } from "../utils/auth-helpers";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * The case-information form is shown this case's own private-media route
 * address for the feature image and submits every field back on save,
 * whether or not the image was touched. Saving with that exact address must
 * leave the stored key unchanged — otherwise the first save after load
 * overwrites the real key with a route address and the image breaks. A
 * genuinely different value must still update the record.
 */

vi.mock("@/lib/auth/validate-session");

const STORED_KEY = "case-studies/original/feature.png";

async function seedCaseWithFeatureImage(ownerId: string) {
	const testCase = await createTestCase(ownerId);
	const { prisma } = await import("@/lib/prisma");
	await prisma.caseInformation.create({
		data: {
			caseId: testCase.id,
			description: "A description",
			authors: "An author",
			sector: "Healthcare",
			featureImageUrl: STORED_KEY,
		},
	});
	return testCase;
}

function putRequest(caseId: string, body: unknown): NextRequest {
	return new NextRequest(
		`http://localhost:3000/api/cases/${caseId}/information`,
		{
			method: "PUT",
			body: JSON.stringify(body),
			headers: { "content-type": "application/json" },
		}
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("saving case information with the displayed feature-image address", () => {
	it("leaves the stored key unchanged at the service layer", async () => {
		const owner = await createTestUser();
		const testCase = await seedCaseWithFeatureImage(owner.id);

		const { upsertCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		const { caseFeatureImageMediaRoute } = await import("@/lib/media-routes");

		const result = await upsertCaseInformation(owner.id, testCase.id, {
			description: "An edited description",
			featureImageUrl: caseFeatureImageMediaRoute(testCase.id),
		});
		if ("error" in result) {
			throw new Error(result.error);
		}

		expect(result.data.featureImageUrl).toBe(STORED_KEY);
		expect(result.data.description).toBe("An edited description");
	});

	it("leaves the stored key unchanged through the PUT route, round-tripping the GET response", async () => {
		const owner = await createTestUser();
		const testCase = await seedCaseWithFeatureImage(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET, PUT } = await import("@/app/api/cases/[id]/information/route");

		const getResponse = await GET(
			new NextRequest(
				`http://localhost:3000/api/cases/${testCase.id}/information`
			),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		const shown = await getResponse.json();
		expect(shown.featureImageUrl).toMatch(
			new RegExp(`/api/cases/${testCase.id}/media/feature(\\?v=[0-9a-f]+)?$`)
		);

		const putResponse = await PUT(
			putRequest(testCase.id, {
				description: "Saved without touching the image",
				featureImageUrl: shown.featureImageUrl,
			}),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		expect(putResponse.status).toBe(200);
		const saved = await putResponse.json();
		// The response is projected back to the route address — the underlying
		// key is what must have survived unchanged.
		expect(saved.featureImageUrl).toBe(shown.featureImageUrl);

		const { prisma } = await import("@/lib/prisma");
		const stored = await prisma.caseInformation.findUniqueOrThrow({
			where: { caseId: testCase.id },
		});
		expect(stored.featureImageUrl).toBe(STORED_KEY);
	});

	it("still replaces the key when a genuinely different value is submitted", async () => {
		const owner = await createTestUser();
		const testCase = await seedCaseWithFeatureImage(owner.id);

		const { upsertCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		// A bare storage key is refused outright (F1) — the only values this
		// path accepts besides this case's own route address are empty or a
		// genuine external https address.
		const result = await upsertCaseInformation(owner.id, testCase.id, {
			featureImageUrl: "https://images.example.com/replacement.png",
		});
		if ("error" in result) {
			throw new Error(result.error);
		}

		expect(result.data.featureImageUrl).toBe(
			"https://images.example.com/replacement.png"
		);
	});

	it("still clears the key when null is submitted explicitly", async () => {
		const owner = await createTestUser();
		const testCase = await seedCaseWithFeatureImage(owner.id);

		const { upsertCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		const result = await upsertCaseInformation(owner.id, testCase.id, {
			featureImageUrl: null,
		});
		if ("error" in result) {
			throw new Error(result.error);
		}

		expect(result.data.featureImageUrl).toBeNull();
	});

	it("refuses another case's own route address rather than treating it as unchanged", async () => {
		const owner = await createTestUser();
		const testCase = await seedCaseWithFeatureImage(owner.id);
		const otherCase = await createTestCase(owner.id);

		const { upsertCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		const { caseFeatureImageMediaRoute } = await import("@/lib/media-routes");

		// Simulates a value copy-pasted from a different case's information
		// panel — this case's own address is the only route address treated as
		// "unchanged"; any other case's route address is refused outright
		// (F1), the same as a bare storage key would be.
		const result = await upsertCaseInformation(owner.id, testCase.id, {
			featureImageUrl: caseFeatureImageMediaRoute(otherCase.id),
		});

		expect("error" in result).toBe(true);

		const { prisma } = await import("@/lib/prisma");
		const stored = await prisma.caseInformation.findUniqueOrThrow({
			where: { caseId: testCase.id },
		});
		expect(stored.featureImageUrl).toBe(STORED_KEY);
	});
});
