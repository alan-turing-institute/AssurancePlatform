import { encode } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authOptions, LINK_COOKIE_NAME } from "@/lib/auth/config";
import { createLinkIntent } from "@/lib/auth/link-intent";
import prisma from "@/lib/prisma";
import type { User } from "@/src/generated/prisma";
import { captureLogs } from "../helpers/capture-logs";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Exercises `authOptions.callbacks.signIn` (lib/auth/config.ts) directly —
 * the OAuth account-linking guard described on the linked issue. Covers both
 * GitHub and Google for: a valid intent bound to the caller's own session
 * (linked), a forged pre-fix raw-user-id cookie, a valid intent whose caller
 * session belongs to someone else, a valid intent with no session at all, an
 * expired intent, and an intent issued for the other provider — each of the
 * five rejection cases asserted to leave both rows byte-for-byte unchanged.
 */

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { cookies } = await import("next/headers");

const TEST_NEXTAUTH_SECRET = "auth-link-intent-integration-test-secret";
const PUBLIC_ORIGIN = "https://staging-assuranceplatform.azurewebsites.net";
const SESSION_COOKIE_NAME = "__Secure-next-auth.session-token";

const signIn = authOptions.callbacks?.signIn;
if (!signIn) {
	throw new Error("authOptions.callbacks.signIn must be configured");
}
type SignInParams = Parameters<typeof signIn>[0];

interface MockCookieJar {
	delete: (name: string) => void;
	get: (name: string) => { name: string; value: string } | undefined;
	getAll: () => { name: string; value: string }[];
}

function mockCookieJar(entries: Record<string, string>): MockCookieJar {
	const store = new Map(Object.entries(entries));
	return {
		get: (name) =>
			store.has(name) ? { name, value: store.get(name) as string } : undefined,
		getAll: () => Array.from(store, ([name, value]) => ({ name, value })),
		delete: vi.fn((name: string) => {
			store.delete(name);
		}),
	};
}

async function mintSessionToken(userId: string): Promise<string> {
	return await encode({
		token: { id: userId, sub: userId },
		secret: TEST_NEXTAUTH_SECRET,
	});
}

/** Builds the request-cookie jar `signIn` reads: the link cookie (if any) and a session cookie (if any). */
async function jarWith(opts: {
	linkIntent?: string;
	sessionUserId?: string;
}): Promise<MockCookieJar> {
	const entries: Record<string, string> = {};
	if (opts.linkIntent !== undefined) {
		entries[LINK_COOKIE_NAME] = opts.linkIntent;
	}
	if (opts.sessionUserId !== undefined) {
		entries[SESSION_COOKIE_NAME] = await mintSessionToken(opts.sessionUserId);
	}
	return mockCookieJar(entries);
}

function installJar(jar: MockCookieJar): void {
	vi.mocked(cookies).mockResolvedValue(
		jar as unknown as Awaited<ReturnType<typeof cookies>>
	);
}

async function snapshotUser(id: string): Promise<User | null> {
	return await prisma.user.findUnique({ where: { id } });
}

interface ProviderFixture {
	buildAccount: (providerAccountId: string) => SignInParams["account"];
	buildProfile: (
		providerAccountId: string,
		email: string
	) => SignInParams["profile"];
	/** The value `idField` ends up holding after a successful link — GitHub's
	 * linker stores `profile.id` (numeric), not the raw provider account id. */
	expectedIdFieldValue: (providerAccountId: string) => string;
	idField: "githubId" | "googleId";
	name: "github" | "google";
}

