import { describe, expect, it } from "vitest";
import {
	fetchCaseFromPrisma,
	updateCaseWithPrisma,
} from "@/lib/services/case-fetch-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

describe("case-fetch-service", () => {
	describe("fetchCaseFromPrisma", () => {
		it("returns full case data for the owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Owner Case" });

			const result = await fetchCaseFromPrisma(testCase.id, user.id);

			const data = expectSuccess(result);
			expect(data.id).toBe(testCase.id);
			expect(data.name).toBe("Owner Case");
			expect(data.owner).toBe(user.id);
			expect(data.permissions).toBe("manage");
		});

		it("returns case data for a user with VIEW permission", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Shared Case",
			});
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const result = await fetchCaseFromPrisma(testCase.id, viewer.id);

			const data = expectSuccess(result);
			expect(data.id).toBe(testCase.id);
			expect(data.permissions).toBe("view");
		});

		it("returns case data for a user with EDIT permission", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Edit Case" });
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

			const result = await fetchCaseFromPrisma(testCase.id, editor.id);

			const data = expectSuccess(result);
			expect(data.permissions).toBe("edit");
		});

		it("returns 'Permission denied' for a user with no access", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Private" });

			const result = await fetchCaseFromPrisma(testCase.id, outsider.id);

			expectError(result, "Permission denied");
		});

		it("returns 'Permission denied' for a non-existent case ID (anti-enumeration)", async () => {
			const user = await createTestUser();

			const result = await fetchCaseFromPrisma(
				"00000000-0000-0000-0000-000000000000",
				user.id
			);

			expectError(result, "Permission denied");
		});

		it("returns 'Permission denied' for a soft-deleted (trashed) case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Trashed Case" });

			// Soft-delete the case
			const { softDeleteCase } = await import(
				"@/lib/services/case-trash-service"
			);
			await softDeleteCase(user.id, testCase.id);

			const result = await fetchCaseFromPrisma(testCase.id, user.id);

			expectError(result);
		});

		it("includes a goals array in the response", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Goals Case" });

			const result = await fetchCaseFromPrisma(testCase.id, user.id);

			const data = expectSuccess(result);
			expect(Array.isArray(data.goals)).toBe(true);
		});

		it("returns the correct permission level for a COMMENT user", async () => {
			const owner = await createTestUser();
			const commenter = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Comment Case" });
			await createTestPermission(
				testCase.id,
				commenter.id,
				owner.id,
				"COMMENT"
			);

			const result = await fetchCaseFromPrisma(testCase.id, commenter.id);

			const data = expectSuccess(result);
			expect(data.permissions).toBe("comment");
		});

		it("returns 'manage' permission for a case ADMIN", async () => {
			const owner = await createTestUser();
			const caseAdmin = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Admin Case" });
			await createTestPermission(testCase.id, caseAdmin.id, owner.id, "ADMIN");

			const result = await fetchCaseFromPrisma(testCase.id, caseAdmin.id);

			const data = expectSuccess(result);
			expect(data.permissions).toBe("manage");
		});
	});

	describe("updateCaseWithPrisma", () => {
		it("updates the case name as the owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Original Name" });

			const result = await updateCaseWithPrisma(testCase.id, user.id, {
				name: "Updated Name",
			});

			const data = expectSuccess(result);
			expect(data.name).toBe("Updated Name");
		});

		it("updates the case description for a user with EDIT permission", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Editor Case",
			});
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

			const result = await updateCaseWithPrisma(testCase.id, editor.id, {
				description: "New description",
			});

			const data = expectSuccess(result);
			expect(data.description).toBe("New description");
		});

		it("returns 'Permission denied' for a user without EDIT permission", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Read Only Case",
			});
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const result = await updateCaseWithPrisma(testCase.id, viewer.id, {
				name: "Forbidden",
			});

			expectError(result, "Permission denied");
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Locked Case" });

			const result = await updateCaseWithPrisma(testCase.id, outsider.id, {
				name: "Hacked",
			});

			expectError(result, "Permission denied");
		});

		it("updates the colour profile", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Colour Case",
			});

			const result = await updateCaseWithPrisma(testCase.id, user.id, {
				colourProfile: "dark",
			});

			const data = expectSuccess(result);
			expect(data.colourProfile).toBe("dark");
		});

		it("updates the layout direction", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Layout Case",
			});

			const result = await updateCaseWithPrisma(testCase.id, user.id, {
				layoutDirection: "LR",
			});

			const data = expectSuccess(result);
			expect(data.layoutDirection).toBe("LR");
		});
	});
});
