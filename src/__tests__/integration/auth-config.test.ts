import { describe, expect, it, vi } from "vitest";
import {
	authenticateGoogleWithPrisma,
	authenticateWithPrisma,
} from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password-service";
import prisma from "@/lib/prisma";
import { captureLogs } from "../helpers/capture-logs";
import { createTestUser } from "../utils/prisma-factories";

const TEST_PASSWORD = "correct horse battery staple";

describe("authenticateWithPrisma — login clears retention warnings", () => {
	it("records lastLoginAt and clears both retention-warning timestamps on a successful login", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const user = await createTestUser({
			passwordHash,
			passwordAlgorithm: "argon2id",
			lastLoginAt: new Date("2020-01-01T00:00:00Z"),
			retentionWarning30SentAt: new Date("2026-01-01T00:00:00Z"),
			retentionWarning7SentAt: new Date("2026-01-20T00:00:00Z"),
		});

		const result = await authenticateWithPrisma(user.username, TEST_PASSWORD);
		expect(result).not.toBeNull();

		const updated = await prisma.user.findUnique({ where: { id: user.id } });
		expect(updated?.lastLoginAt).not.toBeNull();
		expect(updated?.lastLoginAt?.getTime()).toBeGreaterThan(
			new Date("2020-01-01T00:00:00Z").getTime()
		);
		expect(updated?.retentionWarning30SentAt).toBeNull();
		expect(updated?.retentionWarning7SentAt).toBeNull();
	});

	it("does not touch lastLoginAt or the retention-warning timestamps on a failed login", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const originalLastLogin = new Date("2020-01-01T00:00:00Z");
		const user = await createTestUser({
			passwordHash,
			passwordAlgorithm: "argon2id",
			lastLoginAt: originalLastLogin,
			retentionWarning30SentAt: new Date("2026-01-01T00:00:00Z"),
		});

		const result = await authenticateWithPrisma(
			user.username,
			"wrong-password"
		);
		expect(result).toBeNull();

		const unchanged = await prisma.user.findUnique({ where: { id: user.id } });
		expect(unchanged?.lastLoginAt?.getTime()).toBe(originalLastLogin.getTime());
		expect(unchanged?.retentionWarning30SentAt).not.toBeNull();
	});

	it("still succeeds when the user row vanishes between the password check and the best-effort reset write (QA round 2, item f)", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const user = await createTestUser({
			passwordHash,
			passwordAlgorithm: "argon2id",
		});

		const logs = captureLogs();
		const passwordService = await import("@/lib/auth/password-service");
		const originalVerify = passwordService.verifyPassword;
		const verifySpy = vi
			.spyOn(passwordService, "verifyPassword")
			.mockImplementation(async (...args) => {
				const verifyResult = await originalVerify(...args);
				// Delete the row for real, between the password check and the
				// best-effort reset write — no Prisma mocking involved.
				await prisma.user.delete({ where: { id: user.id } });
				return verifyResult;
			});

		try {
			const result = await authenticateWithPrisma(user.username, TEST_PASSWORD);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(user.id);

			const failureEntry = logs.entries.find(
				(entry) =>
					entry.msg === "Failed to record login / reset retention warnings"
			);
			expect(failureEntry).toMatchObject({
				level: "error",
				component: "auth-config",
				userId: user.id,
			});

			const gone = await prisma.user.findUnique({ where: { id: user.id } });
			expect(gone).toBeNull();
		} finally {
			verifySpy.mockRestore();
			logs.restore();
		}
	});
});

describe("authenticateGoogleWithPrisma — OAuth login clears retention warnings", () => {
	it("records lastLoginAt and clears both retention-warning timestamps when an existing user signs in with Google", async () => {
		const user = await createTestUser({
			lastLoginAt: new Date("2020-01-01T00:00:00Z"),
			retentionWarning30SentAt: new Date("2026-01-01T00:00:00Z"),
			retentionWarning7SentAt: new Date("2026-01-20T00:00:00Z"),
		});

		const result = await authenticateGoogleWithPrisma({
			sub: "google-sub-123",
			email: user.email,
			name: "Test User",
		});

		expect(result).not.toBeNull();
		expect(result?.id).toBe(user.id);

		const updated = await prisma.user.findUnique({ where: { id: user.id } });
		expect(updated?.lastLoginAt?.getTime()).toBeGreaterThan(
			new Date("2020-01-01T00:00:00Z").getTime()
		);
		expect(updated?.retentionWarning30SentAt).toBeNull();
		expect(updated?.retentionWarning7SentAt).toBeNull();
		expect(updated?.googleId).toBe("google-sub-123");
	});
});
