import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import type { PermissionLevel, User } from "@/src/generated/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
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
 * PUT, PATCH and DELETE /api/comments/[id]: the author of a comment may change
 * it only while they can still comment on the case, anyone else needs edit
 * access, and nobody changes a comment on a case in Trash.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

type Verb = "PUT" | "PATCH" | "DELETE";

const VERBS: Verb[] = ["PUT", "PATCH", "DELETE"];
const LEVELS: PermissionLevel[] = ["VIEW", "COMMENT", "EDIT", "ADMIN"];
const ORIGINAL = "original text";
const BODIES: Record<Verb, string | undefined> = {
	PUT: JSON.stringify({ content: "changed" }),
	PATCH: JSON.stringify({ resolved: true }),
	DELETE: undefined,
};
const REFUSED = {
	status: 403,
	body: { error: "Permission denied", code: "FORBIDDEN" },
	events: 0,
};
const UNTOUCHED = { content: ORIGINAL, resolved: false };

beforeEach(async () => {
	vi.mocked(emitSSEEvent).mockClear();
	await mockNoAuth();
});

async function call(verb: Verb, commentId: string): Promise<Response> {
	const route = await import("@/app/api/comments/[id]/route");
	const body = BODIES[verb];
	return route[verb](
		new Request(`http://localhost:3000/api/comments/${commentId}`, {
			method: verb,
			body,
		}),
		{ params: Promise.resolve({ id: commentId }) }
	);
}

async function scene() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const element = await createTestElement(testCase.id, owner.id);
	return { owner, caseId: testCase.id, elementId: element.id };
}

function commentBy(author: User, elementId: string) {
	return createTestComment(author.id, { elementId, content: ORIGINAL });
}

function signInAs(user: User) {
	return mockAuth(user.id, user.username, user.email);
}

async function stored(commentId: string) {
	const row = await prisma.comment.findUnique({ where: { id: commentId } });
	return { content: row?.content, resolved: row?.resolved };
}

async function outcome(response: Response) {
	return {
		status: response.status,
		body: await response.json(),
		events: vi.mocked(emitSSEEvent).mock.calls.length,
	};
}

describe.each(VERBS)("%s /api/comments/[id]", (verb) => {
	it("changes the case owner's own comment", async () => {
		const s = await scene();
		const comment = await commentBy(s.owner, s.elementId);
		await signInAs(s.owner);

		expect((await call(verb, comment.id)).status).toBe(200);
		expect(emitSSEEvent).toHaveBeenCalled();
	});

	describe.each([
		["direct", "direct"],
		["team", "team"],
	] as const)("%s grant", (_label, kind) => {
		async function grant(
			s: Awaited<ReturnType<typeof scene>>,
			user: User,
			level: PermissionLevel
		) {
			if (kind === "direct") {
				await createTestPermission(s.caseId, user.id, s.owner.id, level);
				return;
			}
			const team = await createTestTeam(s.owner.id);
			await addTeamMember(team.id, user.id);
			await createTestTeamPermission(s.caseId, team.id, s.owner.id, level);
		}

		it.each(
			LEVELS
		)("%s: as the author, allowed from COMMENT upwards", async (level) => {
			const s = await scene();
			const user = await createTestUser();
			await grant(s, user, level);
			const comment = await commentBy(user, s.elementId);
			await signInAs(user);

			const response = await call(verb, comment.id);

			if (level === "VIEW") {
				expect(await outcome(response)).toMatchObject(REFUSED);
				expect(await stored(comment.id)).toEqual(UNTOUCHED);
			} else {
				expect(response.status).toBe(200);
			}
		});

		it.each(
			LEVELS
		)("%s: on someone else's comment, allowed from EDIT upwards", async (level) => {
			const s = await scene();
			const user = await createTestUser();
			await grant(s, user, level);
			const comment = await commentBy(s.owner, s.elementId);
			await signInAs(user);

			const response = await call(verb, comment.id);

			if (level === "EDIT" || level === "ADMIN") {
				expect(response.status).toBe(200);
			} else {
				expect(await outcome(response)).toMatchObject(REFUSED);
				expect(await stored(comment.id)).toEqual(UNTOUCHED);
			}
		});
	});

	it("refuses an author whose share was removed", async () => {
		const s = await scene();
		const user = await createTestUser();
		const permission = await createTestPermission(
			s.caseId,
			user.id,
			s.owner.id,
			"COMMENT"
		);
		const comment = await commentBy(user, s.elementId);
		await prisma.casePermission.delete({ where: { id: permission.id } });
		await signInAs(user);

		expect(await outcome(await call(verb, comment.id))).toMatchObject(REFUSED);
		expect(await stored(comment.id)).toEqual(UNTOUCHED);
	});

	it("refuses an author who was removed from the team that had the case", async () => {
		const s = await scene();
		const user = await createTestUser();
		const team = await createTestTeam(s.owner.id);
		const member = await addTeamMember(team.id, user.id);
		await createTestTeamPermission(s.caseId, team.id, s.owner.id, "EDIT");
		const comment = await commentBy(user, s.elementId);
		await prisma.teamMember.delete({ where: { id: member.id } });
		await signInAs(user);

		expect(await outcome(await call(verb, comment.id))).toMatchObject(REFUSED);
		expect(await stored(comment.id)).toEqual(UNTOUCHED);
	});

	it("refuses an author with no share at all", async () => {
		const s = await scene();
		const stranger = await createTestUser();
		const comment = await commentBy(stranger, s.elementId);
		await signInAs(stranger);

		expect(await outcome(await call(verb, comment.id))).toMatchObject(REFUSED);
		expect(await stored(comment.id)).toEqual(UNTOUCHED);
	});

	it("refuses everyone, the owner included, while the case is in Trash", async () => {
		const s = await scene();
		const user = await createTestUser();
		await createTestPermission(s.caseId, user.id, s.owner.id, "EDIT");
		const comment = await commentBy(user, s.elementId);
		await prisma.assuranceCase.update({
			where: { id: s.caseId },
			data: { deletedAt: new Date() },
		});

		for (const who of [user, s.owner]) {
			await signInAs(who);
			expect(await outcome(await call(verb, comment.id))).toMatchObject(
				REFUSED
			);
		}
		expect(await stored(comment.id)).toEqual(UNTOUCHED);
	});

	it("answers 401 when signed out", async () => {
		const s = await scene();
		const comment = await commentBy(s.owner, s.elementId);

		expect((await call(verb, comment.id)).status).toBe(401);
	});

	it("answers 403 for a comment that does not exist", async () => {
		const s = await scene();
		await signInAs(s.owner);

		expect(
			await outcome(await call(verb, "00000000-0000-4000-8000-000000000000"))
		).toMatchObject(REFUSED);
	});
});
