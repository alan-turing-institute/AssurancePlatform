import { encode } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	authenticateGoogleWithPrisma,
	authOptions,
	LINK_COOKIE_NAME,
} from "@/lib/auth/config";
import { createLinkIntent } from "@/lib/auth/link-intent";
import { decryptToken, isEncrypted } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";
import { captureLogs } from "../helpers/capture-logs";
import { createTestUser } from "../utils/prisma-factories";

/**
 * GitHub and Google sign-in through the `signIn` callback (and the exported
 * Google function): which user comes back, which row is created or changed,
 * which fields are written, and how the OAuth tokens are stored.
 */

vi.mock("next/headers", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/headers")>()),
	cookies: vi.fn(),
}));

const { cookies } = await import("next/headers");

const NEXTAUTH_SECRET = "auth-provider-sign-in-test-secret";
const PUBLIC_ORIGIN = "https://staging-assuranceplatform.azurewebsites.net";
const SESSION_COOKIE_NAME = "__Secure-next-auth.session-token";
const ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");

const EXPIRES_AT = 1_900_000_000;
const EXPIRES_ISO = "2030-03-17T17:46:40.000Z";
const OLD_LOGIN = new Date("2020-01-01T00:00:00Z");
const OLD_WARNING = new Date("2026-01-01T00:00:00Z");
const NEW_EMAIL = "newcomer@example.test";

const signIn = authOptions.callbacks?.signIn;
if (!signIn) {
	throw new Error("authOptions.callbacks.signIn must be configured");
}
type SignInParams = Parameters<typeof signIn>[0];
type Account = NonNullable<SignInParams["account"]>;

function githubAccount(extra: Partial<Account> = {}): Account {
	return {
		provider: "github",
		type: "oauth",
		providerAccountId: "4242",
		access_token: "gho_test_access_token",
		...extra,
	};
}

function googleAccount(extra: Partial<Account> = {}): Account {
	return {
		provider: "google",
		type: "oauth",
		providerAccountId: "google-sub-1",
		access_token: "ya29_test_access_token",
		refresh_token: "test-refresh-token",
		...extra,
	};
}

function githubProfile(email: string | null | undefined, login?: string) {
	// A provider can send a null email; the callback's profile type does not say so.
	return { id: 4242, login, email: email as string | undefined };
}

function googleProfile(email: string | null | undefined) {
	return {
		sub: "google-sub-1",
		email: email as string | undefined,
		name: "Test User",
	};
}

const signInAs = async (
	account: Account,
	profile: SignInParams["profile"]
): Promise<{ result: boolean | string; userId: string | undefined }> => {
	const user: NonNullable<SignInParams["user"]> = { id: "placeholder" };
	const result = await signIn({ user, account, profile });
	return { result, userId: user.id };
};

function rowByEmail(email: string) {
	return prisma.user.findUnique({ where: { email } });
}

function rowById(id: string) {
	return prisma.user.findUnique({ where: { id } });
}

/** Whether a stored token is in the encrypted form, and what it decrypts to. */
function tokenState(stored: string | null | undefined) {
	if (!stored) {
		return null;
	}
	return { encrypted: isEncrypted(stored), plain: decryptToken(stored) };
}

const GITHUB_STORED = { encrypted: true, plain: "gho_test_access_token" };
const ACCESS_STORED = { encrypted: true, plain: "ya29_test_access_token" };
const REFRESH_STORED = { encrypted: true, plain: "test-refresh-token" };

/** Makes the next sign-in carry a valid link intent and a matching session. */
async function installLinkJar(userId: string, provider: "github" | "google") {
	const store = new Map([
		[LINK_COOKIE_NAME, createLinkIntent({ userId, provider })],
		[
			SESSION_COOKIE_NAME,
			await encode({
				token: { id: userId, sub: userId },
				secret: NEXTAUTH_SECRET,
			}),
		],
	]);
	const jar = {
		get: (name: string) =>
			store.has(name) ? { name, value: store.get(name) } : undefined,
		getAll: () => Array.from(store, ([name, value]) => ({ name, value })),
		delete: vi.fn(),
	};
	vi.mocked(cookies).mockResolvedValue(
		jar as unknown as Awaited<ReturnType<typeof cookies>>
	);
}

