import { describe, expect, it, vi } from "vitest";
import { signInThroughNextAuth } from "../utils/next-auth-callback-kit";
import {
	account,
	OTHER_PASSWORD,
	PASSWORD,
	sequentially,
	times,
	WRONG_PASSWORD,
} from "../utils/sign-in-attempts-kit";

/**
 * The same limits seen from the browser: what next-auth's own credentials
 * callback reports as the `error` of a sign-in.
 */

// A deployment always has a secret; without one next-auth invents a different
// one for its first request, and the form token of that request is refused.
vi.stubEnv("NEXTAUTH_SECRET", "a-secret-for-the-callback-tests");

const ADDRESS = "203.0.113.50";
const WRONG = "CredentialsSignin";
const PAUSED = "SignInRateLimited:15";

const fromAddress = (extra: Record<string, string> = {}) => ({
	"x-client-ip": ADDRESS,
	...extra,
});

describe("sign-in limit: through next-auth's callback", () => {
	it("reports the pause to the browser as SignInRateLimited and the minutes, even for the correct password", async () => {
		await account({ username: "demo" });

		const wrong = await sequentially(10, () =>
			signInThroughNextAuth("demo", WRONG_PASSWORD, fromAddress())
		);

		expect(wrong).toEqual(times(10, WRONG));
		expect(
			await signInThroughNextAuth("demo", WRONG_PASSWORD, fromAddress())
		).toBe(PAUSED);
		expect(await signInThroughNextAuth("demo", PASSWORD, fromAddress())).toBe(
			PAUSED
		);
	});

	it("reports a made-up name to the browser exactly as it reports a real one", async () => {
		await sequentially(10, () =>
			signInThroughNextAuth("made-up-name", WRONG_PASSWORD, fromAddress())
		);

		expect(
			await signInThroughNextAuth("made-up-name", PASSWORD, fromAddress())
		).toBe(PAUSED);
	});

	it("counts the address next-auth hands over, whatever the left of x-forwarded-for says", async () => {
		await account({ username: "demo" }, OTHER_PASSWORD);

		const wrong = await sequentially(20, (index) =>
			signInThroughNextAuth(`nobody-${index}`, WRONG_PASSWORD, {
				"x-forwarded-for": `198.51.100.${index + 1}, ${ADDRESS}`,
			})
		);

		expect(wrong).toEqual(times(20, WRONG));
		expect(
			await signInThroughNextAuth("demo", OTHER_PASSWORD, {
				"x-forwarded-for": `198.51.100.99, ${ADDRESS}`,
			})
		).toBe(PAUSED);
		expect(
			await signInThroughNextAuth("demo", OTHER_PASSWORD, {
				"x-forwarded-for": "198.51.100.99, 203.0.113.51",
			})
		).toBeNull();
	});

	it("reports no error for a sign-in that works", async () => {
		await account({ username: "demo" });

		expect(
			await signInThroughNextAuth("demo", PASSWORD, fromAddress())
		).toBeNull();
	});
});
