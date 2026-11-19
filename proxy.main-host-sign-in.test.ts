import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	MAIN,
	MAIN_HOST,
	OLD_HOST,
	outcome,
	PASSES_THROUGH,
	permanentRedirect,
	run,
	targetOf,
} from "@/src/__tests__/helpers/proxy-requests";

/**
 * The redirect to the main address and the sign-in check, with the real
 * next-auth `withAuth` wrapper. Only visitors with no session are used, so no
 * session cookie has to be decoded.
 */

const SIGNED_OUT = { signedIn: false };

beforeEach(() => {
	vi.stubEnv("NEXTAUTH_URL", MAIN);
	vi.stubEnv("NEXTAUTH_SECRET", "secret-for-the-sign-in-tests");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("a visitor with no session", () => {
	it("on another host is sent to the same page on the main host, not to a sign-in page", async () => {
		const response = await run("/dashboard?x=1", SIGNED_OUT);

		expect(outcome(response)).toEqual(
			permanentRedirect(`${MAIN}/dashboard?x=1`)
		);
	});

	it("on another host asking for the sign-in page is sent to the main host's sign-in page", async () => {
		const response = await run("/login?callbackUrl=%2Fdashboard", SIGNED_OUT);

		expect(outcome(response)).toEqual(
			permanentRedirect(`${MAIN}/login?callbackUrl=%2Fdashboard`)
		);
	});

	it("on the main host is still sent to the sign-in page, which remembers where they were going", async () => {
		const response = await run("/dashboard?x=1", {
			...SIGNED_OUT,
			host: MAIN_HOST,
		});

		const signIn = targetOf(response);
		expect(response?.status).toBe(307);
		expect(signIn.pathname).toBe("/login");
		expect(signIn.searchParams.get("callbackUrl")).toBe("/dashboard?x=1");
	});

	it("lands on the main host's sign-in page after following the redirect from another host", async () => {
		const first = await run("/cases/7/edit?tab=a", SIGNED_OUT);
		const target = targetOf(first);

		const second = await run(`${target.pathname}${target.search}`, {
			...SIGNED_OUT,
			host: target.host,
		});

		const signIn = targetOf(second);
		expect(second?.status).toBe(307);
		expect(signIn.pathname).toBe("/login");
		expect(signIn.searchParams.get("callbackUrl")).toBe("/cases/7/edit?tab=a");
	});

	it("on the main host can read a public page", async () => {
		const response = await run("/discover/some-case", {
			...SIGNED_OUT,
			host: MAIN_HOST,
		});

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});

	it.each([
		OLD_HOST,
		MAIN_HOST,
	])("on %s still gets the JSON refusal for an API call", async (host) => {
		const response = await run("/api/cases/1", { ...SIGNED_OUT, host });

		expect(response?.status).toBe(401);
		expect(await response?.json()).toEqual({
			error: "Unauthorised",
			code: "UNAUTHORISED",
		});
	});
});
