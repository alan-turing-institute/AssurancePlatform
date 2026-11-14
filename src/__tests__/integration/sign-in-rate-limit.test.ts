import { createHash } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { authorizeCredentials } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password-service";
import { signInIdentifierKey } from "@/lib/auth/sign-in-identifier";
import prisma from "@/lib/prisma";
import { resetPassword } from "@/lib/services/password-reset-service";
import { captureLogs } from "../helpers/capture-logs";
import { createTestUser } from "../utils/prisma-factories";

// The reset service imports the email service, an external boundary.
vi.mock("@/lib/services/email-service", () => ({
	sendPasswordResetEmail: vi.fn(),
}));

/**
 * Sign-in is paused for an email or username after 10 failed attempts, and for
 * a network address after 20, each over 15 minutes. Attempts go through
 * `authorizeCredentials`, the body of the credentials provider's `authorize`.
 */

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "Another-Str0ng-Pass!";
const WRONG = "wrong password";
const MINUTE_MS = 60_000;
const PAUSED_FOR_15 = "SignInRateLimited:15";

let passwordHash: string;

beforeAll(async () => {
	passwordHash = await hashPassword(PASSWORD);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

type Outcome = "signed-in" | "refused" | string;

/** What one attempt did: signed in, refused as wrong, or the pause it threw. */
async function attempt(
	username: string,
	password: string,
	headers: Record<string, string> = { "x-client-ip": "198.51.100.1" }
): Promise<Outcome> {
	try {
		const user = await authorizeCredentials({ username, password }, headers);
		return user ? "signed-in" : "refused";
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

/** Several wrong passwords, one after another, for each name given. */
async function failTimes(
	count: number,
	username: string,
	headers?: Record<string, string>
): Promise<Outcome[]> {
	const outcomes: Outcome[] = [];
	for (let index = 0; index < count; index += 1) {
		outcomes.push(await attempt(username, WRONG, headers));
	}
	return outcomes;
}

/** Wrong passwords for `count` different made-up names, from one address. */
async function failAsManyNames(
	count: number,
	headers: Record<string, string>
): Promise<Outcome[]> {
	const outcomes: Outcome[] = [];
	for (let index = 0; index < count; index += 1) {
		outcomes.push(await attempt(`made-up-${index}`, WRONG, headers));
	}
	return outcomes;
}

const countRows = (identifierType: "ip" | "email") =>
	prisma.rateLimitAttempt.count({
		where: { endpoint: "sign_in", identifierType },
	});

function demoUser(overrides: { username?: string; email?: string } = {}) {
	return createTestUser({
		passwordHash,
		username: overrides.username ?? "alice",
		email: overrides.email ?? "alice@example.com",
	});
}

describe("sign-in attempt limit: a name", () => {
	it("pauses a name after 10 wrong passwords and says how long to wait", async () => {
		await demoUser();

		const outcomes = await failTimes(10, "alice");
		expect(outcomes.every((outcome) => outcome === "refused")).toBe(true);

		expect(await attempt("alice", WRONG)).toBe(PAUSED_FOR_15);
	});

	it("refuses the correct password while the name is paused", async () => {
		await demoUser();
		await failTimes(10, "alice");

		expect(await attempt("alice", PASSWORD)).toBe(PAUSED_FOR_15);
	});

	it("keeps a username and an email for the same account as separate counts", async () => {
		await demoUser();
		await failTimes(10, "alice@example.com");

		expect(await attempt("alice@example.com", PASSWORD)).toBe(PAUSED_FOR_15);
		expect(await attempt("alice", PASSWORD)).toBe("signed-in");
	});

	it("counts every capitalisation of an email, and a trailing space, as one name", async () => {
		await demoUser();
		const forms = [
			"alice@example.com",
			"Alice@example.com",
			"aLice@example.com",
			"ALICE@EXAMPLE.COM",
			"alice@example.com ",
		];
		for (let index = 0; index < 10; index += 1) {
			expect(await attempt(forms[index % forms.length] ?? "", WRONG)).toBe(
				"refused"
			);
		}

		for (const form of forms) {
			expect(await attempt(form, PASSWORD)).toBe(PAUSED_FOR_15);
		}
	});

	it("leaves a second account on the same address able to sign in", async () => {
		await demoUser();
		await createTestUser({
			passwordHash,
			username: "bob",
			email: "bob@example.com",
		});
		await failTimes(10, "alice");

		expect(await attempt("bob", PASSWORD)).toBe("signed-in");
	});

	it("pauses a made-up name exactly as it pauses a real one", async () => {
		await demoUser();
		await failTimes(10, "alice");
		await failTimes(10, "nobody@example.com");

		const real = await attempt("alice", PASSWORD);
		const madeUp = await attempt("nobody@example.com", PASSWORD);

		expect(madeUp).toBe(real);
		expect(madeUp).toBe(PAUSED_FOR_15);
	});

	it("lets a success hand back its slots and clear the name's failures", async () => {
		await demoUser();
		await failTimes(9, "alice");

		expect(await attempt("alice", PASSWORD)).toBe("signed-in");

		expect(await countRows("email")).toBe(0);
		expect(await countRows("ip")).toBe(9);
		const afterSuccess = await failTimes(10, "alice");
		expect(afterSuccess.every((outcome) => outcome === "refused")).toBe(true);
		expect(await attempt("alice", WRONG)).toBe(PAUSED_FOR_15);
	});

	it("clears the failures when a padded email signs in as the only account", async () => {
		await demoUser({ email: "person@example.com" });
		await failTimes(4, "person@example.com");

		expect(await attempt("  person@example.com  ", PASSWORD)).toBe("signed-in");

		expect(await countRows("email")).toBe(0);
	});

	it("leaves nothing counted after a sign-in that never failed", async () => {
		await demoUser();

		expect(await attempt("alice", PASSWORD)).toBe("signed-in");

		expect(await prisma.rateLimitAttempt.count()).toBe(0);
	});

	it("lets an unrelated success from the same address keep that address's failures", async () => {
		await demoUser();
		await failAsManyNames(5, { "x-client-ip": "198.51.100.1" });

		expect(await attempt("alice", PASSWORD)).toBe("signed-in");

		expect(await countRows("ip")).toBe(5);
	});

	it("stays within the limit when many attempts arrive at once", async () => {
		const outcomes = await Promise.all(
			Array.from({ length: 30 }, () => attempt("burst-name", WRONG))
		);

		expect(outcomes.filter((outcome) => outcome === "refused")).toHaveLength(
			10
		);
		expect(
			outcomes.filter((outcome) => outcome === PAUSED_FOR_15)
		).toHaveLength(20);
		expect(await countRows("email")).toBe(10);
	});

	it("stores the name only as a hash and writes an audit entry when it pauses", async () => {
		const user = await demoUser();
		await failTimes(10, "alice");
		expect(await prisma.securityAuditLog.count()).toBe(0);

		await attempt("alice", PASSWORD, {
			"x-client-ip": "198.51.100.1",
			"user-agent": "sign-in-test",
		});

		const rows = await prisma.securityAuditLog.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			eventType: "sign_in_rate_limited",
			ipAddress: "198.51.100.1",
			userAgent: "sign-in-test",
		});
		expect(rows[0]?.metadata).toMatchObject({
			identifier: signInIdentifierKey("alice"),
		});
		expect(JSON.stringify(rows[0])).not.toContain("alice");
		expect(JSON.stringify(rows[0])).not.toContain(user.email);
		const counted = await prisma.rateLimitAttempt.findMany({
			where: { identifierType: "email" },
		});
		expect(counted).toHaveLength(10);
		expect(
			counted.every((row) => row.identifier === signInIdentifierKey("alice"))
		).toBe(true);
	});

	it("starts again once the 15 minutes have passed", async () => {
		await demoUser();
		await failTimes(10, "alice");
		expect(await attempt("alice", PASSWORD)).toBe(PAUSED_FOR_15);

		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.now() + 10 * MINUTE_MS);
		expect(await attempt("alice", PASSWORD)).toBe("SignInRateLimited:5");

		vi.setSystemTime(Date.now() + 6 * MINUTE_MS);
		expect(await attempt("alice", PASSWORD)).toBe("signed-in");
	});
});

describe("sign-in attempt limit: an address", () => {
	it("pauses an address after 20 failures across different names", async () => {
		const headers = { "x-client-ip": "198.51.100.1" };
		const outcomes = await failAsManyNames(20, headers);
		expect(outcomes.every((outcome) => outcome === "refused")).toBe(true);
		await demoUser();

		expect(await attempt("alice", PASSWORD, headers)).toBe(PAUSED_FOR_15);
		expect(await attempt("fresh-name", WRONG, headers)).toBe(PAUSED_FOR_15);
		expect(
			await attempt("alice", PASSWORD, { "x-client-ip": "198.51.100.2" })
		).toBe("signed-in");
	});

	it("counts by the address the front end wrote, whatever an earlier entry says", async () => {
		const forged = (index: number) => ({
			"x-forwarded-for": `10.0.0.${index}, 203.0.113.7`,
		});
		for (let index = 0; index < 20; index += 1) {
			expect(await attempt(`made-up-${index}`, WRONG, forged(index))).toBe(
				"refused"
			);
		}

		expect(await attempt("fresh-name", WRONG, forged(99))).toBe(PAUSED_FOR_15);
		expect(
			await attempt("fresh-name", WRONG, {
				"x-forwarded-for": "10.0.0.1, 203.0.113.8",
			})
		).toBe("refused");
	});

	it("skips only the address limit when the address cannot be read", async () => {
		const logs = captureLogs();
		try {
			const outcomes = await failAsManyNames(25, {});
			expect(outcomes.every((outcome) => outcome === "refused")).toBe(true);
			expect(await countRows("ip")).toBe(0);
			expect(logs.entries.some((entry) => entry.level === "warn")).toBe(true);

			await failTimes(10, "alice", {});
			expect(await attempt("alice", WRONG, {})).toBe(PAUSED_FOR_15);
		} finally {
			logs.restore();
		}
	});
});

describe("sign-in attempt limit: without a signing secret", () => {
	it("refuses even the correct password and logs the problem without the name or address", async () => {
		await demoUser();
		vi.stubEnv("NEXTAUTH_SECRET", "");
		const logs = captureLogs();
		try {
			expect(await attempt("alice", PASSWORD)).toBe("refused");

			const errors = logs.entries.filter((entry) => entry.level === "error");
			expect(errors).toHaveLength(1);
			expect(JSON.stringify(errors)).toContain("NEXTAUTH_SECRET");
			expect(JSON.stringify(logs.entries)).not.toContain("alice");
			expect(JSON.stringify(logs.entries)).not.toContain("198.51.100.1");
		} finally {
			logs.restore();
		}
		expect(await prisma.rateLimitAttempt.count()).toBe(0);
	});
});

describe("sign-in attempt limit: password reset", () => {
	async function completeResetFor(userId: string) {
		const token = createHash("sha256").update(userId).digest("hex");
		await prisma.user.update({
			where: { id: userId },
			data: {
				passwordResetTokenHash: createHash("sha256")
					.update(token, "utf8")
					.digest("hex"),
				passwordResetExpires: new Date(Date.now() + 60 * MINUTE_MS),
			},
		});
		return await resetPassword(token, NEW_PASSWORD, "198.51.100.1");
	}

	it("clears the count for the email and the username", async () => {
		const user = await demoUser({ email: "Alice@Example.com" });
		// Two addresses, so neither reaches the address limit on its own.
		const fromEmail = { "x-client-ip": "198.51.100.1" };
		const fromUsername = { "x-client-ip": "198.51.100.2" };
		await failTimes(10, "alice@example.com", fromEmail);
		await failTimes(10, "alice", fromUsername);
		expect(await attempt("alice@example.com", NEW_PASSWORD, fromEmail)).toBe(
			PAUSED_FOR_15
		);
		expect(await attempt("alice", NEW_PASSWORD, fromUsername)).toBe(
			PAUSED_FOR_15
		);

		expect(await completeResetFor(user.id)).toEqual({ data: null });

		expect(await attempt("alice@example.com", NEW_PASSWORD, fromEmail)).toBe(
			"signed-in"
		);
		expect(await attempt("alice", NEW_PASSWORD, fromUsername)).toBe(
			"signed-in"
		);
	});

	it("keeps the count of an email that another account shares", async () => {
		const user = await demoUser({
			username: "pat-one",
			email: "Pat@Example.com",
		});
		await demoUser({ username: "pat-two", email: "pat@example.com" });
		await failTimes(10, "pat@example.com");

		expect(await completeResetFor(user.id)).toEqual({ data: null });

		expect(await attempt("pat@example.com", PASSWORD)).toBe(PAUSED_FOR_15);
	});

	it("completes the reset, and logs the problem, when the counts cannot be cleared", async () => {
		const user = await demoUser();
		vi.stubEnv("NEXTAUTH_SECRET", "");
		const logs = captureLogs();
		try {
			expect(await completeResetFor(user.id)).toEqual({ data: null });

			expect(logs.entries.some((entry) => entry.level === "error")).toBe(true);
			expect(JSON.stringify(logs.entries)).not.toContain(user.email);
			expect(JSON.stringify(logs.entries)).not.toContain(user.username);
		} finally {
			logs.restore();
			vi.unstubAllEnvs();
		}
		expect(await attempt("alice", NEW_PASSWORD)).toBe("signed-in");
	});
});