/** A decoy created first, then the user who already carries the provider id. */
async function decoyAndLinkedUser(data: Record<string, string | Date>) {
	const decoy = await createTestUser();
	const created = await createTestUser({
		lastLoginAt: OLD_LOGIN,
		retentionWarning30SentAt: OLD_WARNING,
		retentionWarning7SentAt: OLD_WARNING,
	});
	const target = await prisma.user.update({
		where: { id: created.id },
		data,
	});
	return { decoy, target };
}

function userCount() {
	return prisma.user.count();
}

beforeEach(() => {
	vi.mocked(cookies).mockReset();
	vi.stubEnv("TOKEN_ENCRYPTION_KEY", ENCRYPTION_KEY);
	vi.stubEnv("NEXTAUTH_SECRET", NEXTAUTH_SECRET);
	vi.stubEnv("NEXTAUTH_URL", PUBLIC_ORIGIN);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("GitHub sign-in", () => {
	it("creates a user with the GitHub identity and an encrypted token", async () => {
		const { result, userId } = await signInAs(
			githubAccount({ expires_at: EXPIRES_AT }),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(true);
		const row = await rowByEmail(NEW_EMAIL);
		expect(row?.id).toBe(userId);
		expect(row?.username).toBe("octo-login");
		expect(row?.githubId).toBe("4242");
		expect(row?.githubUsername).toBe("octo-login");
		expect(row?.authProvider).toBe("GITHUB");
		expect(tokenState(row?.githubAccessToken)).toStrictEqual(GITHUB_STORED);
		expect(row?.githubTokenExpiresAt?.toISOString()).toBe(EXPIRES_ISO);
	});

	it("uses the email as the username when GitHub gives no login", async () => {
		await signInAs(githubAccount(), githubProfile(NEW_EMAIL));

		expect((await rowByEmail(NEW_EMAIL))?.username).toBe(NEW_EMAIL);
	});

	it("stores no token and no expiry for a new user when none is given", async () => {
		await signInAs(
			githubAccount({ access_token: undefined }),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		const row = await rowByEmail(NEW_EMAIL);
		expect(row?.githubAccessToken).toBeNull();
		expect(row?.githubTokenExpiresAt).toBeNull();
	});

	it.each([
		[undefined],
		[null],
		[""],
	])("refuses a sign-in whose email is %j and creates nobody", async (email) => {
		const logs = captureLogs();
		try {
			const { result } = await signInAs(
				githubAccount(),
				githubProfile(email, "octo-login")
			);

			expect(result).toBe(false);
			expect(
				logs.entries.some(
					(entry) =>
						entry.level === "error" && entry.component === "auth-config"
				)
			).toBe(true);
		} finally {
			logs.restore();
		}
		expect(await userCount()).toBe(0);
	});

	it("signs in the user who carries the GitHub id and updates their record", async () => {
		const { decoy, target } = await decoyAndLinkedUser({ githubId: "4242" });

		const { result, userId } = await signInAs(
			githubAccount({ expires_at: EXPIRES_AT }),
			githubProfile(NEW_EMAIL, "renamed-login")
		);

		expect(result).toBe(true);
		expect(userId).toBe(target.id);
		expect(await userCount()).toBe(2);
		const row = await rowById(target.id);
		expect(row?.githubId).toBe("4242");
		expect(row?.githubUsername).toBe("renamed-login");
		expect(tokenState(row?.githubAccessToken)).toStrictEqual(GITHUB_STORED);
		expect(row?.githubTokenExpiresAt?.toISOString()).toBe(EXPIRES_ISO);
		expect(row?.lastLoginAt?.getTime()).toBeGreaterThan(OLD_LOGIN.getTime());
		expect(row?.retentionWarning30SentAt).toBeNull();
		expect(row?.retentionWarning7SentAt).toBeNull();
		expect((await rowById(decoy.id))?.githubId).toBeNull();
	});

	it("keeps the stored token and expiry when the sign-in brings none", async () => {
		const { target } = await decoyAndLinkedUser({
			githubId: "4242",
			githubAccessToken: "stored-access-token",
			githubTokenExpiresAt: new Date(EXPIRES_ISO),
		});

		await signInAs(
			githubAccount({ access_token: undefined }),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		const row = await rowById(target.id);
		expect(row?.githubAccessToken).toBe("stored-access-token");
		expect(row?.githubTokenExpiresAt?.toISOString()).toBe(EXPIRES_ISO);
	});

	it("links GitHub to the signed-in user without changing their provider", async () => {
		const user = await createTestUser();
		await installLinkJar(user.id, "github");

		const { result, userId } = await signInAs(
			githubAccount({ expires_at: EXPIRES_AT }),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(true);
		expect(userId).toBe(user.id);
		expect(await userCount()).toBe(1);
		const row = await rowById(user.id);
		expect(row?.githubId).toBe("4242");
		expect(row?.githubUsername).toBe("octo-login");
		expect(row?.authProvider).toBe("LOCAL");
		expect(tokenState(row?.githubAccessToken)).toStrictEqual(GITHUB_STORED);
		expect(row?.githubTokenExpiresAt?.toISOString()).toBe(EXPIRES_ISO);
	});

	it("refuses to link a GitHub account that belongs to another user and changes nothing", async () => {
		const owner = await createTestUser();
		await prisma.user.update({
			where: { id: owner.id },
			data: { githubId: "4242" },
		});
		const asker = await createTestUser();
		const before = [await rowById(owner.id), await rowById(asker.id)];
		await installLinkJar(asker.id, "github");

		const { result } = await signInAs(
			githubAccount(),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(false);
		expect([await rowById(owner.id), await rowById(asker.id)]).toStrictEqual(
			before
		);
		expect(await userCount()).toBe(2);
	});
});

describe("Google sign-in", () => {
	it("creates a user named from the email with the Google identity and encrypted tokens", async () => {
		const result = await authenticateGoogleWithPrisma(
			googleProfile("alice@example.test"),
			"ya29_test_access_token",
			"test-refresh-token",
			EXPIRES_AT
		);

		const row = await rowByEmail("alice@example.test");
		expect(result).toStrictEqual({ id: row?.id });
		expect(row?.username).toBe("alice");
		expect(row?.googleId).toBe("google-sub-1");
		expect(row?.googleEmail).toBe("alice@example.test");
		expect(row?.authProvider).toBe("GOOGLE");
		expect(tokenState(row?.googleAccessToken)).toStrictEqual(ACCESS_STORED);
		expect(tokenState(row?.googleRefreshToken)).toStrictEqual(REFRESH_STORED);
		expect(row?.googleTokenExpiresAt?.toISOString()).toBe(EXPIRES_ISO);
	});

	it("stores no tokens and no expiry for a new user when none is given", async () => {
		await authenticateGoogleWithPrisma(googleProfile(NEW_EMAIL));

		const row = await rowByEmail(NEW_EMAIL);
		expect(row?.googleAccessToken).toBeNull();
		expect(row?.googleRefreshToken).toBeNull();
		expect(row?.googleTokenExpiresAt).toBeNull();
	});

	it.each([
		[undefined],
		[null],
		[""],
	])("refuses a sign-in whose email is %j and creates nobody", async (email) => {
		const logs = captureLogs();
		try {
			const result = await authenticateGoogleWithPrisma(googleProfile(email));

			expect(result).toBeNull();
			expect(
				logs.entries.some(
					(entry) =>
						entry.level === "error" && entry.component === "auth-config"
				)
			).toBe(true);
		} finally {
			logs.restore();
		}
		expect(await userCount()).toBe(0);
	});

	it("refuses a Google sign-in that arrives with no profile", async () => {
		const { result } = await signInAs(googleAccount(), undefined);

		expect(result).toBe(false);
		expect(await userCount()).toBe(0);
	});

	it("signs in the user who carries the Google id and updates their record", async () => {
		const { decoy, target } = await decoyAndLinkedUser({
			googleId: "google-sub-1",
		});

		const result = await authenticateGoogleWithPrisma(
			googleProfile(NEW_EMAIL),
			"ya29_test_access_token",
			"test-refresh-token",
			EXPIRES_AT
		);

		expect(result).toStrictEqual({ id: target.id });
		expect(await userCount()).toBe(2);
		const row = await rowById(target.id);
		expect(row?.googleId).toBe("google-sub-1");
		expect(row?.googleEmail).toBe(NEW_EMAIL);
		expect(tokenState(row?.googleAccessToken)).toStrictEqual(ACCESS_STORED);
		expect(tokenState(row?.googleRefreshToken)).toStrictEqual(REFRESH_STORED);
		expect(row?.googleTokenExpiresAt?.toISOString()).toBe(EXPIRES_ISO);
		expect(row?.lastLoginAt?.getTime()).toBeGreaterThan(OLD_LOGIN.getTime());
		expect((await rowById(decoy.id))?.googleId).toBeNull();
	});

	it("keeps the stored tokens and expiry when the sign-in brings none", async () => {
		const { target } = await decoyAndLinkedUser({
			googleId: "google-sub-1",
			googleAccessToken: "stored-access-token",
			googleRefreshToken: "stored-refresh-token",
			googleTokenExpiresAt: new Date(EXPIRES_ISO),
		});

		await authenticateGoogleWithPrisma(googleProfile(NEW_EMAIL));

		const row = await rowById(target.id);
		expect(row?.googleAccessToken).toBe("stored-access-token");
		expect(row?.googleRefreshToken).toBe("stored-refresh-token");
		expect(row?.googleTokenExpiresAt?.toISOString()).toBe(EXPIRES_ISO);
	});

	it("stores a refresh token on its own and an access token on its own", async () => {
		const { target } = await decoyAndLinkedUser({ googleId: "google-sub-1" });

		await authenticateGoogleWithPrisma(
			googleProfile(NEW_EMAIL),
			undefined,
			"test-refresh-token"
		);

		const row = await rowById(target.id);
		expect(row?.googleAccessToken).toBeNull();
		expect(tokenState(row?.googleRefreshToken)).toStrictEqual(REFRESH_STORED);
	});

	it("links Google to the signed-in user without changing their provider", async () => {
		const user = await createTestUser();
		await installLinkJar(user.id, "google");

		const { result, userId } = await signInAs(
			googleAccount({ expires_at: EXPIRES_AT }),
			googleProfile(NEW_EMAIL)
		);

		expect(result).toBe(true);
		expect(userId).toBe(user.id);
		expect(await userCount()).toBe(1);
		const row = await rowById(user.id);
		expect(row?.googleId).toBe("google-sub-1");
		expect(row?.googleEmail).toBe(NEW_EMAIL);
		expect(row?.authProvider).toBe("LOCAL");
		expect(tokenState(row?.googleAccessToken)).toStrictEqual(ACCESS_STORED);
		expect(row?.googleTokenExpiresAt?.toISOString()).toBe(EXPIRES_ISO);
	});

	it("lets a user link the Google account they already have linked", async () => {
		const user = await createTestUser();
		await prisma.user.update({
			where: { id: user.id },
			data: { googleId: "google-sub-1" },
		});
		await installLinkJar(user.id, "google");

		const { result, userId } = await signInAs(
			googleAccount(),
			googleProfile(NEW_EMAIL)
		);

		expect(result).toBe(true);
		expect(userId).toBe(user.id);
		expect((await rowById(user.id))?.googleEmail).toBe(NEW_EMAIL);
	});

	it("refuses to link a Google account that belongs to another user and changes nothing", async () => {
		const owner = await createTestUser();
		await prisma.user.update({
			where: { id: owner.id },
			data: { googleId: "google-sub-1" },
		});
		const asker = await createTestUser();
		const before = [await rowById(owner.id), await rowById(asker.id)];
		await installLinkJar(asker.id, "google");

		const { result } = await signInAs(
			googleAccount(),
			googleProfile(NEW_EMAIL)
		);

		expect(result).toBe(false);
		expect([await rowById(owner.id), await rowById(asker.id)]).toStrictEqual(
			before
		);
		expect(await userCount()).toBe(2);
	});
});

describe("provider token storage without an encryption key in production", () => {
	beforeEach(() => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
	});

	async function droppedFields(run: () => Promise<unknown>) {
		const logs = captureLogs();
		try {
			await run();
			return logs.entries
				.filter((entry) => entry.component === "token-encryption")
				.map((entry) => entry.field);
		} finally {
			logs.restore();
		}
	}

	it("names the GitHub token as the field it did not store, and stores none", async () => {
		const fields = await droppedFields(() =>
			signInAs(githubAccount(), githubProfile(NEW_EMAIL, "octo-login"))
		);

		expect(fields).toStrictEqual(["githubAccessToken"]);
		expect((await rowByEmail(NEW_EMAIL))?.githubAccessToken).toBeNull();
	});

	it("names each Google token as a field it did not store", async () => {
		const fields = await droppedFields(() =>
			authenticateGoogleWithPrisma(
				googleProfile(NEW_EMAIL),
				"ya29_test_access_token",
				"test-refresh-token"
			)
		);

		expect(fields).toStrictEqual(["googleAccessToken", "googleRefreshToken"]);
	});
});
