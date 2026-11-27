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

function googleProfile(
	email: string | null | undefined,
	emailVerified: unknown = true
) {
	return {
		sub: "google-sub-1",
		email: email as string | undefined,
		email_verified: emailVerified,
		name: "Test User",
	};
}

/** Replaces the network: GitHub answers the email-list request with `body`. */
function stubGitHubEmails(body: unknown, init: ResponseInit = { status: 200 }) {
	const fetchMock = vi.fn(() =>
		Promise.resolve(new Response(JSON.stringify(body), init))
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const VERIFIED_NEW_EMAIL = [
	{ email: NEW_EMAIL, primary: true, verified: true },
];

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
	stubGitHubEmails(VERIFIED_NEW_EMAIL);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
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

const EMAIL_NOT_VERIFIED_PATH = "/login?error=EmailNotVerified";

describe("GitHub sign-in needs an account id and a verified address", () => {
	it.each([
		["missing", undefined],
		["null", null],
		["empty", ""],
	])("refuses a profile whose id is %s, before any database or network call", async (_label, id) => {
		const fetchMock = stubGitHubEmails(VERIFIED_NEW_EMAIL);
		const profile = {
			id,
			login: "octo-login",
			email: NEW_EMAIL,
		} as unknown as SignInParams["profile"];

		const { result } = await signInAs(githubAccount(), profile);

		expect(result).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(await userCount()).toBe(0);
	});

	it("refuses a linking sign-in whose profile has no id and changes nothing", async () => {
		const user = await createTestUser();
		const before = await rowById(user.id);
		await installLinkJar(user.id, "github");
		const profile = {
			login: "octo-login",
			email: NEW_EMAIL,
		} as unknown as SignInParams["profile"];

		const { result } = await signInAs(githubAccount(), profile);

		expect(result).toBe(false);
		expect(await rowById(user.id)).toStrictEqual(before);
	});

	it("signs in a user who carries the GitHub id without asking GitHub for the email list", async () => {
		const { target } = await decoyAndLinkedUser({ githubId: "4242" });
		const fetchMock = stubGitHubEmails([]);

		const { result, userId } = await signInAs(
			githubAccount(),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(true);
		expect(userId).toBe(target.id);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("attaches the sign-in to the account with a verified address and keeps its provider", async () => {
		const existing = await createTestUser({ email: NEW_EMAIL });
		const fetchMock = stubGitHubEmails([
			{ email: NEW_EMAIL.toUpperCase(), primary: true, verified: true },
		]);

		const { result, userId } = await signInAs(
			githubAccount(),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(true);
		expect(userId).toBe(existing.id);
		expect(await userCount()).toBe(1);
		const row = await rowById(existing.id);
		expect(row?.githubId).toBe("4242");
		expect(row?.authProvider).toBe("LOCAL");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [, init] = fetchMock.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(init.headers).toMatchObject({
			Authorization: "Bearer gho_test_access_token",
		});
		expect(init.redirect).toBe("manual");
	});

	it("creates a GitHub user when the address is verified and no account has it", async () => {
		const { result } = await signInAs(
			githubAccount(),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(true);
		expect((await rowByEmail(NEW_EMAIL))?.authProvider).toBe("GITHUB");
	});

	it("does not ask GitHub when linking from Settings", async () => {
		const user = await createTestUser();
		await installLinkJar(user.id, "github");
		const fetchMock = stubGitHubEmails([]);

		const { result } = await signInAs(
			githubAccount(),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		[
			"the address is not in the list",
			[{ email: "other@example.test", verified: true }],
		],
		[
			"the address is listed unverified",
			[{ email: NEW_EMAIL, verified: false }],
		],
		["verified is the text true", [{ email: NEW_EMAIL, verified: "true" }]],
		["the body is not a list", { message: "Not Found" }],
	])("refuses and changes nothing when %s", async (_label, body) => {
		const existing = await createTestUser({ email: NEW_EMAIL });
		const before = await rowById(existing.id);
		stubGitHubEmails(body);

		const { result } = await signInAs(
			githubAccount(),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(EMAIL_NOT_VERIFIED_PATH);
		expect(await rowById(existing.id)).toStrictEqual(before);
		expect(await userCount()).toBe(1);
	});

	it("refuses when GitHub answers with an error status", async () => {
		stubGitHubEmails({ message: "Bad credentials" }, { status: 401 });

		const { result } = await signInAs(
			githubAccount(),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(EMAIL_NOT_VERIFIED_PATH);
		expect(await userCount()).toBe(0);
	});

	it("refuses when the request fails", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

		const { result } = await signInAs(
			githubAccount(),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(EMAIL_NOT_VERIFIED_PATH);
		expect(await userCount()).toBe(0);
	});

	it("refuses when the sign-in has no access token, without a request", async () => {
		const fetchMock = stubGitHubEmails(VERIFIED_NEW_EMAIL);

		const { result } = await signInAs(
			githubAccount({ access_token: undefined }),
			githubProfile(NEW_EMAIL, "octo-login")
		);

		expect(result).toBe(EMAIL_NOT_VERIFIED_PATH);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("writes no log entry that carries the address or the token", async () => {
		stubGitHubEmails([{ email: "other@example.test", verified: true }]);
		const logs = captureLogs();
		try {
			await signInAs(githubAccount(), githubProfile(NEW_EMAIL, "octo-login"));
			const text = JSON.stringify(logs.entries);
			expect(text).not.toContain(NEW_EMAIL);
			expect(text).not.toContain("gho_test_access_token");
			expect(text).not.toContain("other@example.test");
		} finally {
			logs.restore();
		}
	});
});

describe("Google sign-in needs an account id and a verified address", () => {
	it.each([
		["missing", undefined],
		["null", null],
		["empty", ""],
	])("refuses a profile whose sub is %s", async (_label, sub) => {
		const profile = {
			...googleProfile(NEW_EMAIL),
			sub,
		} as unknown as SignInParams["profile"];

		const { result } = await signInAs(googleAccount(), profile);

		expect(result).toBe(false);
		expect(await userCount()).toBe(0);
	});

	it("attaches a verified sign-in to the account with that address", async () => {
		const existing = await createTestUser({ email: NEW_EMAIL });

		const result = await authenticateGoogleWithPrisma(googleProfile(NEW_EMAIL));

		expect(result).toStrictEqual({ id: existing.id });
		expect((await rowById(existing.id))?.googleId).toBe("google-sub-1");
	});

	it.each([
		["false", false],
		["missing", undefined],
		["the text true", "true"],
		["the number 1", 1],
	])("refuses when email_verified is %s, and the callback answers the login error", async (_label, flag) => {
		const existing = await createTestUser({ email: NEW_EMAIL });
		const before = await rowById(existing.id);

		const profile = { ...googleProfile(NEW_EMAIL), email_verified: flag };
		const direct = await authenticateGoogleWithPrisma(profile);
		const { result } = await signInAs(googleAccount(), profile);

		expect(direct).toStrictEqual({ refused: "EmailNotVerified" });
		expect(result).toBe(EMAIL_NOT_VERIFIED_PATH);
		expect(await rowById(existing.id)).toStrictEqual(before);
		expect(await userCount()).toBe(1);
	});

	it("refuses an unverified address when no account has it, and creates nobody", async () => {
		const { result } = await signInAs(
			googleAccount(),
			googleProfile(NEW_EMAIL, false)
		);

		expect(result).toBe(EMAIL_NOT_VERIFIED_PATH);
		expect(await userCount()).toBe(0);
	});

	it("signs in a user who carries the Google id whatever the verified flag says", async () => {
		const { target } = await decoyAndLinkedUser({ googleId: "google-sub-1" });

		const result = await authenticateGoogleWithPrisma(
			googleProfile(NEW_EMAIL, false)
		);

		expect(result).toStrictEqual({ id: target.id });
	});

	it("links from Settings without needing a verified address", async () => {
		const user = await createTestUser();
		await installLinkJar(user.id, "google");

		const { result } = await signInAs(
			googleAccount(),
			googleProfile(NEW_EMAIL, false)
		);

		expect(result).toBe(true);
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

describe("signIn callback outside the provider flows", () => {
	it.each([
		["github", githubAccount, githubProfile(NEW_EMAIL, "octo-login")],
		["google", googleAccount, googleProfile(NEW_EMAIL)],
	])("marks the %s user it signs in with that provider", async (provider, account, profile) => {
		const user: NonNullable<SignInParams["user"]> = { id: "placeholder" };

		await signIn({ user, account: account(), profile });

		expect(user.provider).toBe(provider);
	});

	it("refuses a GitHub sign-in that arrives with no profile and creates nobody", async () => {
		const { result } = await signInAs(githubAccount(), undefined);

		expect(result).toBe(false);
		expect(await userCount()).toBe(0);
	});

	it("allows a sign-in with no provider account when the user has an id", async () => {
		const user: NonNullable<SignInParams["user"]> = { id: "some-user-id" };

		await expect(
			signIn({ user, account: null, profile: undefined })
		).resolves.toBe(true);
	});

	it("allows a sign-in with no provider account while a link cookie is present", async () => {
		const owner = await createTestUser();
		await installLinkJar(owner.id, "github");
		const user: NonNullable<SignInParams["user"]> = { id: "some-user-id" };

		await expect(
			signIn({ user, account: null, profile: undefined })
		).resolves.toBe(true);
	});

	it("refuses a sign-in with no provider account and no user id", async () => {
		const user = { id: "" } as NonNullable<SignInParams["user"]>;

		await expect(
			signIn({ user, account: null, profile: undefined })
		).resolves.toBe(false);
	});
});
