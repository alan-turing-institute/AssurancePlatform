import { encode } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	authenticateGoogleWithPrisma,
	authOptions,
	LINK_COOKIE_NAME,
} from "@/lib/auth/config";
import { createLinkIntent } from "@/lib/auth/link-intent";
import prisma from "@/lib/prisma";
import { captureLogs } from "../helpers/capture-logs";
import { createTestUser } from "../utils/prisma-factories";

/**
 * A GitHub or Google sign-in is attached to an account by email address only
 * when the provider says the address is verified, and is refused outright when
 * the provider gives no account id. These tests try to get around that rule
 * through the `signIn` callback, with the network replaced by a stand-in.
 */

vi.mock("next/headers", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/headers")>()),
	cookies: vi.fn(),
}));

const { cookies } = await import("next/headers");

const NEXTAUTH_SECRET = "provider-verified-email-test-secret";
const PUBLIC_ORIGIN = "https://staging-assuranceplatform.azurewebsites.net";
const SESSION_COOKIE_NAME = "__Secure-next-auth.session-token";
const ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");

const NOT_VERIFIED_PATH = "/login?error=EmailNotVerified";
const MEMBER_EMAIL = "member.person@example.test";
const OTHER_EMAIL = "someone.else@example.test";
const GITHUB_TOKEN = "gho_made_up_token_for_tests";
const BODY_MARKER = "made-up-github-answer-marker";

const signIn = authOptions.callbacks?.signIn;
if (!signIn) {
	throw new Error("authOptions.callbacks.signIn must be configured");
}
const signInCallback = signIn;
type SignInParams = Parameters<typeof signInCallback>[0];
type Account = NonNullable<SignInParams["account"]>;
type Profile = SignInParams["profile"];
type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------- stand-ins

function stubFetch(handler: FetchHandler) {
	const stand = vi.fn((url: string | URL | Request, init?: RequestInit) =>
		handler(String(url), init)
	);
	vi.stubGlobal("fetch", stand);
	return stand;
}

function listing(body: unknown, init: ResponseInit = { status: 200 }) {
	return Promise.resolve(new Response(JSON.stringify(body), init));
}

function stubList(body: unknown) {
	return stubFetch(() => listing(body));
}

function verifiedEntry(email: string) {
	return { email, primary: true, verified: true, visibility: null };
}

