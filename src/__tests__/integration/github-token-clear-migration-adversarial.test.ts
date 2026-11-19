import { readFileSync } from "node:fs";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authOptions, LINK_COOKIE_NAME } from "@/lib/auth/config";
import { createLinkIntent } from "@/lib/auth/link-intent";
import { decryptToken, encryptToken } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";
import { hasGitHubToken } from "@/lib/services/github-api-service";
import type { User } from "@/src/generated/prisma";

/**
 * Pins `prisma/migrations/20261108120000_clear_github_access_tokens`, which
 * removes every stored GitHub access token at release. It runs the migration
 * file's own SQL (the text `prisma migrate deploy` applies) against rows
 * written with `prisma` directly, and compares whole rows before and after so
 * a column the migration should not touch cannot change unnoticed.
 */
const { cookieJar } = vi.hoisted(() => ({
	cookieJar: {} as Record<string, string>,
}));

vi.mock("next/headers", () => ({
	cookies: vi.fn().mockResolvedValue({
		get: (name: string) =>
			name in cookieJar ? { name, value: cookieJar[name] } : undefined,
		delete: (name: string) => Reflect.deleteProperty(cookieJar, name),
		getAll: () =>
			Object.entries(cookieJar).map(([name, value]) => ({ name, value })),
	}),
}));

const SECRET = "github-token-clear-test-secret";
const ORIGIN = "https://tea.example.test";
const SESSION_COOKIE_NAME = "__Secure-next-auth.session-token";

const MIGRATION_SQL = readFileSync(
	path.join(
		import.meta.dirname,
		"../../../prisma/migrations/20261108120000_clear_github_access_tokens/migration.sql"
	),
	"utf8"
);

type UserData = Omit<
	Parameters<typeof prisma.user.create>[0]["data"],
	"email" | "username"
>;

let counter = 0;

function seedUser(data: UserData = {}): Promise<User> {
	counter += 1;
	return prisma.user.create({
		data: {
			email: `github-clear-${counter}@example.test`,
			username: `github-clear-${counter}`,
			...data,
		},
	});
}

function runMigration(): Promise<number> {
	return prisma.$executeRawUnsafe(MIGRATION_SQL);
}

async function reload(user: User): Promise<User> {
	return await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}

function githubUser(overrides: UserData = {}): Promise<User> {
	counter += 1;
	return seedUser({
		githubId: `gh-${counter}`,
		githubUsername: `octo-${counter}`,
		githubAccessToken: encryptToken(`gho_token_${counter}`),
		githubTokenExpiresAt: new Date("2031-01-01T00:00:00Z"),
		...overrides,
	});
}

const WITHOUT_TOKEN = { githubAccessToken: null, githubTokenExpiresAt: null };

// A value other than the column default for every non-token column a careless
// statement might reset, so a changed value shows up in the whole-row compare.
const NON_DEFAULT_PROFILE: UserData = {
	avatarUrl: "https://avatars.example.test/octo.png",
	completedTours: ["welcome", "dashboard"],
	defaultCaseMode: "ADVANCED",
	hasSeenMigrationNotice: true,
	isSystemUser: true,
	passwordAlgorithm: "argon2id",
	passwordResetExpires: new Date("2031-05-05T00:00:00Z"),
	passwordResetTokenHash: "reset-token-hash",
	retentionWarning30SentAt: new Date("2026-09-01T00:00:00Z"),
	retentionWarning7SentAt: new Date("2026-09-24T00:00:00Z"),
	sessionVersion: 7,
	showUnsupportedMarkers: false,
};

function githubSignIn(user: User, accessToken: string) {
	const signIn = authOptions.callbacks?.signIn;
	if (!signIn) {
		throw new Error("authOptions.callbacks.signIn must be configured");
	}
	return signIn({
		user: { id: "", email: user.email },
		account: {
			provider: "github",
			type: "oauth",
			providerAccountId: String(user.githubId),
			access_token: accessToken,
		},
		profile: {
			id: user.githubId,
			login: user.githubUsername,
			email: user.email,
		},
	} as Parameters<typeof signIn>[0]);
}

