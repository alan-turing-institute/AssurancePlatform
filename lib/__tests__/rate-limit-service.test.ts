import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
	prismaNew: {
		rateLimitAttempt: {
			count: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			createMany: vi.fn(),
			deleteMany: vi.fn(),
		},
		securityAuditLog: {
			create: vi.fn(),
		},
	},
}));

import { prismaNew } from "@/lib/prisma";
import {
	checkAndRecordRateLimit,
	checkRateLimit,
	cleanupRateLimitAttempts,
	RATE_LIMIT_CONFIGS,
	recordAttempt,
} from "../services/rate-limit-service";

describe("rate-limit-service", () => {
	const mockPrisma = vi.mocked(prismaNew);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("checkRateLimit", () => {
		it("allows request when under limit", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(2);

			const result = await checkRateLimit(RATE_LIMIT_CONFIGS.register, {
				ipAddress: "192.168.1.1",
				email: "test@example.com",
			});

			expect(result.allowed).toBe(true);
		});

		it("blocks request when IP limit exceeded", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(5);
			mockPrisma.rateLimitAttempt.findFirst.mockResolvedValue({
				id: "attempt-1",
				endpoint: "register",
				identifier: "192.168.1.1",
				identifierType: "ip",
				attemptedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
				blocked: false,
				metadata: null,
			});

			const result = await checkRateLimit(RATE_LIMIT_CONFIGS.register, {
				ipAddress: "192.168.1.1",
				email: "test@example.com",
			});

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("your network");
			expect(result.retryAfterMs).toBeGreaterThan(0);
		});

		it("blocks request when email limit exceeded", async () => {
			// First call for IP (under limit), second for email (over limit)
			mockPrisma.rateLimitAttempt.count
				.mockResolvedValueOnce(2) // IP check passes
				.mockResolvedValueOnce(3); // Email check fails
			mockPrisma.rateLimitAttempt.findFirst.mockResolvedValue({
				id: "attempt-1",
				endpoint: "register",
				identifier: "spam@example.com",
				identifierType: "email",
				attemptedAt: new Date(Date.now() - 45 * 60 * 1000),
				blocked: false,
				metadata: null,
			});

			const result = await checkRateLimit(RATE_LIMIT_CONFIGS.register, {
				ipAddress: "192.168.1.1",
				email: "spam@example.com",
			});

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("this email");
		});

		it("handles missing identifiers gracefully", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);

			const result = await checkRateLimit(RATE_LIMIT_CONFIGS.register, {
				// No identifiers provided
			});

			expect(result.allowed).toBe(true);
			// Should not have called count since no identifiers were provided
			expect(mockPrisma.rateLimitAttempt.count).not.toHaveBeenCalled();
		});

		it("normalises email to lowercase for checking", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);

			await checkRateLimit(RATE_LIMIT_CONFIGS.register, {
				email: "TEST@EXAMPLE.COM",
			});

			expect(mockPrisma.rateLimitAttempt.count).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						identifier: "test@example.com",
					}),
				})
			);
		});
	});

	describe("recordAttempt", () => {
		it("records attempts for all provided identifiers", async () => {
			mockPrisma.rateLimitAttempt.createMany.mockResolvedValue({ count: 2 });

			await recordAttempt(
				RATE_LIMIT_CONFIGS.register,
				{ ipAddress: "192.168.1.1", email: "test@example.com" },
				false
			);

			expect(mockPrisma.rateLimitAttempt.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						endpoint: "register",
						identifier: "192.168.1.1",
						identifierType: "ip",
						blocked: false,
					}),
					expect.objectContaining({
						endpoint: "register",
						identifier: "test@example.com",
						identifierType: "email",
						blocked: false,
					}),
				]),
			});
		});

		it("normalises email to lowercase when recording", async () => {
			mockPrisma.rateLimitAttempt.createMany.mockResolvedValue({ count: 1 });

			await recordAttempt(
				RATE_LIMIT_CONFIGS.register,
				{ email: "TEST@EXAMPLE.COM" },
				false
			);

			expect(mockPrisma.rateLimitAttempt.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						identifier: "test@example.com",
					}),
				]),
			});
		});

		it("does not call createMany when no identifiers provided", async () => {
			await recordAttempt(RATE_LIMIT_CONFIGS.register, {}, false);

			expect(mockPrisma.rateLimitAttempt.createMany).not.toHaveBeenCalled();
		});

		it("records blocked attempts correctly", async () => {
			mockPrisma.rateLimitAttempt.createMany.mockResolvedValue({ count: 1 });

			await recordAttempt(
				RATE_LIMIT_CONFIGS.register,
				{ ipAddress: "192.168.1.1" },
				true
			);

			expect(mockPrisma.rateLimitAttempt.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						blocked: true,
					}),
				]),
			});
		});
	});

	describe("checkAndRecordRateLimit", () => {
		it("logs security event when rate limited", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(5);
			mockPrisma.rateLimitAttempt.findFirst.mockResolvedValue({
				id: "attempt-1",
				endpoint: "register",
				identifier: "192.168.1.1",
				identifierType: "ip",
				attemptedAt: new Date(),
				blocked: false,
				metadata: null,
			});
			mockPrisma.rateLimitAttempt.createMany.mockResolvedValue({ count: 1 });
			mockPrisma.securityAuditLog.create.mockResolvedValue({
				id: "log-1",
				userId: null,
				eventType: "register_rate_limited",
				ipAddress: "192.168.1.1",
				userAgent: "Test Agent",
				metadata: null,
				createdAt: new Date(),
			});

			const result = await checkAndRecordRateLimit(
				RATE_LIMIT_CONFIGS.register,
				{ ipAddress: "192.168.1.1" },
				{ ipAddress: "192.168.1.1", userAgent: "Test Agent" }
			);

			expect(result.allowed).toBe(false);
			expect(mockPrisma.securityAuditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					eventType: "register_rate_limited",
					ipAddress: "192.168.1.1",
					userAgent: "Test Agent",
				}),
			});
		});

		it("does not log security event when allowed", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
			mockPrisma.rateLimitAttempt.createMany.mockResolvedValue({ count: 1 });

			const result = await checkAndRecordRateLimit(
				RATE_LIMIT_CONFIGS.register,
				{ ipAddress: "192.168.1.1" }
			);

			expect(result.allowed).toBe(true);
			expect(mockPrisma.securityAuditLog.create).not.toHaveBeenCalled();
		});

		it("records attempt when allowed", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
			mockPrisma.rateLimitAttempt.createMany.mockResolvedValue({ count: 1 });

			await checkAndRecordRateLimit(RATE_LIMIT_CONFIGS.register, {
				ipAddress: "192.168.1.1",
			});

			expect(mockPrisma.rateLimitAttempt.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						blocked: false,
					}),
				]),
			});
		});

		it("records blocked attempt when rate limited", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(5);
			mockPrisma.rateLimitAttempt.findFirst.mockResolvedValue({
				id: "attempt-1",
				endpoint: "register",
				identifier: "192.168.1.1",
				identifierType: "ip",
				attemptedAt: new Date(),
				blocked: false,
				metadata: null,
			});
			mockPrisma.rateLimitAttempt.createMany.mockResolvedValue({ count: 1 });
			mockPrisma.securityAuditLog.create.mockResolvedValue({
				id: "log-1",
				userId: null,
				eventType: "register_rate_limited",
				ipAddress: "192.168.1.1",
				userAgent: null,
				metadata: null,
				createdAt: new Date(),
			});

			await checkAndRecordRateLimit(RATE_LIMIT_CONFIGS.register, {
				ipAddress: "192.168.1.1",
			});

			expect(mockPrisma.rateLimitAttempt.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						blocked: true,
					}),
				]),
			});
		});
	});

	describe("cleanupRateLimitAttempts", () => {
		it("deletes records older than specified hours", async () => {
			mockPrisma.rateLimitAttempt.deleteMany.mockResolvedValue({ count: 150 });

			const result = await cleanupRateLimitAttempts(24);

			expect(result).toBe(150);
			expect(mockPrisma.rateLimitAttempt.deleteMany).toHaveBeenCalledWith({
				where: {
					attemptedAt: { lt: expect.any(Date) },
				},
			});
		});

		it("uses default of 24 hours when not specified", async () => {
			mockPrisma.rateLimitAttempt.deleteMany.mockResolvedValue({ count: 50 });

			await cleanupRateLimitAttempts();

			expect(mockPrisma.rateLimitAttempt.deleteMany).toHaveBeenCalled();
		});
	});

	describe("invite accept rate limiting", () => {
		it("uses user_id for authenticated endpoint", async () => {
			mockPrisma.rateLimitAttempt.count.mockResolvedValue(0);
			mockPrisma.rateLimitAttempt.createMany.mockResolvedValue({ count: 2 });

			await checkAndRecordRateLimit(RATE_LIMIT_CONFIGS.inviteAccept, {
				ipAddress: "192.168.1.1",
				userId: "user-123",
			});

			expect(mockPrisma.rateLimitAttempt.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						endpoint: "invite_accept",
						identifierType: "ip",
					}),
					expect.objectContaining({
						endpoint: "invite_accept",
						identifierType: "user_id",
						identifier: "user-123",
					}),
				]),
			});
		});

		it("blocks when user rate limit exceeded", async () => {
			// IP under limit, user_id over limit
			mockPrisma.rateLimitAttempt.count
				.mockResolvedValueOnce(5) // IP check passes
				.mockResolvedValueOnce(10); // User check fails
			mockPrisma.rateLimitAttempt.findFirst.mockResolvedValue({
				id: "attempt-1",
				endpoint: "invite_accept",
				identifier: "user-123",
				identifierType: "user_id",
				attemptedAt: new Date(Date.now() - 30 * 60 * 1000),
				blocked: false,
				metadata: null,
			});

			const result = await checkRateLimit(RATE_LIMIT_CONFIGS.inviteAccept, {
				ipAddress: "192.168.1.1",
				userId: "user-123",
			});

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("your account");
		});
	});
});
