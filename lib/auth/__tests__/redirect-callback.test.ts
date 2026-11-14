import { afterEach, describe, expect, it, vi } from "vitest";
import { authOptions } from "@/lib/auth/config";

/**
 * NextAuth hands the redirect callback whatever `callbackUrl` a request
 * carried (sign-out and its built-in sign-in page both do). Only an address
 * on the app's own origin may come back; a string prefix match is not an
 * origin match.
 */

const redirectCallback = authOptions.callbacks?.redirect;

async function redirectTo(url: string, baseUrl = "https://base.example") {
	if (!redirectCallback) {
		throw new Error("the redirect callback is not configured");
	}
	return await redirectCallback({ url, baseUrl });
}

const AUTH_URLS = ["https://app.example", "http://localhost:3000"];

afterEach(() => {
	vi.unstubAllEnvs();
});

describe.each(
	AUTH_URLS
)("redirect callback with the auth URL %s", (authUrl) => {
	const dashboard = `${authUrl}/dashboard`;
	const authHost = new URL(authUrl).host;

	const stubAuthUrl = () => vi.stubEnv("NEXTAUTH_URL", authUrl);

	it.each([
		"/dashboard",
		"/login",
		"/cases/1?tab=a#section-2",
	])("resolves the relative path %s against the auth URL", async (path) => {
		stubAuthUrl();
		await expect(redirectTo(path)).resolves.toBe(`${authUrl}${path}`);
	});

	it.each([
		"/dashboard",
		"/cases/1?tab=a#section-2",
		"/login?registered=true",
	])("returns the same-origin address %s unchanged", async (path) => {
		stubAuthUrl();
		await expect(redirectTo(`${authUrl}${path}`)).resolves.toBe(
			`${authUrl}${path}`
		);
	});

	it.each([
		["the site name as userinfo", "@evil.example/x"],
		["a longer host name", ".evil.example/x"],
		["a host name with a suffix", "-evil.example/x"],
		["the site name as a user name", ":@evil.example/x"],
		["an encoded dot before another host", "%2eevil.example/x"],
		["one more character on the host or port", "0/x"],
	])("sends an address with %s to the dashboard", async (_label, tail) => {
		stubAuthUrl();
		await expect(redirectTo(`${authUrl}${tail}`)).resolves.toBe(dashboard);
	});

	it("sends an address that only mentions the site to the dashboard", async () => {
		stubAuthUrl();
		await expect(redirectTo(`https://evil.example/${authHost}`)).resolves.toBe(
			dashboard
		);
		await expect(redirectTo(`javascript:alert(1)//${authHost}`)).resolves.toBe(
			dashboard
		);
	});

	it.each([
		"https://evil.example/x",
		"http://evil.example",
		"HTTPS://EVIL.EXAMPLE/x",
		"javascript:alert(1)",
		"data:text/html,x",
	])("sends %j to the dashboard", async (url) => {
		stubAuthUrl();
		await expect(redirectTo(url)).resolves.toBe(dashboard);
	});

	// A network-path reference resolves, against the auth URL, to another host.
	it.each([
		"//evil.example/x",
		"///evil.example/x",
		"/\\evil.example",
		"/\\/evil.example",
	])("sends the network-path reference %j to the dashboard", async (url) => {
		stubAuthUrl();
		await expect(redirectTo(url)).resolves.toBe(dashboard);
	});

	it("never returns an address on another origin, whatever the input", async () => {
		stubAuthUrl();
		const inputs = [
			"",
			"/",
			"//",
			"//evil.example",
			"/\\evil.example",
			`${authUrl}@evil.example`,
			`${authUrl}.evil.example`,
			`${authUrl}0`,
			`${authUrl}\\@evil.example`,
			`${authUrl}/\\evil.example`,
			`${authUrl}/../..//evil.example`,
			`${authUrl}\t.evil.example`,
			`${authUrl}\n.evil.example`,
			` ${authUrl}.evil.example`,
			"https://evil.example",
			"javascript:alert(1)",
			"not a url",
		];
		const origins: Record<string, string> = {};
		for (const input of inputs) {
			const result = await redirectTo(input);
			origins[input] = URL.canParse(result)
				? new URL(result).origin
				: `unparseable: ${result}`;
		}
		const expected = Object.fromEntries(
			inputs.map((input) => [input, new URL(authUrl).origin])
		);
		expect(origins).toEqual(expected);
	});
});

describe("redirect callback without NEXTAUTH_URL", () => {
	const baseUrl = "https://base.example";

	it("compares against the base URL it is given", async () => {
		vi.stubEnv("NEXTAUTH_URL", "");
		await expect(redirectTo("/login", baseUrl)).resolves.toBe(
			`${baseUrl}/login`
		);
		await expect(redirectTo(`${baseUrl}/cases/1`, baseUrl)).resolves.toBe(
			`${baseUrl}/cases/1`
		);
		await expect(
			redirectTo(`${baseUrl}@evil.example/x`, baseUrl)
		).resolves.toBe(`${baseUrl}/dashboard`);
		await expect(
			redirectTo(`${baseUrl}.evil.example/x`, baseUrl)
		).resolves.toBe(`${baseUrl}/dashboard`);
	});

	it("refuses to guess when neither address is configured", async () => {
		vi.stubEnv("NEXTAUTH_URL", "");
		await expect(redirectTo("/login", "")).rejects.toThrow("NEXTAUTH_URL");
	});
});

describe("redirect callback with a trailing slash on the auth URL", () => {
	it("returns a same-origin address unchanged and still refuses another host", async () => {
		vi.stubEnv("NEXTAUTH_URL", "https://app.example/");
		await expect(redirectTo("https://app.example/dashboard")).resolves.toBe(
			"https://app.example/dashboard"
		);
		const longerHost = await redirectTo("https://app.example.evil.example/x");
		expect(new URL(longerHost).origin).toBe("https://app.example");
		const userinfo = await redirectTo("https://app.example@evil.example/x");
		expect(new URL(userinfo).origin).toBe("https://app.example");
	});
});
