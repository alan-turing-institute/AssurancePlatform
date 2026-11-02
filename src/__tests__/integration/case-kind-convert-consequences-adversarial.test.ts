import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { getConversionConsequences } from "@/lib/services/case-kind-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createPublishedRow,
	createRichCase,
	MISSING_CASE_ID,
	PEOPLE,
	snapshotAroundKind,
	tapCaseEvents,
} from "../utils/case-kind-convert-kit";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * What the confirmation dialog is told before a conversion: who it is shared
 * with and which other cases cite it. The same people may ask as may convert,
 * and a refused caller learns nothing, not even a count.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

const KINDS = ["CASE", "PATTERN"] as const;

describe.each(
	KINDS
)("what converting a %s would affect: who may ask", (kind) => {
	it("tells the owner", async () => {
		const rich = await createRichCase(kind);

		const result = await getConversionConsequences(rich.ownerId, rich.caseId);

		expect(result).toHaveProperty("data");
	});

	it.each(
		PEOPLE.filter((person) => person.allowed).map((person) => [
			person.label,
			person,
		])
	)("tells %s", async (_label, person) => {
		const rich = await createRichCase(kind);
		const user = await person.setup({
			caseId: rich.caseId,
			ownerId: rich.ownerId,
		});

		const result = await getConversionConsequences(user.id, rich.caseId);

		expect(result).toHaveProperty("data");
		expect(result).toMatchObject({
			data: {
				citingCases: expect.any(Number),
				people: expect.any(Number),
				teams: expect.any(Number),
			},
		});
	});

	it.each(
		PEOPLE.filter((person) => !person.allowed).map((person) => [
			person.label,
			person,
		])
	)("refuses %s with the stranger's error and no counts", async (_label, person) => {
		const rich = await createRichCase(kind);
		const user = await person.setup({
			caseId: rich.caseId,
			ownerId: rich.ownerId,
		});
		const stranger = await createTestUser();

		const result = await getConversionConsequences(user.id, rich.caseId);

		expect(result).toEqual({ error: "Permission denied" });
		expect(result).toEqual(
			await getConversionConsequences(stranger.id, rich.caseId)
		);
	});

	it("gives a missing case the same error a stranger gets for a real one", async () => {
		const rich = await createRichCase(kind);
		const stranger = await createTestUser();

		const forMissing = await getConversionConsequences(
			rich.ownerId,
			MISSING_CASE_ID
		);
		const forReal = await getConversionConsequences(stranger.id, rich.caseId);

		expect(forMissing).toEqual({ error: "Permission denied" });
		expect(forMissing).toEqual(forReal);
	});

	it("gives even the owner the missing-case error once the case is in Trash", async () => {
		const rich = await createRichCase(kind);
		await prisma.assuranceCase.update({
			where: { id: rich.caseId },
			data: { deletedAt: new Date(), deletedById: rich.ownerId },
		});

		const result = await getConversionConsequences(rich.ownerId, rich.caseId);

		expect(result).toEqual({ error: "Permission denied" });
	});

	it("changes nothing and announces nothing", async () => {
		const rich = await createRichCase(kind);
		const before = await snapshotAroundKind(rich.caseId);
		const tap = tapCaseEvents(rich.caseId);

		await getConversionConsequences(rich.ownerId, rich.caseId);
		tap.stop();

		expect(await snapshotAroundKind(rich.caseId)).toEqual(before);
		expect(
			(
				await prisma.assuranceCase.findUniqueOrThrow({
					where: { id: rich.caseId },
				})
			).kind
		).toBe(kind);
		expect(tap.events()).toEqual([]);
	});
});

