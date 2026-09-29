import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { softDeleteCase } from "@/lib/services/case-trash-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCaseWithGoal,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

/** Publishes and archives a fresh case for `owner`, returning its published id. */
async function publishAndArchive(owner: {
	id: string;
	username: string;
	email: string;
}): Promise<string> {
	const testCase = await createTestCaseWithGoal(owner.id, "Archived Copy");
	const published = await publishAssuranceCase(owner.id, testCase.id);
	if ("error" in published) {
		throw new Error(published.error);
	}
	await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });
	return published.data.publishedId;
}

describe("GET /api/cases/trash/archived", () => {
	it("returns 401 when unauthenticated", async () => {
		const { GET } = await import("@/app/api/cases/trash/archived/route");
		const response = await GET();
		expect(response.status).toBe(401);
	});

	it("returns 200 with only the caller's own archived copies", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		await publishAndArchive(stranger);
		await publishAndArchive(owner);

		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await import("@/app/api/cases/trash/archived/route");
		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveLength(1);
	});
});

describe("DELETE /api/cases/trash/archived/[publishedId]", () => {
	async function callDelete(publishedId: string) {
		const { DELETE } = await import(
			"@/app/api/cases/trash/archived/[publishedId]/route"
		);
		const request = new NextRequest(
			`http://localhost:3000/api/cases/trash/archived/${publishedId}`
		);
		return DELETE(request, { params: Promise.resolve({ publishedId }) });
	}

	it("returns 401 when unauthenticated", async () => {
		const response = await callDelete("00000000-0000-0000-0000-000000000000");
		expect(response.status).toBe(401);
	});

	it("returns 404 for a missing id", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const response = await callDelete("00000000-0000-0000-0000-000000000000");
		expect(response.status).toBe(404);
	});

	it("returns the same 404 for a malformed id as for a missing one", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const response = await callDelete("not-a-uuid");
		expect(response.status).toBe(404);
	});

	it("returns 404 for someone else's archived copy", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const publishedId = await publishAndArchive(owner);

		await mockAuth(stranger.id, stranger.username, stranger.email);
		const response = await callDelete(publishedId);
		expect(response.status).toBe(404);

		const stillThere = await prisma.publishedAssuranceCase.findUnique({
			where: { id: publishedId },
		});
		expect(stillThere).not.toBeNull();
	});

	it("returns 200 and removes the caller's own archived copy", async () => {
		const owner = await createTestUser();
		const publishedId = await publishAndArchive(owner);

		await mockAuth(owner.id, owner.username, owner.email);
		const response = await callDelete(publishedId);
		expect(response.status).toBe(200);

		const gone = await prisma.publishedAssuranceCase.findUnique({
			where: { id: publishedId },
		});
		expect(gone).toBeNull();
	});
});
