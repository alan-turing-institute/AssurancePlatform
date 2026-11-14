import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import {
	createElementComment,
	resolveComment,
} from "@/lib/services/comment-service";
import type { User } from "@/src/generated/prisma";
import {
	PANEL_ACCESS,
	type PanelPermission,
} from "../utils/comment-panel-access-matrix";
import {
	addTeamMember,
	createTestCase,
	createTestComment,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The comments panel decides what to show from the `permissions` string the case
 * endpoint sends. These tests start from a real grant, read the string the
 * endpoint sends for it, and check that the comment service accepts exactly what
 * the panel's access table says it offers.
 */

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

type Level = "VIEW" | "COMMENT" | "EDIT" | "ADMIN";

interface Scene {
	caseId: string;
	elementId: string;
	owner: User;
	theirCommentId: string;
}

function session(user: User) {
	return { userId: user.id, username: user.username, email: user.email };
}

/** A case with one element carrying a comment written by the owner. */
async function sceneWithComment(): Promise<Scene> {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const element = await createTestElement(testCase.id, owner.id);
	const theirComment = await createTestComment(owner.id, {
		elementId: element.id,
	});
	return {
		owner,
		caseId: testCase.id,
		elementId: element.id,
		theirCommentId: theirComment.id,
	};
}

async function panelPermissionFor(
	caseId: string,
	user: User
): Promise<string | string[] | undefined> {
	const result = await fetchCaseFromPrisma(caseId, user.id);
	return "data" in result ? result.data.permissions : undefined;
}

async function directGrant(scene: Scene, level: Level): Promise<User> {
	const user = await createTestUser();
	await createTestPermission(scene.caseId, user.id, scene.owner.id, level);
	return user;
}

async function teamGrant(scene: Scene, level: Level): Promise<User> {
	const user = await createTestUser();
	const team = await createTestTeam(scene.owner.id);
	await addTeamMember(team.id, user.id, "MEMBER", scene.owner.id);
	await createTestTeamPermission(scene.caseId, team.id, scene.owner.id, level);
	return user;
}

async function createAccepted(scene: Scene, user: User): Promise<boolean> {
	const result = await createElementComment(
		scene.elementId,
		"A new comment",
		null,
		session(user)
	);
	return !("error" in result);
}

async function resolveAccepted(
	commentId: string,
	user: User
): Promise<boolean> {
	const result = await resolveComment(commentId, true, session(user));
	return !("error" in result);
}

const GRANTS: [Level, PanelPermission][] = [
	["VIEW", "view"],
	["COMMENT", "comment"],
	["EDIT", "edit"],
	["ADMIN", "manage"],
];

const GRANTS_THAT_ACT = GRANTS.filter(([, panel]) => panel !== "view");

describe("comments panel and comment service agree", () => {
	describe.each([
		["direct", directGrant],
		["team", teamGrant],
	])("%s grant", (_label, grant) => {
		it.each(
			GRANTS
		)("%s: the endpoint sends the panel its permission, and the form is offered where the server accepts a new comment", async (level, panelPermission) => {
			const scene = await sceneWithComment();
			const user = await grant(scene, level);

			expect(await panelPermissionFor(scene.caseId, user)).toBe(
				panelPermission
			);
			expect(await createAccepted(scene, user)).toBe(
				PANEL_ACCESS[panelPermission].form
			);
		});

		it.each(
			GRANTS
		)("%s: Resolve on someone else's comment is offered where the server accepts it", async (level, panelPermission) => {
			const scene = await sceneWithComment();
			const user = await grant(scene, level);

			expect(await resolveAccepted(scene.theirCommentId, user)).toBe(
				PANEL_ACCESS[panelPermission].resolveOthers
			);
		});

		it.each(
			GRANTS_THAT_ACT
		)("%s: Resolve on the person's own comment, offered by the panel, is accepted by the server", async (level, panelPermission) => {
			const scene = await sceneWithComment();
			const user = await grant(scene, level);
			const own = await createTestComment(user.id, {
				elementId: scene.elementId,
			});

			expect(PANEL_ACCESS[panelPermission].resolveOwn).toBe(true);
			expect(await resolveAccepted(own.id, user)).toBe(true);
		});
	});

	it("the owner is sent manage, may comment, and may resolve anyone's comment", async () => {
		const scene = await sceneWithComment();

		expect(await panelPermissionFor(scene.caseId, scene.owner)).toBe("manage");
		expect(await createAccepted(scene, scene.owner)).toBe(true);
		expect(await resolveAccepted(scene.theirCommentId, scene.owner)).toBe(true);
	});

	it("a commenter's refused resolve leaves the other person's comment unresolved", async () => {
		const scene = await sceneWithComment();
		const commenter = await directGrant(scene, "COMMENT");

		expect(await resolveAccepted(scene.theirCommentId, commenter)).toBe(false);

		const stored = await prisma.comment.findUnique({
			where: { id: scene.theirCommentId },
		});
		expect(stored?.resolved).toBe(false);
	});
});
