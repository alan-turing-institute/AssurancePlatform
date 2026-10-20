// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import {
	cleanProviderMessage,
	providerErrorMessage,
} from "@/lib/plugins/assistant/provider-message";

/**
 * A provider that rejects a key may repeat it with the middle hidden behind
 * asterisks and its last characters showing. What is shown to the user must
 * hold no part of such a key, whatever the provider and however it is quoted,
 * and ordinary text, Markdown emphasis included, must come through unchanged.
 */

const SECRETS = { apiKey: null, baseUrl: "http://localhost:11434" };
/** The last characters a provider leaves showing; no other text in these cases holds them. */
const TAIL = "Q7xZ";
const STARS = "*".repeat(20);

function clean(message: string): string {
	return cleanProviderMessage(message, SECRETS);
}

describe("masked keys are removed whole", () => {
	it.each([
		["OpenAI project key", `sk-proj-${STARS}${TAIL}`],
		[
			"OpenAI key with the first characters showing",
			`sk-abcd1${"*".repeat(27)}${TAIL}`,
		],
		["a short run of four asterisks", `sk-proj-****${TAIL}`],
		["a very long run of asterisks", `sk-proj-${"*".repeat(200)}${TAIL}`],
		["Anthropic key", `sk-ant-api03-${STARS}${TAIL}`],
		["OpenRouter key", `sk-or-v1-${STARS}${TAIL}`],
		["a key that is only asterisks and its tail", `${STARS}${TAIL}`],
		["a Google-style key", `AIzaSy${STARS}${TAIL}`],
		["a key with an underscore prefix", `gsk_${STARS}${TAIL}`],
		["a key with a hyphen prefix", `xai-${STARS}${TAIL}`],
		["a key with a word prefix", `key-${STARS}${TAIL}`],
		["a key with base64 characters", `ab+/12${STARS}${TAIL}==`],
	])("%s", (_label, masked) => {
		const text = clean(`Incorrect API key provided: ${masked}. Check it.`);

		expect(text).toContain("[key removed]");
		expect(text).not.toContain("****");
		expect(text).not.toContain(TAIL);
		expect(text).not.toMatch(/sk-/i);
		expect(text).not.toContain("proj-");
		expect(text).not.toContain("api03");
		expect(text).not.toContain("v1-");
		expect(text).not.toContain("AIza");
		expect(text).not.toContain("gsk_");
		expect(text).not.toContain("xai-");
		expect(text).not.toContain("==");
		expect(text).toContain("Check it.");
	});

	it.each([
		["Anthropic key", "sk-ant-api03-AbCdEf_GhIjKl-0123456789_QqRrSs"],
		["OpenRouter key", "sk-or-v1-0123456789abcdef0123456789abcdef"],
		["OpenAI project key", "sk-proj-AbC123_xyz-9876543210"],
	])("an unmasked %s", (_label, key) => {
		const text = clean(`Bad key ${key} for this model`);

		expect(text).toBe("Bad key [key removed] for this model");
	});

	it("takes the whole of OpenAI's usual sentence, and keeps the sentences around it", () => {
		const text = clean(
			`Incorrect API key provided: sk-proj-${STARS}${TAIL}. You can find your API key at https://platform.openai.com/account/api-keys.`
		);

		expect(text).toBe(
			"Incorrect API key provided: [key removed]. You can find your API key at https://platform.openai.com/account/api-keys."
		);
	});

	it.each([
		["double quotes", `"sk-proj-****${TAIL}"`],
		["single quotes", `'sk-proj-****${TAIL}'`],
		["parentheses", `(sk-proj-****${TAIL})`],
		["square brackets", `[sk-proj-****${TAIL}]`],
		["angle brackets", `<sk-proj-****${TAIL}>`],
		["backticks", `\`sk-proj-****${TAIL}\``],
		["a comma after it", `sk-proj-****${TAIL}, and more`],
		["a semicolon after it", `sk-proj-****${TAIL}; and more`],
		["a colon before it", `key:sk-proj-****${TAIL}`],
		["an equals sign before it", `api_key=sk-proj-****${TAIL}`],
		["quotes around a key with another prefix", `"AIza****${TAIL}"`],
		["brackets around a key with another prefix", `[AIza****${TAIL}]`],
		["parentheses around a key with another prefix", `(AIza****${TAIL})`],
		["a comma after a key with another prefix", `AIza****${TAIL}, and more`],
	])("with %s", (_label, shown) => {
		const text = clean(`Rejected ${shown} by the provider`);

		expect(text).not.toContain(TAIL);
		expect(text).not.toContain("****");
		expect(text).not.toMatch(/sk-/i);
		expect(text).not.toContain("AIza");
		expect(text.startsWith("Rejected ")).toBe(true);
		expect(text.endsWith("by the provider")).toBe(true);
	});

	it.each([
		[
			"a JSON error body",
			`{"error":{"message":"Incorrect API key provided: sk-proj-****${TAIL}.","type":"invalid_request_error","code":"invalid_api_key"}}`,
		],
		[
			"a JSON field holding the key",
			`{"key":"sk-proj-****${TAIL}","other":"AIza****${TAIL}"}`,
		],
		["a JSON array of keys", `["sk-proj-****${TAIL}","gsk_****${TAIL}"]`],
	])("inside %s", (_label, body) => {
		const text = clean(body);

		expect(text).not.toContain(TAIL);
		expect(text).not.toContain("****");
		expect(text).not.toMatch(/sk-/i);
		expect(text).not.toContain("gsk_");
		expect(text).not.toContain("AIza");
	});

	it.each([
		["with no stop after it", `Invalid key sk-proj-****${TAIL}`],
		["followed by a full stop", `Invalid key sk-proj-****${TAIL}.`],
		["followed by an exclamation mark", `Invalid key sk-proj-****${TAIL}!`],
		["followed by a question mark", `Invalid key sk-proj-****${TAIL}?`],
		[
			"quoted and followed by a full stop",
			`Invalid key "sk-proj-****${TAIL}".`,
		],
		["with another prefix and no stop", `Invalid key AIza****${TAIL}`],
		["with another prefix and a full stop", `Invalid key AIza****${TAIL}.`],
		["alone", `sk-proj-****${TAIL}`],
		["alone with another prefix", `AIza****${TAIL}`],
	])("at the very end of the message, %s", (_label, message) => {
		const text = clean(message);

		expect(text).not.toContain(TAIL);
		expect(text).not.toContain("****");
		expect(text).toContain("[key removed]");
	});

	it("keeps the full stop that ends the sentence, after either kind of key", () => {
		expect(clean(`Invalid key sk-proj-****${TAIL}.`)).toBe(
			"Invalid key [key removed]."
		);
		expect(clean(`Invalid key AIza****${TAIL}.`)).toBe(
			"Invalid key [key removed]."
		);
	});

	it.each([
		[
			"a masked token after Bearer",
			`Authorization: Bearer ****${TAIL} was refused`,
		],
		[
			"a masked sk- token after Bearer",
			`Authorization: Bearer sk-proj-****${TAIL} was refused`,
		],
		[
			"a lower-case bearer",
			`authorization: bearer ********${TAIL} was refused`,
		],
		[
			"a quoted token after Bearer",
			`Authorization: "Bearer ****${TAIL}" was refused`,
		],
	])("%s", (_label, message) => {
		const text = clean(message);

		expect(text).not.toContain(TAIL);
		expect(text).not.toContain("****");
		expect(text).toContain("was refused");
	});

	it("removes two keys in one message and keeps the words between and after them", () => {
		const text = clean(
			`Keys sk-proj-****${TAIL} and AIza****Z9yX were both rejected; also sk-ant-api03-****W3vU.`
		);

		expect(text).toBe(
			"Keys [key removed] and [key removed] were both rejected; also [key removed]."
		);
	});

	it("removes every masked key that does not start with sk-, not only the first", () => {
		const text = clean(
			`Keys AIza****${TAIL} and gsk_********Z9yX and key-****W3vU were rejected. Also xai-****R5tY.`
		);

		expect(text).toBe(
			"Keys [key removed] and [key removed] and [key removed] were rejected. Also [key removed]."
		);
	});

	it("removes a masked key that has invisible characters inside it", () => {
		const zeroWidth = String.fromCodePoint(0x20_0b);
		const softHyphen = String.fromCodePoint(0xad);
		const text = clean(
			`Rejected s${zeroWidth}k-proj-**${softHyphen}**${zeroWidth}${TAIL} today`
		);

		expect(text).toBe("Rejected [key removed] today");
	});

	it("removes a masked key whose asterisks were separated by a line break from the words before it", () => {
		const text = clean(`Rejected key:\nsk-proj-****${TAIL}\nplease retry`);

		expect(text).toBe("Rejected key: [key removed] please retry");
	});

	it("removes the provider's masked key when the user's own key is also known", () => {
		const own = "sk-proj-AbCdEfGhIjKlMnOpQrStUv0123";
		const text = cleanProviderMessage(
			`Provided ${own} but expected sk-proj-${STARS}0123 or ${own.slice(0, 8)}****0123`,
			{ apiKey: own, baseUrl: SECRETS.baseUrl }
		);

		expect(text).not.toContain("0123");
		expect(text).not.toContain("****");
		expect(text).not.toContain("AbCdEf");
	});
});

