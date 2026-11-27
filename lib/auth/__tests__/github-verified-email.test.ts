import { afterEach, describe, expect, it, vi } from "vitest";
import { isGitHubEmailVerified } from "@/lib/auth/github-verified-email";
import { captureLogs } from "@/src/__tests__/helpers/capture-logs";

const EMAIL = "Person@Example.test";
const TOKEN = "gho_unit_test_token";

function answer(body: unknown, init: ResponseInit = { status: 200 }) {
	const fetchMock = vi.fn(() =>
		Promise.resolve(new Response(JSON.stringify(body), init))
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("isGitHubEmailVerified", () => {
	it("asks for one page of up to a hundred addresses, without following redirects, within five seconds", async () => {
		const fetchMock = answer([{ email: EMAIL, verified: true }]);

		await isGitHubEmailVerified(TOKEN, EMAIL);

		const [url, init] = fetchMock.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe("https://api.github.com/user/emails?per_page=100");
		expect(init.redirect).toBe("manual");
		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
	});

	it("matches the address without regard to capitals when it is marked verified", async () => {
		answer([
			{ email: "other@example.test", verified: true },
			{ email: EMAIL.toLowerCase(), verified: true },
		]);

		await expect(isGitHubEmailVerified(TOKEN, EMAIL)).resolves.toBe(true);
	});

	it.each([
		["listed but not verified", [{ email: EMAIL, verified: false }]],
		["verified given as text", [{ email: EMAIL, verified: "true" }]],
		["verified missing", [{ email: EMAIL }]],
		["absent from the list", [{ email: "x@example.test", verified: true }]],
		["an empty list", []],
	])("answers false when the address is %s", async (_label, body) => {
		answer(body);

		await expect(isGitHubEmailVerified(TOKEN, EMAIL)).resolves.toBe(false);
	});

	it.each([
		["an error status", { message: "no" }, { status: 403 }],
		["a redirect", {}, { status: 302 }],
		["a body that is not a list", { email: EMAIL, verified: true }, undefined],
	])("answers false for %s and logs one warning with only a reason", async (_label, body, init) => {
		answer(body, init);
		const logs = captureLogs();
		try {
			await expect(isGitHubEmailVerified(TOKEN, EMAIL)).resolves.toBe(false);

			const warnings = logs.entries.filter((entry) => entry.level === "warn");
			expect(warnings).toHaveLength(1);
			const text = JSON.stringify(logs.entries);
			expect(text).not.toContain(EMAIL);
			expect(text).not.toContain(TOKEN);
		} finally {
			logs.restore();
		}
	});

	it("answers false when the request fails or times out", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"))
		);

		await expect(isGitHubEmailVerified(TOKEN, EMAIL)).resolves.toBe(false);
	});

	it("answers false without a request when there is no token", async () => {
		const fetchMock = answer([{ email: EMAIL, verified: true }]);

		await expect(isGitHubEmailVerified(undefined, EMAIL)).resolves.toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
