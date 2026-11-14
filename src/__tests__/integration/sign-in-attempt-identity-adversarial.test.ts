import { describe, expect, it } from "vitest";
import { extractClientIp } from "@/lib/auth/extract-client-ip";
import prisma from "@/lib/prisma";
import { captureLogs } from "../helpers/capture-logs";
import {
	account,
	addressWarnings,
	at,
	attempt,
	attemptRows,
	failures,
	failuresAcrossNames,
	nth,
	PASSWORD,
	pauseEvents,
	rowsPerName,
	type SignInRequest,
	sameAddress,
	storedIdentifiers,
	tenWrongThenPaused,
	times,
	WRONG_PASSWORD,
} from "../utils/sign-in-attempts-kit";

const ADDRESS = "203.0.113.9";
const SHA256_HEX = /^[0-9a-f]{64}$/;

describe("sign-in limit: padded and separate names", () => {
	it.each([
		["a space", " demo "],
		["a tab and a line feed", "\tdemo\n"],
		["a carriage return", "demo\r"],
	])("counts a username padded with %s as the same name", async (_label, padded) => {
		await account({ username: "demo" });
		await failures("demo", 5, nth);

		expect(await failures(padded, 6, (index) => nth(index + 10))).toEqual([
			...times(5, "wrong"),
			"paused:15",
		]);
		expect(await attempt("demo", PASSWORD, nth(30))).toBe("paused:15");
	});

	it.each([
		["email", "demo@example.com", "demo"],
		["username", "demo", "demo@example.com"],
	])("pauses the %s alone when ten failures were typed as it", async (_label, failing, other) => {
		await account({ email: "demo@example.com", username: "demo" });
		await failures(failing, 10, nth);

		expect(await attempt(failing, PASSWORD, nth(20))).toBe("paused:15");
		expect(await attempt(other, PASSWORD, nth(21))).toBe("ok");
		expect(await attempt(failing, PASSWORD, nth(22))).toBe("paused:15");
	});
});

describe("sign-in limit: made-up names", () => {
	it("pauses a made-up name exactly like a real one", async () => {
		await account({ username: "real-user" });

		const real = await failures("real-user", 11, sameAddress("203.0.113.1"));
		const madeUp = await failures(
			"made-up-user",
			11,
			sameAddress("203.0.113.2")
		);

		expect(real).toEqual(tenWrongThenPaused);
		expect(madeUp).toEqual(real);
		expect(await rowsPerName()).toEqual([10, 10]);
	});

	it("answers the correct password for a real name and any password for a made-up one the same way", async () => {
		await account({ username: "real-user" });
		await failures("real-user", 10, nth);
		await failures("made-up-user", 10, (index) => nth(index + 20));

		expect(await attempt("real-user", PASSWORD, nth(50))).toBe("paused:15");
		expect(await attempt("made-up-user", PASSWORD, nth(51))).toBe("paused:15");
	});

	it("writes the same kind of audit-log entry for a real name and a made-up one", async () => {
		await account({ username: "real-user" });
		await failures("real-user", 11, nth);
		await failures("made-up-user", 11, (index) => nth(index + 20));

		const [first, second] = await pauseEvents();

		expect(first?.userId).toBeNull();
		expect(second?.userId).toBeNull();
		expect(Object.entries(first?.metadata ?? {}).map(([name]) => name)).toEqual(
			Object.entries(second?.metadata ?? {}).map(([name]) => name)
		);
	});
});

/** Requests that differ in everything the sender supplies, but not in the real address. */
const INVENTED_ADDRESS_FORMS: ReadonlyArray<
	readonly [string, (index: number) => SignInRequest]
> = [
	[
		"an invented left-hand x-forwarded-for entry",
		(index) => ({
			headers: {
				"x-forwarded-for": `198.51.100.${index + 1}, ${ADDRESS}`,
			},
		}),
	],
	[
		"invented entries with ports",
		(index) => ({
			headers: {
				"x-forwarded-for": `198.51.100.${index + 1}:4000, ${ADDRESS}:5000`,
			},
		}),
	],
	[
		"three hops of invented entries",
		(index) => ({
			headers: {
				"x-forwarded-for": `198.51.100.${index + 1}, 192.0.2.${index + 1}, ${ADDRESS}`,
			},
		}),
	],
	[
		"an x-forwarded-for that varies beside a fixed x-client-ip",
		(index) => ({
			headers: {
				"x-client-ip": ADDRESS,
				"x-forwarded-for": `198.51.100.${index + 1}`,
			},
		}),
	],
	[
		"an x-real-ip that varies beside a fixed x-client-ip",
		(index) => ({
			headers: {
				"x-client-ip": ADDRESS,
				"x-real-ip": `198.51.100.${index + 1}`,
			},
		}),
	],
];