describe("a masked key near the point where long messages are cut", () => {
	it.each([
		[280],
		[290],
		[295],
		[298],
		[299],
		[300],
	])("leaves no part of the key when it starts at character %i", (start) => {
		const text = clean(
			`${"w".repeat(start - 1)} sk-proj-${STARS}${TAIL} and more words after it`
		);

		expect(text).not.toContain("sk-");
		expect(text).not.toContain("**");
		expect(text).not.toContain(TAIL);
		expect(text).not.toContain("proj");
	});

	it.each([
		[280],
		[295],
		[299],
	])("leaves no part of a key with another prefix when it starts at character %i", (start) => {
		const text = clean(
			`${"w".repeat(start - 1)} AIza${STARS}${TAIL} and more words after it`
		);

		expect(text).not.toContain("**");
		expect(text).not.toContain(TAIL);
		expect(text).not.toContain("AIza");
	});
});

describe("ordinary text is left alone", () => {
	it.each([
		["bold", "Use **bold** text"],
		["italic", "Use *italic* text"],
		["bold and italic together", "Use ***both*** at once"],
		[
			"several emphasised words",
			"Choose **gpt-5** or **o3** (see the *Models* page)",
		],
		["a footnote star", "Terms apply*"],
		["two footnote stars", "Terms apply** and more"],
		["arithmetic", "The result is 2*3*4 = 24"],
		["spaced arithmetic", "a * b * c = d"],
		["a bullet list", "* one * two * three"],
		["a glob pattern", "Matches *.json and src/*/index.ts"],
		["a power", "2 ** 10 is 1024"],
		["three stars apart", "a *** b *** c"],
		["the word task-oriented", "A task-oriented model"],
		["a sentence about the prefix", "Keys start with sk- and are long"],
	])("%s", (_label, message) => {
		expect(clean(message)).toBe(message);
	});
});

