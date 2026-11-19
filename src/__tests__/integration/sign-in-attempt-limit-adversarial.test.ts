import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	account,
	ageAttempts,
	at,
	attempt,
	attemptRows,
	authorizeWith,
	countOf,
	failures,
	failuresAcrossNames,
	nth,
	OTHER_PASSWORD,
	PASSWORD,
	pausedCount,
	sameAddress,
	sequentially,
	tenWrongThenPaused,
	times,
	together,
	WRONG_PASSWORD,
} from "../utils/sign-in-attempts-kit";

const ADDRESS = "203.0.113.10";
const OTHER_ADDRESS = "203.0.113.77";
const FROM_ADDRESS = sameAddress(ADDRESS);

describe("sign-in limit: one name", () => {
	it("lets ten wrong passwords through as ordinary failures and pauses the eleventh", async () => {
		await account({ username: "demo" });

		expect(await failures("demo", 11, FROM_ADDRESS)).toEqual(
			tenWrongThenPaused
		);
	});

	it("counts failures from any address toward the name", async () => {
		await account({ username: "demo" });

		expect(await failures("demo", 10, nth)).toEqual(times(10, "wrong"));
		expect(await attempt("demo", WRONG_PASSWORD, at(OTHER_ADDRESS))).toBe(
			"paused:15"
		);
	});

	it.each([
		[9, "ok"],
		[10, "paused:15"],
	])("answers the correct password after %i failures with %s", async (failed, expected) => {
		await account({ username: "demo" });
		await failures("demo", failed, nth);

		expect(await attempt("demo", PASSWORD, at(OTHER_ADDRESS))).toBe(expected);
	});

	it("refuses the correct password while paused, and pauses that name only", async () => {
		await account({ username: "demo" });
		await account({ username: "bystander" }, OTHER_PASSWORD);
		await failures("demo", 10, FROM_ADDRESS);

		expect(await attempt("demo", PASSWORD, FROM_ADDRESS(0))).toBe("paused:15");
		expect(await attempt("bystander", OTHER_PASSWORD, FROM_ADDRESS(0))).toBe(
			"ok"
		);
	});

	it("does not store or extend the count for attempts it refuses", async () => {
		await account({ username: "demo" });
		await failures("demo", 10, FROM_ADDRESS);

		const refused = await sequentially(15, (index) =>
			attempt("demo", index % 2 ? PASSWORD : WRONG_PASSWORD, FROM_ADDRESS(0))
		);

		expect(refused).toEqual(times(15, "paused:15"));
		expect(await attemptRows("email")).toBe(10);
		expect(await attemptRows("ip")).toBe(10);
	});

	it("does not spend the address's attempts on a name that is already paused", async () => {
		await account({ username: "demo" });
		await account({ username: "bystander" }, OTHER_PASSWORD);
		await failures("demo", 10, FROM_ADDRESS);
		await failures("demo", 5, FROM_ADDRESS);

		expect(await attempt("bystander", OTHER_PASSWORD, FROM_ADDRESS(0))).toBe(
			"ok"
		);
		expect(await attemptRows("ip")).toBe(10);
	});
});

describe("sign-in limit: how long the pause lasts", () => {
	it.each([
		[0, 15],
		[300, 10],
		[600, 5],
		[840, 1],
		[870, 1],
	])("tells a person to wait for what is left of the window when the earliest failure is %i seconds old (%i minutes)", async (seconds, minutes) => {
		await failures("demo", 10, nth);
		await ageAttempts({ seconds, oldest: 1, identifierType: "email" });

		expect(await attempt("demo", WRONG_PASSWORD, nth(40))).toBe(
			`paused:${minutes}`
		);
	});

	it("frees a slot for each failure that leaves the window", async () => {
		await failures("demo", 10, nth);
		await ageAttempts({ seconds: 960, oldest: 3, identifierType: "email" });

		expect(await failures("demo", 4, (index) => nth(index + 40))).toEqual([
			"wrong",
			"wrong",
			"wrong",
			"paused:15",
		]);
	});

	it("lets the name sign in again once every counted failure is older than the window", async () => {
		await account({ username: "demo" });
		await failures("demo", 10, nth);
		await ageAttempts({ seconds: 15 * 60 + 10 });

		expect(await attempt("demo", PASSWORD, nth(40))).toBe("ok");
	});

	it("lets the address try again once its failures are older than the window", async () => {
		await failuresAcrossNames(20, FROM_ADDRESS);
		expect(await attempt("someone", WRONG_PASSWORD, FROM_ADDRESS(0))).toBe(
			"paused:15"
		);
		await ageAttempts({ seconds: 15 * 60 + 10 });

		expect(await attempt("someone", WRONG_PASSWORD, FROM_ADDRESS(0))).toBe(
			"wrong"
		);
	});
});

