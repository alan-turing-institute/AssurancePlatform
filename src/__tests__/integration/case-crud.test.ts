import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
	fetchCaseFromPrisma,
	updateCaseWithPrisma,
} from "@/lib/services/case-fetch-service";
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

			const result = (await fetchCaseFromPrisma(
				testCase.id,
				user.id
			)) as unknown as Record<string, unknown>;

			expect(result.id).toBe(testCase.id);
			expect(result.name).toBe("Owner Case");
			expect(result.owner).toBe(user.id);
			expect(result.permissions).toBe("manage");
		});

		it("returns case data for a user with VIEW permission", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Shared Case",
			});
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const result = (await fetchCaseFromPrisma(
				testCase.id,
				viewer.id
			)) as unknown as Record<string, unknown>;

			expect(result.id).toBe(testCase.id);
			expect(result.permissions).toBe("view");
		});

		it("returns case data for a user with EDIT permission", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Edit Case" });
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

			const result = (await fetchCaseFromPrisma(
				testCase.id,
				editor.id
			)) as unknown as Record<string, unknown>;

			expect(result.permissions).toBe("edit");
		});

		it("throws NOT_FOUND for a user with no access", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Private" });

			await expect(
				fetchCaseFromPrisma(testCase.id, outsider.id)
			).rejects.toThrow(AppError);

			await expect(
				fetchCaseFromPrisma(testCase.id, outsider.id)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("throws NOT_FOUND for a non-existent case ID", async () => {
			const user = await createTestUser();

			await expect(
				fetchCaseFromPrisma("00000000-0000-0000-0000-000000000000", user.id)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("throws NOT_FOUND for a soft-deleted (trashed) case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Trashed Case" });

			// Soft-delete the case
			const { softDeleteCase } = await import(
				"@/lib/services/case-trash-service"
			);
			await softDeleteCase(user.id, testCase.id);

			await expect(
				fetchCaseFromPrisma(testCase.id, user.id)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("includes a goals array in the response", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Goals Case" });

			const result = (await fetchCaseFromPrisma(
				testCase.id,
				user.id
			)) as unknown as Record<string, unknown>;

			expect(Array.isArray(result.goals)).toBe(true);
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

			const result = (await fetchCaseFromPrisma(
				testCase.id,
				commenter.id
			)) as unknown as Record<string, unknown>;

			expect(result.permissions).toBe("comment");
		});

		it("returns 'manage' permission for a case ADMIN", async () => {
			const owner = await createTestUser();
			const caseAdmin = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Admin Case" });
			await createTestPermission(testCase.id, caseAdmin.id, owner.id, "ADMIN");

			const result = (await fetchCaseFromPrisma(
				testCase.id,
				caseAdmin.id
			)) as unknown as Record<string, unknown>;

			expect(result.permissions).toBe("manage");
		});
	});

	describe("updateCaseWithPrisma", () => {
		it("updates the case name as the owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Original Name" });

			const result = (await updateCaseWithPrisma(testCase.id, user.id, {
				name: "Updated Name",
			})) as unknown as Record<string, unknown>;

			expect(result.name).toBe("Updated Name");
		});

		it("updates the case description for a user with EDIT permission", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Editor Case",
			});
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

			const result = (await updateCaseWithPrisma(testCase.id, editor.id, {
				description: "New description",
			})) as unknown as Record<string, unknown>;

			expect(result.description).toBe("New description");
		});

		it("throws FORBIDDEN for a user without EDIT permission", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Read Only Case",
			});
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			await expect(
				updateCaseWithPrisma(testCase.id, viewer.id, { name: "Forbidden" })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("throws FORBIDDEN for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id, { name: "Locked Case" });

			await expect(
				updateCaseWithPrisma(testCase.id, outsider.id, { name: "Hacked" })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("updates the colour profile", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Colour Case",
			});

			const result = (await updateCaseWithPrisma(testCase.id, user.id, {
				colourProfile: "dark",
			})) as unknown as Record<string, unknown>;

			expect(result.colourProfile).toBe("dark");
		});

		it("updates the layout direction", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Layout Case",
			});

			const result = (await updateCaseWithPrisma(testCase.id, user.id, {
				layoutDirection: "LR",
			})) as unknown as Record<string, unknown>;

			expect(result.layoutDirection).toBe("LR");
		});
	});
});
