import { render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

/**
 * Someone who opens an invitation link while signed out is sent to sign in
 * with the invitation itself as the place to return to, and only a token in
 * the UUID shape ever reaches that address.
 */

const { redirectMock, notFoundMock } = vi.hoisted(() => ({
	redirectMock: vi.fn((target: string) => {
		throw new Error(`NEXT_REDIRECT ${target}`);
	}),
	notFoundMock: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

vi.mock("next/navigation", () => ({
	redirect: redirectMock,
	notFound: notFoundMock,
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock(
	"@/app/(authenticated)/invites/[token]/_components/invite-accept-card",
	() => ({
		InviteAcceptCard: ({ token }: { token: string }) => (
			<p>accepting {token}</p>
		),
	})
);

import AcceptInvitePage from "@/app/(authenticated)/invites/[token]/page";

const TOKEN = "0b5f6b7c-3f0e-4d3a-9a3e-6a1f2c9d8e47";
const ORIGIN = "https://app.example";
const SIGNED_IN = { user: { id: "u1" } };

const visit = (token: string) =>
	AcceptInvitePage({ params: Promise.resolve({ token }) });

beforeEach(() => {
	redirectMock.mockClear();
	notFoundMock.mockClear();
	vi.mocked(getServerSession).mockReset();
});

describe("invitation page for a visitor who is signed out", () => {
	it.each([
		TOKEN,
		TOKEN.toUpperCase(),
	])("sends them to sign in and back to the invitation %s", async (token) => {
		vi.mocked(getServerSession).mockResolvedValue(null);

		await expect(visit(token)).rejects.toThrow("NEXT_REDIRECT");

		expect(redirectMock).toHaveBeenCalledTimes(1);
		const target = new URL(redirectMock.mock.calls[0]?.[0] ?? "", ORIGIN);
		expect(target.origin).toBe(ORIGIN);
		expect(target.pathname).toBe("/login");
		expect(target.searchParams.get("redirect")).toBe(`/invites/${token}`);
		expect(target.searchParams.has("callbackUrl")).toBe(false);
	});

	it("asks for an address that the sign-in form will follow", async () => {
		vi.mocked(getServerSession).mockResolvedValue(null);

		await expect(visit(TOKEN)).rejects.toThrow("NEXT_REDIRECT");

		const target = new URL(redirectMock.mock.calls[0]?.[0] ?? "", ORIGIN);
		expect(safeRedirectPath(target.searchParams.get("redirect"), "/x")).toBe(
			`/invites/${TOKEN}`
		);
	});

	it("treats a session without a user id as signed out", async () => {
		vi.mocked(getServerSession).mockResolvedValue({ user: {} } as never);

		await expect(visit(TOKEN)).rejects.toThrow("NEXT_REDIRECT");
	});
});

describe("invitation page for a visitor who is signed in", () => {
	it("shows the invitation without redirecting", async () => {
		vi.mocked(getServerSession).mockResolvedValue(SIGNED_IN as never);

		render(await visit(TOKEN));

		expect(screen.getByText(`accepting ${TOKEN}`)).toBeInTheDocument();
		expect(redirectMock).not.toHaveBeenCalled();
	});
});

describe("invitation page with a token that is not a UUID", () => {
	it.each([
		"",
		"abc",
		"../../evil",
		"x?redirect=//evil.example",
		"x#fragment",
		"//evil.example",
		"https://evil.example",
		"%2F%2Fevil.example",
		"/\\evil.example",
		`${TOKEN}/../../x`,
		`${TOKEN}\n`,
		`${TOKEN}?next=//evil.example`,
		`${TOKEN}#x`,
		`${TOKEN}/`,
		` ${TOKEN}`,
		`${TOKEN}\\evil`,
		TOKEN.slice(0, -1),
		`${TOKEN}a`,
		TOKEN.replace("0b5f", "zb5f"),
		TOKEN.replaceAll("-", ""),
	])("answers not found for %j and never builds a sign-in address from it", async (token) => {
		for (const session of [null, SIGNED_IN]) {
			vi.mocked(getServerSession).mockResolvedValue(session as never);

			await expect(visit(token)).rejects.toThrow("NEXT_NOT_FOUND");
		}
		expect(redirectMock).not.toHaveBeenCalled();
	});
});
