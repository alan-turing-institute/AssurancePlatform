import { beforeAll, describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password-service";
import prisma from "@/lib/prisma";
import { captureLogs } from "../helpers/capture-logs";
import {
	DOTTED_CAPITAL_I,
	FULLWIDTH_CAPITAL_A,
	KELVIN_SIGN,
	NO_BREAK_SPACE,
	TRIMMED_WHITESPACE,
} from "../helpers/identifier-characters";
import { createTestUser } from "../utils/prisma-factories";

const PASSWORD_A = "correct horse battery staple";
const PASSWORD_B = "another horse battery stapler";
const AMBIGUOUS_EVENT = "email_lookup_ambiguous";

type Authorize = (
	credentials: Record<string, unknown> | undefined,
	request: unknown
) => Promise<{ id: string } | null>;

let hashA: string;
let hashB: string;

beforeAll(async () => {
	hashA = await hashPassword(PASSWORD_A);
	hashB = await hashPassword(PASSWORD_B);
});

/** The credentials provider's real `authorize`, as the sign-in endpoint calls it. */
function credentialsAuthorize(): Authorize {
	const provider = authOptions.providers.find(
		(candidate) => candidate.id === "credentials"
	) as unknown as { options: { authorize: Authorize } };
	return provider.options.authorize;
}

/** Calls `authorize` directly and returns the signed-in user's id, or null. */
async function signInAs(
	identifier: unknown,
	password: unknown = PASSWORD_A
): Promise<string | null> {
	const user = await credentialsAuthorize()(
		{ username: identifier, password },
		{}
	);
	return user?.id ?? null;
}

function account(
	fields: { email?: string; username?: string },
	passwordHash: string = hashA
) {
	return createTestUser({
		...fields,
		passwordHash,
		passwordAlgorithm: "argon2id",
	});
}

function ambiguityEvents(entries: { msg: string }[]) {
	return entries.filter((entry) => entry.msg === AMBIGUOUS_EVENT);
}

const WHITESPACE_ONLY: ReadonlyArray<readonly [string, string]> = [
	["an empty string", ""],
	...TRIMMED_WHITESPACE.map(
		([label, space]) => [label, space + space] as const
	),
	["a mix of whitespace", ` ${NO_BREAK_SPACE}\t\r\n `],
];

describe("sign-in: whitespace around the identifier is ignored by the server", () => {
	it.each(
		TRIMMED_WHITESPACE
	)("ignores %s around a username", async (_label, pad) => {
		const user = await account({ username: "demo" });

		expect(await signInAs(`${pad}demo${pad}`)).toBe(user.id);
	});

	it.each(
		TRIMMED_WHITESPACE
	)("ignores %s around an email", async (_label, pad) => {
		const user = await account({ email: "demo@example.com" });

		expect(await signInAs(`${pad}demo@example.com${pad}`)).toBe(user.id);
	});

	it("trims before the capital-insensitive email match", async () => {
		const user = await account({ email: "demo@example.com" });

		expect(await signInAs("  Demo@Example.com\t")).toBe(user.id);
	});

	it.each(
		WHITESPACE_ONLY
	)("refuses an identifier of only %s even when an account has that exact username", async (_label, identifier) => {
		await account({ username: identifier });

		expect(await signInAs(identifier)).toBeNull();
	});

	it.each([
		undefined,
		null,
		42,
		true,
		["demo"],
		{ username: "demo" },
	])("refuses a non-string identifier %j", async (identifier) => {
		await account({ username: "demo" });

		expect(await signInAs(identifier)).toBeNull();
	});

	it.each([
		["an empty password", { username: "demo", password: "" }],
		["no password", { username: "demo" }],
		["a null password", { username: "demo", password: null }],
		["no credentials at all", undefined],
	])("refuses %s", async (_label, credentials) => {
		await account({ username: "demo" });

		expect(await credentialsAuthorize()(credentials, {})).toBeNull();
	});
});

describe("sign-in: the password is never trimmed", () => {
	it.each([
		["spaces at both ends", "  spaced pass  "],
		["spaces only", "        "],
		["tabs at both ends", "\tpass\t"],
	])("accepts a stored password of %s only exactly as typed", async (_label, password) => {
		const user = await account(
			{ username: "demo" },
			await hashPassword(password)
		);

		expect(await signInAs("demo", password)).toBe(user.id);
		expect(await signInAs("demo", password.trim())).toBeNull();
	});

	it.each(
		TRIMMED_WHITESPACE
	)("refuses a correct password with %s added to either end", async (_label, pad) => {
		await account({ username: "demo" });

		expect(await signInAs("demo", `${pad}${PASSWORD_A}`)).toBeNull();
		expect(await signInAs("demo", `${PASSWORD_A}${pad}`)).toBeNull();
	});
});

describe("sign-in: an exact match is tried first", () => {
	it("lets a username containing @ win over another account's email that differs in capitals", async () => {
		const byUsername = await account({
			username: "Zed@Org",
			email: "zed-user@example.com",
		});
		const byEmail = await account({ username: "zed-mail", email: "zed@org" });

		expect(await signInAs("Zed@Org")).toBe(byUsername.id);
		expect(await signInAs("zed@org")).toBe(byEmail.id);
	});

	it("does not look for a capital-insensitive email when the exact text matches", async () => {
		await account({ email: "demo@example.com" });
		const logs = captureLogs();

		try {
			await signInAs("demo@example.com");

			expect(ambiguityEvents(logs.entries)).toHaveLength(0);
		} finally {
			logs.restore();
		}
	});
});

describe("sign-in: email matching ignores ASCII capitals only", () => {
	it.each([
		"Demo@Example.com",
		"DEMO@EXAMPLE.COM",
		"dEmO@eXaMpLe.CoM",
	])("reaches demo@example.com when typed %s", async (typed) => {
		const user = await account({ email: "demo@example.com" });

		expect(await signInAs(typed)).toBe(user.id);
	});

	it.each([
		"jane.smith@example.com",
		"JANE.SMITH@EXAMPLE.COM",
		"Jane.Smith@Example.com",
	])("reaches a stored Jane.Smith@Example.com when typed %s", async (typed) => {
		const user = await account({ email: "Jane.Smith@Example.com" });

		expect(await signInAs(typed)).toBe(user.id);
	});

	it("still checks the password when the email is capitalised differently", async () => {
		await account({ email: "demo@example.com" });

		expect(await signInAs("Demo@Example.com", PASSWORD_B)).toBeNull();
	});

	it("does not log an ambiguity when exactly one account matches", async () => {
		await account({ email: "Jane.Smith@Example.com" });
		const logs = captureLogs();

		try {
			await signInAs("jane.smith@example.com");

			expect(ambiguityEvents(logs.entries)).toHaveLength(0);
		} finally {
			logs.restore();
		}
	});

	it.each([
		[
			"a dotted capital I",
			"info@example.com",
			`${DOTTED_CAPITAL_I}nfo@example.com`,
		],
		["a Kelvin sign", "kelvin@example.com", `${KELVIN_SIGN}elvin@example.com`],
		[
			"a fullwidth capital A",
			"abe@example.com",
			`${FULLWIDTH_CAPITAL_A}be@example.com`,
		],
		[
			"a stored dotted capital I",
			`${DOTTED_CAPITAL_I}nfo@example.com`,
			"inFO@example.com",
		],
	])("does not match across %s (non-ASCII capitals do not fold)", async (_label, stored, typed) => {
		await account({ email: stored });

		expect(await signInAs(typed)).toBeNull();
	});

	it("folds the ASCII capitals around a non-ASCII capital", async () => {
		const stored = `${DOTTED_CAPITAL_I}nfo@example.com`;
		const user = await account({ email: stored });

		expect(await signInAs(`${DOTTED_CAPITAL_I}NFO@Example.com`)).toBe(user.id);
	});

	it("does not fold capitals for an identifier without @", async () => {
		const user = await account({ email: "NoAtSign" });

		expect(await signInAs("NoAtSign")).toBe(user.id);
		expect(await signInAs("noatsign")).toBeNull();
	});
});

describe("sign-in: % _ and backslash are ordinary characters in the email match", () => {
	it.each([
		"d_mo@example.com",
		"D_MO@EXAMPLE.COM",
		"%@example.com",
		"de%@example.com",
		"demo@exampl_.com",
		"d\\emo@example.com",
	])("%s reaches no account", async (typed) => {
		await account({ email: "demo@example.com" });
		await account({ email: "first_last@example.com" });

		expect(await signInAs(typed)).toBeNull();
	});

	it.each([
		["first_last@example.com", "First_Last@Example.com"],
		["50%off@example.com", "50%OFF@Example.com"],
		["back\\slash@example.com", "BACK\\slash@example.com"],
	])("reaches stored %s when typed %s", async (stored, typed) => {
		const user = await account({ email: stored });

		expect(await signInAs(typed)).toBe(user.id);
	});

	it.each([
		["backslash@example.com", "Back\\slash@example.com"],
		["50off@example.com", "50%@example.com"],
		["first_last@example.com", "First_@Example.com"],
	])("does not reach stored %s when typed %s", async (stored, typed) => {
		await account({ email: stored });

		expect(await signInAs(typed)).toBeNull();
	});

	it.each([
		"x' OR '1'='1@example.com",
		"x@example.com'; DROP TABLE users; --",
		'"@example.com',
	])("treats %s as text, not as SQL", async (typed) => {
		await account({ email: "demo@example.com" });

		expect(await signInAs(typed)).toBeNull();
		expect(await prisma.user.count()).toBe(1);
	});
});

describe("sign-in: usernames stay exact", () => {
	it.each([
		"Demo",
		"DEMO",
		"dEMO",
	])("does not reach demo when typed %s", async (typed) => {
		await account({ username: "demo" });

		expect(await signInAs(typed)).toBeNull();
	});

	it("does not reach Demo when typed demo", async () => {
		await account({ username: "Demo" });

		expect(await signInAs("demo")).toBeNull();
	});

	it("does not reach a username that contains @ when typed in other capitals", async () => {
		const user = await account({ username: "Pat@Home" });

		expect(await signInAs("Pat@Home")).toBe(user.id);
		expect(await signInAs("pat@home")).toBeNull();
		expect(await signInAs("PAT@HOME")).toBeNull();
	});

	it("signs two accounts Demo and demo in with their own names and passwords", async () => {
		const upper = await account({ username: "Demo" }, hashA);
		const lower = await account({ username: "demo" }, hashB);

		expect(await signInAs("Demo", PASSWORD_A)).toBe(upper.id);
		expect(await signInAs("demo", PASSWORD_B)).toBe(lower.id);
		expect(await signInAs("demo ", PASSWORD_B)).toBe(lower.id);
		expect(await signInAs("Demo", PASSWORD_B)).toBeNull();
		expect(await signInAs("demo", PASSWORD_A)).toBeNull();
		expect(await signInAs("DEMO", PASSWORD_A)).toBeNull();
	});
});

describe("sign-in: two emails that differ only in capitals", () => {
	async function seedTwins() {
		const upper = await account({ email: "Twin@Example.com" }, hashA);
		const lower = await account({ email: "twin@example.com" }, hashB);
		return { upper, lower };
	}

	it("signs each account in with its exact email and its own password", async () => {
		const { upper, lower } = await seedTwins();
		const logs = captureLogs();

		try {
			expect(await signInAs("Twin@Example.com", PASSWORD_A)).toBe(upper.id);
			expect(await signInAs("twin@example.com", PASSWORD_B)).toBe(lower.id);
			expect(await signInAs(" twin@example.com ", PASSWORD_B)).toBe(lower.id);
			expect(ambiguityEvents(logs.entries)).toHaveLength(0);
		} finally {
			logs.restore();
		}
	});

	it("never falls over to the other account when the exact account's password is wrong", async () => {
		await seedTwins();

		expect(await signInAs("Twin@Example.com", PASSWORD_B)).toBeNull();
		expect(await signInAs("twin@example.com", PASSWORD_A)).toBeNull();
	});

	it.each([
		"TWIN@example.com",
		"tWiN@EXAMPLE.com",
	])("refuses %s with either password", async (typed) => {
		await seedTwins();

		expect(await signInAs(typed, PASSWORD_A)).toBeNull();
		expect(await signInAs(typed, PASSWORD_B)).toBeNull();
	});

	it("refuses another capitalisation when three accounts match", async () => {
		await account({ email: "a@x.com" });
		await account({ email: "A@x.com" });
		await account({ email: "a@X.com" });

		expect(await signInAs("A@X.com")).toBeNull();
	});

	it("logs the ambiguity without the typed or stored address", async () => {
		await seedTwins();
		const logs = captureLogs();

		try {
			await signInAs("TWIN@example.com");

			expect(ambiguityEvents(logs.entries)).toHaveLength(1);
			expect(JSON.stringify(logs.entries).toLowerCase()).not.toContain("twin@");
		} finally {
			logs.restore();
		}
	});
});
