import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import {
	cleanProviderMessage,
	MAX_PROVIDER_MESSAGE_CHARS,
	PROVIDER_ERROR_TEXT,
	providerErrorMessage,
} from "@/lib/plugins/assistant/provider-message";

const KEY = "sk-or-v1-0123456789abcdef";
const ADDRESS = "https://models.internal.example:8443/v1";
const SECRETS = { apiKey: KEY, baseUrl: ADDRESS };

function apiError(message: string, statusCode?: number) {
	return new APICallError({
		message,
		url: `${ADDRESS}/chat/completions`,
		requestBodyValues: {},
		statusCode,
	});
}

describe("providerErrorMessage", () => {
	it("returns the provider's own reason and nothing else", () => {
		const reason =
			"This model requires you to complete the following before use: 18+ age confirmation";

		expect(providerErrorMessage(apiError(reason, 403), SECRETS)).toBe(reason);
		expect(providerErrorMessage(apiError("Rate limited"), SECRETS)).toBe(
			"Rate limited"
		);
	});

	it("finds the provider's answer under the SDK's retry wrapper", () => {
		const wrapped = new RetryError({
			message: "Failed after 2 attempts",
			reason: "maxRetriesExceeded",
			errors: [apiError("first", 500), apiError("Upstream overloaded", 503)],
		});

		expect(providerErrorMessage(wrapped, SECRETS)).toBe("Upstream overloaded");
	});

	it.each([
		["a failure that is not the provider's answer", new Error(`boom ${KEY}`)],
		["a value that is not an error", `boom ${KEY}`],
		["nothing", undefined],
	])("gives only the fixed sentence for %s", (_label, failure) => {
		expect(providerErrorMessage(failure, SECRETS)).toBe(PROVIDER_ERROR_TEXT);
	});

	it("gives only the fixed sentence when nothing readable is left of the message", () => {
		expect(providerErrorMessage(apiError(" \n\t ", 500), SECRETS)).toBe(
			PROVIDER_ERROR_TEXT
		);
		expect(providerErrorMessage(apiError(ADDRESS, 500), SECRETS)).toBe(
			"[address removed]"
		);
	});
});

describe("cleanProviderMessage", () => {
	it("replaces the user's key wherever it appears, whatever its case", () => {
		const text = cleanProviderMessage(
			`Invalid key ${KEY}; again ${KEY.toUpperCase()}`,
			SECRETS
		);

		expect(text).not.toContain(KEY);
		expect(text.toLowerCase()).not.toContain(KEY.toLowerCase());
		expect(text).toBe("Invalid key [key removed]; again [key removed]");
	});

	it("replaces any token that starts sk-, not only the user's own", () => {
		const text = cleanProviderMessage(
			"Keys sk-proj-AbC123_xyz and SK-live-0000 were refused",
			SECRETS
		);

		expect(text).toBe("Keys [key removed] and [key removed] were refused");
	});

	it("keeps words that only begin like a key", () => {
		expect(cleanProviderMessage("Ask-me and sk-1 are fine", SECRETS)).toBe(
			"Ask-me and sk-1 are fine"
		);
	});

	it("replaces any bearer token, not only the user's own", () => {
		const text = cleanProviderMessage(
			'Header "Authorization: Bearer abc.DEF-123_xyz" was refused; bearer other-token too',
			SECRETS
		);

		expect(text).not.toContain("abc.DEF-123_xyz");
		expect(text).not.toContain("other-token");
		expect(text).toContain("Bearer [key removed]");
	});

	it("removes the connection's address in each form it can take", () => {
		const text = cleanProviderMessage(
			`Cannot reach ${ADDRESS}/chat/completions; host models.internal.example:8443 and models.internal.example are down`,
			SECRETS
		);

		expect(text).not.toContain("models.internal.example");
		expect(text).not.toContain("8443");
	});

	it("keeps an address that is not the connection's", () => {
		const text = cleanProviderMessage(
			"See https://openrouter.ai/docs/errors for help",
			SECRETS
		);

		expect(text).toContain("https://openrouter.ai/docs/errors");
	});

	it("collapses line breaks, tabs and runs of space into single spaces", () => {
		expect(
			cleanProviderMessage("one\r\ntwo\t\tthree    four\u0000five", SECRETS)
		).toBe("one two three four five");
	});

	it("cuts a long message to 300 characters, ending in an ellipsis", () => {
		const text = cleanProviderMessage("word ".repeat(200), SECRETS);

		expect(text.length).toBeLessThanOrEqual(MAX_PROVIDER_MESSAGE_CHARS);
		expect(text.endsWith("…")).toBe(true);
		expect(MAX_PROVIDER_MESSAGE_CHARS).toBe(300);
	});

	it("does not let a key split by the cut survive, since the key goes first", () => {
		const padding = "x ".repeat(148);
		const text = cleanProviderMessage(`${padding}${KEY}`, SECRETS);

		expect(text).not.toContain(KEY.slice(0, 10));
	});

	it("works for a connection with no key and an address that is not a URL", () => {
		expect(
			cleanProviderMessage("Plain message", { apiKey: null, baseUrl: "nope" })
		).toBe("Plain message");
	});

	it("does not replace a very short key, which would also match ordinary words", () => {
		expect(
			cleanProviderMessage("a key was invalid", { apiKey: "key", baseUrl: "x" })
		).toBe("a key was invalid");
	});
});