describe("sign-in limit: one address", () => {
	it("pauses an address after twenty failures, for any name, even with a correct password", async () => {
		await account({ username: "demo" });

		expect(await failuresAcrossNames(20, FROM_ADDRESS)).toEqual(
			times(20, "wrong")
		);
		expect(await attempt("fresh-name", WRONG_PASSWORD, FROM_ADDRESS(0))).toBe(
			"paused:15"
		);
		expect(await attempt("demo", PASSWORD, FROM_ADDRESS(0))).toBe("paused:15");
		expect(await attempt("demo", PASSWORD, at(OTHER_ADDRESS))).toBe("ok");
	});

	it("keeps the address's failures when its own account signs in between wrong passwords", async () => {
		await account({ username: "own" });

		const rounds = await sequentially(19, async (index) => [
			await attempt(`nobody-${index}`, WRONG_PASSWORD, FROM_ADDRESS(0)),
			await attempt("own", PASSWORD, FROM_ADDRESS(0)),
		]);

		expect(rounds).toEqual(times(19, ["wrong", "ok"]));
		expect(await attempt("nobody-19", WRONG_PASSWORD, FROM_ADDRESS(0))).toBe(
			"wrong"
		);
		expect(await attempt("own", PASSWORD, FROM_ADDRESS(0))).toBe("paused:15");
	});

	it("does not count attempts other limits recorded for the same address", async () => {
		await account({ username: "demo" });
		await prisma.rateLimitAttempt.createMany({
			data: ["register", "password_reset", "invite_accept"].flatMap(
				(endpoint) =>
					times(25, { endpoint, identifier: ADDRESS, identifierType: "ip" })
			),
		});

		expect(await failures("demo", 5, FROM_ADDRESS)).toEqual(times(5, "wrong"));
		expect(await attempt("demo", PASSWORD, FROM_ADDRESS(0))).toBe("ok");
	});
});

describe("sign-in limit: only failures count", () => {
	it("never pauses a name or an address for correct passwords", async () => {
		await account({ username: "demo" });

		const outcomes = await sequentially(25, () =>
			attempt("demo", PASSWORD, FROM_ADDRESS(0))
		);

		expect(outcomes).toEqual(times(25, "ok"));
		expect(await attemptRows("email")).toBe(0);
		expect(await attemptRows("ip")).toBe(0);
	});

	it("clears a name's failures on success, so it has its full allowance again", async () => {
		await account({ username: "demo" });
		await failures("demo", 9, nth);
		expect(await attempt("demo", PASSWORD, nth(50))).toBe("ok");
		expect(await attemptRows("email")).toBe(0);

		expect(await failures("demo", 11, (index) => nth(index + 60))).toEqual(
			tenWrongThenPaused
		);
	});

	it("clears only the name that signed in", async () => {
		await account({ username: "demo" });
		await failures("demo", 5, nth);
		await failures("other", 5, (index) => nth(index + 10));

		expect(await attempt("demo", PASSWORD, nth(50))).toBe("ok");

		expect(await failures("other", 6, (index) => nth(index + 60))).toEqual([
			...times(5, "wrong"),
			"paused:15",
		]);
		expect(await failures("demo", 10, (index) => nth(index + 70))).toEqual(
			times(10, "wrong")
		);
	});

	it.each([
		["a blank name", { username: "   ", password: PASSWORD }],
		["no password", { username: "demo" }],
		["an empty password", { username: "demo", password: "" }],
		["no credentials", undefined],
	])("does not count a request with %s", async (_label, credentials) => {
		await account({ username: "demo" });

		const results = await sequentially(30, () =>
			authorizeWith(credentials, FROM_ADDRESS(0))
		);

		expect(results).toEqual(times(30, null));
		expect(await attempt("demo", PASSWORD, FROM_ADDRESS(0))).toBe("ok");
		expect(await attemptRows("email")).toBe(0);
	});
});

describe("sign-in limit: attempts that arrive together", () => {
	it("lets exactly ten of thirty simultaneous wrong passwords for one name through", async () => {
		await account({ username: "demo" });

		const outcomes = await together(30, (index) =>
			attempt("demo", WRONG_PASSWORD, nth(index))
		);

		expect(countOf(outcomes, "wrong")).toBe(10);
		expect(pausedCount(outcomes)).toBe(20);
		expect(await attemptRows("email")).toBe(10);
	});

	it("lets exactly twenty of forty simultaneous attempts from one address through", async () => {
		const outcomes = await together(40, (index) =>
			attempt(`nobody-${index}`, WRONG_PASSWORD, FROM_ADDRESS(index))
		);

		expect(countOf(outcomes, "wrong")).toBe(20);
		expect(pausedCount(outcomes)).toBe(20);
		expect(await attemptRows("ip")).toBe(20);
	});

	it("hands back every slot of simultaneous correct sign-ins, and only theirs", async () => {
		await account({ username: "demo" });
		await failuresAcrossNames(5, FROM_ADDRESS);

		const outcomes = await together(5, () =>
			attempt("demo", PASSWORD, FROM_ADDRESS(0))
		);

		expect(outcomes).toEqual(times(5, "ok"));
		expect(await attemptRows("ip")).toBe(5);
		expect(await attemptRows("email")).toBe(5);
	});
});
