import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * POST /api/elements/[id]/comments: the text may arrive in `content` or in
 * the older `comment` field, and is limited to 5,000 characters once trimmed.
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

async function scene() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const element = await createTestElement(testCase.id, owner.id);
	await mockAuth(owner.id, owner.username, owner.email);
	return element.id;
}

async function post(elementId: string, body: Record<string, unknown>) {
	const { POST } = await import("@/app/api/elements/[id]/comments/route");
	return POST(
		new NextRequest(
			`http://localhost:3000/api/elements/${elementId}/comments`,
			{
				method: "POST",
				body: JSON.stringify(body),
				headers: { "Content-Type": "application/json" },
			}
		),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

function storedContents(elementId: string) {
	return prisma.comment
		.findMany({ where: { elementId } })
		.then((rows) => rows.map((row) => row.content));
}

describe("POST /api/elements/[id]/comments", () => {
	it("accepts and stores 5000 characters", async () => {
		const elementId = await scene();
		const text = "c".repeat(5000);

		expect((await post(elementId, { content: text })).status).toBe(201);
		expect(await storedContents(elementId)).toEqual([text]);
	});

	it("refuses 5001 characters and stores nothing", async () => {
		const elementId = await scene();

		const response = await post(elementId, { content: "c".repeat(5001) });

		expect(response.status).toBe(400);
		expect(JSON.stringify(await response.json())).toContain(
			"Comment content must be less than 5000 characters"
		);
		expect(await storedContents(elementId)).toEqual([]);
	});

	it("uses the older field when content is only spaces", async () => {
		const elementId = await scene();

		const response = await post(elementId, {
			content: "   ",
			comment: "from the older field",
		});

		expect(response.status).toBe(201);
		expect(await storedContents(elementId)).toEqual(["from the older field"]);
	});
});