describe("sign-in limit: where the address comes from", () => {
	it.each(
		INVENTED_ADDRESS_FORMS
	)("counts %s against the one real address", async (_label, requestFor) => {
		expect(await failuresAcrossNames(20, requestFor)).toEqual(
			times(20, "wrong")
		);
		expect(await attempt("fresh-name", WRONG_PASSWORD, requestFor(99))).toBe(
			"paused:15"
		);
		expect(await storedIdentifiers("ip")).toEqual([ADDRESS]);
	});

	it.each([
		["x-client-ip", { "x-client-ip": "203.0.113.4" }],
		[
			"x-forwarded-for with ports",
			{ "x-forwarded-for": "10.0.0.1:80, 203.0.113.5:4433" },
		],
		[
			"a bracketed IPv6 x-forwarded-for with a port",
			{ "x-forwarded-for": "10.0.0.1, [2001:db8::7]:4433" },
		],
		[
			"x-client-ip beside x-forwarded-for",
			{
				"x-client-ip": "203.0.113.6",
				"x-forwarded-for": "10.0.0.2, 203.0.113.99",
			},
		],
		["header names in capitals", { "X-Client-IP": "203.0.113.8" }],
	])("counts the address extractClientIp reads from %s", async (_label, headers) => {
		await attempt("nobody", WRONG_PASSWORD, { headers });

		expect(await storedIdentifiers("ip")).toEqual([
			extractClientIp(new Headers(headers)),
		]);
	});
});

const UNREADABLE: ReadonlyArray<readonly [string, SignInRequest]> = [
	["no request at all", undefined],
	["no headers", { headers: {} }],
	["an empty x-forwarded-for", { headers: { "x-forwarded-for": "" } }],
	[
		"a trailing comma in x-forwarded-for",
		{ headers: { "x-forwarded-for": `10.0.0.1, ${ADDRESS},` } },
	],
	["only an x-real-ip", { headers: { "x-real-ip": ADDRESS } }],
	["a blank x-client-ip", { headers: { "x-client-ip": "   " } }],
];

describe("sign-in limit: no readable address", () => {
	it.each(
		UNREADABLE
	)("skips the address limit and logs it when there is %s", async (_label, request) => {
		const logs = captureLogs();
		try {
			expect(await failuresAcrossNames(25, () => request)).toEqual(
				times(25, "wrong")
			);

			expect(await attemptRows("ip")).toBe(0);
			expect(addressWarnings(logs.entries).length).toBeGreaterThan(0);
		} finally {
			logs.restore();
		}
	});

	it.each(
		UNREADABLE
	)("still pauses a name after ten failures when there is %s", async (_label, request) => {
		await account({ username: "demo" });

		expect(await failures("demo", 11, () => request)).toEqual(
			tenWrongThenPaused
		);
		expect(await attempt("demo", PASSWORD, request)).toBe("paused:15");
	});
});

const NAMES_NEVER_STORED = [
	"Demo@Example.com",
	"Tr0ub4dor&3-typed-into-the-wrong-box",
	"plain-username",
];

describe("sign-in limit: what is stored", () => {
	it.each(
		NAMES_NEVER_STORED
	)("keeps %j in the attempt table and the audit log only as a hash", async (name) => {
		const logs = captureLogs();
		try {
			await failures(name, 11, nth);

			const stored = JSON.stringify([
				await prisma.rateLimitAttempt.findMany(),
				await prisma.securityAuditLog.findMany(),
				logs.entries,
			]).toLowerCase();
			expect(stored).not.toContain(name.toLowerCase());
		} finally {
			logs.restore();
		}

		expect(await pauseEvents()).toHaveLength(1);
		const identifiers = await storedIdentifiers("email");
		expect(identifiers).toHaveLength(1);
		expect(identifiers.every((value) => SHA256_HEX.test(value))).toBe(true);
	});

	it("counts a name of ten thousand characters under a key of fixed size", async () => {
		const name = `${"a".repeat(10_000)}@example.com`;

		expect(await failures(name, 11, nth)).toEqual(tenWrongThenPaused);

		const identifiers = await storedIdentifiers("email");
		expect(identifiers).toHaveLength(1);
		expect(identifiers.every((value) => SHA256_HEX.test(value))).toBe(true);
	});

	it("writes one audit-log entry for each refused attempt, with the address and no account", async () => {
		await account({ username: "demo" });
		await failuresAcrossNames(20, sameAddress(ADDRESS));

		await attempt("demo", PASSWORD, at(ADDRESS));
		await attempt("fresh-name", WRONG_PASSWORD, at(ADDRESS));

		const events = await pauseEvents();
		expect(events).toHaveLength(2);
		expect(events.map((event) => event.ipAddress)).toEqual([ADDRESS, ADDRESS]);
		expect(events.map((event) => event.userId)).toEqual([null, null]);
	});
});