describe("through the provider's error", () => {
	function apiError(message: string) {
		return new APICallError({
			message,
			url: "http://localhost:11434/v1/chat/completions",
			requestBodyValues: {},
			statusCode: 401,
		});
	}

	it("shows the provider's sentence without the masked key", () => {
		const shown = providerErrorMessage(
			apiError(
				`Incorrect API key provided: sk-proj-${STARS}${TAIL}. You can find your API key at https://platform.openai.com/account/api-keys.`
			),
			SECRETS
		);

		expect(shown).toBe(
			"Incorrect API key provided: [key removed]. You can find your API key at https://platform.openai.com/account/api-keys."
		);
	});

	it("does the same for the error under the SDK's retry wrapper", () => {
		const wrapped = new RetryError({
			message: "Failed after 3 attempts",
			reason: "maxRetriesExceeded",
			errors: [
				apiError("first"),
				apiError(`Incorrect API key provided: AIza${STARS}${TAIL}.`),
			],
		});

		const shown = providerErrorMessage(wrapped, SECRETS);

		expect(shown).toBe("Incorrect API key provided: [key removed].");
	});
});

describe("a very long message", () => {
	const SIZE = 30_000;
	/** Far more than the linear cost of cleaning it, far less than the quadratic cost. */
	const LIMIT_MS = 300;

	it.each([
		["one very long run of asterisks", () => "*".repeat(SIZE)],
		[
			"a long run of asterisks inside one long word",
			() => `a${"*".repeat(SIZE)}b`,
		],
		[
			"a token of single asterisks between letters",
			() => "a*".repeat(SIZE / 2),
		],
		[
			"many short tokens with three asterisks each",
			() => "x*** ".repeat(SIZE / 5),
		],
		["many masked keys", () => `sk-proj-****${TAIL} `.repeat(SIZE / 20)],
		[
			"many tokens with another prefix",
			() => `AIza****${TAIL} `.repeat(SIZE / 20),
		],
		["a long word with no asterisks", () => "w".repeat(SIZE)],
		[
			"a long word ending in asterisks and a full stop",
			() => `${"w".repeat(SIZE)}****.`,
		],
		["a long run of sk- starts", () => "sk-".repeat(SIZE / 3)],
		[
			"a long run of full stops after a key start",
			() => `sk-ab${".".repeat(SIZE)}`,
		],
		["alternating stars and full stops", () => "*.".repeat(SIZE / 2)],
		["alternating delimiters and stars", () => '"*'.repeat(SIZE / 2)],
		["a long run of brackets", () => "(".repeat(SIZE)],
		["a long line of spaces and asterisks", () => "* ".repeat(SIZE / 2)],
		[
			"a long line of masked keys with stops between",
			() => `AIza****${TAIL}. `.repeat(SIZE / 20),
		],
	])("is cleaned in a moment: %s", (_label, build) => {
		const message = build();

		const start = performance.now();
		clean(message);
		const elapsed = performance.now() - start;

		expect(elapsed).toBeLessThan(LIMIT_MS);
	});
});
