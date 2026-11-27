import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth/config";
import { findProvider } from "@/src/__tests__/utils/auth-config-load-kit";

/**
 * The username and password form's provider is named Credentials and offers
 * a text field for the username and a masked one for the password.
 */

describe("credentials provider options", () => {
	const options = findProvider(authOptions, "credentials").options;

	it("is named Credentials", () => {
		expect(options?.name).toBe("Credentials");
	});

	it("offers a username text field and a password field", () => {
		expect(options?.credentials).toStrictEqual({
			username: { label: "Username", type: "text" },
			password: { label: "Password", type: "password" },
		});
	});
});
