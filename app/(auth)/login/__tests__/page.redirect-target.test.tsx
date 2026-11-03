import { beforeEach, describe, expect, it, vi } from "vitest";
import { OFF_SITE_REDIRECT_VALUES } from "@/src/__tests__/fixtures/off-site-redirect-values";

/**
 * A visitor who is already signed in is sent on from the login page to the
 * `redirect` (or `callbackUrl`) value, but only to a same-site path, and with
 * a bare path as the redirect target.
 */

const { redirectMock } = vi.hoisted(() => ({
	redirectMock: vi.fn((target: string) => {
		throw new Error(`NEXT_REDIRECT ${target}`);
	}),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/validate-session", () => ({ validateSession: vi.fn() }));
vi.mock("@/components/auth/sign-in-form", () => ({ default: () => null }));

import SignInPage from "@/app/(auth)/login/page";
import { validateSession } from "@/lib/auth/validate-session";

const SESSION = { userId: "u1", username: "alan", email: "alan@example.com" };
const ORIGIN = "https://app.example";

/** A path alone: no scheme or host, and nothing a browser would read as one. */
function isBarePath(target: unknown) {
	return (
		typeof target === "string" &&
		target.startsWith("/") &&
		!target.startsWith("//") &&
		!target.includes("\\") &&
		new URL(target, ORIGIN).origin === ORIGIN
	);
}

type Params = Record<string, string | string[] | undefined>;

/** Visits the login page and returns every address it redirected to. */
async function visit(params: Params, signedIn = true) {
	vi.mocked(validateSession).mockResolvedValue(signedIn ? SESSION : null);
	redirectMock.mockClear();
	try {
		await SignInPage({ searchParams: Promise.resolve(params) });
	} catch {
		// The mocked redirect throws, as Next's does, to stop rendering.
	}
	return redirectMock.mock.calls;
}

beforeEach(() => {
	vi.mocked(validateSession).mockReset();
});

describe("login page for a visitor who is signed in", () => {
	it.each([
		"/cases/1",
		"/cases/1?tab=a#section-2",
		"/discover/some-slug?use=1",
		"/invites/0b5f6b7c-3f0e-4d3a-9a3e-6a1f2c9d8e47",
	])("sends them on to %s", async (path) => {
		expect(await visit({ redirect: path })).toEqual([[path]]);
		expect(await visit({ callbackUrl: path })).toEqual([[path]]);
	});

	it("sends them to the dashboard when nothing is asked for", async () => {
		expect(await visit({})).toEqual([["/dashboard"]]);
	});

	it.each(
		OFF_SITE_REDIRECT_VALUES
	)("sends them to the dashboard, not to %j", async (value) => {
		expect(await visit({ redirect: value })).toEqual([["/dashboard"]]);
		expect(await visit({ callbackUrl: value })).toEqual([["/dashboard"]]);
	});

	it("redirects only to a bare path", async () => {
		const targets = [
			...OFF_SITE_REDIRECT_VALUES,
			"/cases/1",
			"/cases/1?next=https://evil.example",
		];
		for (const value of targets) {
			const calls = await visit({ redirect: value });
			expect(calls).toHaveLength(1);
			expect(calls[0]).toHaveLength(1);
			expect(isBarePath(calls[0]?.[0])).toBe(true);
		}
	});

	it("uses the first value when the address repeats redirect", async () => {
		expect(
			await visit({ redirect: ["/cases/1", "https://evil.example"] })
		).toEqual([["/cases/1"]]);
		expect(
			await visit({ redirect: ["https://evil.example", "/cases/1"] })
		).toEqual([["/dashboard"]]);
		expect(await visit({ redirect: ["", "/cases/1"] })).toEqual([
			["/dashboard"],
		]);
	});

	it("prefers redirect over callbackUrl, even when redirect is refused", async () => {
		expect(
			await visit({ redirect: "/cases/1", callbackUrl: "/cases/2" })
		).toEqual([["/cases/1"]]);
		expect(
			await visit({ redirect: "//evil.example", callbackUrl: "/cases/2" })
		).toEqual([["/dashboard"]]);
	});

	it("falls through to callbackUrl when redirect is empty", async () => {
		expect(await visit({ redirect: "", callbackUrl: "/cases/2" })).toEqual([
			["/cases/2"],
		]);
		expect(
			await visit({ redirect: "", callbackUrl: "//evil.example" })
		).toEqual([["/dashboard"]]);
	});
});

describe("login page for a visitor who is not signed in", () => {
	it.each([
		"/cases/1",
		"https://evil.example",
	])("shows the sign-in page and does not follow %s", async (value) => {
		expect(await visit({ redirect: value }, false)).toEqual([]);
	});
});
