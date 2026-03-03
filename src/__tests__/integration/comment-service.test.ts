import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import type { CommentResponse } from "@/lib/services/comment-service";
import {
	createCaseComment,
	createElementComment,
	deleteComment,
	fetchCaseComments,
	fetchElementComments,
	resolveComment,
	updateComment,
} from "@/lib/services/comment-service";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

// SSE events are fire-and-forget in tests — mock to prevent side effects
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

/**
 * Constructs a minimal ValidatedSession-like object for comment mutations.
 */
function makeSession(userId: string, username = "testuser") {
	return { userId, username, email: `${username}@example.com` };
}

describe("comment-service", () => {
	describe("createCaseComment", () => {
		it("creates a case-level comment and returns CommentResponse", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			// Give user COMMENT permission (owner already has it)
			const comment = (await createCaseComment(
				testCase.id,
				"Hello, case!",
				null,
				user.id
			)) as unknown as CommentResponse;

			expect(comment.id).toBeDefined();
			expect(comment.content).toBe("Hello, case!");
			expect(comment.authorId).toBe(user.id);
			expect(comment.replies).toEqual([]);
		});

		it("throws FORBIDDEN when user lacks COMMENT permission", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);

			await expect(
				createCaseComment(testCase.id, "Sneaky comment", null, outsider.id)
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("throws FORBIDDEN when user only has VIEW permission (view < comment)", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			await expect(
				createCaseComment(testCase.id, "Cannot comment", null, viewer.id)
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});
	});

	describe("createElementComment", () => {
		it("creates an element-level comment and returns CommentResponse", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const element = await createTestElement(testCase.id, user.id);

			const session = makeSession(user.id, user.username);
			const comment = (await createElementComment(
				element.id,
				"Element note",
				null,
				session
			)) as unknown as CommentResponse;

			expect(comment.id).toBeDefined();
			expect(comment.content).toBe("Element note");
		});

		it("throws NOT_FOUND when user has no access to the case", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const element = await createTestElement(testCase.id, owner.id);

			const session = makeSession(outsider.id, outsider.username);
			await expect(
				createElementComment(element.id, "Sneaky", null, session)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("threading (replies)", () => {
		it("creates a reply to an existing comment with a parentId", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const parent = (await createCaseComment(
				testCase.id,
				"Parent comment",
				null,
				user.id
			)) as unknown as CommentResponse;
			const reply = (await createCaseComment(
				testCase.id,
				"Reply here",
				parent.id,
				user.id
			)) as unknown as CommentResponse;

			expect(reply.parentId).toBe(parent.id);
		});
	});

	describe("fetchCaseComments", () => {
		it("returns a threaded tree of case-level comments", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const parent = (await createCaseComment(
				testCase.id,
				"Thread root",
				null,
				user.id
			)) as unknown as CommentResponse;
			await createCaseComment(testCase.id, "Child", parent.id, user.id);

			const result = (await fetchCaseComments(
				testCase.id,
				user.id
			)) as unknown as CommentResponse[];

			expect(result).toHaveLength(1);
			expect(result[0]!.content).toBe("Thread root");
			expect(result[0]!.replies).toHaveLength(1);
			expect(result[0]!.replies![0]!.content).toBe("Child");
		});

		it("throws NOT_FOUND when user has no VIEW access", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);

			await expect(
				fetchCaseComments(testCase.id, outsider.id)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("fetchElementComments", () => {
		it("returns comments for an element that the user can VIEW", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const element = await createTestElement(testCase.id, user.id);

			const session = makeSession(user.id, user.username);
			await createElementComment(
				element.id,
				"An element comment",
				null,
				session
			);

			const result = (await fetchElementComments(
				element.id,
				user.id
			)) as unknown as CommentResponse[];

			expect(result).toHaveLength(1);
			expect(result[0]!.content).toBe("An element comment");
		});

		it("throws NOT_FOUND when user has no access to the case", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const element = await createTestElement(testCase.id, owner.id);

			await expect(
				fetchElementComments(element.id, outsider.id)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("updateComment", () => {
		it("allows the author to edit their own comment", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const comment = (await createCaseComment(
				testCase.id,
				"Original content",
				null,
				user.id
			)) as unknown as CommentResponse;
			const session = makeSession(user.id, user.username);

			const updated = (await updateComment(
				comment.id,
				"Edited content",
				session
			)) as unknown as CommentResponse;

			expect(updated.content).toBe("Edited content");
		});

		it("allows a user with EDIT case permission to edit any comment", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

			const comment = (await createCaseComment(
				testCase.id,
				"Owner comment",
				null,
				owner.id
			)) as unknown as CommentResponse;
			const editorSession = makeSession(editor.id, editor.username);

			const updated = (await updateComment(
				comment.id,
				"Editor-modified",
				editorSession
			)) as unknown as CommentResponse;

			expect(updated.content).toBe("Editor-modified");
		});

		it("throws NOT_FOUND when a non-author without EDIT permission tries to edit", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "COMMENT");

			const comment = (await createCaseComment(
				testCase.id,
				"Owner only",
				null,
				owner.id
			)) as unknown as CommentResponse;
			const viewerSession = makeSession(viewer.id, viewer.username);

			// NOT_FOUND is returned (not FORBIDDEN) to prevent comment enumeration
			await expect(
				updateComment(comment.id, "Forbidden edit", viewerSession)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("deleteComment", () => {
		it("allows the author to delete their own comment", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const comment = (await createCaseComment(
				testCase.id,
				"Delete me",
				null,
				user.id
			)) as unknown as CommentResponse;
			const session = makeSession(user.id, user.username);

			const result = (await deleteComment(comment.id, session)) as unknown as {
				success: boolean;
			};

			expect(result.success).toBe(true);
		});

		it("throws NOT_FOUND when trying to delete a non-existent comment", async () => {
			const user = await createTestUser();
			const session = makeSession(user.id, user.username);

			await expect(
				deleteComment("00000000-0000-0000-0000-000000000000", session)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("resolveComment", () => {
		it("marks a comment as resolved", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const comment = (await createCaseComment(
				testCase.id,
				"Resolve me",
				null,
				user.id
			)) as unknown as CommentResponse;
			const session = makeSession(user.id, user.username);

			const resolved = (await resolveComment(
				comment.id,
				true,
				session
			)) as unknown as CommentResponse;

			expect(resolved.resolved).toBe(true);
			expect(resolved.resolvedBy).toBe(user.username);
			expect(resolved.resolvedAt).toBeDefined();
		});

		it("persists resolved state to the database", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const comment = (await createCaseComment(
				testCase.id,
				"Verify DB state",
				null,
				user.id
			)) as unknown as CommentResponse;
			const session = makeSession(user.id, user.username);

			await resolveComment(comment.id, true, session);

			// Verify DB state directly
			const inDb = await prisma.comment.findUnique({
				where: { id: comment.id },
				include: { resolvedBy: { select: { username: true } } },
			});
			expect(inDb?.resolved).toBe(true);
			expect(inDb?.resolvedAt).not.toBeNull();
			expect(inDb?.resolvedById).toBe(user.id);
			expect(inDb?.resolvedBy?.username).toBe(user.username);
		});

		it("marks a resolved comment as unresolved", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const comment = (await createCaseComment(
				testCase.id,
				"Unresolve me",
				null,
				user.id
			)) as unknown as CommentResponse;
			const session = makeSession(user.id, user.username);

			await resolveComment(comment.id, true, session);
			const unresolved = (await resolveComment(
				comment.id,
				false,
				session
			)) as unknown as CommentResponse;

			expect(unresolved.resolved).toBe(false);
			expect(unresolved.resolvedBy).toBeNull();
			expect(unresolved.resolvedAt).toBeNull();
		});

		it("throws NOT_FOUND when a VIEW-only user tries to resolve a comment", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const comment = (await createCaseComment(
				testCase.id,
				"Only editors can resolve",
				null,
				owner.id
			)) as unknown as CommentResponse;
			const viewerSession = makeSession(viewer.id, viewer.username);

			// A VIEW-only user is not the author and does not have EDIT access,
			// so the service returns NOT_FOUND (anti-enumeration)
			await expect(
				resolveComment(comment.id, true, viewerSession)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});
});
