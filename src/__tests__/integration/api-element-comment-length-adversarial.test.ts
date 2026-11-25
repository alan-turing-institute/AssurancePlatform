import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import type { PermissionLevel, User } from "@/src/generated/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestComment,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * POST /api/elements/[id]/comments: the text comes from `content` or, for
 * older callers, `comment`; each is trimmed, the first that is not blank is
 * kept, and at most 5000 characters are stored.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const LONG_MESSAGE = "Comment content must be less than 5000 characters";
const BLANK_MESSAGE = "Comment content is required";

beforeEach(async () => {
	await mockNoAuth();
});

async function post(elementId: string, body: unknown): Promise<Response> {
	const route = await import("@/app/api/elements/[id]/comments/route");
	return route.POST(
		new Request(`http://localhost:3000/api/elements/${elementId}/comments`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

async function scene(level: PermissionLevel = "COMMENT") {
	const owner = await createTestUser();
	const commenter = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const element = await createTestElement(testCase.id, owner.id);
	await createTestPermission(testCase.id, commenter.id, owner.id, level);
	await signIn(commenter);
	return { owner, commenter, elementId: element.id };
}

function signIn(user: User) {
	return mockAuth(user.id, user.username, user.email);
}

async function storedContents(elementId: string) {
	const rows = await prisma.comment.findMany({
		where: { elementId },
		orderBy: { createdAt: "asc" },
	});
	return rows.map((row) => row.content);
}

async function refusal(response: Response) {
	const body = await response.json();
	return { status: response.status, text: JSON.stringify(body) };
}

describe("POST /api/elements/[id]/comments: text and length", () => {
	it("stores exactly 5000 characters", async () => {
		const s = await scene();
		const text = "a".repeat(5000);

		const response = await post(s.elementId, { content: text });

		expect(response.status).toBe(201);
		expect(await storedContents(s.elementId)).toEqual([text]);
	});

	it("refuses 5001 characters and stores nothing", async () => {
		const s = await scene();

		const result = await refusal(
			await post(s.elementId, { content: "a".repeat(5001) })
		);

		expect(result.status).toBe(400);
		expect(result.text).toContain(LONG_MESSAGE);
		expect(await storedContents(s.elementId)).toEqual([]);
	});

	it("refuses 5001 characters sent in the older field", async () => {
		const s = await scene();

		const result = await refusal(
			await post(s.elementId, { comment: "a".repeat(5001) })
		);

		expect(result.status).toBe(400);
		expect(result.text).toContain(LONG_MESSAGE);
		expect(await storedContents(s.elementId)).toEqual([]);
	});

	it("counts the length after trimming and stores the trimmed text", async () => {
		const s = await scene();
		const text = "b".repeat(5000);

		const response = await post(s.elementId, { content: `  ${text}\n ` });

		expect(response.status).toBe(201);
		expect(await storedContents(s.elementId)).toEqual([text]);
	});

	it("uses the older field when content is only spaces", async () => {
		const s = await scene();

		const response = await post(s.elementId, {
			content: "   ",
			comment: "  from the older field ",
		});

		expect(response.status).toBe(201);
		expect(await storedContents(s.elementId)).toEqual(["from the older field"]);
	});

	it("uses content when both hold text", async () => {
		const s = await scene();

		const response = await post(s.elementId, {
			content: "newer",
			comment: "older",
		});

		expect(response.status).toBe(201);
		expect(await storedContents(s.elementId)).toEqual(["newer"]);
	});

	it("does not fall back to the older field when content is too long", async () => {
		const s = await scene();

		const result = await refusal(
			await post(s.elementId, {
				content: "a".repeat(5001),
				comment: "short",
			})
		);

		expect(result.status).toBe(400);
		expect(result.text).toContain(LONG_MESSAGE);
		expect(await storedContents(s.elementId)).toEqual([]);
	});

	it.each([
		["both fields blank", { content: "  ", comment: "\n\t" }],
		["both fields empty", { content: "", comment: "" }],
		["no text at all", {}],
	])("refuses a blank comment: %s", async (_label, body) => {
		const s = await scene();

		const result = await refusal(await post(s.elementId, body));

		expect(result.status).toBe(400);
		expect(result.text).toContain(BLANK_MESSAGE);
		expect(await storedContents(s.elementId)).toEqual([]);
	});

	it("still stores a reply under its parent", async () => {
		const s = await scene();
		const parent = await createTestComment(s.owner.id, {
			elementId: s.elementId,
			content: "parent",
		});

		const response = await post(s.elementId, {
			comment: "  a reply ",
			parentId: parent.id,
		});

		expect(response.status).toBe(201);
		const reply = await prisma.comment.findFirst({
			where: { elementId: s.elementId, parentCommentId: parent.id },
		});
		expect(reply?.content).toBe("a reply");
	});

	it("keeps refusing an unknown parent, storing nothing", async () => {
		const s = await scene();

		const response = await post(s.elementId, {
			content: "reply",
			parentId: "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f",
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(await storedContents(s.elementId)).toEqual([]);
	});
});

describe("POST /api/elements/[id]/comments: who may comment", () => {
	it.each([
		["a short comment", "hello", 403],
		["exactly 5000 characters", "a".repeat(5000), 403],
		["too long", "a".repeat(5001), 400],
		["blank", "   ", 400],
	])("refuses a user who may only view, whatever the text: %s", async (_label, text, status) => {
		const s = await scene("VIEW");

		const response = await post(s.elementId, { content: text });

		expect(response.status).toBe(status);
		expect(await storedContents(s.elementId)).toEqual([]);
	});

	it("refuses a user who may only view with a 403 for valid text", async () => {
		const s = await scene("VIEW");

		const response = await post(s.elementId, { content: "hello" });

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
		expect(await storedContents(s.elementId)).toEqual([]);
	});

	it("refuses a user with no access with a 403 for 5000 characters", async () => {
		const s = await scene();
		const stranger = await createTestUser();
		await signIn(stranger);

		const response = await post(s.elementId, { content: "a".repeat(5000) });

		expect(response.status).toBe(403);
		expect(await storedContents(s.elementId)).toEqual([]);
	});

	it("refuses a signed-out caller", async () => {
		const s = await scene();
		await mockNoAuth();

		const response = await post(s.elementId, { content: "hello" });

		expect(response.status).toBe(401);
		expect(await storedContents(s.elementId)).toEqual([]);
	});
});
