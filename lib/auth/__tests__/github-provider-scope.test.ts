import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth/config";

/**
 * The one GitHub provider serves the sign-in button, Settings' Connect and
 * the import tab's prompt, so its scope is the scope of every GitHub request.
 */
const EXPECTED_SCOPE = "read:user user:email";

interface ProviderWithScope {
	authorization?: { params?: { scope?: string } };
	id: string;
	options?: { authorization?: { params?: { scope?: string } } };
}

describe("GitHub provider scope", () => {
	const github = authOptions.providers.find(
		(provider) => provider.id === "github"
	) as ProviderWithScope | undefined;

	it("requests only the profile and email scopes", () => {
		expect(github?.authorization?.params?.scope).toBe(EXPECTED_SCOPE);
	});

	it("sets the scope explicitly rather than relying on the library default", () => {
		expect(github?.options?.authorization?.params?.scope).toBe(EXPECTED_SCOPE);
	});
});
