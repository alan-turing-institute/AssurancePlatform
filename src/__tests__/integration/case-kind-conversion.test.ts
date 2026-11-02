import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	convertCaseKind as convertCaseKindAction,
	fetchConversionConsequences as fetchConsequencesAction,
	fetchUserPatterns as fetchPatternsAction,
} from "@/actions/case-kind";
import prisma from "@/lib/prisma";
import {
	convertCaseKind,
	getConversionConsequences,
	listUserPatterns,
} from "@/lib/services/case-kind-service";
import { restoreCase, softDeleteCase } from "@/lib/services/case-trash-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestCaseWithGoal,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
}));

/**
 * A case becomes a pattern, and a pattern a case, only through
 * convertCaseKind, and only for someone with ADMIN permission. A case that is
 * in the trash, published, or holds a published or archived copy is refused.
 */

const UNPUBLISH_CASE = "Unpublish this case before converting it";

beforeEach(async () => {
	await mockNoAuth();
	vi.mocked(emitSSEEvent).mockClear();
	revalidatePath.mockClear();
});

async function kindOf(caseId: string) {
	const row = await prisma.assuranceCase.findUniqueOrThrow({
		where: { id: caseId },
		select: { kind: true },
	});
	return row.kind;
}

describe("convertCaseKind: who may convert", () => {
	it("lets the owner convert a case to a pattern and back", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const toPattern = expectSuccess(
			await convertCaseKind(owner.id, testCase.id, "PATTERN")
		);
		expect(toPattern.kind).toBe("PATTERN");
		expect(await kindOf(testCase.id)).toBe("PATTERN");

		const toCase = expectSuccess(
			await convertCaseKind(owner.id, testCase.id, "CASE")
		);
		expect(toCase.kind).toBe("CASE");
		expect(await kindOf(testCase.id)).toBe("CASE");
	});

	it("lets a collaborator with direct ADMIN permission convert", async () => {
		const owner = await createTestUser();
		const admin = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, admin.id, owner.id, "ADMIN");

		expectSuccess(await convertCaseKind(admin.id, testCase.id, "PATTERN"));

		expect(await kindOf(testCase.id)).toBe("PATTERN");
	});

	it("lets a member of a team with ADMIN permission convert", async () => {
		const owner = await createTestUser();
		const member = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id, "MEMBER", owner.id);
		const testCase = await createTestCase(owner.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "ADMIN");

		expectSuccess(await convertCaseKind(member.id, testCase.id, "PATTERN"));

		expect(await kindOf(testCase.id)).toBe("PATTERN");
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
	] as const)("refuses a collaborator with %s permission and changes nothing", async (level) => {
		const owner = await createTestUser();
		const collaborator = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, collaborator.id, owner.id, level);

		expectError(
			await convertCaseKind(collaborator.id, testCase.id, "PATTERN"),
			"Permission denied"
		);

		expect(await kindOf(testCase.id)).toBe("CASE");
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("refuses a team member whose team has only EDIT permission", async () => {
		const owner = await createTestUser();
		const member = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id, "ADMIN", owner.id);
		const testCase = await createTestCase(owner.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");

		expectError(
			await convertCaseKind(member.id, testCase.id, "PATTERN"),
			"Permission denied"
		);

		expect(await kindOf(testCase.id)).toBe("CASE");
	});

	it("gives a stranger and a missing case the same answer", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const noAccess = await convertCaseKind(stranger.id, testCase.id, "PATTERN");
		const missing = await convertCaseKind(
			stranger.id,
			"00000000-0000-4000-8000-000000000000",
			"PATTERN"
		);

		expectSameError(noAccess, missing);
		expectError(noAccess, "Permission denied");
	});
});

