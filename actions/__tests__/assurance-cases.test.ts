import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock validateSession before importing actions
vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn(),
}));

// Mock Prisma (must use vi.hoisted for dynamic imports)
const mockPrismaNew = vi.hoisted(() => ({
	assuranceCase: {
		findMany: vi.fn(),
	},
}));

vi.mock("@/lib/prisma", () => ({
	prismaNew: mockPrismaNew,
}));

import { validateSession } from "@/lib/auth/validate-session";
import {
	fetchAssuranceCases,
	fetchSharedAssuranceCases,
} from "../assurance-cases";

describe("Assurance Cases Actions", () => {
	const mockValidateSession = vi.mocked(validateSession);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("fetchAssuranceCases", () => {
		it("returns null when session is invalid", async () => {
			mockValidateSession.mockResolvedValue(null);

			const result = await fetchAssuranceCases("mock-token");

			expect(result).toBeNull();
			expect(mockValidateSession).toHaveBeenCalledTimes(1);
			expect(mockPrismaNew.assuranceCase.findMany).not.toHaveBeenCalled();
		});

		it("returns mapped cases with created_date and updated_date fields", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			const mockCases = [
				{
					id: "case-1",
					name: "Test Case 1",
					description: "Description 1",
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					createdById: "user-123",
				},
				{
					id: "case-2",
					name: "Test Case 2",
					description: null,
					createdAt: new Date("2024-02-01T08:00:00Z"),
					updatedAt: new Date("2024-02-03T12:00:00Z"),
					createdById: "user-456",
				},
			];

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue(mockCases);

			const result = await fetchAssuranceCases("mock-token");

			expect(result).toEqual([
				{
					id: "case-1",
					name: "Test Case 1",
					description: "Description 1",
					created_date: "2024-01-01T10:00:00.000Z",
					updated_date: "2024-01-02T15:30:00.000Z",
					owner: "user-123",
				},
				{
					id: "case-2",
					name: "Test Case 2",
					description: undefined,
					created_date: "2024-02-01T08:00:00.000Z",
					updated_date: "2024-02-03T12:00:00.000Z",
					owner: "user-456",
				},
			]);
		});

		it("excludes soft-deleted cases by querying deletedAt: null", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([]);

			await fetchAssuranceCases("mock-token");

			expect(mockPrismaNew.assuranceCase.findMany).toHaveBeenCalledWith({
				where: {
					deletedAt: null,
					OR: [
						{ createdById: "user-123" },
						{
							userPermissions: {
								some: {
									userId: "user-123",
								},
							},
						},
					],
				},
				select: {
					id: true,
					name: true,
					description: true,
					createdAt: true,
					updatedAt: true,
					createdById: true,
				},
				orderBy: {
					createdAt: "desc",
				},
			});
		});

		it("returns updated_date as ISO string", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			const testDate = new Date("2024-06-15T14:23:45.678Z");

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([
				{
					id: "case-1",
					name: "Test Case",
					description: "Test",
					createdAt: testDate,
					updatedAt: testDate,
					createdById: "user-123",
				},
			]);

			const result = await fetchAssuranceCases("mock-token");

			expect(result?.[0]?.updated_date).toBe("2024-06-15T14:23:45.678Z");
			expect(typeof result?.[0]?.updated_date).toBe("string");
		});

		it("queries for cases where user is creator OR has explicit permission", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([]);

			await fetchAssuranceCases("mock-token");

			const callArgs = mockPrismaNew.assuranceCase.findMany.mock.calls[0][0];
			expect(callArgs.where).toMatchObject({
				deletedAt: null,
				OR: [
					{ createdById: "user-123" },
					{
						userPermissions: {
							some: {
								userId: "user-123",
							},
						},
					},
				],
			});
		});

		it("handles null description by converting to undefined", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([
				{
					id: "case-1",
					name: "Test Case",
					description: null,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-01T10:00:00Z"),
					createdById: "user-123",
				},
			]);

			const result = await fetchAssuranceCases("mock-token");

			expect(result?.[0]?.description).toBeUndefined();
		});
	});

	describe("fetchSharedAssuranceCases", () => {
		it("returns null when session is invalid", async () => {
			mockValidateSession.mockResolvedValue(null);

			const result = await fetchSharedAssuranceCases("mock-token");

			expect(result).toBeNull();
			expect(mockValidateSession).toHaveBeenCalledTimes(1);
			expect(mockPrismaNew.assuranceCase.findMany).not.toHaveBeenCalled();
		});

		it("returns shared cases with correct field mapping", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			const mockSharedCases = [
				{
					id: "shared-case-1",
					name: "Shared Case 1",
					description: "Shared with me",
					createdAt: new Date("2024-03-01T09:00:00Z"),
					updatedAt: new Date("2024-03-10T16:45:00Z"),
					createdById: "owner-456",
				},
			];

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue(mockSharedCases);

			const result = await fetchSharedAssuranceCases("mock-token");

			expect(result).toEqual([
				{
					id: "shared-case-1",
					name: "Shared Case 1",
					description: "Shared with me",
					created_date: "2024-03-01T09:00:00.000Z",
					updated_date: "2024-03-10T16:45:00.000Z",
					owner: "owner-456",
				},
			]);
		});

		it("excludes cases where user is the creator", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([]);

			await fetchSharedAssuranceCases("mock-token");

			const callArgs = mockPrismaNew.assuranceCase.findMany.mock.calls[0][0];
			expect(callArgs.where.AND).toContainEqual({
				NOT: {
					createdById: "user-123",
				},
			});
		});

		it("queries for cases with direct user permissions OR team permissions", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([]);

			await fetchSharedAssuranceCases("mock-token");

			const callArgs = mockPrismaNew.assuranceCase.findMany.mock.calls[0][0];
			expect(callArgs.where).toMatchObject({
				deletedAt: null,
				AND: [
					{
						OR: [
							{
								userPermissions: {
									some: {
										userId: "user-123",
									},
								},
							},
							{
								teamPermissions: {
									some: {
										team: {
											members: {
												some: {
													userId: "user-123",
												},
											},
										},
									},
								},
							},
						],
					},
					{
						NOT: {
							createdById: "user-123",
						},
					},
				],
			});
		});

		it("returns updated_date as ISO string", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			const testDate = new Date("2024-07-20T11:30:15.999Z");

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([
				{
					id: "shared-1",
					name: "Shared",
					description: "Test",
					createdAt: testDate,
					updatedAt: testDate,
					createdById: "owner-999",
				},
			]);

			const result = await fetchSharedAssuranceCases("mock-token");

			expect(result?.[0]?.updated_date).toBe("2024-07-20T11:30:15.999Z");
			expect(typeof result?.[0]?.updated_date).toBe("string");
		});

		it("excludes soft-deleted cases by querying deletedAt: null", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([]);

			await fetchSharedAssuranceCases("mock-token");

			const callArgs = mockPrismaNew.assuranceCase.findMany.mock.calls[0][0];
			expect(callArgs.where.deletedAt).toBeNull();
		});

		it("handles null description by converting to undefined", async () => {
			mockValidateSession.mockResolvedValue({
				userId: "user-123",
				username: "testuser",
				email: "test@example.com",
			});

			mockPrismaNew.assuranceCase.findMany.mockResolvedValue([
				{
					id: "shared-1",
					name: "Shared Case",
					description: null,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-01T10:00:00Z"),
					createdById: "owner-456",
				},
			]);

			const result = await fetchSharedAssuranceCases("mock-token");

			expect(result?.[0]?.description).toBeUndefined();
		});
	});
});
