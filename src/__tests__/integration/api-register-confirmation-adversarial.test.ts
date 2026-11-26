import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";

/**
 * Sign-up refuses a confirmation that does not match the password, creates
 * nothing, and is answered like any other invalid input.
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

const PASSWORD = "StrongP@ss1";
const CONFIRMATION = "DifferentP@ss2";
const USERNAME = "confirm_user";
const EMAIL = "confirm@example.com";

beforeEach(async () => {
	await mockNoAuth();
});

async function register(fields: Record<string, unknown>) {
	const { POST } = await import("@/app/api/users/register/route");
	return POST(
		new Request("http://localhost:3000/api/users/register", {
			method: "POST",
			body: JSON.stringify({ username: USERNAME, email: EMAIL, ...fields }),
		})
	);
}

function accountsFor() {
	return prisma.user.count({
		where: { OR: [{ email: EMAIL }, { username: USERNAME }] },
	});
}

describe("POST /api/users/register with a confirmation", () => {
	it("answers 400 for a differing confirmation and creates no account", async () => {
		const response = await register({
			password: PASSWORD,
			password2: CONFIRMATION,
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: "Passwords do not match",
			code: "VALIDATION",
		});
		expect(await accountsFor()).toBe(0);
	});

	it("does not repeat either password in the answer", async () => {
		const response = await register({
			password: PASSWORD,
			password2: CONFIRMATION,
		});

		const text = await response.text();
		expect(text).not.toContain(PASSWORD);
		expect(text).not.toContain(CONFIRMATION);
	});

	it("refuses an empty confirmation and creates no account", async () => {
		const response = await register({ password1: PASSWORD, password2: "" });

		expect(response.status).toBe(400);
		expect(await accountsFor()).toBe(0);
	});

	it("records no sign-up attempt for a refused confirmation", async () => {
		const before = await prisma.rateLimitAttempt.count();

		await register({ password: PASSWORD, password2: CONFIRMATION });
		const afterMismatch = await prisma.rateLimitAttempt.count();
		await register({ email: "not-an-email", password: PASSWORD });
		const afterInvalid = await prisma.rateLimitAttempt.count();

		expect(afterMismatch).toBe(before);
		expect(afterInvalid).toBe(before);
	});

	it("lets the same details sign up once the confirmation matches", async () => {
		const refused = await register({
			password: PASSWORD,
			password2: CONFIRMATION,
		});
		const accepted = await register({
			password: PASSWORD,
			password2: PASSWORD,
		});

		expect(refused.status).toBe(400);
		expect(accepted.status).toBe(201);
		expect(await accountsFor()).toBe(1);
	});

	it("creates the account for password1 with an equal confirmation", async () => {
		const response = await register({
			password1: PASSWORD,
			password2: PASSWORD,
		});

		expect(response.status).toBe(201);
		expect(await accountsFor()).toBe(1);
	});

	it("creates the account when no confirmation is sent", async () => {
		const response = await register({ password: PASSWORD });

		expect(response.status).toBe(201);
		expect(await accountsFor()).toBe(1);
	});

	it("reports only the missing password when a confirmation is sent alone", async () => {
		const response = await register({ password2: CONFIRMATION });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("Password is required");
		expect(await accountsFor()).toBe(0);
	});
});
