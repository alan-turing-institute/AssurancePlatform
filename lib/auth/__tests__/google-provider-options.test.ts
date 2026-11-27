import { afterEach, describe, expect, it, vi } from "vitest";
import {
	findProvider,
	loadAuthOptionsWith,
} from "@/src/__tests__/utils/auth-config-load-kit";

/**
 * The Google provider carries the app's client id and secret, asks for the
 * Drive file scope that backup and import need, and asks for offline access
 * with a forced consent screen so that a refresh token comes back.
 */

afterEach(() => {
	vi.unstubAllEnvs();
});

async function googleOptions() {
	const authOptions = await loadAuthOptionsWith({
		GOOGLE_CLIENT_ID: "test-google-id",
		GOOGLE_CLIENT_SECRET: "test-google-secret",
		// The GitHub settings must not leak into the Google provider.
		GITHUB_APP_CLIENT_ID: "test-github-id",
		GITHUB_APP_CLIENT_SECRET: "test-github-secret",
	});
	return findProvider(authOptions, "google").options;
}

describe("Google provider options", () => {
	it("is given the Google client id and secret", async () => {
		const options = await googleOptions();
		expect(options?.clientId).toBe("test-google-id");
		expect(options?.clientSecret).toBe("test-google-secret");
	});

	it("asks for the sign-in scopes and the Drive file scope", async () => {
		const options = await googleOptions();
		expect(options?.authorization?.params?.scope).toBe(
			"openid email profile https://www.googleapis.com/auth/drive.file"
		);
	});

	it("asks for offline access and forces the consent screen", async () => {
		const params = (await googleOptions())?.authorization?.params;
		expect(params?.access_type).toBe("offline");
		expect(params?.prompt).toBe("consent");
	});

	it("sends no authorisation parameter beyond those three", async () => {
		const params = (await googleOptions())?.authorization?.params;
		expect(Object.keys(params ?? {}).sort()).toStrictEqual([
			"access_type",
			"prompt",
			"scope",
		]);
	});
});