function installJar(entries: Record<string, string>) {
	const store = new Map(Object.entries(entries));
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

async function installLinkJar(userId: string, provider: "github" | "google") {
	installJar({
		[LINK_COOKIE_NAME]: createLinkIntent({ userId, provider }),
		[SESSION_COOKIE_NAME]: await encode({
			token: { id: userId, sub: userId },
			secret: NEXTAUTH_SECRET,
		}),
	});
}

// ------------------------------------------------------------ sign-in calls

interface Attempt {
	id?: unknown;
	token?: string | undefined;
	verified?: unknown;
}

function githubAccount(token: string | undefined): Account {
	return {
		provider: "github",
		type: "oauth",
		providerAccountId: "ignored",
		access_token: token,
	};
}

function googleAccount(): Account {
	return {
		provider: "google",
		type: "oauth",
		providerAccountId: "ignored",
		access_token: "ya29_made_up_access",
		refresh_token: "made-up-refresh",
	};
}

async function callBack(account: Account, profile: Record<string, unknown>) {
	const user: NonNullable<SignInParams["user"]> = { id: "placeholder" };
	const result = await signInCallback({
		user,
		account,
		profile: profile as unknown as Profile,
	});
	return { result, userId: user.id };
}

function githubIn(email: string, attempt: Attempt = {}) {
	const token = "token" in attempt ? attempt.token : GITHUB_TOKEN;
	return callBack(githubAccount(token), {
		id: "id" in attempt ? attempt.id : 7001,
		login: "octo-person",
		email,
	});
}

function googleIn(email: string, attempt: Attempt = {}) {
	return callBack(googleAccount(), {
		sub: "id" in attempt ? attempt.id : "made-up-sub-1",
		email,
		email_verified: "verified" in attempt ? attempt.verified : true,
	});
}

// -------------------------------------------------------------- inspection

function allUsers() {
	return prisma.user.findMany({ orderBy: { createdAt: "asc" } });
}

function rowOf(id: string) {
	return prisma.user.findUniqueOrThrow({ where: { id } });
}

function passwordMember() {
	return createTestUser({ email: MEMBER_EMAIL, authProvider: "LOCAL" });
}

const REFUSED_UNCHANGED = { answer: NOT_VERIFIED_PATH, unchanged: true };

/** What the callback answered, and whether every user row is exactly as it was. */
async function refusal(run: () => Promise<{ result: boolean | string }>) {
	const before = await allUsers();
	const { result } = await run();
	const after = await allUsers();
	return {
		answer: result,
		unchanged: JSON.stringify(after) === JSON.stringify(before),
	};
}

beforeEach(() => {
	vi.mocked(cookies).mockReset();
	vi.mocked(cookies).mockResolvedValue(
		undefined as unknown as Awaited<ReturnType<typeof cookies>>
	);
	vi.stubEnv("TOKEN_ENCRYPTION_KEY", ENCRYPTION_KEY);
	vi.stubEnv("NEXTAUTH_SECRET", NEXTAUTH_SECRET);
	vi.stubEnv("NEXTAUTH_URL", PUBLIC_ORIGIN);
	stubFetch(() => Promise.reject(new Error("no request expected")));
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

// ------------------------------------------------------------------ Google

const NOT_EXACTLY_TRUE: [string, unknown][] = [
	["false", false],
	["undefined", undefined],
	["null", null],
	["the text true", "true"],
	["the text True", "True"],
	["the number 1", 1],
	["the text 1", "1"],
	["an empty object", {}],
	["a list holding true", [true]],
	["the number 0", 0],
];

describe("Google sign-in and the verified flag", () => {
	it.each(
		NOT_EXACTLY_TRUE
	)("refuses an address that matches an account when email_verified is %s", async (_label, verified) => {
		await passwordMember();

		expect(
			await refusal(() => googleIn(MEMBER_EMAIL, { verified }))
		).toStrictEqual(REFUSED_UNCHANGED);
	});

	it.each(
		NOT_EXACTLY_TRUE
	)("creates no user for an unknown address when email_verified is %s", async (_label, verified) => {
		const result = await googleIn(OTHER_EMAIL, { verified });

		expect(result.result).toBe(NOT_VERIFIED_PATH);
		expect(await allUsers()).toHaveLength(0);
	});

	it("attaches a verified address to a password account and keeps it a password account", async () => {
		const member = await passwordMember();

		const { result, userId } = await googleIn(MEMBER_EMAIL);

		expect(result).toBe(true);
		expect(userId).toBe(member.id);
		const row = await rowOf(member.id);
		expect(row.googleId).toBe("made-up-sub-1");
		expect(row.authProvider).toBe("LOCAL");
		expect(row.passwordHash).toBe(member.passwordHash);
		expect(await allUsers()).toHaveLength(1);
	});

	it("creates a Google user for a verified address no account has", async () => {
		const { result, userId } = await googleIn(OTHER_EMAIL);

		expect(result).toBe(true);
		const row = await rowOf(userId as string);
		expect(row.authProvider).toBe("GOOGLE");
		expect(row.email).toBe(OTHER_EMAIL);
	});

	it.each(
		NOT_EXACTLY_TRUE
	)("signs in the user who already carries the Google id when email_verified is %s", async (_label, verified) => {
		const member = await passwordMember();
		await prisma.user.update({
			where: { id: member.id },
			data: { googleId: "made-up-sub-1" },
		});

		const { result, userId } = await googleIn(MEMBER_EMAIL, { verified });

		expect(result).toBe(true);
		expect(userId).toBe(member.id);
	});

	it("stops attaching once the id is carried, so a later unverified sign-in still works", async () => {
		await googleIn(OTHER_EMAIL);
		const before = await allUsers();

		const second = await googleIn(OTHER_EMAIL, { verified: false });

		expect(second.result).toBe(true);
		expect(second.userId).toBe(before[0]?.id);
		expect(await allUsers()).toHaveLength(1);
	});

	it("applies the same rule to the exported function", async () => {
		await passwordMember();
		const before = await allUsers();

		const refused = await authenticateGoogleWithPrisma({
			sub: "made-up-sub-1",
			email: MEMBER_EMAIL,
			email_verified: "true",
		});

		expect(refused).toStrictEqual({ refused: "EmailNotVerified" });
		expect(await allUsers()).toStrictEqual(before);
	});
});

// ------------------------------------------------------------------ GitHub

const FAILED_ANSWERS: [string, FetchHandler][] = [
	[
		"the address is absent",
		() => listing([verifiedEntry("unrelated.address@example.test")]),
	],
	[
		"the address is present but not verified",
		() => listing([{ email: MEMBER_EMAIL, verified: false }]),
	],
	[
		"the verified mark is the text true",
		() => listing([{ email: MEMBER_EMAIL, verified: "true" }]),
	],
	[
		"the verified mark is the number 1",
		() => listing([{ email: MEMBER_EMAIL, verified: 1 }]),
	],
	[
		"the verified mark is missing",
		() => listing([{ email: MEMBER_EMAIL, primary: true }]),
	],
	["the list holds no object", () => listing([null, "text", 3, [true]])],
	["the list is empty", () => listing([])],
	[
		"the answer is an object holding the list",
		() => listing({ emails: [verifiedEntry(MEMBER_EMAIL)] }),
	],
	[
		"the answer is a redirect",
		() =>
			Promise.resolve(
				Response.redirect("https://elsewhere.example/emails", 302)
			),
	],
	[
		"the status is 401",
		() => listing({ message: BODY_MARKER }, { status: 401 }),
	],
	[
		"the status is 403",
		() => listing([verifiedEntry(MEMBER_EMAIL)], { status: 403 }),
	],
	[
		"the status is 500",
		() => listing({ message: BODY_MARKER }, { status: 500 }),
	],
	[
		"the answer is not JSON",
		() => Promise.resolve(new Response(`<html>${BODY_MARKER}</html>`)),
	],
	[
		"the answer is a success with no body",
		() => Promise.resolve(new Response(null, { status: 204 })),
	],
	["the request fails", () => Promise.reject(new TypeError("fetch failed"))],
	[
		"the request times out",
		() => Promise.reject(new DOMException("timed out", "TimeoutError")),
	],
];

describe("GitHub sign-in and the verified email list", () => {
	it.each(
		FAILED_ANSWERS
	)("refuses, with nothing created or changed, when %s", async (_label, handler) => {
		await passwordMember();
		stubFetch(handler);

		const known = await refusal(() => githubIn(MEMBER_EMAIL));
		const unknown = await refusal(() => githubIn(OTHER_EMAIL, { id: 7002 }));
		expect([known, unknown]).toStrictEqual([
			REFUSED_UNCHANGED,
			REFUSED_UNCHANGED,
		]);
		expect(await allUsers()).toHaveLength(1);
	});

	it("refuses when the sign-in carries no access token, without asking GitHub", async () => {
		await passwordMember();
		const stand = stubList([verifiedEntry(MEMBER_EMAIL)]);

		const outcome = await refusal(() =>
			githubIn(MEMBER_EMAIL, { token: undefined })
		);

		expect(outcome).toStrictEqual(REFUSED_UNCHANGED);
		expect(stand).not.toHaveBeenCalled();
	});

	it("refuses when GitHub does not answer before the time limit", async () => {
		await passwordMember();
		stubFetch(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(init.signal?.reason)
					);
				})
		);

		expect(await refusal(() => githubIn(MEMBER_EMAIL))).toStrictEqual(
			REFUSED_UNCHANGED
		);
	}, 20_000);

	it("refuses an address that is verified only on a later page of the list", async () => {
		await passwordMember();
		stubFetch((url) =>
			listing(
				new URL(url).searchParams.get("page") === "2"
					? [verifiedEntry(MEMBER_EMAIL)]
					: [verifiedEntry(OTHER_EMAIL)]
			)
		);

		expect(await refusal(() => githubIn(MEMBER_EMAIL))).toStrictEqual(
			REFUSED_UNCHANGED
		);
	});

	const VERIFIED_LISTS: [string, unknown[]][] = [
		["the same capitals", [verifiedEntry(MEMBER_EMAIL)]],
		["other capitals", [verifiedEntry("MEMBER.Person@Example.TEST")]],
		[
			"the address listed twice, first unverified and then verified",
			[
				{ email: MEMBER_EMAIL, verified: false },
				{ email: MEMBER_EMAIL, verified: true },
			],
		],
		[
			"entries that are not objects ahead of it",
			[null, "text", 3, [], verifiedEntry(MEMBER_EMAIL)],
		],
	];

	it.each(
		VERIFIED_LISTS
	)("attaches to a password account and keeps its provider when the list has %s", async (_label, entries) => {
		const member = await passwordMember();
		stubList(entries);

		const { result, userId } = await githubIn(MEMBER_EMAIL);

		expect(result).toBe(true);
		expect(userId).toBe(member.id);
		const row = await rowOf(member.id);
		expect(row.githubId).toBe("7001");
		expect(row.authProvider).toBe("LOCAL");
		expect(row.passwordHash).toBe(member.passwordHash);
		expect(await allUsers()).toHaveLength(1);
	});

	it("creates a GitHub user for a verified address no account has", async () => {
		stubList([verifiedEntry(OTHER_EMAIL)]);

		const { result, userId } = await githubIn(OTHER_EMAIL);

		expect(result).toBe(true);
		expect((await rowOf(userId as string)).authProvider).toBe("GITHUB");
	});

	it("asks GitHub once, with the sign-in's own token in the header only", async () => {
		await passwordMember();
		const stand = stubList([verifiedEntry(MEMBER_EMAIL)]);

		await githubIn(MEMBER_EMAIL);

		expect(stand).toHaveBeenCalledTimes(1);
		const [url, init] = stand.mock.calls[0] as [string, RequestInit];
		expect(new URL(String(url)).hostname).toBe("api.github.com");
		expect(String(url)).not.toContain(GITHUB_TOKEN);
		expect(JSON.stringify(init?.headers)).toContain(`Bearer ${GITHUB_TOKEN}`);
	});

	it.each([
		["a list that does not contain the address", [verifiedEntry(OTHER_EMAIL)]],
		[
			"a list where it is unverified",
			[{ email: MEMBER_EMAIL, verified: false }],
		],
	])("signs in the user who already carries the GitHub id with %s, asking nothing", async (_label, entries) => {
		const member = await passwordMember();
		await prisma.user.update({
			where: { id: member.id },
			data: { githubId: "7001" },
		});
		const stand = stubList(entries);

		const { result, userId } = await githubIn(MEMBER_EMAIL);

		expect(result).toBe(true);
		expect(userId).toBe(member.id);
		expect(stand).not.toHaveBeenCalled();
	});

	it("signs in the carrier of the id even when the profile now shows a different address", async () => {
		const member = await passwordMember();
		await prisma.user.update({
			where: { id: member.id },
			data: { githubId: "7001" },
		});
		const stand = stubList([]);

		const { result, userId } = await githubIn(OTHER_EMAIL);

		expect(result).toBe(true);
		expect(userId).toBe(member.id);
		expect((await rowOf(member.id)).email).toBe(MEMBER_EMAIL);
		expect(stand).not.toHaveBeenCalled();
	});

	it("asks GitHub for the first sign-in only; a second one by id needs no answer", async () => {
		const stand = stubList([verifiedEntry(OTHER_EMAIL)]);
		const first = await githubIn(OTHER_EMAIL);
		stubFetch(() => Promise.reject(new Error("no request expected")));

		const second = await githubIn(OTHER_EMAIL);

		expect(first.result).toBe(true);
		expect(second.result).toBe(true);
		expect(second.userId).toBe(first.userId);
		expect(stand).toHaveBeenCalledTimes(1);
		expect(await allUsers()).toHaveLength(1);
	});
});