describe("convertCaseKind: when a case cannot be converted", () => {
	it("refuses a published case with the message to unpublish it", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		expectSuccess(await publishAssuranceCase(owner.id, testCase.id));

		expectError(
			await convertCaseKind(owner.id, testCase.id, "PATTERN"),
			UNPUBLISH_CASE
		);

		expect(await kindOf(testCase.id)).toBe("CASE");
	});

	it("refuses a published pattern with the same message naming a pattern", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		expectSuccess(await publishAssuranceCase(owner.id, testCase.id));
		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: { kind: "PATTERN" },
		});

		expectError(
			await convertCaseKind(owner.id, testCase.id, "CASE"),
			"Unpublish this pattern before converting it"
		);

		expect(await kindOf(testCase.id)).toBe("PATTERN");
	});

	it.each([
		{ published: true, publishStatus: "DRAFT" },
		{ published: false, publishStatus: "PUBLISHED" },
	] as const)("refuses a case whose flags say published: $published, status: $publishStatus", async (flags) => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: flags,
		});

		expectError(
			await convertCaseKind(owner.id, testCase.id, "PATTERN"),
			UNPUBLISH_CASE
		);

		expect(await kindOf(testCase.id)).toBe("CASE");
	});

	it("refuses a draft case that still has an archived copy", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		expectSuccess(await publishAssuranceCase(owner.id, testCase.id));
		expectSuccess(
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" })
		);
		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: {
				deletedAt: null,
				deletedById: null,
				published: false,
				publishStatus: "DRAFT",
			},
		});

		expectError(
			await convertCaseKind(owner.id, testCase.id, "PATTERN"),
			"Remove this case's copy from Discover before converting it"
		);

		expect(await kindOf(testCase.id)).toBe("CASE");
	});

	it("refuses a case restored from the trash with its archived copy, which is published again", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		expectSuccess(await publishAssuranceCase(owner.id, testCase.id));
		expectSuccess(
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" })
		);
		expectSuccess(await restoreCase(owner.id, testCase.id));

		expectError(
			await convertCaseKind(owner.id, testCase.id, "PATTERN"),
			UNPUBLISH_CASE
		);

		expect(await kindOf(testCase.id)).toBe("CASE");
	});

	it("refuses a case in the trash as if it did not exist, and converts it once restored", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		expectSuccess(await softDeleteCase(owner.id, testCase.id));

		const refused = await convertCaseKind(owner.id, testCase.id, "PATTERN");
		const missing = await convertCaseKind(
			owner.id,
			"00000000-0000-4000-8000-000000000000",
			"PATTERN"
		);
		expectSameError(refused, missing);
		expect(await kindOf(testCase.id)).toBe("CASE");

		expectSuccess(await restoreCase(owner.id, testCase.id));
		expectSuccess(await convertCaseKind(owner.id, testCase.id, "PATTERN"));
		expect(await kindOf(testCase.id)).toBe("PATTERN");
	});

	it("refuses a case that already has the kind asked for", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, { kind: "PATTERN" });

		expectError(
			await convertCaseKind(owner.id, testCase.id, "PATTERN"),
			"This is already a pattern"
		);
		expectError(
			await convertCaseKind(
				owner.id,
				(await createTestCase(owner.id)).id,
				"CASE"
			),
			"This is already a case"
		);
	});

	it("lets exactly one of two simultaneous conversions through", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const results = await Promise.all([
			convertCaseKind(owner.id, testCase.id, "PATTERN"),
			convertCaseKind(owner.id, testCase.id, "PATTERN"),
		]);

		expect(results.filter((result) => "data" in result)).toHaveLength(1);
		expect(
			results.filter(
				(result) =>
					"error" in result && result.error === "This is already a pattern"
			)
		).toHaveLength(1);
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
	});
});

