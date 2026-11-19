import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "@/lib/services/email-service";
import {
	requestPasswordReset,
	resetPassword,
} from "@/lib/services/password-reset-service";
import {
	account,
	attempt,
	attemptRows,
	failures,
	nth,
	PASSWORD,
	times,
} from "../utils/sign-in-attempts-kit";

// The email service is an external boundary: mock only the sender.
vi.mock("@/lib/services/email-service", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/services/email-service")>()),
	sendPasswordResetEmail: vi.fn().mockResolvedValue({
		success: true,
		messageId: "mock-message-id",
	}),
}));

const RESET_ADDRESS = "203.0.113.200";
const NEW_PASSWORD = "StrongP@ss1";
const STORED_EMAIL = "Jane.Smith@Example.com";
const TYPED_EMAIL = "jane.smith@example.com";
const USERNAME = "JaneS";
const UNKNOWN_TOKEN = "0".repeat(64);

beforeEach(() => {
	vi.mocked(sendPasswordResetEmail).mockClear();
});

function mailedToken(): string {
	const lastCall = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1);
	if (!lastCall) {
		throw new Error("no reset email was sent");
	}
	return lastCall[0].resetToken;
}

/** An account whose email and username have each been failed ten times, and a reset token for it. */
async function pausedAccount() {
	const user = await account({ email: STORED_EMAIL, username: USERNAME });
	await failures(TYPED_EMAIL, 10, nth);
	await failures(USERNAME, 10, (index) => nth(index + 20));
	await requestPasswordReset(user.email, RESET_ADDRESS);
	return { user, token: mailedToken() };
}

describe("sign-in limit: a completed password reset", () => {
	it("ends the pause on the account's email and on its username", async () => {
		const { token } = await pausedAccount();
		expect(await attempt(TYPED_EMAIL, PASSWORD, nth(50))).toBe("paused:15");
		expect(await attempt(USERNAME, PASSWORD, nth(51))).toBe("paused:15");

		await resetPassword(token, NEW_PASSWORD, RESET_ADDRESS);

		expect(await attempt(TYPED_EMAIL, NEW_PASSWORD, nth(52))).toBe("ok");
		expect(await attempt(USERNAME, NEW_PASSWORD, nth(53))).toBe("ok");
	});

	it("gives the email and the username their full allowance again", async () => {
		const { token } = await pausedAccount();

		await resetPassword(token, NEW_PASSWORD, RESET_ADDRESS);

		expect(await failures(TYPED_EMAIL, 5, (index) => nth(index + 60))).toEqual(
			times(5, "wrong")
		);
		expect(await failures(USERNAME, 5, (index) => nth(index + 70))).toEqual(
			times(5, "wrong")
		);
	});

	it("ends the pause on a username that holds an @ when no account has that email", async () => {
		const user = await account({ username: "Jane@Example.com" });
		await failures("Jane@Example.com", 10, nth);
		expect(await attempt("Jane@Example.com", PASSWORD, nth(50))).toBe(
			"paused:15"
		);
		await requestPasswordReset(user.email, RESET_ADDRESS);

		await resetPassword(mailedToken(), NEW_PASSWORD, RESET_ADDRESS);

		expect(await attempt("Jane@Example.com", NEW_PASSWORD, nth(51))).toBe("ok");
	});

	it("keeps the pause when a reset was only requested, or tried with a wrong token", async () => {
		const { user } = await pausedAccount();

		await requestPasswordReset(user.email, RESET_ADDRESS);
		const refused = await resetPassword(
			UNKNOWN_TOKEN,
			NEW_PASSWORD,
			RESET_ADDRESS
		);

		expect(refused).toHaveProperty("error");
		expect(await attempt(TYPED_EMAIL, PASSWORD, nth(50))).toBe("paused:15");
		expect(await attempt(USERNAME, PASSWORD, nth(51))).toBe("paused:15");
	});

	it("leaves other accounts paused and the address's attempts in place", async () => {
		const { token } = await pausedAccount();
		await account({ username: "bystander" });
		await failures("bystander", 10, (index) => nth(index + 80));
		const addressRows = await attemptRows("ip");

		await resetPassword(token, NEW_PASSWORD, RESET_ADDRESS);

		expect(await attempt("bystander", PASSWORD, nth(90))).toBe("paused:15");
		expect(await attemptRows("ip")).toBe(addressRows);
	});
});