beforeEach(() => {
	counter = 0;
	for (const [name] of Object.entries(cookieJar)) {
		Reflect.deleteProperty(cookieJar, name);
	}
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("clear_github_access_tokens migration", () => {
	it("clears the token and its expiry for every user who has one, keeping the GitHub id and username", async () => {
		const withExpiry = await githubUser();
		const withoutExpiry = await githubUser({ githubTokenExpiresAt: null });
		const alreadyExpired = await githubUser({
			githubTokenExpiresAt: new Date("2020-01-01T00:00:00Z"),
		});
		const legacyPlaintext = await githubUser({
			githubAccessToken: "gho_unencrypted_legacy_value",
		});

		const cleared = await runMigration();

		expect(cleared).toBe(4);
		for (const before of [
			withExpiry,
			withoutExpiry,
			alreadyExpired,
			legacyPlaintext,
		]) {
			const after = await reload(before);
			expect(after.githubAccessToken).toBeNull();
			expect(after.githubTokenExpiresAt).toBeNull();
			expect(after.githubId).toBe(before.githubId);
			expect(after.githubUsername).toBe(before.githubUsername);
		}
	});

	it("changes nothing but those two columns on a row it clears", async () => {
		const before = await githubUser({
			authProvider: "GITHUB",
			firstName: "Octo",
			lastName: "Cat",
			emailVerified: true,
			lastLoginAt: new Date("2026-10-01T09:00:00Z"),
			...NON_DEFAULT_PROFILE,
		});

		await runMigration();

		expect(await reload(before)).toEqual({ ...before, ...WITHOUT_TOKEN });
	});

	it("leaves Google's columns alone, on a user who has both a GitHub and a Google token", async () => {
		const before = await githubUser({
			googleId: "google-both",
			googleEmail: "both@example.test",
			googleAccessToken: encryptToken("ya29.google-access"),
			googleRefreshToken: encryptToken("1//google-refresh"),
			googleTokenExpiresAt: new Date("2031-02-02T00:00:00Z"),
		});
		const googleOnly = await seedUser({
			authProvider: "GOOGLE",
			googleId: "google-only",
			googleEmail: "google-only@example.test",
			googleAccessToken: encryptToken("ya29.google-only"),
			googleRefreshToken: encryptToken("1//google-only-refresh"),
			googleTokenExpiresAt: new Date("2031-03-03T00:00:00Z"),
		});

		await runMigration();

		expect(await reload(before)).toEqual({ ...before, ...WITHOUT_TOKEN });
		expect(await reload(googleOnly)).toEqual(googleOnly);
	});

	it("leaves a user with no GitHub token exactly as they were, and counts only the users it cleared", async () => {
		const local = await seedUser({ passwordHash: "a-hash" });
		const githubIdOnly = await seedUser({
			githubId: "gh-id-only",
			githubUsername: "id-only",
			authProvider: "GITHUB",
		});
		const holder = await githubUser();

		const cleared = await runMigration();

		expect(cleared).toBe(1);
		expect(await reload(local)).toEqual(local);
		expect(await reload(githubIdOnly)).toEqual(githubIdOnly);
		expect((await reload(holder)).githubAccessToken).toBeNull();
	});

	it("is safe to run twice: the second run changes no row", async () => {
		await githubUser();
		await githubUser({ githubTokenExpiresAt: null });
		await seedUser();

		const firstRun = await runMigration();
		const afterFirst = await prisma.user.findMany({
			orderBy: { email: "asc" },
		});
		const secondRun = await runMigration();
		const afterSecond = await prisma.user.findMany({
			orderBy: { email: "asc" },
		});

		expect(firstRun).toBe(2);
		expect(secondRun).toBe(0);
		expect(afterSecond).toEqual(afterFirst);
	});

	it("runs on a database with no GitHub tokens and reports zero rows cleared", async () => {
		await seedUser();

		expect(await runMigration()).toBe(0);
	});

	it("is recorded as applied by the migrate-deploy run every test database is built with", async () => {
		const rows = await prisma.$queryRaw<{ finished_at: Date | null }[]>`
			SELECT finished_at FROM _prisma_migrations
			WHERE migration_name = '20261108120000_clear_github_access_tokens'`;

		expect(rows).toHaveLength(1);
		expect(rows[0]?.finished_at).not.toBeNull();
	});
});

describe("after the clear", () => {
	it("reports GitHub as not connected, although the GitHub id is still on file", async () => {
		const user = await githubUser();
		expect(await hasGitHubToken(user.id)).toBe(true);

		await runMigration();

		expect(await hasGitHubToken(user.id)).toBe(false);
		expect((await reload(user)).githubId).toBe(user.githubId);
	});

	it("lets the same person sign in with GitHub, on the same account, and stores a fresh token", async () => {
		const user = await githubUser({ authProvider: "GITHUB" });
		await runMigration();

		const allowed = await githubSignIn(user, "gho_fresh_narrow_token");

		expect(allowed).toBe(true);
		expect(await prisma.user.count()).toBe(1);
		const after = await reload(user);
		expect(after.id).toBe(user.id);
		expect(after.githubId).toBe(user.githubId);
		expect(after.githubAccessToken).not.toBeNull();
		expect(await hasGitHubToken(user.id)).toBe(true);
	});

	it("lets the person reconnect from a signed-in session, on the same account, with a fresh token", async () => {
		vi.stubEnv("NEXTAUTH_SECRET", SECRET);
		vi.stubEnv("NEXTAUTH_URL", ORIGIN);
		const user = await githubUser();
		await runMigration();
		cookieJar[LINK_COOKIE_NAME] = createLinkIntent({
			userId: user.id,
			provider: "github",
		});
		cookieJar[SESSION_COOKIE_NAME] = await encode({
			token: { id: user.id, sub: user.id },
			secret: SECRET,
		});

		const allowed = await githubSignIn(user, "gho_reconnected_narrow_token");

		expect(allowed).toBe(true);
		expect(await prisma.user.count()).toBe(1);
		const after = await reload(user);
		expect(after.githubId).toBe(user.githubId);
		expect(decryptToken(after.githubAccessToken as string)).toBe(
			"gho_reconnected_narrow_token"
		);
		expect(await hasGitHubToken(user.id)).toBe(true);
	});
});
