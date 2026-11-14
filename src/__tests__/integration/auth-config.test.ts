import type { CredentialsConfig } from "next-auth/providers/credentials";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	authenticateGoogleWithPrisma,
	authenticateWithPrisma,
	authOptions,
} from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password-service";
import { encryptToken } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";
import { getUserGitHubToken } from "@/lib/services/github-api-service";
import { captureLogs } from "../helpers/capture-logs";
import { createTestUser } from "../utils/prisma-factories";

/** A valid-shaped base64, 32-byte test key — distinct per describe block below. */
function testKey(fill: number): string {
	return Buffer.alloc(32, fill).toString("base64");
}

/**
 * Corrupts an envelope by flipping a bit in its first payload byte — always
 * a real ciphertext/tag byte. Flipping a character of the base64 STRING
 * instead (e.g. its last character) is only *sometimes* a real corruption:
 * when the payload's byte length isn't a multiple of 3, the last character
 * encodes some bits that base64 decoding discards, so certain flips there
 * silently round-trip to the same bytes.
 */
function tamper(encrypted: string): string {
	const [version, iv, payload] = encrypted.split(":") as [
		string,
		string,
		string,
	];
	const bytes = Buffer.from(payload, "base64url");
	const firstByte = bytes[0] ?? 0;
	bytes[0] = (firstByte + 1) % 256;
	return `${version}:${iv}:${bytes.toString("base64url")}`;
}

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

describe("GitHub OAuth token encryption (getUserGitHubToken)", () => {
	const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

	beforeEach(() => {
		process.env.TOKEN_ENCRYPTION_KEY = testKey(3);
	});

	afterEach(() => {
		if (originalKey === undefined) {
			Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
		} else {
			process.env.TOKEN_ENCRYPTION_KEY = originalKey;
		}
	});

	it("returns the decrypted value for a stored, encrypted GitHub token", async () => {
		const user = await createTestUser();
		await prisma.user.update({
			where: { id: user.id },
			data: { githubAccessToken: encryptToken("gho_realtoken1234567890") },
		});

		await expect(getUserGitHubToken(user.id)).resolves.toBe(
			"gho_realtoken1234567890"
		);
	});

	it("still accepts a legacy plaintext GitHub token", async () => {
		const user = await createTestUser();
		await prisma.user.update({
			where: { id: user.id },
			data: { githubAccessToken: "gho_legacyplaintext" },
		});

		await expect(getUserGitHubToken(user.id)).resolves.toBe(
			"gho_legacyplaintext"
		);
	});

	it("treats a tampered stored token as absent, logging via the token-encryption component, rather than throwing", async () => {
		const user = await createTestUser();
		const encrypted = encryptToken("gho_realtoken1234567890");
		await prisma.user.update({
			where: { id: user.id },
			data: { githubAccessToken: tamper(encrypted) },
		});

		const logs = captureLogs();
		try {
			await expect(getUserGitHubToken(user.id)).resolves.toBeNull();

			const errorLog = logs.entries.find(
				(entry) =>
					entry.level === "error" && entry.component === "token-encryption"
			);
			expect(errorLog).toBeDefined();
		} finally {
			logs.restore();
		}
	});
});

describe("authenticateGoogleWithPrisma — production key-absent path", () => {
	const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

	beforeEach(() => {
		Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
		vi.stubEnv("NODE_ENV", "production");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		if (originalKey !== undefined) {
			process.env.TOKEN_ENCRYPTION_KEY = originalKey;
		}
	});

	it("does not persist the token, still signs the user in, and logs the failure", async () => {
		const user = await createTestUser();

		const logs = captureLogs();
		try {
			const result = await authenticateGoogleWithPrisma(
				{ sub: "google-sub-prod-1", email: user.email, name: "Test User" },
				"ya29.newaccesstoken",
				"1//newrefreshtoken",
				Math.floor(Date.now() / 1000) + 3600
			);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(user.id);

			const updated = await prisma.user.findUnique({ where: { id: user.id } });
			expect(updated?.googleAccessToken).toBeNull();
			expect(updated?.googleRefreshToken).toBeNull();
			// googleId is set normally — only the token fields were dropped.
			expect(updated?.googleId).toBe("google-sub-prod-1");

			const errorLog = logs.entries.find(
				(entry) =>
					entry.level === "error" && entry.component === "token-encryption"
			);
			expect(errorLog).toBeDefined();
		} finally {
			logs.restore();
		}
	});
});

/**
 * `authorize` is the function next-auth calls with what the sign-in form
 * posted. next-auth keeps the one configured in `options`, not the
 * placeholder it puts on the provider object itself.
 */
function credentialsAuthorize(): NonNullable<CredentialsConfig["authorize"]> {
	const provider = authOptions.providers.find((p) => p.id === "credentials");
	// next-auth types `options` per provider kind; for the credentials
	// provider it is the config object that was passed in.
	const options = provider?.options as Partial<CredentialsConfig> | undefined;
	if (!options?.authorize) {
		throw new Error("the credentials provider must define authorize");
	}
	return options.authorize;
}

function authorizeAs(username: string, password: string) {
	return credentialsAuthorize()(
		{ username, password },
		{ body: {}, query: {}, headers: {}, method: "POST" }
	);
}

