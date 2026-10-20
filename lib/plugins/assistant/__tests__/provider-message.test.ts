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

/** The character with this code point, written as a number so the file holds no invisible character. */
const at = (codePoint: number) => String.fromCodePoint(codePoint);

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

	it.each([
		["OpenAI's masked form", "sk-********************abcd"],
		["OpenAI's masked project form", "sk-proj-********************abcd"],
		["a masked key with no sk- prefix", "abcd1234********wxyz"],
		[
			"a masked key with characters beyond letters and digits",
			"ab+/12****wx==",
		],
	])("removes %s whole, with the characters on both sides of the mask", (_label, masked) => {
		const text = cleanProviderMessage(
			`Incorrect API key provided: ${masked}. You can find your key in the dashboard.`,
			SECRETS
		);

		expect(text).toBe(
			"Incorrect API key provided: [key removed]. You can find your key in the dashboard."
		);
	});

	it("gives one placeholder for a masked key whose mask is broken by full stops", () => {
		expect(
			cleanProviderMessage("Rejected sk-proj-****...****Q7xZ today", SECRETS)
		).toBe("Rejected [key removed] today");
	});

	it("leaves markdown emphasis alone", () => {
		const message = "The **model** is *not* available; ***try*** another one";

		expect(cleanProviderMessage(message, SECRETS)).toBe(message);
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

	it.each([
		["a line feed", "\n"],
		["a tab", "\t"],
		["a zero-width space", at(0x20_0b)],
		["a right-to-left override", at(0x20_2e)],
		["a soft hyphen", at(0xad)],
		["an Arabic letter mark", at(0x6_1c)],
		["an invisible times sign", at(0x20_62)],
		["a tag character", at(0xe_00_41)],
		["a variation selector", at(0xfe_0f)],
		["a combining grapheme joiner", at(0x3_4f)],
		["a Hangul filler", at(0x31_64)],
	])("replaces a key split by %s", (_label, hidden) => {
		const key = "opaque-7f3a9c2e51d8";
		const split = `${key.slice(0, 9)}${hidden}${key.slice(9)}`;

		expect(
			cleanProviderMessage(`Invalid key ${split}`, { ...SECRETS, apiKey: key })
		).toBe("Invalid key [key removed]");
	});

	it("removes the connection's address when whitespace has been put inside it", () => {
		const text = cleanProviderMessage(
			"Cannot reach https://models.internal.example:8443/v1/chat/completions; host models.internal.\nexample is down",
			SECRETS
		);

		expect(text).not.toContain("models.internal");
		expect(text).not.toContain("8443");
		expect(text).toContain("is down");
	});

	it("leaves ordinary words alone when the host name is two letters", () => {
		expect(
			cleanProviderMessage("data is", {
				apiKey: null,
				baseUrl: "http://ai:8000/v1",
			})
		).toBe("data is");
	});

	it("removes the address when a full stop follows it", () => {
		expect(
			cleanProviderMessage("could not reach ai.example.org.", {
				apiKey: null,
				baseUrl: "https://ai.example.org",
			})
		).toBe("could not reach [address removed].");
	});

	it.each([
		[
			"followed by a full stop",
			"Invalid key opaque-7f3a9c2e51d8.",
			"Invalid key [key removed].",
		],
		[
			"in a query string",
			"GET /v1?key=opaque-7f3a9c2e51d8&model=m",
			"GET /v1?key=[key removed]&model=m",
		],
	])("removes the key when it is %s", (_label, message, expected) => {
		expect(
			cleanProviderMessage(message, {
				...SECRETS,
				apiKey: "opaque-7f3a9c2e51d8",
			})
		).toBe(expected);
	});

	it("keeps the spaces of an ordinary message", () => {
		expect(
			cleanProviderMessage(
				"The model is not available for this account; try another one",
				SECRETS
			)
		).toBe("The model is not available for this account; try another one");
	});

	it("puts a message with a Unicode line separator on one line", () => {
		expect(
			cleanProviderMessage(
				`first${at(0x20_28)}second${at(0x20_29)}third`,
				SECRETS
			)
		).toBe("first second third");
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
