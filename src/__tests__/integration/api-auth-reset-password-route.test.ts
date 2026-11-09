import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Route-level coverage for GET and POST /api/auth/reset-password. A used, an
 * expired and an unknown link get the same refusal, so nobody can tell which
 * links exist. The email sender is mocked at its service boundary, matching
 * api-auth-forgot-password-route.test.ts, as is `next/headers`'s `headers()`,
 * which throws outside a real Next.js request context.
 */

vi.mock("@/lib/services/email-service", () => ({
	sendPasswordResetEmail: vi.fn().mockResolvedValue({
		success: true,
		messageId: "mock-message-id",
	}),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}));

const INVALID_TOKEN_MESSAGE = "Invalid or expired reset token";
const STRONG_PASSWORD = "StrongP@ss1";
const ONE_HOUR_MS = 60 * 60 * 1000;

const USED_TOKEN = "d1".repeat(32);
const EXPIRED_TOKEN = "e2".repeat(32);
const UNKNOWN_TOKEN = "f3".repeat(32);
const VALID_TOKEN = "a4".repeat(32);

function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

/** A LOCAL user whose reset link is `token`, which expires `expiresInMs` from now. */
async function createUserWithResetToken(token: string, expiresInMs: number) {
	const user = await createTestUser({ authProvider: "LOCAL" });
	await prisma.user.update({
		where: { id: user.id },
		data: {
			passwordResetTokenHash: sha256Hex(token),
			passwordResetExpires: new Date(Date.now() + expiresInMs),
		},
	});
	return user;
}

function resetRequest(token: string): Request {
	return new Request("http://localhost:3000/api/auth/reset-password", {
		method: "POST",
		body: JSON.stringify({ token, password: STRONG_PASSWORD }),
	});
}

function validateRequest(token: string): Request {
	return new Request(
		`http://localhost:3000/api/auth/reset-password?token=${token}`
	);
}

/** Sets up a used, an expired and an unknown link, and returns their tokens. */
async function createRefusedTokens() {
	const { POST } = await import("@/app/api/auth/reset-password/route");

	await createUserWithResetToken(USED_TOKEN, ONE_HOUR_MS);
	const firstUse = await POST(resetRequest(USED_TOKEN));
	if (firstUse.status !== 200) {
		throw new Error(`the first use of the link failed: ${firstUse.status}`);
	}

	await createUserWithResetToken(EXPIRED_TOKEN, -ONE_HOUR_MS);

	return [USED_TOKEN, EXPIRED_TOKEN, UNKNOWN_TOKEN];
}

describe("POST /api/auth/reset-password", () => {
	it("returns 400 with the same body for a used, an expired and an unknown link", async () => {
		const tokens = await createRefusedTokens();

		const { POST } = await import("@/app/api/auth/reset-password/route");
		const responses = await Promise.all(
			tokens.map((token) => POST(resetRequest(token)))
		);

		for (const response of responses) {
			expect(response.status).toBe(400);
		}
		const bodies = await Promise.all(responses.map((r) => r.json()));
		expect(bodies[0]).toEqual({
			error: INVALID_TOKEN_MESSAGE,
			code: "VALIDATION",
		});
		expect(bodies[1]).toEqual(bodies[0]);
		expect(bodies[2]).toEqual(bodies[0]);
	});

	it("returns 200 for a valid link", async () => {
		await createUserWithResetToken(VALID_TOKEN, ONE_HOUR_MS);

		const { POST } = await import("@/app/api/auth/reset-password/route");
		const response = await POST(resetRequest(VALID_TOKEN));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			success: true,
			message: "Your password has been reset successfully. You can now log in.",
		});
	});
});

describe("GET /api/auth/reset-password", () => {
	it("returns 400 with the same body for a used, an expired and an unknown link", async () => {
		const tokens = await createRefusedTokens();

		const { GET } = await import("@/app/api/auth/reset-password/route");
		const responses = await Promise.all(
			tokens.map((token) => GET(validateRequest(token)))
		);

		for (const response of responses) {
			expect(response.status).toBe(400);
		}
		const bodies = await Promise.all(responses.map((r) => r.json()));
		expect(bodies[0]).toEqual({
			error: INVALID_TOKEN_MESSAGE,
			code: "VALIDATION",
		});
		expect(bodies[1]).toEqual(bodies[0]);
		expect(bodies[2]).toEqual(bodies[0]);
	});

	it("returns 200 for a valid link", async () => {
		const user = await createUserWithResetToken(VALID_TOKEN, ONE_HOUR_MS);

		const { GET } = await import("@/app/api/auth/reset-password/route");
		const response = await GET(validateRequest(VALID_TOKEN));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({ valid: true, email: user.email });
	});
});
