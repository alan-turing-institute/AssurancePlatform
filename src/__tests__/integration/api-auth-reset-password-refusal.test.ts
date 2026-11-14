import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/auth/password-service";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email-service";
import { requestPasswordReset } from "@/lib/services/password-reset-service";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Route-level coverage for how /api/auth/reset-password answers a reset link
 * that cannot be used. The email sender is mocked at its service boundary (the
 * raw token only ever leaves the server in that email), and `next/headers` is
 * mocked because `headers()` throws outside a real Next.js request.
 */

vi.mock("@/lib/services/email-service", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/services/email-service")>()),
	sendPasswordResetEmail: vi
		.fn()
		.mockResolvedValue({ data: { messageId: "mock-message-id" } }),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}));

const REFUSAL = "Invalid or expired reset token";
const ROUTE_URL = "http://localhost:3000/api/auth/reset-password";
const STRONG_PASSWORD = "StrongP@ss1";
const OTHER_PASSWORD = "OtherStr0ng!Pass";
const REQUEST_IP = "10.0.0.1";

type LinkMaker = () => Promise<string>;

function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

async function post(token: string, password = STRONG_PASSWORD) {
	const { POST } = await import("@/app/api/auth/reset-password/route");
	return POST(
		new Request(ROUTE_URL, {
			method: "POST",
			body: JSON.stringify({ token, password }),
		})
	);
}

async function get(token: string) {
	const { GET } = await import("@/app/api/auth/reset-password/route");
	return GET(new Request(`${ROUTE_URL}?token=${encodeURIComponent(token)}`));
}

/** Everything a caller can see of an answer. */
async function observed(response: Response) {
	return {
		status: response.status,
		headers: Object.fromEntries(response.headers.entries()),
		body: await response.text(),
	};
}

/** Asks for a reset as a real user would and returns what the email carried. */
async function requestLink(): Promise<{ userId: string; token: string }> {
	const user = await createTestUser();
	await requestPasswordReset(user.email, REQUEST_IP);
	const sent = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)?.[0];
	if (!sent) {
		throw new Error("no reset email was sent");
	}
	return { userId: user.id, token: sent.resetToken };
}

const liveLink: LinkMaker = async () => (await requestLink()).token;

const usedLink: LinkMaker = async () => {
	const token = await liveLink();
	const first = await post(token);
	if (first.status !== 200) {
		throw new Error(`the first use of a live link answered ${first.status}`);
	}
	return token;
};

const expiredLink: LinkMaker = async () => {
	const { userId, token } = await requestLink();
	await prisma.user.update({
		where: { id: userId },
		data: { passwordResetExpires: new Date(Date.now() - 60_000) },
	});
	return token;
};

const unknownLink: LinkMaker = () => Promise.resolve("b2".repeat(32));

const supersededLink: LinkMaker = async () => {
	const { userId, token } = await requestLink();
	await prisma.user.update({
		where: { id: userId },
		data: { passwordResetTokenHash: sha256Hex("c3".repeat(32)) },
	});
	return token;
};

const REFUSED_LINKS: [kind: string, make: LinkMaker][] = [
	["used", usedLink],
	["expired", expiredLink],
	["unknown", unknownLink],
	["replaced", supersededLink],
];

/** The status and JSON body of an answer. */
async function answerOf(response: Response) {
	return { status: response.status, body: await response.json() };
}

const REFUSED = {
	status: 400,
	body: { error: REFUSAL, code: "VALIDATION" },
};

describe("POST /api/auth/reset-password with a link that cannot be used", () => {
	it.each(
		REFUSED_LINKS
	)("answers a link that is %s with 400 and the refusal message", async (_kind, make) => {
		expect(await answerOf(await post(await make()))).toEqual(REFUSED);
	});

	it("answers a used, an expired and an unknown link identically", async () => {
		const used = await observed(await post(await usedLink()));
		const expired = await observed(await post(await expiredLink()));
		const unknown = await observed(await post(await unknownLink()));

		expect(unknown.status).toBe(400);
		expect(used).toEqual(unknown);
		expect(expired).toEqual(unknown);
	});

	it("changes neither the password nor the session version when it refuses", async () => {
		const { userId, token } = await requestLink();
		await prisma.user.update({
			where: { id: userId },
			data: { passwordResetExpires: new Date(Date.now() - 60_000) },
		});
		const before = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
		});

		expect((await post(token)).status).toBe(400);

		const after = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
		});
		expect(after.passwordHash).toBe(before.passwordHash);
		expect(after.sessionVersion).toBe(before.sessionVersion);
	});

	it("lets exactly one of two submits with one link through and refuses the other like any bad link", async () => {
		const token = await liveLink();

		const [first, second] = await Promise.all([
			post(token, STRONG_PASSWORD),
			post(token, OTHER_PASSWORD),
		]);

		expect([first.status, second.status].sort()).toEqual([200, 400]);
		const loser = first.status === 400 ? first : second;
		const unknown = await post(await unknownLink());
		expect(await observed(loser)).toEqual(await observed(unknown));
	});

	it("keeps the first password after a refused replay", async () => {
		const { userId, token } = await requestLink();
		expect((await post(token, STRONG_PASSWORD)).status).toBe(200);

		expect(await answerOf(await post(token, OTHER_PASSWORD))).toEqual(REFUSED);

		const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
		const kept = await verifyPassword(
			STRONG_PASSWORD,
			user.passwordHash as string,
			"argon2id"
		);
		expect(kept.valid).toBe(true);
	});
});

