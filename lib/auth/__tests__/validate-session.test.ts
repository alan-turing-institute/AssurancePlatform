import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authOptions } from "@/lib/auth/config";
import { validateSession } from "../validate-session";

vi.mock("next-auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("next-auth")>()),
	getServerSession: vi.fn(),
}));

type SessionUser = Record<string, string | null | undefined>;

function signedInAs(user: SessionUser | undefined): void {
	vi.mocked(getServerSession).mockResolvedValue(
		user === undefined ? null : { user, expires: "2099-01-01T00:00:00.000Z" }
	);
}

beforeEach(() => {
	vi.mocked(getServerSession).mockReset();
});

describe("validateSession", () => {
	it("returns the user id, name and email of a signed-in user", async () => {
		signedInAs({
			id: "user-1",
			name: "test-user",
			email: "user@example.test",
		});

		await expect(validateSession()).resolves.toStrictEqual({
			userId: "user-1",
			username: "test-user",
			email: "user@example.test",
		});
	});

	it("asks for the session with the app's own auth options", async () => {
		signedInAs({ id: "user-1" });

		await validateSession();

		expect(getServerSession).toHaveBeenCalledTimes(1);
		expect(vi.mocked(getServerSession).mock.calls[0]?.[0]).toBe(authOptions);
	});

	it("returns null when there is no session", async () => {
		signedInAs(undefined);

		await expect(validateSession()).resolves.toBeNull();
	});

	it("returns null for a session without a user", async () => {
		vi.mocked(getServerSession).mockResolvedValue({
			expires: "2099-01-01T00:00:00.000Z",
		});

		await expect(validateSession()).resolves.toBeNull();
	});

	it.each([
		["a missing id", { name: "test-user", email: "user@example.test" }],
		["an empty id", { id: "", name: "test-user" }],
	])("returns null for a session with %s", async (_label, user) => {
		signedInAs(user);

		await expect(validateSession()).resolves.toBeNull();
	});

	it.each([
		["a missing name and email", {}],
		["a null name and email", { name: null, email: null }],
	])("gives null for %s but keeps the id", async (_label, rest) => {
		signedInAs({ id: "user-1", ...rest });

		await expect(validateSession()).resolves.toStrictEqual({
			userId: "user-1",
			username: null,
			email: null,
		});
	});

	it("gives null for a missing name only, or a missing email only", async () => {
		signedInAs({ id: "user-1", email: "user@example.test" });
		await expect(validateSession()).resolves.toStrictEqual({
			userId: "user-1",
			username: null,
			email: "user@example.test",
		});

		signedInAs({ id: "user-1", name: "test-user" });
		await expect(validateSession()).resolves.toStrictEqual({
			userId: "user-1",
			username: "test-user",
			email: null,
		});
	});
});
