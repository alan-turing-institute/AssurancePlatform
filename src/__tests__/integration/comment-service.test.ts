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
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * SSE broadcasts are fire-and-forget in-process operations with no external I/O.
 * Mock to prevent test blocking on real SSE setup — not to avoid real DB testing.
 */
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
			const result = await createCaseComment(
				testCase.id,
				"Hello, case!",
				null,
				user.id
			);

			const comment = expectSuccess(result) as CommentResponse;
			expect(comment.id).toBeDefined();
			expect(comment.content).toBe("Hello, case!");
			expect(comment.authorId).toBe(user.id);
			expect(comment.replies).toEqual([]);
		});

		it("returns 'Permission denied' when user lacks COMMENT permission", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);

			const result = await createCaseComment(
				testCase.id,
				"Sneaky comment",
				null,
				outsider.id
			);

			expectError(result, "Permission denied");
		});

		it("returns 'Permission denied' when user only has VIEW permission (view < comment)", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const result = await createCaseComment(
				testCase.id,
				"Cannot comment",
				null,
				viewer.id
			);

			expectError(result, "Permission denied");
		});
	});

	describe("createElementComment", () => {
		it("creates an element-level comment and returns CommentResponse", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const element = await createTestElement(testCase.id, user.id);

			const session = makeSession(user.id, user.username);
			const result = await createElementComment(
				element.id,
				"Element note",
				null,
				session
			);

			const comment = expectSuccess(result) as CommentResponse;
			expect(comment.id).toBeDefined();
			expect(comment.content).toBe("Element note");
		});

		it("returns 'Permission denied' when user has no access to the case", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const element = await createTestElement(testCase.id, owner.id);

			const session = makeSession(outsider.id, outsider.username);
			const result = await createElementComment(
				element.id,
				"Sneaky",
				null,
				session
			);

			expectError(result);
		});
	});

	describe("threading (replies)", () => {
		it("creates a reply to an existing comment with a parentId", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const parentResult = await createCaseComment(
				testCase.id,
				"Parent comment",
				null,
				user.id
			);
			const parent = expectSuccess(parentResult) as CommentResponse;

			const replyResult = await createCaseComment(
				testCase.id,
				"Reply here",
				parent.id,
				user.id
			);
			const reply = expectSuccess(replyResult) as CommentResponse;

			expect(reply.parentId).toBe(parent.id);
		});
	});

	describe("fetchCaseComments", () => {
		it("returns a threaded tree of case-level comments", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const parentResult = await createCaseComment(
				testCase.id,
				"Thread root",
				null,
				user.id
			);
			const parent = expectSuccess(parentResult) as CommentResponse;
			await createCaseComment(testCase.id, "Child", parent.id, user.id);

			const result = await fetchCaseComments(testCase.id, user.id);

			const comments = expectSuccess(result) as CommentResponse[];
			expect(comments).toHaveLength(1);
			expect(comments[0]!.content).toBe("Thread root");
			expect(comments[0]!.replies).toHaveLength(1);
			expect(comments[0]!.replies![0]!.content).toBe("Child");
		});

		it("returns 'Permission denied' when user has no VIEW access", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);

			const result = await fetchCaseComments(testCase.id, outsider.id);

			expectError(result);
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

			const result = await fetchElementComments(element.id, user.id);

			const comments = expectSuccess(result) as CommentResponse[];
			expect(comments).toHaveLength(1);
			expect(comments[0]!.content).toBe("An element comment");
		});

		it("returns 'Permission denied' when user has no access to the case", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const element = await createTestElement(testCase.id, owner.id);

			const result = await fetchElementComments(element.id, outsider.id);

			expectError(result);
		});
	});

	describe("updateComment", () => {
		it("allows the author to edit their own comment", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const commentResult = await createCaseComment(
				testCase.id,
				"Original content",
				null,
				user.id
			);
			const comment = expectSuccess(commentResult) as CommentResponse;
			const session = makeSession(user.id, user.username);

			const updatedResult = await updateComment(
				comment.id,
				"Edited content",
				session
			);

			const updated = expectSuccess(updatedResult);
			expect(updated.content).toBe("Edited content");
		});

		it("allows a user with EDIT case permission to edit any comment", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

			const commentResult = await createCaseComment(
				testCase.id,
				"Owner comment",
				null,
				owner.id
			);
			const comment = expectSuccess(commentResult) as CommentResponse;
			const editorSession = makeSession(editor.id, editor.username);

			const updatedResult = await updateComment(
				comment.id,
				"Editor-modified",
				editorSession
			);

			const updated = expectSuccess(updatedResult);
			expect(updated.content).toBe("Editor-modified");
		});

		it("returns 'Permission denied' when a non-author without EDIT permission tries to edit", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "COMMENT");

			const commentResult = await createCaseComment(
				testCase.id,
				"Owner only",
				null,
				owner.id
			);
			const comment = expectSuccess(commentResult) as CommentResponse;
			const viewerSession = makeSession(viewer.id, viewer.username);

			// "Permission denied" is returned (not a throw) to prevent comment enumeration
			const result = await updateComment(
				comment.id,
				"Forbidden edit",
				viewerSession
			);

			expectError(result);
		});
	});

	describe("deleteComment", () => {
		it("allows the author to delete their own comment", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const commentResult = await createCaseComment(
				testCase.id,
				"Delete me",
				null,
				user.id
			);
			const comment = expectSuccess(commentResult) as CommentResponse;
			const session = makeSession(user.id, user.username);

			const result = await deleteComment(comment.id, session);

			expect("error" in result).toBe(false);
		});

		it("returns 'Permission denied' when trying to delete a non-existent comment", async () => {
			const user = await createTestUser();
			const session = makeSession(user.id, user.username);

			const result = await deleteComment(
				"00000000-0000-0000-0000-000000000000",
				session
			);

			expectError(result);
		});
	});

	describe("resolveComment", () => {
		it("marks a comment as resolved", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const commentResult = await createCaseComment(
				testCase.id,
				"Resolve me",
				null,
				user.id
			);
			const comment = expectSuccess(commentResult) as CommentResponse;
			const session = makeSession(user.id, user.username);

			const resolvedResult = await resolveComment(comment.id, true, session);

			const resolved = expectSuccess(resolvedResult) as CommentResponse;
			expect(resolved.resolved).toBe(true);
			expect(resolved.resolvedBy).toBe(user.username);
			expect(resolved.resolvedAt).toBeDefined();
		});

		it("persists resolved state to the database", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const commentResult = await createCaseComment(
				testCase.id,
				"Verify DB state",
				null,
				user.id
			);
			const comment = expectSuccess(commentResult) as CommentResponse;
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

			const commentResult = await createCaseComment(
				testCase.id,
				"Unresolve me",
				null,
				user.id
			);
			const comment = expectSuccess(commentResult) as CommentResponse;
			const session = makeSession(user.id, user.username);

			await resolveComment(comment.id, true, session);
			const unresolvedResult = await resolveComment(comment.id, false, session);

			const unresolved = expectSuccess(unresolvedResult) as CommentResponse;
			expect(unresolved.resolved).toBe(false);
			expect(unresolved.resolvedBy).toBeNull();
			expect(unresolved.resolvedAt).toBeNull();
		});

		it("returns 'Permission denied' when a VIEW-only user tries to resolve a comment", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const commentResult = await createCaseComment(
				testCase.id,
				"Only editors can resolve",
				null,
				owner.id
			);
			const comment = expectSuccess(commentResult) as CommentResponse;
			const viewerSession = makeSession(viewer.id, viewer.username);

			// A VIEW-only user is not the author and does not have EDIT access,
			// so the service returns "Permission denied" (anti-enumeration)
			const result = await resolveComment(comment.id, true, viewerSession);

			expectError(result);
		});
	});
});