describe("GET /api/auth/reset-password with a link that cannot be used", () => {
	it.each(
		REFUSED_LINKS
	)("answers a link that is %s with 400 and the refusal message", async (_kind, make) => {
		expect(await answerOf(await get(await make()))).toEqual(REFUSED);
	});

	it("answers a used, an expired and an unknown link identically", async () => {
		const used = await observed(await get(await usedLink()));
		const expired = await observed(await get(await expiredLink()));
		const unknown = await observed(await get(await unknownLink()));

		expect(unknown.status).toBe(400);
		expect(used).toEqual(unknown);
		expect(expired).toEqual(unknown);
	});

	it("answers the same way as POST does for the same bad link", async () => {
		const token = await unknownLink();

		const viaGet = await observed(await get(token));
		const viaPost = await observed(await post(token));

		expect(viaGet).toEqual(viaPost);
	});
});

/** Tokens of odd shape. None may reach the database as anything but a miss. */
const ODD_TOKENS: [label: string, token: string][] = [
	["one character", "x"],
	["63 hex characters", "a".repeat(63)],
	["65 hex characters", "a".repeat(65)],
	["64 non-hex letters", "g".repeat(64)],
	["64 capital letters", "A".repeat(64)],
	["64 accented letters", "é".repeat(64)],
	["32 emoji (64 UTF-16 units)", "\u{1F600}".repeat(32)],
	["64 control characters", "\u0001".repeat(64)],
	["a path", "../../etc/passwd"],
	["an SQL fragment", "' OR '1'='1"],
	["whitespace only", "   "],
	["a very long run", "a".repeat(100_000)],
];

describe("an odd-shaped token on /api/auth/reset-password", () => {
	it.each(
		ODD_TOKENS
	)("is refused like an unknown link on POST and GET: %s", async (_label, token) => {
		const unknown = await unknownLink();
		const expectedPost = await observed(await post(unknown));
		const expectedGet = await observed(await get(unknown));

		const viaPost = await observed(await post(token));
		const viaGet = await observed(await get(token));

		expect(viaPost.status).toBe(400);
		expect(viaGet.status).toBe(400);
		expect(viaPost).toEqual(expectedPost);
		expect(viaGet).toEqual(expectedGet);
	});

	it.each([
		["capitals", (token: string) => token.toUpperCase()],
		["a trailing space", (token: string) => `${token} `],
		["a leading space", (token: string) => ` ${token}`],
		["a trailing newline", (token: string) => `${token}\n`],
	])("is refused when a live link is changed to %s, and the live link still works", async (_label, change) => {
		const token = await liveLink();

		expect(await answerOf(await post(change(token)))).toEqual(REFUSED);
		expect(await answerOf(await get(change(token)))).toEqual(REFUSED);

		expect((await post(token)).status).toBe(200);
	});

	it("answers a missing or empty token with a 400, never a server error", async () => {
		const { GET } = await import("@/app/api/auth/reset-password/route");

		const empty = await post("");
		const emptyGet = await get("");
		const absent = await GET(new Request(ROUTE_URL));

		expect(empty.status).toBe(400);
		expect(emptyGet.status).toBe(400);
		expect(absent.status).toBe(400);
	});
});

describe("a usable reset link on /api/auth/reset-password", () => {
	it("still resets the password, clears the link and signs other sessions out", async () => {
		const { userId, token } = await requestLink();
		const before = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
		});

		const response = await post(token);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			message: "Your password has been reset successfully. You can now log in.",
		});
		const after = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
		});
		expect(after.passwordResetTokenHash).toBeNull();
		expect(after.passwordResetExpires).toBeNull();
		expect(after.sessionVersion).toBe(before.sessionVersion + 1);
		const check = await verifyPassword(
			STRONG_PASSWORD,
			after.passwordHash as string,
			"argon2id"
		);
		expect(check.valid).toBe(true);
	});

	it("is reported as valid with the account's email by GET", async () => {
		const { userId, token } = await requestLink();
		const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

		const response = await get(token);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ valid: true, email: user.email });
	});

	it("is the only link that works when a second link was requested", async () => {
		const user = await createTestUser();
		await requestPasswordReset(user.email, REQUEST_IP);
		const first = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)?.[0]
			.resetToken as string;
		await requestPasswordReset(user.email, REQUEST_IP);
		const second = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)?.[0]
			.resetToken as string;

		expect(await answerOf(await post(first))).toEqual(REFUSED);
		expect((await post(second)).status).toBe(200);
	});
});
