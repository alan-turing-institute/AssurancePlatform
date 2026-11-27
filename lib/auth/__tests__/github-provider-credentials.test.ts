import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type AuthConfigSettings,
	findProvider,
	loadAuthOptionsWith,
} from "@/src/__tests__/utils/auth-config-load-kit";

/**
 * The GitHub provider is given the production app's client id and secret, and
 * the staging app's only where the production one is not set. Each of the two
 * is chosen on its own.
 */

afterEach(() => {
	vi.unstubAllEnvs();
});

async function githubOptions(settings: AuthConfigSettings) {
	const authOptions = await loadAuthOptionsWith(settings);
	return findProvider(authOptions, "github").options;
}

describe("GitHub provider client id", () => {
	it.each([
		[
			"both are set",
			{
				GITHUB_APP_CLIENT_ID: "test-github-id",
				GITHUB_APP_CLIENT_ID_STAGING: "test-github-staging-id",
			},
			"test-github-id",
		],
		[
			"only the production one is set",
			{ GITHUB_APP_CLIENT_ID: "test-github-id" },
			"test-github-id",
		],
		[
			"only the staging one is set",
			{ GITHUB_APP_CLIENT_ID_STAGING: "test-github-staging-id" },
			"test-github-staging-id",
		],
	] as [
		string,
		AuthConfigSettings,
		string,
	][])("uses the right id when %s", async (_label, settings, expected) => {
		expect((await githubOptions(settings))?.clientId).toBe(expected);
	});
});

describe("GitHub provider client secret", () => {
	it.each([
		[
			"both are set",
			{
				GITHUB_APP_CLIENT_SECRET: "test-github-secret",
				GITHUB_APP_CLIENT_SECRET_STAGING: "test-github-staging-secret",
			},
			"test-github-secret",
		],
		[
			"only the production one is set",
			{ GITHUB_APP_CLIENT_SECRET: "test-github-secret" },
			"test-github-secret",
		],
		[
			"only the staging one is set",
			{ GITHUB_APP_CLIENT_SECRET_STAGING: "test-github-staging-secret" },
			"test-github-staging-secret",
		],
	] as [
		string,
		AuthConfigSettings,
		string,
	][])("uses the right secret when %s", async (_label, settings, expected) => {
		expect((await githubOptions(settings))?.clientSecret).toBe(expected);
	});

	it("chooses the id and the secret independently of each other", async () => {
		const options = await githubOptions({
			GITHUB_APP_CLIENT_ID: "test-github-id",
			GITHUB_APP_CLIENT_SECRET_STAGING: "test-github-staging-secret",
		});
		expect(options?.clientId).toBe("test-github-id");
		expect(options?.clientSecret).toBe("test-github-staging-secret");
	});
});