// --------------------------------------------------------- missing account id

const MISSING_IDS: [string, unknown][] = [
	["missing", undefined],
	["null", null],
	["empty", ""],
];

describe("a sign-in with no account id", () => {
	it.each(
		MISSING_IDS
	)("is refused for GitHub when the id is %s, on the ordinary path", async (_label, id) => {
		await passwordMember();
		const before = await allUsers();
		const stand = stubList([verifiedEntry(MEMBER_EMAIL)]);

		const { result } = await githubIn(MEMBER_EMAIL, { id });

		expect(result).toBe(false);
		expect(await allUsers()).toStrictEqual(before);
		expect(stand).not.toHaveBeenCalled();
	});

	it.each(
		MISSING_IDS
	)("is refused for Google when the id is %s, on the ordinary path", async (_label, id) => {
		await passwordMember();
		const before = await allUsers();

		const { result } = await googleIn(MEMBER_EMAIL, { id });

		expect(result).toBe(false);
		expect(await allUsers()).toStrictEqual(before);
	});

	it.each(
		MISSING_IDS
	)("is refused for GitHub when the id is %s, even with a valid link intent", async (_label, id) => {
		const member = await passwordMember();
		const before = await allUsers();
		await installLinkJar(member.id, "github");

		const { result } = await githubIn(MEMBER_EMAIL, { id });

		expect(result).toBe(false);
		expect(await allUsers()).toStrictEqual(before);
	});

	it.each(
		MISSING_IDS
	)("is refused for Google when the id is %s, even with a valid link intent", async (_label, id) => {
		const member = await passwordMember();
		const before = await allUsers();
		await installLinkJar(member.id, "google");

		const { result } = await googleIn(MEMBER_EMAIL, { id });

		expect(result).toBe(false);
		expect(await allUsers()).toStrictEqual(before);
	});

	it("does not give an unverified user a way in by sending a null id", async () => {
		const { result } = await githubIn(OTHER_EMAIL, { id: null });

		expect(result).toBe(false);
		expect(await allUsers()).toHaveLength(0);
	});
});

