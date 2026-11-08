import { describe, expect, it } from "vitest";
import { KELVIN_SIGN, NO_BREAK_SPACE } from "../helpers/identifier-characters";
import {
	account,
	attempt,
	attemptRows,
	failures,
	nth,
	OTHER_PASSWORD,
	PASSWORD,
	times,
	WRONG_PASSWORD,
} from "../utils/sign-in-attempts-kit";

/**
 * Capitals are folded only where sign-in itself ignores them. A name without
 * "@" is a username and is counted exactly as typed (after trimming), so
 * `Alice` and `alice` can be two accounts with two counts. A name with "@" is
 * an email, whose ASCII capitals are folded; non-ASCII capitals are not.
 */

type Field = "username" | "email";
type Pair = readonly [
	label: string,
	field: Field,
	first: string,
	second: string,
];

const PAIRS: readonly Pair[] = [
	["Alice and alice", "username", "Alice", "alice"],
	[
		"a Kelvin-sign username and its ASCII look-alike",
		"username",
		`${KELVIN_SIGN}elvin`,
		"kelvin",
	],
	[
		"a Kelvin-sign email and its ASCII look-alike",
		"email",
		`${KELVIN_SIGN}@example.com`,
		"k@example.com",
	],
];

/** Each pair twice, so either spelling is the one that fails. */
const DIRECTIONS = PAIRS.flatMap(([label, field, first, second]) => [
	[`${label}, first failing`, field, first, second] as const,
	[`${label}, second failing`, field, second, first] as const,
]);

/** Two accounts whose usernames or emails are the two spellings. */
async function twoAccounts(field: Field, failing: string, other: string) {
	await account({ [field]: failing });
	await account({ [field]: other }, OTHER_PASSWORD);
}

describe("sign-in limit: names that differ only in capitals", () => {
	it.each(
		DIRECTIONS
	)("counts %s separately, so ten failures on one leave the other signing in", async (_label, field, failing, other) => {
		await twoAccounts(field, failing, other);
		await failures(failing, 10, nth);

		expect(await attempt(failing, PASSWORD, nth(20))).toBe("paused:15");
		expect(await attempt(other, OTHER_PASSWORD, nth(21))).toBe("ok");
	});

	it.each(
		DIRECTIONS
	)("keeps the failures on one of %s when the other signs in", async (_label, field, failing, other) => {
		await twoAccounts(field, failing, other);
		await failures(failing, 9, nth);

		expect(await attempt(other, OTHER_PASSWORD, nth(20))).toBe("ok");

		expect(await attempt(failing, WRONG_PASSWORD, nth(21))).toBe("wrong");
		expect(await attempt(failing, PASSWORD, nth(22))).toBe("paused:15");
	});
});

const EMAIL_SPELLINGS = [
	"demo@example.com",
	"DEMO@EXAMPLE.COM",
	"  Demo@Example.com ",
	"\tdemo@EXAMPLE.com\n",
	`${NO_BREAK_SPACE}Demo@example.com${NO_BREAK_SPACE}`,
];

describe("sign-in limit: email spellings that sign-in treats as one", () => {
	it.each(
		EMAIL_SPELLINGS
	)("pauses %j after ten failures typed in the other spellings", async (spelling) => {
		await account({ email: "Demo@Example.com", username: "demo" });
		for (let index = 0; index < 10; index += 1) {
			await attempt(
				EMAIL_SPELLINGS[index % 5] ?? "",
				WRONG_PASSWORD,
				nth(index)
			);
		}

		expect(await attempt(spelling, PASSWORD, nth(20))).toBe("paused:15");
	});

	it("clears the shared count when the email signs in under another spelling", async () => {
		await account({ email: "Demo@Example.com", username: "demo" });
		await failures("Demo@Example.com", 9, nth);

		expect(await attempt("DEMO@example.com", PASSWORD, nth(20))).toBe("ok");

		expect(await attemptRows("email")).toBe(0);
		expect(
			await failures("demo@example.com", 10, (index) => nth(index + 30))
		).toEqual(times(10, "wrong"));
	});
});

describe("sign-in limit: two accounts whose emails differ only in capitals", () => {
	it.each([
		[
			"the lower-case spelling failing, the capitalised account signing in",
			"pat@example.com",
			"Pat@example.com",
		],
		[
			"the capitalised spelling failing, the lower-case account signing in",
			"Pat@example.com",
			"pat@example.com",
		],
	])("keeps the failures when %s", async (_label, failing, signer) => {
		await account({ email: "Pat@example.com" });
		await account({ email: "pat@example.com" }, OTHER_PASSWORD);
		await failures(failing, 9, nth);
		const password = signer === "Pat@example.com" ? PASSWORD : OTHER_PASSWORD;

		expect(await attempt(signer, password, nth(20))).toBe("ok");

		expect(await attempt(failing, WRONG_PASSWORD, nth(21))).toBe("wrong");
		expect(await attempt(failing, WRONG_PASSWORD, nth(22))).toBe("paused:15");
	});
});

/**
 * Accounts brought over from an earlier platform kept their usernames as
 * typed, so a username can hold an "@" and capitals. Its name is counted with
 * its capitals folded, like an email, so the accounts that share the folded
 * name are counted as emails and as usernames alike.
 */
describe("sign-in limit: a username that holds an @", () => {
	const IMPORTED_USERNAME = "Jane@Example.com";

	it("keeps its failures when an account whose email is the lower-case spelling signs in", async () => {
		await account({ username: IMPORTED_USERNAME });
		await account({ email: "jane@example.com" }, OTHER_PASSWORD);
		await failures(IMPORTED_USERNAME, 9, nth);

		expect(await attempt("jane@example.com", OTHER_PASSWORD, nth(20))).toBe(
			"ok"
		);

		expect(await attempt(IMPORTED_USERNAME, WRONG_PASSWORD, nth(21))).toBe(
			"wrong"
		);
		expect(await attempt(IMPORTED_USERNAME, WRONG_PASSWORD, nth(22))).toBe(
			"paused:15"
		);
	});

	it("clears its own failures when it signs in and no account has that email", async () => {
		await account({ username: IMPORTED_USERNAME });
		await failures(IMPORTED_USERNAME, 9, nth);

		expect(await attempt(IMPORTED_USERNAME, PASSWORD, nth(20))).toBe("ok");

		expect(await attemptRows("email")).toBe(0);
	});
});
