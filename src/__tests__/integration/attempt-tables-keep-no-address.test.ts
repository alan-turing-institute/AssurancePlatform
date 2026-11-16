import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signInIdentifierKey } from "@/lib/auth/sign-in-identifier";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email-service";
import {
	requestPasswordReset,
	resetPassword,
} from "@/lib/services/password-reset-service";
import { createTestUser } from "../utils/prisma-factories";

/**
 * The password-reset and registration limits count an address under a keyed
 * fingerprint. The tables never hold the address as typed, and a missing
 * fingerprint never turns a filter into "every row".
 */

vi.mock("@/lib/services/email-service", () => ({
	sendPasswordResetEmail: vi.fn().mockResolvedValue({
		success: true,
		messageId: "mock-message-id",
	}),
	sendWelcomeEmail: vi.fn().mockResolvedValue({ data: { messageId: "m" } }),
}));
vi.mock("next/headers", () => ({
	headers: vi
		.fn()
		.mockResolvedValue(new Headers({ "x-client-ip": "198.51.100.20" })),
}));

const NETWORK = "198.51.100.20";
const TYPED = "Nobody.Here@Example.com";
const STRONG = "StrongP@ss1";
const OTHER_KEY = "f".repeat(64);

afterEach(() => {
	vi.unstubAllEnvs();
});

async function forgotPassword(email: string): Promise<Response> {
	const { POST } = await import("@/app/api/auth/forgot-password/route");
	return POST(
		new NextRequest("http://localhost:3000/api/auth/forgot-password", {
			method: "POST",
			body: JSON.stringify({ email }),
		})
	);
}

async function register(username: string, email: string): Promise<Response> {
	const { POST } = await import("@/app/api/users/register/route");
	return POST(
		new NextRequest("http://localhost:3000/api/users/register", {
			method: "POST",
			body: JSON.stringify({ username, email, password: STRONG }),
		})
	);
}

const seedResetRows = (emailKey: string, count: number) =>
	prisma.passwordResetAttempt.createMany({
		data: Array.from({ length: count }, (_, index) => ({
			emailKey,
			ipAddress: `10.9.0.${index + 1}`,
		})),
	});

describe("password-reset requests", () => {
	it("store the fingerprint of the typed address and never the address", async () => {
		const response = await forgotPassword(TYPED);

		expect(response.status).toBe(200);
		const rows = await prisma.passwordResetAttempt.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.emailKey).toBe(signInIdentifierKey(TYPED));
		expect(JSON.stringify(rows).toLowerCase()).not.toContain("nobody");
	});

	it("without the server secret, count the network alone", async () => {
		vi.stubEnv("NEXTAUTH_SECRET", "");
		await seedResetRows(OTHER_KEY, 5);

		for (let i = 0; i < 10; i++) {
			expect((await forgotPassword(`person${i}@example.com`)).status).toBe(200);
		}
		const refused = await forgotPassword("person10@example.com");

		expect(refused.status).toBe(429);
		const own = await prisma.passwordResetAttempt.count({
			where: { ipAddress: NETWORK },
		});
		expect(own).toBe(10);
		expect(
			await prisma.passwordResetAttempt.count({
				where: { ipAddress: NETWORK, emailKey: { not: null } },
			})
		).toBe(0);
	});

	it("without the server secret, completing a reset marks no row", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		await requestPasswordReset(user.email, NETWORK);
		const token = vi
			.mocked(sendPasswordResetEmail)
			.mock.calls.at(-1)?.[0].resetToken;
		if (!token) {
			throw new Error("no reset email was sent");
		}
		await seedResetRows(OTHER_KEY, 2);
		vi.stubEnv("NEXTAUTH_SECRET", "");

		expect(await resetPassword(token, STRONG, NETWORK)).toEqual({ data: null });

		expect(
			await prisma.passwordResetAttempt.count({ where: { successful: true } })
		).toBe(0);
	});

	it("mark only the attempts under the account's own fingerprint once reset", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		await requestPasswordReset(user.email, NETWORK);
		const token = vi
			.mocked(sendPasswordResetEmail)
			.mock.calls.at(-1)?.[0].resetToken;
		if (!token) {
			throw new Error("no reset email was sent");
		}
		await seedResetRows(OTHER_KEY, 2);

		await resetPassword(token, STRONG, NETWORK);

		const marked = await prisma.passwordResetAttempt.findMany({
			where: { successful: true },
		});
		expect(marked).toHaveLength(1);
		expect(marked[0]?.emailKey).toBe(
			signInIdentifierKey(user.email.toLowerCase())
		);
	});
});

describe("registration", () => {
	const emailRows = () =>
		prisma.rateLimitAttempt.findMany({
			where: { endpoint: "register", identifierType: "email" },
		});

	it("stores only a fingerprint in the email limit rows", async () => {
		await register("reg_person", "Reg.Person@Example.com");

		const rows = await emailRows();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.identifier).toBe(
			signInIdentifierKey("reg.person@example.com")
		);
		expect(rows[0]?.identifier).not.toContain("@");
	});

	it("still refuses the fourth attempt for one address", async () => {
		for (let i = 0; i < 3; i++) {
			await register(`reg_person_${i}`, "reg.person@example.com");
		}

		const fourth = await register("reg_person_3", "reg.person@example.com");

		expect(fourth.status).toBe(429);
		for (const row of await emailRows()) {
			expect(row.identifier).not.toContain("@");
		}
	});

	it("without the server secret, goes ahead and counts the network alone", async () => {
		vi.stubEnv("NEXTAUTH_SECRET", "");

		const response = await register("reg_person", "reg.person@example.com");

		expect(response.status).toBeLessThan(300);
		expect(await emailRows()).toHaveLength(0);
		const rows = await prisma.rateLimitAttempt.findMany({
			where: { endpoint: "register" },
		});
		expect(rows.map((row) => row.identifierType)).toEqual(["ip"]);
	});
});
