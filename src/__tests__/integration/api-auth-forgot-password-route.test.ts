import { describe, expect, it, vi } from "vitest";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Route-level coverage for POST /api/auth/forgot-password — previously
 * never invoked by any test. The email sender is mocked at its service
 * boundary, matching password-reset-service.test.ts; `next/headers`'s
 * `headers()` is also mocked, since it throws when called outside a real
 * Next.js request context (unlike `NextRequest`-based routes, this one
 * takes a plain `Request` and calls `headers()` separately for IP/UA).
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

const GENERIC_MESSAGE =
	"If an account with that email exists, you will receive a password reset link shortly.";

function forgotPasswordRequest(body: unknown): Request {
	return new Request("http://localhost:3000/api/auth/forgot-password", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/forgot-password", () => {
	it("returns 200 with the generic message for a known email", async () => {
		const user = await createTestUser();

		const { POST } = await import("@/app/api/auth/forgot-password/route");
		const response = await POST(forgotPasswordRequest({ email: user.email }));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({ success: true, message: GENERIC_MESSAGE });
	});

	it("returns byte-identical responses for a known and an unknown email (no enumeration oracle)", async () => {
		const user = await createTestUser();

		const { POST } = await import("@/app/api/auth/forgot-password/route");
		const knownResponse = await POST(
			forgotPasswordRequest({ email: user.email })
		);
		const unknownResponse = await POST(
			forgotPasswordRequest({ email: "definitely-not-a-user@example.com" })
		);

		expect(knownResponse.status).toBe(unknownResponse.status);
		const knownBody = await knownResponse.json();
		const unknownBody = await unknownResponse.json();
		expect(knownBody).toEqual(unknownBody);
	});

	it("returns 400 'Email is required' for a missing email", async () => {
		const { POST } = await import("@/app/api/auth/forgot-password/route");
		const response = await POST(forgotPasswordRequest({}));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Email is required");
	});

	it("returns 400 for an unknown key", async () => {
		const { POST } = await import("@/app/api/auth/forgot-password/route");
		const response = await POST(
			forgotPasswordRequest({ email: "a@example.com", extra: "not allowed" })
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Unrecognized key: "extra"');
	});
});
