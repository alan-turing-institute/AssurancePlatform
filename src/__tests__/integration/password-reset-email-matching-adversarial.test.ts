import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email-service";
import { requestPasswordReset } from "@/lib/services/password-reset-service";
import { captureLogs } from "../helpers/capture-logs";
import {
	DOTTED_CAPITAL_I,
	FULLWIDTH_CAPITAL_A,
	KELVIN_SIGN,
	NO_BREAK_SPACE,
} from "../helpers/identifier-characters";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestUser,
	getTestPasswordResetTokenHash,
} from "../utils/prisma-factories";

// The email service is an external boundary: mock only the sender.
vi.mock("@/lib/services/email-service", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/services/email-service")>()),
	sendPasswordResetEmail: vi.fn().mockResolvedValue({
		success: true,
		messageId: "mock-message-id",
	}),
}));

const IP = "127.0.0.1";
const AMBIGUOUS_EVENT = "email_lookup_ambiguous";

beforeEach(() => {
	vi.mocked(sendPasswordResetEmail).mockClear();
});

/** Every address a reset email was sent to, in order. */
function recipients(): string[] {
	return vi.mocked(sendPasswordResetEmail).mock.calls.map(([mail]) => mail.to);
}

async function hasResetToken(userId: string): Promise<boolean> {
	return (await getTestPasswordResetTokenHash(userId)) !== null;
}

function seedAttempts(email: string, count: number, ipAddress?: string) {
	return prisma.passwordResetAttempt.createMany({
		data: Array.from({ length: count }, (_, index) => ({
			email,
			ipAddress: ipAddress ?? `10.0.0.${index + 1}`,
			successful: false,
		})),
	});
}

describe("password reset: finds the account whatever capitals are typed", () => {
	it.each([
		["lowercase", "jane.smith@example.com"],
		["uppercase", "JANE.SMITH@EXAMPLE.COM"],
		["padded with a tab and spaces", "  Jane.Smith@Example.com\t"],
		[
			"padded with no-break spaces",
			`${NO_BREAK_SPACE}jane.smith@example.com${NO_BREAK_SPACE}`,
		],
	])("sends to the stored Jane.Smith@Example.com when it is requested %s", async (_label, typed) => {
		const user = await createTestUser({ email: "Jane.Smith@Example.com" });

		expectSuccess(await requestPasswordReset(typed, IP));

		expect(recipients()).toEqual(["Jane.Smith@Example.com"]);
		expect(await hasResetToken(user.id)).toBe(true);
	});

	it("sends to the stored address, never the typed one", async () => {
		await createTestUser({ email: "demo@example.com" });

		expectSuccess(await requestPasswordReset("Demo@EXAMPLE.com", IP));

		expect(recipients()).toEqual(["demo@example.com"]);
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
	])("does not send across %s (non-ASCII capitals do not fold)", async (_label, stored, typed) => {
		const user = await createTestUser({ email: stored });

		expectSuccess(await requestPasswordReset(typed, IP));

		expect(recipients()).toEqual([]);
		expect(await hasResetToken(user.id)).toBe(false);
	});

	it.each([
		"d_mo@example.com",
		"%@example.com",
		"de%@example.com",
		"d\\emo@example.com",
	])("treats %s as ordinary characters, so no account is reached", async (typed) => {
		const user = await createTestUser({ email: "demo@example.com" });

		expectSuccess(await requestPasswordReset(typed, IP));

		expect(recipients()).toEqual([]);
		expect(await hasResetToken(user.id)).toBe(false);
	});

	it("matches a stored email that itself contains _ when typed in other capitals", async () => {
		await createTestUser({ email: "first_last@example.com" });

		expectSuccess(await requestPasswordReset("First_Last@Example.com", IP));

		expect(recipients()).toEqual(["first_last@example.com"]);
	});
});

