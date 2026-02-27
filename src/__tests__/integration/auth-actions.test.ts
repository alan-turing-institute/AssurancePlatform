import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createTestUser } from "../utils/prisma-factories";

// ============================================
// validatePasswordResetToken
// ============================================

describe("validatePasswordResetToken", () => {
	it("returns valid=true and email for a valid unexpired token", async () => {
		const user = await createTestUser({ email: "reset-valid@example.com" });

		const token = "a".repeat(64);
		const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetToken: token,
				passwordResetExpires: expires,
			},
		});

		const { validatePasswordResetToken } = await import("@/actions/auth");
		const result = await validatePasswordResetToken(token);

		expect(result.valid).toBe(true);
		expect(result.email).toBe(user.email);
		expect(result.error).toBeUndefined();
	});

	it("returns valid=false for a non-existent token", async () => {
		const { validatePasswordResetToken } = await import("@/actions/auth");
		const result = await validatePasswordResetToken("b".repeat(64));

		expect(result.valid).toBe(false);
		expect(result.email).toBeUndefined();
		expect(result.error).toBeDefined();
	});

	it("returns valid=false for an expired token", async () => {
		const user = await createTestUser({ email: "reset-expired@example.com" });

		const token = "c".repeat(64);
		const expired = new Date(Date.now() - 60 * 1000); // 1 minute in the past

		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetToken: token,
				passwordResetExpires: expired,
			},
		});

		const { validatePasswordResetToken } = await import("@/actions/auth");
		const result = await validatePasswordResetToken(token);

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("returns valid=false for an empty string token", async () => {
		const { validatePasswordResetToken } = await import("@/actions/auth");
		const result = await validatePasswordResetToken("");

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("returns valid=false for a token with incorrect length", async () => {
		const { validatePasswordResetToken } = await import("@/actions/auth");
		// The service checks token.length === 64
		const result = await validatePasswordResetToken("tooshort");

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("does not return the token for a second user when token is already consumed", async () => {
		const user = await createTestUser({ email: "reset-once@example.com" });

		const token = "d".repeat(64);
		const expires = new Date(Date.now() + 60 * 60 * 1000);

		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetToken: token,
				passwordResetExpires: expires,
			},
		});

		// Clear the token (simulate consumption)
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetToken: null,
				passwordResetExpires: null,
			},
		});

		const { validatePasswordResetToken } = await import("@/actions/auth");
		const result = await validatePasswordResetToken(token);

		expect(result.valid).toBe(false);
	});
});