describe("what converting would affect: the action", () => {
	async function askAs(
		user: { email: string; id: string; username: string } | null,
		caseId: string
	) {
		if (user) {
			await mockAuth(user.id, user.username, user.email);
		} else {
			await mockNoAuth();
		}
		const { fetchConversionConsequences } = await import("@/actions/case-kind");
		return fetchConversionConsequences(caseId);
	}

	it("answers the owner with the counts", async () => {
		const rich = await createRichCase("CASE");

		const result = await askAs(rich.owner, rich.caseId);

		expect(result).toMatchObject({
			success: true,
			data: { citingCases: 1, people: 3, teams: 1 },
		});
	});

	it("refuses a signed-out caller", async () => {
		const rich = await createRichCase("CASE");

		expect(await askAs(null, rich.caseId)).toEqual({
			success: false,
			error: "Unauthorised",
		});
	});

	it("refuses a malformed case id", async () => {
		const user = await createTestUser();

		expect(await askAs(user, "not-a-uuid")).toEqual({
			success: false,
			error: "Invalid case ID",
		});
	});

	it.each(
		PEOPLE.filter((person) => !person.allowed).map((person) => [
			person.label,
			person,
		])
	)("refuses %s through the action", async (_label, person) => {
		const rich = await createRichCase("CASE");
		const user = await person.setup({
			caseId: rich.caseId,
			ownerId: rich.ownerId,
		});

		expect(await askAs(user, rich.caseId)).toEqual({
			success: false,
			error: "Permission denied",
		});
	});

	it("gives a stranger the same error for a missing case as for a real one", async () => {
		const rich = await createRichCase("CASE");
		const stranger = await createTestUser();

		const forReal = await askAs(stranger, rich.caseId);
		const forMissing = await askAs(stranger, MISSING_CASE_ID);

		expect(forReal).toEqual({ success: false, error: "Permission denied" });
		expect(forMissing).toEqual(forReal);
	});
});