describe("convertCaseKind: what a conversion changes", () => {
	it("changes only the kind, and tells the case's open editors", async () => {
		const owner = await createTestUser({ username: "converter" });
		const viewer = await createTestUser();
		const team = await createTestTeam(owner.id);
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			role: "TOP_LEVEL",
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});

		expectSuccess(await convertCaseKind(owner.id, testCase.id, "PATTERN"));

		const after = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect({ ...after, kind: "CASE", updatedAt: before.updatedAt }).toEqual(
			before
		);
		expect(
			await prisma.casePermission.count({ where: { caseId: testCase.id } })
		).toBe(1);
		expect(
			await prisma.caseTeamPermission.count({ where: { caseId: testCase.id } })
		).toBe(1);
		expect(
			await prisma.assuranceElement.findUniqueOrThrow({
				where: { id: goal.id },
			})
		).toMatchObject({ deletedAt: null, caseId: testCase.id });
		expect(emitSSEEvent).toHaveBeenCalledWith("case:updated", testCase.id, {
			action: "kind-changed",
			kind: "PATTERN",
			userId: owner.id,
			username: "converter",
		});
	});

	it("is not reachable through the ordinary case-update route", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/route");
		const response = await PUT(
			new NextRequest(`http://localhost:3000/api/cases/${testCase.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ kind: "PATTERN" }),
			}),
			{ params: Promise.resolve({ id: testCase.id }) }
		);

		expect(response.status).toBe(400);
		expect(await kindOf(testCase.id)).toBe("CASE");
	});
});

describe("getConversionConsequences", () => {
	it("counts the people and teams it is shared with, leaving out integration accounts", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const first = await createTestUser();
		const second = await createTestUser();
		const machine = await createTestUser();
		await prisma.user.update({
			where: { id: machine.id },
			data: { isSystemUser: true },
		});
		for (const user of [first, second, machine]) {
			await createTestPermission(testCase.id, user.id, owner.id, "VIEW");
		}
		for (let index = 0; index < 2; index++) {
			const team = await createTestTeam(owner.id);
			await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		}

		const data = expectSuccess(
			await getConversionConsequences(owner.id, testCase.id)
		);

		expect(data).toEqual({
			kind: "CASE",
			people: 2,
			teams: 2,
			citingCases: 0,
		});
	});

	it("counts each other live case that cites it once", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, { kind: "PATTERN" });
		const citingOnce = await createTestCase(owner.id);
		const citingTwice = await createTestCase(owner.id);
		const trashedCiting = await createTestCase(owner.id);
		const deletedElementOnly = await createTestCase(owner.id);
		const parent = (caseId: string) =>
			createTestElement(caseId, owner.id, {
				elementType: "GOAL",
				role: "TOP_LEVEL",
			});
		const cite = async (
			caseId: string,
			elementType: "AWAY_GOAL" | "MODULE"
		) => {
			const goal = await parent(caseId);
			return createTestElement(caseId, owner.id, {
				elementType,
				parentId: goal.id,
				moduleReferenceId: testCase.id,
				moduleEmbedType: "REFERENCE",
			});
		};
		await cite(citingOnce.id, "AWAY_GOAL");
		await cite(citingTwice.id, "AWAY_GOAL");
		await cite(citingTwice.id, "MODULE");
		await cite(trashedCiting.id, "MODULE");
		await prisma.assuranceCase.update({
			where: { id: trashedCiting.id },
			data: { deletedAt: new Date(), deletedById: owner.id },
		});
		const removed = await cite(deletedElementOnly.id, "MODULE");
		await prisma.assuranceElement.update({
			where: { id: removed.id },
			data: { deletedAt: new Date() },
		});

		const data = expectSuccess(
			await getConversionConsequences(owner.id, testCase.id)
		);

		expect(data.kind).toBe("PATTERN");
		expect(data.citingCases).toBe(2);
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
	] as const)("refuses a collaborator with %s permission", async (level) => {
		const owner = await createTestUser();
		const collaborator = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, collaborator.id, owner.id, level);

		expectError(
			await getConversionConsequences(collaborator.id, testCase.id),
			"Permission denied"
		);
	});

	it("refuses a case in the trash", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		expectSuccess(await softDeleteCase(owner.id, testCase.id));

		expectError(
			await getConversionConsequences(owner.id, testCase.id),
			"Permission denied"
		);
	});
});

describe("listUserPatterns", () => {
	it("returns the user's own patterns and patterns shared with them directly, and no case", async () => {
		const reader = await createTestUser();
		const other = await createTestUser();
		const team = await createTestTeam(other.id);
		await addTeamMember(team.id, reader.id, "MEMBER", other.id);
		const own = await createTestCase(reader.id, { kind: "PATTERN" });
		const ownCase = await createTestCase(reader.id);
		const direct = await createTestCase(other.id, { kind: "PATTERN" });
		const viaTeam = await createTestCase(other.id, { kind: "PATTERN" });
		const unshared = await createTestCase(other.id, { kind: "PATTERN" });
		const trashed = await createTestCase(reader.id, { kind: "PATTERN" });
		await prisma.assuranceCase.update({
			where: { id: trashed.id },
			data: { deletedAt: new Date(), deletedById: reader.id },
		});
		await createTestPermission(direct.id, reader.id, other.id, "VIEW");
		await createTestTeamPermission(viaTeam.id, team.id, other.id, "VIEW");

		const listed = expectSuccess(await listUserPatterns(reader.id));

		const ids = listed.map((row) => row.id);
		expect(ids.sort()).toEqual([own.id, direct.id].sort());
		expect(ids).not.toContain(ownCase.id);
		expect(ids).not.toContain(viaTeam.id);
		expect(ids).not.toContain(unshared.id);
		expect(ids).not.toContain(trashed.id);
		expect(listed.every((row) => row.kind === "PATTERN")).toBe(true);
		expect(listed.find((row) => row.id === own.id)?.permissions).toBe("owner");
		expect(listed.find((row) => row.id === direct.id)?.permissions).toBe(
			"view"
		);
	});

	it("shows a case converted to a pattern, and stops showing it once converted back", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		expect(expectSuccess(await listUserPatterns(owner.id))).toHaveLength(0);

		expectSuccess(await convertCaseKind(owner.id, testCase.id, "PATTERN"));
		expect(
			expectSuccess(await listUserPatterns(owner.id)).map((row) => row.id)
		).toEqual([testCase.id]);

		expectSuccess(await convertCaseKind(owner.id, testCase.id, "CASE"));
		expect(expectSuccess(await listUserPatterns(owner.id))).toHaveLength(0);
	});
});

describe("the case-kind actions", () => {
	it("refuses a request with no session", async () => {
		expect(
			await convertCaseKindAction(
				"00000000-0000-4000-8000-000000000000",
				"PATTERN"
			)
		).toEqual({ success: false, error: "Unauthorised" });
		expect(
			await fetchConsequencesAction("00000000-0000-4000-8000-000000000000")
		).toEqual({ success: false, error: "Unauthorised" });
		expect(await fetchPatternsAction()).toBeNull();
	});

	it("refuses a malformed case id or kind before reaching the service", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		expect(await convertCaseKindAction("not-a-uuid", "PATTERN")).toEqual({
			success: false,
			error: "Invalid case ID",
		});
		expect(
			await convertCaseKindAction(
				"00000000-0000-4000-8000-000000000000",
				"TEMPLATE" as never
			)
		).toEqual({ success: false, error: "Invalid kind" });
		expect(await fetchConsequencesAction("not-a-uuid")).toEqual({
			success: false,
			error: "Invalid case ID",
		});
	});

	it("converts for the signed-in user and refreshes the dashboard and patterns pages", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const result = await convertCaseKindAction(testCase.id, "PATTERN");

		expect(result).toEqual({ success: true, data: { kind: "PATTERN" } });
		expect(await kindOf(testCase.id)).toBe("PATTERN");
		expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
		expect(revalidatePath).toHaveBeenCalledWith("/dashboard/patterns");
	});

	it("passes a refusal on, and refreshes nothing", async () => {
		const owner = await createTestUser();
		const collaborator = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, collaborator.id, owner.id, "EDIT");
		await mockAuth(collaborator.id, collaborator.username, collaborator.email);

		const result = await convertCaseKindAction(testCase.id, "PATTERN");

		expect(result).toEqual({ success: false, error: "Permission denied" });
		expect(await kindOf(testCase.id)).toBe("CASE");
		expect(revalidatePath).not.toHaveBeenCalled();
	});

	it("reads the consequences and the pattern list for the signed-in user", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, { kind: "PATTERN" });
		await mockAuth(owner.id, owner.username, owner.email);

		const consequences = await fetchConsequencesAction(testCase.id);
		const patterns = await fetchPatternsAction();

		expect(consequences).toEqual({
			success: true,
			data: { kind: "PATTERN", people: 0, teams: 0, citingCases: 0 },
		});
		expect(patterns?.map((row) => row.id)).toEqual([testCase.id]);
	});
});