describe("sign-in identifier matching through authorize", () => {
	it("signs in with a trailing space and with an email typed in other capitals", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const user = await createTestUser({
			passwordHash,
			username: "demo",
			email: "demo@example.com",
		});

		expect((await authorizeAs("demo ", TEST_PASSWORD))?.id).toBe(user.id);
		expect((await authorizeAs("Demo@Example.com", TEST_PASSWORD))?.id).toBe(
			user.id
		);
	});

	it("trims a padded identifier before it reaches the lookup", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const user = await createTestUser({ passwordHash, username: "padded" });

		expect((await authorizeAs("  padded\t", TEST_PASSWORD))?.id).toBe(user.id);
		expect(await authorizeAs("   ", TEST_PASSWORD)).toBeNull();
	});

	it("never trims the password", async () => {
		const passwordHash = await hashPassword(` ${TEST_PASSWORD}`);
		const user = await createTestUser({ passwordHash, username: "spaced" });

		expect(await authorizeAs("spaced", TEST_PASSWORD)).toBeNull();
		expect((await authorizeAs("spaced", ` ${TEST_PASSWORD}`))?.id).toBe(
			user.id
		);
	});

	it("keeps usernames exact: Demo is refused while demo works", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const user = await createTestUser({
			passwordHash,
			username: "demo",
			email: "demo-owner@example.com",
		});

		expect((await authorizeAs("demo", TEST_PASSWORD))?.id).toBe(user.id);
		expect(await authorizeAs("Demo", TEST_PASSWORD)).toBeNull();
	});
});

describe("authenticateWithPrisma — email matching ignores capitals", () => {
	it("signs in with a stored Alice@Example.com typed in lowercase", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const user = await createTestUser({
			passwordHash,
			email: "Alice@Example.com",
		});

		const result = await authenticateWithPrisma(
			"alice@example.com",
			TEST_PASSWORD
		);

		expect(result?.id).toBe(user.id);
		expect(result?.email).toBe("Alice@Example.com");
	});

	it("lets two accounts named Demo and demo each sign in with their own name", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const upper = await createTestUser({
			passwordHash,
			username: "Demo",
			email: "demo-upper@example.com",
		});
		const lower = await createTestUser({
			passwordHash,
			username: "demo",
			email: "demo-lower@example.com",
		});

		expect((await authenticateWithPrisma("Demo", TEST_PASSWORD))?.id).toBe(
			upper.id
		);
		expect((await authenticateWithPrisma("demo", TEST_PASSWORD))?.id).toBe(
			lower.id
		);
	});

	it("with two emails differing only in capitals, accepts each exactly and refuses other capitals without naming the identifier in the log", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const capitalised = await createTestUser({
			passwordHash,
			email: "Pat@Example.com",
		});
		const lowercase = await createTestUser({
			passwordHash,
			email: "pat@example.com",
		});

		expect(
			(await authenticateWithPrisma("Pat@Example.com", TEST_PASSWORD))?.id
		).toBe(capitalised.id);
		expect(
			(await authenticateWithPrisma("pat@example.com", TEST_PASSWORD))?.id
		).toBe(lowercase.id);

		const logs = captureLogs();
		try {
			expect(
				await authenticateWithPrisma("PAT@EXAMPLE.COM", TEST_PASSWORD)
			).toBeNull();

			const entry = logs.entries.find(
				(e) => e.msg === "email_lookup_ambiguous"
			);
			expect(entry).toMatchObject({ level: "warn" });
			expect(JSON.stringify(entry).toLowerCase()).not.toContain("pat@");
		} finally {
			logs.restore();
		}
	});

	it.each([
		"%",
		"%@example.com",
		"d_mo@example.com",
	])("refuses %s, where % and _ are not wildcards", async (identifier) => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		await createTestUser({ passwordHash, email: "demo@example.com" });

		expect(await authenticateWithPrisma(identifier, TEST_PASSWORD)).toBeNull();
	});

	it("refuses İnfo@example.com for a stored info@example.com, whatever the database locale does with İ", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		await createTestUser({ passwordHash, email: "info@example.com" });

		expect(
			await authenticateWithPrisma("İnfo@example.com", TEST_PASSWORD)
		).toBeNull();
	});

	it("matches an identifier without an @ exactly only, never by an email search ignoring capitals", async () => {
		// Registration never stores an email without an "@"; the stored value
		// here is what lets an unwanted capitals-ignoring search show itself.
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const user = await createTestUser({ passwordHash, email: "Legacy-Import" });

		expect(
			(await authenticateWithPrisma("Legacy-Import", TEST_PASSWORD))?.id
		).toBe(user.id);
		expect(
			await authenticateWithPrisma("legacy-import", TEST_PASSWORD)
		).toBeNull();
	});

	it("matches an email containing an underscore typed in other capitals", async () => {
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const user = await createTestUser({
			passwordHash,
			email: "first_last@example.com",
		});

		const result = await authenticateWithPrisma(
			"First_Last@Example.com",
			TEST_PASSWORD
		);

		expect(result?.id).toBe(user.id);
	});
});