describe("what converting would affect: the counts", () => {
	async function counts(ownerId: string, caseId: string) {
		const result = await getConversionConsequences(ownerId, caseId);
		if (!("data" in result)) {
			throw new Error(`consequences failed: ${result.error}`);
		}
		const { people, teams, citingCases } = result.data;
		return { people, teams, citingCases };
	}

	it("counts nothing for a case that is shared with no one and cited by no one", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expect(await counts(owner.id, testCase.id)).toEqual({
			people: 0,
			teams: 0,
			citingCases: 0,
		});
	});

	it("counts every person it is shared with directly, whatever their level", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		for (const level of ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const) {
			const person = await createTestUser();
			await createTestPermission(testCase.id, person.id, owner.id, level);
		}

		expect((await counts(owner.id, testCase.id)).people).toBe(4);
	});

	it("does not count integration accounts as people", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const person = await createTestUser();
		await createTestPermission(testCase.id, person.id, owner.id, "VIEW");
		for (const _ of [1, 2]) {
			const { systemUser } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
		}

		expect((await counts(owner.id, testCase.id)).people).toBe(1);
	});

	it("does not count the people of a team as people, and counts each team once", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const founder = await createTestUser();
		const team = await createTestTeam(founder.id);
		for (const _ of [1, 2, 3]) {
			const member = await createTestUser();
			await addTeamMember(team.id, member.id);
		}
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		const secondTeam = await createTestTeam(founder.id);
		await createTestTeamPermission(
			testCase.id,
			secondTeam.id,
			owner.id,
			"EDIT"
		);

		expect(await counts(owner.id, testCase.id)).toMatchObject({
			people: 0,
			teams: 2,
		});
	});

	it("counts only the sharing of this case", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const elsewhere = await createTestCase(owner.id);
		const person = await createTestUser();
		await createTestPermission(elsewhere.id, person.id, owner.id, "VIEW");
		const team = await createTestTeam(person.id);
		await createTestTeamPermission(elsewhere.id, team.id, owner.id, "VIEW");

		expect(await counts(owner.id, testCase.id)).toEqual({
			people: 0,
			teams: 0,
			citingCases: 0,
		});
	});

	describe("the cases that cite it", () => {
		function citedBy(
			citer: { caseId: string; ownerId: string },
			elementType: "AWAY_GOAL" | "MODULE",
			targetId: string
		) {
			return createTestElement(citer.caseId, citer.ownerId, {
				elementType,
				name: elementType === "MODULE" ? "M" : "AG",
				moduleReferenceId: targetId,
				moduleEmbedType: elementType === "MODULE" ? "REFERENCE" : undefined,
			});
		}

		it("counts a case with an away goal and a case with a module", async () => {
			const owner = await createTestUser();
			const target = await createTestCase(owner.id, { kind: "PATTERN" });
			const viaAway = await createTestCase(owner.id);
			const viaModule = await createTestCase(owner.id);
			await citedBy(
				{ caseId: viaAway.id, ownerId: owner.id },
				"AWAY_GOAL",
				target.id
			);
			await citedBy(
				{ caseId: viaModule.id, ownerId: owner.id },
				"MODULE",
				target.id
			);

			expect((await counts(owner.id, target.id)).citingCases).toBe(2);
		});

		it("counts a case once however many times it cites", async () => {
			const owner = await createTestUser();
			const target = await createTestCase(owner.id);
			const citer = await createTestCase(owner.id);
			const ref = { caseId: citer.id, ownerId: owner.id };
			await citedBy(ref, "AWAY_GOAL", target.id);
			await citedBy(ref, "AWAY_GOAL", target.id);
			await citedBy(ref, "MODULE", target.id);

			expect((await counts(owner.id, target.id)).citingCases).toBe(1);
		});

		it("does not count a citing case that is in Trash", async () => {
			const owner = await createTestUser();
			const target = await createTestCase(owner.id);
			const live = await createTestCase(owner.id);
			const trashed = await createTestCase(owner.id);
			await citedBy(
				{ caseId: live.id, ownerId: owner.id },
				"AWAY_GOAL",
				target.id
			);
			await citedBy(
				{ caseId: trashed.id, ownerId: owner.id },
				"AWAY_GOAL",
				target.id
			);
			await prisma.assuranceCase.update({
				where: { id: trashed.id },
				data: { deletedAt: new Date(), deletedById: owner.id },
			});

			expect((await counts(owner.id, target.id)).citingCases).toBe(1);
		});

		it("does not count a case whose only citation was deleted from it", async () => {
			const owner = await createTestUser();
			const target = await createTestCase(owner.id);
			const citer = await createTestCase(owner.id);
			const element = await citedBy(
				{ caseId: citer.id, ownerId: owner.id },
				"AWAY_GOAL",
				target.id
			);
			await prisma.assuranceElement.update({
				where: { id: element.id },
				data: { deletedAt: new Date() },
			});

			expect((await counts(owner.id, target.id)).citingCases).toBe(0);
		});

		it("does not count the case citing itself", async () => {
			const owner = await createTestUser();
			const target = await createTestCase(owner.id);
			await citedBy(
				{ caseId: target.id, ownerId: owner.id },
				"AWAY_GOAL",
				target.id
			);

			expect((await counts(owner.id, target.id)).citingCases).toBe(0);
		});

		it("does not count a case that cites a different case", async () => {
			const owner = await createTestUser();
			const target = await createTestCase(owner.id);
			const other = await createTestCase(owner.id);
			const citer = await createTestCase(owner.id);
			await citedBy(
				{ caseId: citer.id, ownerId: owner.id },
				"AWAY_GOAL",
				other.id
			);

			expect((await counts(owner.id, target.id)).citingCases).toBe(0);
		});

		it("counts citing cases that belong to other people, as a number only", async () => {
			const owner = await createTestUser();
			const target = await createTestCase(owner.id);
			const stranger = await createTestUser();
			const theirs = await createTestCase(stranger.id, {
				name: "Private citing case",
			});
			await citedBy(
				{ caseId: theirs.id, ownerId: stranger.id },
				"AWAY_GOAL",
				target.id
			);

			const result = await getConversionConsequences(owner.id, target.id);

			expect(result).toMatchObject({ data: { citingCases: 1 } });
			expect(JSON.stringify(result)).not.toContain("Private citing case");
			expect(JSON.stringify(result)).not.toContain(theirs.id);
		});

		it("counts citing cases whether the cited case is a case or a pattern, and a published one", async () => {
			const owner = await createTestUser();
			const citer = await createTestCase(owner.id);
			for (const kind of KINDS) {
				const target = await createTestCase(owner.id, { kind });
				await createPublishedRow(target.id);
				await citedBy(
					{ caseId: citer.id, ownerId: owner.id },
					"AWAY_GOAL",
					target.id
				);

				expect((await counts(owner.id, target.id)).citingCases).toBe(1);
			}
		});
	});

	it("counts all three together for a case with all three", async () => {
		const rich = await createRichCase("CASE");

		expect(await counts(rich.ownerId, rich.caseId)).toEqual({
			people: 3,
			teams: 1,
			citingCases: 1,
		});
	});
});
