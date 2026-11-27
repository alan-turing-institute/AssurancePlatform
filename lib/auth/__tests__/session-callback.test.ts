import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth/config";

/**
 * The session the browser and server components read is built from the
 * sign-in token: it carries the provider the person signed in with, and the
 * user's id when the token has one.
 */

const EXPIRES = "2030-01-01T00:00:00.000Z";

type SessionParams = Parameters<
	NonNullable<NonNullable<typeof authOptions.callbacks>["session"]>
>[0];

async function buildSession(session: Session, token: JWT): Promise<Session> {
	const callback = authOptions.callbacks?.session;
	if (!callback) {
		throw new Error("the session callback is not configured");
	}
	return await callback({ session, token } as unknown as SessionParams);
}

describe("session settings", () => {
	it("keeps the session in a signed token, not in the database", () => {
		expect(authOptions.session).toStrictEqual({ strategy: "jwt" });
	});
});

describe("session callback", () => {
	it("puts the token's user id and provider on the session and keeps the rest", async () => {
		const result = await buildSession(
			{
				user: { name: "Test User", email: "user@example.test" },
				expires: EXPIRES,
			},
			{ id: "user-1", provider: "github" }
		);

		expect(result).toStrictEqual({
			user: { name: "Test User", email: "user@example.test", id: "user-1" },
			expires: EXPIRES,
			provider: "github",
		});
	});

	it("leaves the user without an id when the token has none", async () => {
		const result = await buildSession(
			{ user: { name: "Test User" }, expires: EXPIRES },
			{ provider: "google" }
		);

		expect(result).toStrictEqual({
			user: { name: "Test User" },
			expires: EXPIRES,
			provider: "google",
		});
	});

	it("leaves an id already on the session alone when the token's id is empty", async () => {
		const result = await buildSession(
			{ user: { name: "Test User", id: "kept-id" }, expires: EXPIRES },
			{ id: "", provider: "credentials" }
		);

		expect(result.user?.id).toBe("kept-id");
	});

	it("adds no user to a session that has none, even when the token has an id", async () => {
		const result = await buildSession(
			{ expires: EXPIRES },
			{ id: "user-1", provider: "github" }
		);

		expect(result).toStrictEqual({ expires: EXPIRES, provider: "github" });
	});
});