// ------------------------------------------------------------------ linking

describe("linking from Settings", () => {
	it("links Google although the flag is not true, with no verified check", async () => {
		const member = await passwordMember();
		await installLinkJar(member.id, "google");

		const { result, userId } = await googleIn(MEMBER_EMAIL, {
			verified: "true",
		});

		expect(result).toBe(true);
		expect(userId).toBe(member.id);
		expect((await rowOf(member.id)).googleId).toBe("made-up-sub-1");
	});

	it("links GitHub without asking GitHub for the email list", async () => {
		const member = await passwordMember();
		await installLinkJar(member.id, "github");
		const stand = stubList([]);

		const { result } = await githubIn(OTHER_EMAIL);

		expect(result).toBe(true);
		expect((await rowOf(member.id)).githubId).toBe("7001");
		expect((await rowOf(member.id)).authProvider).toBe("LOCAL");
		expect(stand).not.toHaveBeenCalled();
	});

	it("still refuses a provider account that belongs to another user", async () => {
		const owner = await createTestUser();
		await prisma.user.update({
			where: { id: owner.id },
			data: { githubId: "7001", googleId: "made-up-sub-1" },
		});
		const member = await passwordMember();
		await installLinkJar(member.id, "github");
		const before = await allUsers();

		const viaGitHub = await githubIn(MEMBER_EMAIL);
		await installLinkJar(member.id, "google");
		const viaGoogle = await googleIn(MEMBER_EMAIL);

		expect([viaGitHub.result, viaGoogle.result]).toStrictEqual([false, false]);
		expect(await allUsers()).toStrictEqual(before);
	});
});

