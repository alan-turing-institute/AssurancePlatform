import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	captureCaseInformationForSnapshot,
	deleteCaseInformation,
	getCaseInformation,
	upsertCaseInformation,
} from "@/lib/services/case-information-service";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestCaseInformation,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

const NON_EXISTENT_CASE_ID = "00000000-0000-0000-0000-000000000000";

// ============================================
// getCaseInformation
// ============================================

describe("getCaseInformation", () => {
	it("returns null data for a case with no case information yet", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		// Not `expectSuccess`: its `data === null` branch is designed for
		// void-result services (delete/reset) and returns `undefined` rather
		// than asserting the value — here `null` is the meaningful "no case
		// information yet" payload, so assert on the raw ServiceResult
		// directly (same convention as `plugin-data-service.test.ts`).
		const result = await getCaseInformation(owner.id, testCase.id);
		expect("error" in result).toBe(false);
		expect("data" in result && result.data).toBeNull();
	});

	it("returns the record when one exists", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id, {
			description: "A narrative description",
			authors: "Ada Lovelace",
			sector: "Healthcare",
			featureImageUrl: "https://example.com/feature.png",
		});

		const data = expectSuccess(await getCaseInformation(owner.id, testCase.id));
		expect(data?.description).toBe("A narrative description");
		expect(data?.authors).toBe("Ada Lovelace");
		expect(data?.sector).toBe("Healthcare");
		expect(data?.featureImageUrl).toBe("https://example.com/feature.png");
	});

	it("owner (implicit ADMIN) can read", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expectSuccess(await getCaseInformation(owner.id, testCase.id));
	});

	it("direct EDIT share can read", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

		expectSuccess(await getCaseInformation(editor.id, testCase.id));
	});

	it("direct VIEW share can read", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectSuccess(await getCaseInformation(viewer.id, testCase.id));
	});

	it("direct COMMENT share can read", async () => {
		const owner = await createTestUser();
		const commenter = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, commenter.id, owner.id, "COMMENT");

		expectSuccess(await getCaseInformation(commenter.id, testCase.id));
	});

	it("EDIT via team can read", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");

		expectSuccess(await getCaseInformation(teamMember.id, testCase.id));
	});

	it("VIEW via team can read", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");

		expectSuccess(await getCaseInformation(teamMember.id, testCase.id));
	});

	it("COMMENT via team can read", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "COMMENT");

		expectSuccess(await getCaseInformation(teamMember.id, testCase.id));
	});

	it("returns error for a user with no permission", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expectError(
			await getCaseInformation(stranger.id, testCase.id),
			"Permission denied"
		);
	});

	it("returns the same error for a non-existent case as for an inaccessible one", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const noAccessResult = await getCaseInformation(stranger.id, testCase.id);
		const notFoundResult = await getCaseInformation(
			stranger.id,
			NON_EXISTENT_CASE_ID
		);

		expectSameError(noAccessResult, notFoundResult);
	});
});

// ============================================
// upsertCaseInformation
// ============================================

describe("upsertCaseInformation", () => {
	it("creates a new record when none exists", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const data = expectSuccess(
			await upsertCaseInformation(owner.id, testCase.id, {
				description: "First description",
				authors: "Grace Hopper",
			})
		);
		expect(data.description).toBe("First description");
		expect(data.authors).toBe("Grace Hopper");
		expect(data.sector).toBeNull();
		expect(data.featureImageUrl).toBeNull();

		const stored = await prisma.caseInformation.findUnique({
			where: { caseId: testCase.id },
		});
		expect(stored).not.toBeNull();
	});

	it("updates only the fields provided, leaving the rest untouched", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id, {
			description: "Original description",
			authors: "Original authors",
			sector: "Original sector",
		});

		const data = expectSuccess(
			await upsertCaseInformation(owner.id, testCase.id, {
				sector: "Updated sector",
			})
		);
		expect(data.sector).toBe("Updated sector");
		expect(data.description).toBe("Original description");
		expect(data.authors).toBe("Original authors");
	});

	it("owner (implicit ADMIN) can write", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expectSuccess(
			await upsertCaseInformation(owner.id, testCase.id, {
				description: "desc",
			})
		);
	});

	it("direct EDIT share can write", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

		expectSuccess(
			await upsertCaseInformation(editor.id, testCase.id, {
				description: "desc",
			})
		);
	});

	it("EDIT via team can write", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");

		expectSuccess(
			await upsertCaseInformation(teamMember.id, testCase.id, {
				description: "desc",
			})
		);
	});

	it("returns error for direct VIEW share (read-only)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await upsertCaseInformation(viewer.id, testCase.id, {
				description: "desc",
			}),
			"Permission denied"
		);
	});

	it("returns error for direct COMMENT share (read-only)", async () => {
		const owner = await createTestUser();
		const commenter = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, commenter.id, owner.id, "COMMENT");

		expectError(
			await upsertCaseInformation(commenter.id, testCase.id, {
				description: "desc",
			}),
			"Permission denied"
		);
	});

	it("returns error for VIEW via team (read-only)", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");

		expectError(
			await upsertCaseInformation(teamMember.id, testCase.id, {
				description: "desc",
			}),
			"Permission denied"
		);
	});

	it("returns error for COMMENT via team (read-only)", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "COMMENT");

		expectError(
			await upsertCaseInformation(teamMember.id, testCase.id, {
				description: "desc",
			}),
			"Permission denied"
		);
	});

	it("returns error for a user with no permission", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expectError(
			await upsertCaseInformation(stranger.id, testCase.id, {
				description: "desc",
			}),
			"Permission denied"
		);
	});

	it("returns the same error for a non-existent case as for an inaccessible one", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const noAccessResult = await upsertCaseInformation(
			stranger.id,
			testCase.id,
			{ description: "desc" }
		);
		const notFoundResult = await upsertCaseInformation(
			stranger.id,
			NON_EXISTENT_CASE_ID,
			{ description: "desc" }
		);

		expectSameError(noAccessResult, notFoundResult);
	});
});

