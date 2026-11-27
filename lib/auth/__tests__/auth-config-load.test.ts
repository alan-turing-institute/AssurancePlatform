import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAuthConfigWith } from "@/src/__tests__/utils/auth-config-load-kit";

/**
 * What the configuration file does at the moment it is loaded: it exports the
 * name of the cookie that carries an account-link request, and it loads a
 * local environment file without printing anything to standard output.
 */

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("link cookie name", () => {
	it("is the name of the signed link-intent cookie, not the old user-id cookie", async () => {
		const { LINK_COOKIE_NAME } = await loadAuthConfigWith({});

		expect(LINK_COOKIE_NAME).toBe("tea_link_intent");
	});
});

describe("loading the environment file", () => {
	it("prints nothing to standard output", async () => {
		const printed = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);
		// A set value in either of these would change how the loader reports.
		vi.stubEnv("DOTENV_CONFIG_QUIET", "");
		vi.stubEnv("DOTENV_CONFIG_DEBUG", "");

		await loadAuthConfigWith({});

		expect(printed).not.toHaveBeenCalled();
	});
});
