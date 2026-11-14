import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	createStoredCase,
	importOk,
	richNestedFile,
} from "../utils/case-kind-kit";
import {
	addTeamMember,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * An import keeps a reference to another case (an away goal or a module) only
 * when the importing user can view that case. Any other reference is cleared,
 * flagged as dangling and named in the import's warnings, and a case the user
 * cannot view is indistinguishable from one that does not exist.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

type User = Awaited<ReturnType<typeof createTestUser>>;

function referencesOf(caseId: string) {
	return prisma.assuranceElement.findMany({
		where: { caseId, elementType: { in: ["AWAY_GOAL", "MODULE"] } },
		select: {
			name: true,
			moduleReferenceId: true,
			moduleReferenceDangling: true,
		},
		orderBy: { name: "asc" },
	});
}

const SCENARIOS: {
	label: string;
	keeps: boolean;
	setup: (importer: User, owner: User) => Promise<string>;
}[] = [
	{
		label: "a case the user owns",
		keeps: true,
		setup: async (importer) => (await createStoredCase(importer.id)).id,
	},
	{
		label: "a case shared with the user",
		keeps: true,
		setup: async (importer, owner) => {
			const shared = await createStoredCase(owner.id);
			await createTestPermission(shared.id, importer.id, owner.id);
			return shared.id;
		},
	},
	{
		label: "a case shared with a team the user belongs to",
		keeps: true,
		setup: async (importer, owner) => {
			const team = await createTestTeam(owner.id);
			await addTeamMember(team.id, importer.id);
			const shared = await createStoredCase(owner.id);
			await createTestTeamPermission(shared.id, team.id, owner.id);
			return shared.id;
		},
	},
	{
		label: "a case that is not shared with the user",
		keeps: false,
		setup: async (_importer, owner) => (await createStoredCase(owner.id)).id,
	},
	{
		label: "a case shared with another user only",
		keeps: false,
		setup: async (_importer, owner) => {
			const other = await createTestUser();
			const shared = await createStoredCase(owner.id);
			await createTestPermission(shared.id, other.id, owner.id);
			return shared.id;
		},
	},
	{
		label: "a case shared with a team the user is not in",
		keeps: false,
		setup: async (_importer, owner) => {
			const team = await createTestTeam(owner.id);
			const shared = await createStoredCase(owner.id);
			await createTestTeamPermission(shared.id, team.id, owner.id);
			return shared.id;
		},
	},
	{
		label: "a case in the trash",
		keeps: false,
		setup: async (importer) => {
			const trashed = await createStoredCase(importer.id);
			await prisma.assuranceCase.update({
				where: { id: trashed.id },
				data: { deletedAt: new Date() },
			});
			return trashed.id;
		},
	},
	{
		label: "a case that does not exist",
		keeps: false,
		setup: () => Promise.resolve(randomUUID()),
	},
];

describe("importCase and references to other cases", () => {
	it.each(SCENARIOS)("handles an away goal and a module citing $label", async ({
		keeps,
		setup,
	}) => {
		const owner = await createTestUser();
		const importer = await createTestUser();
		const citedCaseId = await setup(importer, owner);

		const data = await importOk(importer.id, richNestedFile({ citedCaseId }));

		const expected = keeps
			? { moduleReferenceId: citedCaseId, moduleReferenceDangling: false }
			: { moduleReferenceId: null, moduleReferenceDangling: true };
		expect(await referencesOf(data.caseId)).toEqual([
			{ name: "AG1", ...expected },
			{ name: "M1", ...expected },
		]);
		expect(data.warnings.filter((w) => w.includes("cited case"))).toHaveLength(
			keeps ? 0 : 2
		);
		expect(keeps).toBe(
			await canAccessCase({ userId: importer.id, caseId: citedCaseId }, "VIEW")
		);
	});

	it("gives the same warnings for a case the user cannot view as for a case that does not exist", async () => {
		const owner = await createTestUser();
		const importer = await createTestUser();
		const hidden = await createStoredCase(owner.id);

		const forHidden = await importOk(
			importer.id,
			richNestedFile({ citedCaseId: hidden.id })
		);
		const forMissing = await importOk(
			importer.id,
			richNestedFile({ citedCaseId: randomUUID() })
		);

		expect(forHidden.warnings).toEqual(forMissing.warnings);
	});

	it("clears an away goal's cited element together with its case when the user cannot view the case, and keeps both when they can", async () => {
		const owner = await createTestUser();
		const importer = await createTestUser();
		const hiddenCase = await createStoredCase(owner.id);
		const sharedCase = await createStoredCase(owner.id);
		await createTestPermission(sharedCase.id, importer.id, owner.id);
		const hiddenGoal = await createTestElement(hiddenCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		const sharedGoal = await createTestElement(sharedCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});

		const fileCiting = (caseId: string, elementId: string) => ({
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Cites an element", description: "One away goal" },
			tree: {
				id: "31000000-0000-4000-8000-000000000001",
				type: "GOAL",
				name: "G1",
				description: "The goal",
				inSandbox: false,
				role: "TOP_LEVEL",
				children: [
					{
						id: "31000000-0000-4000-8000-000000000002",
						type: "AWAY_GOAL",
						name: "AG1",
						description: "An away goal",
						inSandbox: false,
						moduleReferenceId: caseId,
						citedElementId: elementId,
						children: [],
					},
				],
			},
		});
		const awayGoalOf = (caseId: string) =>
			prisma.assuranceElement.findFirstOrThrow({
				where: { caseId, elementType: "AWAY_GOAL" },
				select: {
					moduleReferenceId: true,
					moduleReferenceDangling: true,
					citedElementId: true,
					citationDangling: true,
				},
			});

		const cleared = await importOk(
			importer.id,
			fileCiting(hiddenCase.id, hiddenGoal.id)
		);
		const kept = await importOk(
			importer.id,
			fileCiting(sharedCase.id, sharedGoal.id)
		);

		expect(await awayGoalOf(cleared.caseId)).toEqual({
			moduleReferenceId: null,
			moduleReferenceDangling: true,
			citedElementId: null,
			citationDangling: true,
		});
		expect(await awayGoalOf(kept.caseId)).toEqual({
			moduleReferenceId: sharedCase.id,
			moduleReferenceDangling: false,
			citedElementId: sharedGoal.id,
			citationDangling: false,
		});
	});
});