const PROVIDERS: ProviderFixture[] = [
	{
		name: "github",
		idField: "githubId",
		buildAccount: (providerAccountId) => ({
			provider: "github",
			type: "oauth",
			providerAccountId,
			access_token: `gho_${providerAccountId}`,
		}),
		buildProfile: (providerAccountId, email) => ({
			id: Number.parseInt(providerAccountId.replace(/\D/g, "") || "1", 10),
			login: `octocat-${providerAccountId}`,
			email,
		}),
		expectedIdFieldValue: (providerAccountId) =>
			String(Number.parseInt(providerAccountId.replace(/\D/g, "") || "1", 10)),
	},
	{
		name: "google",
		idField: "googleId",
		buildAccount: (providerAccountId) => ({
			provider: "google",
			type: "oauth",
			providerAccountId,
			access_token: `ya29_${providerAccountId}`,
			refresh_token: `refresh_${providerAccountId}`,
		}),
		buildProfile: (providerAccountId, email) => ({
			sub: providerAccountId,
			email,
			name: "Test User",
		}),
		expectedIdFieldValue: (providerAccountId) => providerAccountId,
	},
];

describe.each(PROVIDERS)("signIn account linking — $name", (fixture) => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("NEXTAUTH_SECRET", TEST_NEXTAUTH_SECRET);
		vi.stubEnv("NEXTAUTH_URL", PUBLIC_ORIGIN);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("links the provider account when the intent is valid and the caller's session matches", async () => {
		const user = await createTestUser();
		const intent = createLinkIntent({
			userId: user.id,
			provider: fixture.name,
		});
		const jar = await jarWith({ linkIntent: intent, sessionUserId: user.id });
		installJar(jar);

		const authUser: NonNullable<SignInParams["user"]> = { id: "placeholder" };
		const result = await signIn({
			user: authUser,
			account: fixture.buildAccount("acct-linked"),
			profile: fixture.buildProfile("acct-linked", user.email),
		});

		expect(result).toBe(true);
		expect(authUser.id).toBe(user.id);
		const updated = await snapshotUser(user.id);
		expect(updated?.[fixture.idField]).toBe(
			fixture.expectedIdFieldValue("acct-linked")
		);
		expect(jar.delete).toHaveBeenCalledWith(LINK_COOKIE_NAME);
	});

	it("rejects a forged pre-fix raw-user-id cookie, leaving both rows unchanged", async () => {
		const attacker = await createTestUser();
		const target = await createTestUser();
		const before = {
			attacker: await snapshotUser(attacker.id),
			target: await snapshotUser(target.id),
		};
		// The pre-fix cookie held the raw target user id with no signature at
		// all — exactly what an attacker could still send today.
		const jar = await jarWith({
			linkIntent: target.id,
			sessionUserId: attacker.id,
		});
		installJar(jar);

		const logs = captureLogs();
		let result: string | boolean;
		try {
			result = await signIn({
				user: { id: "placeholder" },
				account: fixture.buildAccount("acct-forged"),
				profile: fixture.buildProfile("acct-forged", attacker.email),
			});
			expect(result).toBe(false);
			expect(
				logs.entries.some(
					(entry) =>
						entry.level === "warn" && entry.reason === "link-intent-invalid"
				)
			).toBe(true);
		} finally {
			logs.restore();
		}

		expect(await snapshotUser(attacker.id)).toEqual(before.attacker);
		expect(await snapshotUser(target.id)).toEqual(before.target);
	});

	it("rejects a valid intent whose caller session belongs to a different user, leaving both rows unchanged", async () => {
		const userA = await createTestUser();
		const userB = await createTestUser();
		const before = {
			a: await snapshotUser(userA.id),
			b: await snapshotUser(userB.id),
		};
		const intent = createLinkIntent({
			userId: userA.id,
			provider: fixture.name,
		});
		const jar = await jarWith({ linkIntent: intent, sessionUserId: userB.id });
		installJar(jar);

		const logs = captureLogs();
		try {
			const result = await signIn({
				user: { id: "placeholder" },
				account: fixture.buildAccount("acct-mismatch"),
				profile: fixture.buildProfile("acct-mismatch", userB.email),
			});
			expect(result).toBe(false);
			expect(
				logs.entries.some(
					(entry) =>
						entry.level === "warn" &&
						entry.reason === "link-intent-session-mismatch"
				)
			).toBe(true);
		} finally {
			logs.restore();
		}

		expect(await snapshotUser(userA.id)).toEqual(before.a);
		expect(await snapshotUser(userB.id)).toEqual(before.b);
	});

	it("rejects a valid intent with no session cookie present, leaving the row unchanged", async () => {
		const user = await createTestUser();
		const before = await snapshotUser(user.id);
		const intent = createLinkIntent({
			userId: user.id,
			provider: fixture.name,
		});
		const jar = await jarWith({ linkIntent: intent });
		installJar(jar);

		const result = await signIn({
			user: { id: "placeholder" },
			account: fixture.buildAccount("acct-no-session"),
			profile: fixture.buildProfile("acct-no-session", user.email),
		});

		expect(result).toBe(false);
		expect(await snapshotUser(user.id)).toEqual(before);
	});

	it("rejects an expired intent, leaving the row unchanged", async () => {
		const user = await createTestUser();
		const before = await snapshotUser(user.id);

		// Mint the intent under a long-past fake clock, then return to real
		// time — the DB calls above and below run against the real clock
		// throughout; only the token's `exp` is backdated.
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
		const intent = createLinkIntent({
			userId: user.id,
			provider: fixture.name,
		});
		vi.useRealTimers();

		const jar = await jarWith({ linkIntent: intent, sessionUserId: user.id });
		installJar(jar);

		const logs = captureLogs();
		try {
			const result = await signIn({
				user: { id: "placeholder" },
				account: fixture.buildAccount("acct-expired"),
				profile: fixture.buildProfile("acct-expired", user.email),
			});
			expect(result).toBe(false);
			expect(
				logs.entries.some(
					(entry) =>
						entry.level === "warn" && entry.reason === "link-intent-invalid"
				)
			).toBe(true);
		} finally {
			logs.restore();
		}

		expect(await snapshotUser(user.id)).toEqual(before);
	});

	it("rejects an intent issued for the other provider, leaving the row unchanged", async () => {
		const otherProvider = fixture.name === "github" ? "google" : "github";
		const user = await createTestUser();
		const before = await snapshotUser(user.id);
		const intent = createLinkIntent({
			userId: user.id,
			provider: otherProvider,
		});
		const jar = await jarWith({ linkIntent: intent, sessionUserId: user.id });
		installJar(jar);

		const result = await signIn({
			user: { id: "placeholder" },
			account: fixture.buildAccount("acct-wrong-provider"),
			profile: fixture.buildProfile("acct-wrong-provider", user.email),
		});

		expect(result).toBe(false);
		expect(await snapshotUser(user.id)).toEqual(before);
	});
});

