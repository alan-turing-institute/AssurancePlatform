import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptToken } from "@/lib/auth/token-encryption";
import { getUserGitHubToken } from "@/lib/services/github-api-service";

// github-api-service.ts imports @/lib/prisma at module scope, which throws
// at load without DATABASE_URL (same module-load dependency documented in
// case-import-service.test.ts). Mocking it at the boundary lets this file
// load and run standalone, with a controllable findUnique for these tests.
// vi.hoisted is required because the mock factory below references
// `findUnique` — vi.mock itself is hoisted above these imports.
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));

const TEST_KEY = Buffer.alloc(32, 3).toString("base64");

describe("getUserGitHubToken", () => {
	const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

	beforeEach(() => {
		process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
		findUnique.mockReset();
	});

	afterEach(() => {
		if (originalKey === undefined) {
			Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
		} else {
			process.env.TOKEN_ENCRYPTION_KEY = originalKey;
		}
	});

	it("returns the decrypted value for an encrypted stored token", async () => {
		const plain = "gho_realtoken1234567890";
		findUnique.mockResolvedValue({
			githubAccessToken: encryptToken(plain),
			githubTokenExpiresAt: null,
		});

		await expect(getUserGitHubToken("user-1")).resolves.toBe(plain);
	});

	it("returns legacy plaintext unchanged", async () => {
		findUnique.mockResolvedValue({
			githubAccessToken: "gho_legacyplaintext",
			githubTokenExpiresAt: null,
		});

		await expect(getUserGitHubToken("user-1")).resolves.toBe(
			"gho_legacyplaintext"
		);
	});

	it("returns null when no token is stored", async () => {
		findUnique.mockResolvedValue({
			githubAccessToken: null,
			githubTokenExpiresAt: null,
		});

		await expect(getUserGitHubToken("user-1")).resolves.toBeNull();
	});

	it("returns null when the stored token has expired", async () => {
		findUnique.mockResolvedValue({
			githubAccessToken: encryptToken("gho_realtoken"),
			githubTokenExpiresAt: new Date("2000-01-01T00:00:00Z"),
		});

		await expect(getUserGitHubToken("user-1")).resolves.toBeNull();
	});
});
