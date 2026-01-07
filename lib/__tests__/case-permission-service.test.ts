import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
	prismaNew: {
		user: {
			findUnique: vi.fn(),
		},
		caseInvite: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		casePermission: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
		securityAuditLog: {
			create: vi.fn(),
		},
		$transaction: vi.fn(),
	},
}));

import { prismaNew } from "@/lib/prisma";
import { acceptInvite } from "../services/case-permission-service";

describe("acceptInvite", () => {
	const mockPrisma = vi.mocked(prismaNew);

	const mockSecurityContext = {
		ipAddress: "192.168.1.1",
		userAgent: "Mozilla/5.0 Test Browser",
	};

	const validInvite = {
		id: "invite-123",
		caseId: "case-456",
		email: "user@example.com",
		permission: "VIEW" as const,
		inviteToken: "abc123def456",
		inviteExpiresAt: new Date("2099-01-01"),
		acceptedAt: null,
		acceptedById: null,
		invitedById: "inviter-789",
		createdAt: new Date(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("returns error when user is not found", async () => {
		mockPrisma.user.findUnique.mockResolvedValue(null);

		const result = await acceptInvite(
			"user-123",
			"token-abc",
			mockSecurityContext
		);

		expect(result).toEqual({ success: false, error: "User not found" });
		expect(mockPrisma.securityAuditLog.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				eventType: "invite_acceptance_user_not_found",
				userId: "user-123",
			}),
		});
	});

	it("returns error for invalid invite token", async () => {
		mockPrisma.user.findUnique.mockResolvedValue({
			email: "user@example.com",
		});
		mockPrisma.$transaction.mockImplementation(async (callback) => {
			const tx = {
				caseInvite: { findUnique: vi.fn().mockResolvedValue(null) },
				casePermission: { findUnique: vi.fn(), create: vi.fn() },
			};
			return callback(tx);
		});

		const result = await acceptInvite(
			"user-123",
			"invalid-token",
			mockSecurityContext
		);

		expect(result).toEqual({ success: false, error: "Invalid invite" });
	});

	it("returns error for expired invite", async () => {
		const expiredInvite = {
			...validInvite,
			inviteExpiresAt: new Date("2020-01-01"),
		};

		mockPrisma.user.findUnique.mockResolvedValue({
			email: "user@example.com",
		});
		mockPrisma.$transaction.mockImplementation(async (callback) => {
			const tx = {
				caseInvite: {
					findUnique: vi.fn().mockResolvedValue(expiredInvite),
				},
				casePermission: { findUnique: vi.fn(), create: vi.fn() },
			};
			return callback(tx);
		});

		const result = await acceptInvite(
			"user-123",
			"token",
			mockSecurityContext
		);

		expect(result).toEqual({ success: false, error: "Invite has expired" });
	});

	it("returns error for already used invite", async () => {
		const usedInvite = {
			...validInvite,
			acceptedAt: new Date("2024-01-01"),
			acceptedById: "other-user",
		};

		mockPrisma.user.findUnique.mockResolvedValue({
			email: "user@example.com",
		});
		mockPrisma.$transaction.mockImplementation(async (callback) => {
			const tx = {
				caseInvite: {
					findUnique: vi.fn().mockResolvedValue(usedInvite),
				},
				casePermission: { findUnique: vi.fn(), create: vi.fn() },
			};
			return callback(tx);
		});

		const result = await acceptInvite(
			"user-123",
			"token",
			mockSecurityContext
		);

		expect(result).toEqual({
			success: false,
			error: "Invite has already been used",
		});
	});

	it("rejects and logs email mismatch attempts", async () => {
		mockPrisma.user.findUnique.mockResolvedValue({
			email: "attacker@evil.com",
		});
		mockPrisma.$transaction.mockImplementation(async (callback) => {
			const tx = {
				caseInvite: {
					findUnique: vi.fn().mockResolvedValue(validInvite),
				},
				casePermission: { findUnique: vi.fn(), create: vi.fn() },
			};
			return callback(tx);
		});

		const result = await acceptInvite(
			"user-123",
			"token",
			mockSecurityContext
		);

		expect(result).toEqual({
			success: false,
			error: "Invite was sent to a different email address",
		});
		expect(mockPrisma.securityAuditLog.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				eventType: "invite_acceptance_email_mismatch",
				metadata: expect.objectContaining({
					inviteEmail: "user@example.com",
					userEmail: "attacker@evil.com",
				}),
			}),
		});
	});

	it("accepts invite with case-insensitive email match", async () => {
		mockPrisma.user.findUnique.mockResolvedValue({
			email: "USER@Example.Com",
		});
		mockPrisma.$transaction.mockImplementation(async (callback) => {
			const tx = {
				caseInvite: {
					findUnique: vi.fn().mockResolvedValue(validInvite),
					update: vi.fn().mockResolvedValue({}),
				},
				casePermission: {
					findUnique: vi.fn().mockResolvedValue(null),
					create: vi.fn().mockResolvedValue({}),
				},
			};
			return callback(tx);
		});

		const result = await acceptInvite(
			"user-123",
			"token",
			mockSecurityContext
		);

		expect(result).toEqual({ success: true, case_id: "case-456" });
	});

	it("creates permission and marks invite as accepted on success", async () => {
		const mockInviteUpdate = vi.fn().mockResolvedValue({});
		const mockPermissionCreate = vi.fn().mockResolvedValue({});

		mockPrisma.user.findUnique.mockResolvedValue({
			email: "user@example.com",
		});
		mockPrisma.$transaction.mockImplementation(async (callback) => {
			const tx = {
				caseInvite: {
					findUnique: vi.fn().mockResolvedValue(validInvite),
					update: mockInviteUpdate,
				},
				casePermission: {
					findUnique: vi.fn().mockResolvedValue(null),
					create: mockPermissionCreate,
				},
			};
			return callback(tx);
		});

		const result = await acceptInvite(
			"user-123",
			"token",
			mockSecurityContext
		);

		expect(result).toEqual({ success: true, case_id: "case-456" });
		expect(mockPermissionCreate).toHaveBeenCalledWith({
			data: {
				caseId: "case-456",
				userId: "user-123",
				permission: "VIEW",
				grantedById: "inviter-789",
			},
		});
		expect(mockInviteUpdate).toHaveBeenCalledWith({
			where: { inviteToken: "token" },
			data: expect.objectContaining({
				acceptedAt: expect.any(Date),
				acceptedById: "user-123",
			}),
		});
	});

	it("skips permission creation if user already has permission", async () => {
		const mockInviteUpdate = vi.fn().mockResolvedValue({});
		const mockPermissionCreate = vi.fn();

		mockPrisma.user.findUnique.mockResolvedValue({
			email: "user@example.com",
		});
		mockPrisma.$transaction.mockImplementation(async (callback) => {
			const tx = {
				caseInvite: {
					findUnique: vi.fn().mockResolvedValue(validInvite),
					update: mockInviteUpdate,
				},
				casePermission: {
					findUnique: vi.fn().mockResolvedValue({ id: "existing-perm" }),
					create: mockPermissionCreate,
				},
			};
			return callback(tx);
		});

		const result = await acceptInvite(
			"user-123",
			"token",
			mockSecurityContext
		);

		expect(result).toEqual({ success: true, case_id: "case-456" });
		expect(mockPermissionCreate).not.toHaveBeenCalled();
	});
});