// --------------------------------------------------------------------- logs

describe("what the log records", () => {
	const SECRET_THROW: FetchHandler = () =>
		Promise.reject(new Error(`request failed for ${GITHUB_TOKEN}`));

	it.each([
		["a bad status", () => listing({ message: BODY_MARKER }, { status: 500 })],
		["a bad body", () => listing({ message: BODY_MARKER })],
		[
			"an address that is not verified",
			() =>
				listing([{ email: MEMBER_EMAIL, verified: false, note: BODY_MARKER }]),
		],
		["a failed request that names the token", SECRET_THROW],
	])("leaves out the address, the token and GitHub's answer on %s", async (_label, handler) => {
		await passwordMember();
		stubFetch(handler);
		const logs = captureLogs();
		try {
			await githubIn(MEMBER_EMAIL);
			await githubIn(MEMBER_EMAIL, { token: undefined });
		} finally {
			logs.restore();
		}

		const text = JSON.stringify(logs.entries);
		expect(text).not.toContain(MEMBER_EMAIL);
		expect(text).not.toContain(GITHUB_TOKEN);
		expect(text).not.toContain(BODY_MARKER);
	});

	it("leaves out the address on a Google refusal and on a verified sign-in of either provider", async () => {
		await passwordMember();
		stubList([verifiedEntry(MEMBER_EMAIL)]);
		const logs = captureLogs();
		try {
			await googleIn(MEMBER_EMAIL, { verified: "true" });
			await googleIn(OTHER_EMAIL);
			await githubIn(MEMBER_EMAIL);
		} finally {
			logs.restore();
		}

		const text = JSON.stringify(logs.entries);
		expect(text).not.toContain(MEMBER_EMAIL);
		expect(text).not.toContain(OTHER_EMAIL);
		expect(text).not.toContain(GITHUB_TOKEN);
	});
});