// ============================================
// deleteCaseInformation
// ============================================

describe("deleteCaseInformation", () => {
	it("deletes an existing record", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id);

		expectSuccess(await deleteCaseInformation(owner.id, testCase.id));

		const stored = await prisma.caseInformation.findUnique({
			where: { caseId: testCase.id },
		});
		expect(stored).toBeNull();
	});

	it("is a no-op success when no record exists", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expectSuccess(await deleteCaseInformation(owner.id, testCase.id));
	});

	it("direct EDIT share can delete", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await createTestCaseInformation(testCase.id);

		expectSuccess(await deleteCaseInformation(editor.id, testCase.id));

		const stored = await prisma.caseInformation.findUnique({
			where: { caseId: testCase.id },
		});
		expect(stored).toBeNull();
	});

	it("EDIT via team can delete", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
		await createTestCaseInformation(testCase.id);

		expectSuccess(await deleteCaseInformation(teamMember.id, testCase.id));

		const stored = await prisma.caseInformation.findUnique({
			where: { caseId: testCase.id },
		});
		expect(stored).toBeNull();
	});

	it("returns error for a user with only VIEW permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await createTestCaseInformation(testCase.id);

		expectError(
			await deleteCaseInformation(viewer.id, testCase.id),
			"Permission denied"
		);
	});

	it("returns error for direct COMMENT share (read-only)", async () => {
		const owner = await createTestUser();
		const commenter = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, commenter.id, owner.id, "COMMENT");
		await createTestCaseInformation(testCase.id);

		expectError(
			await deleteCaseInformation(commenter.id, testCase.id),
			"Permission denied"
		);
	});

	it("returns error for VIEW via team (read-only)", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		await createTestCaseInformation(testCase.id);

		expectError(
			await deleteCaseInformation(teamMember.id, testCase.id),
			"Permission denied"
		);
	});

	it("returns error for COMMENT via team (read-only)", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "COMMENT");
		await createTestCaseInformation(testCase.id);

		expectError(
			await deleteCaseInformation(teamMember.id, testCase.id),
			"Permission denied"
		);
	});

	it("returns error for a user with no permission", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expectError(
			await deleteCaseInformation(stranger.id, testCase.id),
			"Permission denied"
		);
	});

	it("returns the same error for a non-existent case as for an inaccessible one", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const noAccessResult = await deleteCaseInformation(
			stranger.id,
			testCase.id
		);
		const notFoundResult = await deleteCaseInformation(
			stranger.id,
			NON_EXISTENT_CASE_ID
		);

		expectSameError(noAccessResult, notFoundResult);
	});
});

// ============================================
// captureCaseInformationForSnapshot
// ============================================

describe("captureCaseInformationForSnapshot", () => {
	it("returns undefined when no case information exists", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const snapshot = await captureCaseInformationForSnapshot(testCase.id);
		expect(snapshot).toBeUndefined();
	});

	it("returns the record verbatim when one exists", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id, {
			description: "Snapshot description",
			authors: "Snapshot authors",
			sector: "Snapshot sector",
			featureImageUrl: "https://example.com/snapshot.png",
		});

		const snapshot = await captureCaseInformationForSnapshot(testCase.id);
		expect(snapshot).toStrictEqual({
			description: "Snapshot description",
			authors: "Snapshot authors",
			sector: "Snapshot sector",
			featureImageUrl: "https://example.com/snapshot.png",
		});
	});
});