describe("signIn account linking — non-OAuth sign-in with a stray intent cookie", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("NEXTAUTH_SECRET", TEST_NEXTAUTH_SECRET);
		vi.stubEnv("NEXTAUTH_URL", PUBLIC_ORIGIN);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("signs in normally and deletes the cookie without verifying it, when a valid github intent is present but the sign-in is credentials", async () => {
		const user = await createTestUser();
		const before = await snapshotUser(user.id);
		// An abandoned "link GitHub" attempt: the intent is valid and still
		// unexpired, but this sign-in is a plain username/password one.
		const intent = createLinkIntent({ userId: user.id, provider: "github" });
		const jar = await jarWith({ linkIntent: intent, sessionUserId: user.id });
		installJar(jar);

		const logs = captureLogs();
		let result: string | boolean;
		try {
			result = await signIn({
				user: { id: user.id, name: user.username, email: user.email },
				account: {
					provider: "credentials",
					type: "credentials",
					providerAccountId: user.id,
				},
			});
			expect(result).toBe(true);
			expect(
				logs.entries.some(
					(entry) =>
						entry.reason === "link-intent-invalid" ||
						entry.reason === "link-intent-session-mismatch"
				)
			).toBe(false);
		} finally {
			logs.restore();
		}

		expect(jar.delete).toHaveBeenCalledWith(LINK_COOKIE_NAME);
		expect(await snapshotUser(user.id)).toEqual(before);
	});
});
