import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password-service";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createTestUser } from "../utils/prisma-factories";

/**
 * A weak new password is refused with a 400 on change-password, reset and
 * registration, and nothing is changed by the refused request.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/email-service", () => ({
	sendPasswordResetEmail: vi.fn(),
	sendWelcomeEmail: vi.fn().mockResolvedValue({ data: { messageId: "m" } }),
}));
vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}));

const CURRENT = "CurrentP@ss1";
const STRONG = "StrongP@ss1";
const WEAK_MESSAGE = "Password must be at least 8 characters";
const RESET_TOKEN = "b7".repeat(32);

function put(body: unknown): NextRequest {
	return new NextRequest("http://localhost:3000/api/users/me/password", {
		method: "PUT",
		body: JSON.stringify(body),
	});
}

beforeEach(async () => {
	await mockNoAuth();
});

describe("PUT /api/users/me/password", () => {
	it("answers 400 for a weak new password and changes nothing", async () => {
		const user = await createTestUser({
			authProvider: "LOCAL",
			passwordHash: await hashPassword(CURRENT),
		});
		await mockAuth(user.id, user.username, user.email);
		const { PUT } = await import("@/app/api/users/me/password/route");

		const response = await PUT(
			put({ currentPassword: CURRENT, newPassword: "short" })
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: WEAK_MESSAGE,
			code: "VALIDATION",
		});
		const after = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
		});
		expect(after.passwordHash).toBe(user.passwordHash);
		expect(after.sessionVersion).toBe(user.sessionVersion);
	});

	it("answers 400 for a wrong current password", async () => {
		const user = await createTestUser({
			authProvider: "LOCAL",
			passwordHash: await hashPassword(CURRENT),
		});
		await mockAuth(user.id, user.username, user.email);
		const { PUT } = await import("@/app/api/users/me/password/route");

		const response = await PUT(
			put({ currentPassword: "WrongP@ss1", newPassword: STRONG })
		);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("Current password is incorrect");
	});

	it("answers 403 for an account that signs in with a provider", async () => {
		const user = await createTestUser({ authProvider: "GITHUB" });
		await mockAuth(user.id, user.username, user.email);
		const { PUT } = await import("@/app/api/users/me/password/route");

		const response = await PUT(
			put({ currentPassword: CURRENT, newPassword: STRONG })
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /api/auth/reset-password", () => {
	it("answers 400 for a weak password and the same link then works", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetTokenHash: createHash("sha256")
					.update(RESET_TOKEN)
					.digest("hex"),
				passwordResetExpires: new Date(Date.now() + 3_600_000),
			},
		});
		const { POST } = await import("@/app/api/auth/reset-password/route");
		const post = (password: string) =>
			POST(
				new Request("http://localhost:3000/api/auth/reset-password", {
					method: "POST",
					body: JSON.stringify({ token: RESET_TOKEN, password }),
				})
			);

		const weak = await post("short");
		const strong = await post(STRONG);

		expect(weak.status).toBe(400);
		expect((await weak.json()).error).toBe(WEAK_MESSAGE);
		expect(strong.status).toBe(200);
	});
});

describe("POST /api/users/register", () => {
	it("answers 400 for a weak password", async () => {
		const { POST } = await import("@/app/api/users/register/route");

		const response = await POST(
			new Request("http://localhost:3000/api/users/register", {
				method: "POST",
				body: JSON.stringify({
					username: "weakpass_user",
					email: "weakpass@example.com",
					password: "short",
				}),
			})
		);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(WEAK_MESSAGE);
		expect(
			await prisma.user.count({ where: { email: "weakpass@example.com" } })
		).toBe(0);
	});
});