describe("password reset: two emails that differ only in capitals", () => {
	async function seedTwins() {
		const upper = await createTestUser({ email: "Twin@Example.com" });
		const lower = await createTestUser({ email: "twin@example.com" });
		return { upper, lower };
	}

	it("sends nothing and sets no token for another capitalisation, and answers as for an unknown email", async () => {
		const { upper, lower } = await seedTwins();

		const ambiguous = await requestPasswordReset("TWIN@example.com", IP);
		const unknown = await requestPasswordReset("nobody@example.com", IP);

		expect(ambiguous).toEqual(unknown);
		expect(recipients()).toEqual([]);
		expect(await hasResetToken(upper.id)).toBe(false);
		expect(await hasResetToken(lower.id)).toBe(false);
	});

	it("sends to and sets a token on only the account whose exact email was requested", async () => {
		const { upper, lower } = await seedTwins();

		expectSuccess(await requestPasswordReset("Twin@Example.com", IP));
		expect(recipients()).toEqual(["Twin@Example.com"]);
		expect(await hasResetToken(upper.id)).toBe(true);
		expect(await hasResetToken(lower.id)).toBe(false);

		expectSuccess(await requestPasswordReset("twin@example.com", IP));
		expect(recipients()).toEqual(["Twin@Example.com", "twin@example.com"]);
		expect(await hasResetToken(lower.id)).toBe(true);
	});

	it("logs the ambiguity without the requested or stored address", async () => {
		await seedTwins();
		const logs = captureLogs();

		try {
			await requestPasswordReset("TWIN@example.com", IP);

			const events = logs.entries.filter((e) => e.msg === AMBIGUOUS_EVENT);
			expect(events).toHaveLength(1);
			expect(JSON.stringify(events).toLowerCase()).not.toContain("twin@");
		} finally {
			logs.restore();
		}
	});

	it("does not move on to a locally registered twin when the exact match is an OAuth account", async () => {
		const local = await createTestUser({
			email: "Twin@Example.com",
			authProvider: "LOCAL",
		});
		await createTestUser({
			email: "twin@example.com",
			authProvider: "GITHUB",
		});

		expectSuccess(await requestPasswordReset("twin@example.com", IP));

		expect(recipients()).toEqual([]);
		expect(await hasResetToken(local.id)).toBe(false);
	});
});

describe("password reset: limits stay keyed on the lowercased, trimmed email and the IP", () => {
	it("records the attempt under the lowercased, trimmed typed email", async () => {
		await createTestUser({ email: "Jane.Smith@Example.com" });

		await requestPasswordReset(" Jane.Smith@Example.com ", IP);

		const attempts = await prisma.passwordResetAttempt.findMany();
		expect(attempts).toHaveLength(1);
		expect(attempts[0]).toMatchObject({
			email: "jane.smith@example.com",
			ipAddress: IP,
		});
	});

	it.each([
		"jane.smith@example.com",
		"JANE.SMITH@EXAMPLE.COM",
	])("limits %s by the lowercased email even though the stored email has capitals", async (typed) => {
		await createTestUser({ email: "Jane.Smith@Example.com" });
		await seedAttempts("jane.smith@example.com", 3);

		const result = await requestPasswordReset(typed, "10.1.1.1");

		expect(result).toMatchObject({ rateLimited: true });
		expect(recipients()).toEqual([]);
	});

	it("limits by IP after ten attempts from the same address", async () => {
		await createTestUser({ email: "Jane.Smith@Example.com" });
		await seedAttempts("someone-else@example.com", 10, "10.2.2.2");

		const result = await requestPasswordReset(
			"jane.smith@example.com",
			"10.2.2.2"
		);

		expect(result).toMatchObject({ rateLimited: true });
		expect(recipients()).toEqual([]);
	});

	it("counts requests that match no single account towards the limit, whatever the capitals", async () => {
		await createTestUser({ email: "Twin@Example.com" });
		await createTestUser({ email: "twin@example.com" });

		for (const typed of [
			"TWIN@example.com",
			"tWin@example.com",
			"TWin@example.com",
		]) {
			expectSuccess(await requestPasswordReset(typed, IP));
		}
		const fourth = await requestPasswordReset("Twin@Example.com", "10.3.3.3");

		expect(fourth).toMatchObject({ rateLimited: true });
		expect(recipients()).toEqual([]);
	});
});
