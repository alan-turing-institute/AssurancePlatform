import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth/config";

/**
 * The one GitHub provider serves the sign-in button, Settings' Connect and
 * the import tab's prompt, so its scope is the scope of every GitHub request.
 */
const EXPECTED_SCOPE = "read:user user:email";

interface AuthorizationParams {
	authorization?: { params?: { scope?: string } };
}

interface GitHubProvider extends AuthorizationParams {
	id: string;
	options?: AuthorizationParams;
}

describe("GitHub provider scope", () => {
	const github = authOptions.providers.find(
		(provider) => provider.id === "github"
	) as GitHubProvider | undefined;

	it("requests only the profile and email scopes once our option is merged over the library default", () => {
		// NextAuth merges the options given to the provider factory over the
		// provider's own defaults, so our scope wins when both name one.
		const scope =
			github?.options?.authorization?.params?.scope ??
			github?.authorization?.params?.scope;

		expect(scope).toBe(EXPECTED_SCOPE);
	});

	it("sets the scope explicitly rather than relying on the library default", () => {
		expect(github?.options?.authorization?.params?.scope).toBe(EXPECTED_SCOPE);
	});
});
