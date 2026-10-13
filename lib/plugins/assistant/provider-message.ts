import { APICallError, RetryError } from "ai";

/**
 * What the user is told when the model provider fails. The provider's own
 * words are shown to the user whose account they concern (for example, a model
 * that needs an age confirmation before use), cleaned first: invisible
 * characters are removed and control characters become spaces, then the user's
 * key, any bearer token and any `sk-` token are replaced, the connection's
 * address is removed, and the text is cut to a short line. They are never
 * written to a log.
 */

/** What is said when the provider gave no usable reason. */
export const PROVIDER_ERROR_TEXT = "The model provider returned an error.";

/** The most characters of the provider's own message that are shown. */
export const MAX_PROVIDER_MESSAGE_CHARS = 300;

/** The parts of a connection that a message from its provider must not repeat. */
export interface ProviderSecrets {
	apiKey: string | null;
	baseUrl: string;
}

/** A key shorter than this is not replaced, since it would also match ordinary words. */
const MIN_KEY_CHARS_TO_REPLACE = 4;
const BEARER_TOKEN = /\bBearer\s+[^\s"',;]+/gi;
const SK_TOKEN = /\bsk-[\w-]{4,}/gi;
const SPECIAL_REGEX_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const SPACE_RUNS = / {2,}/g;
const REDACTED_KEY = "[key removed]";
const REDACTED_ADDRESS = "[address removed]";

type CodePointRange = readonly [first: number, last: number];

/**
 * Characters that show nothing but can sit inside a key to stop it matching:
 * every format character (soft hyphens, direction marks, zero-width characters,
 * invisible operators, tag characters and the byte order mark among them) and
 * the variation selectors.
 */
const INVISIBLE_CHARACTERS = /\p{Cf}|[\uFE00-\uFE0F]|[\u{E0100}-\u{E01EF}]/gu;

/** Control characters (line breaks and tabs among them) and the Unicode line and paragraph separators. */
const SPACED_RANGES: readonly CodePointRange[] = [
	[0x00, 0x1f],
	[0x7f, 0x9f],
	[0x20_28, 0x20_29],
];

const WHITESPACE = /\s/;

const isWithin = (code: number, ranges: readonly CodePointRange[]): boolean =>
	ranges.some(([first, last]) => code >= first && code <= last);

/** A pattern for the needle that allows any whitespace between its characters, ignoring case. */
function spacedPattern(needle: string): RegExp | null {
	const characters = [...needle].filter((char) => !WHITESPACE.test(char));
	return characters.length > 0
		? new RegExp(
				characters
					.map((char) => char.replace(SPECIAL_REGEX_CHARACTERS, "\\$&"))
					.join("\\s*"),
				"gi"
			)
		: null;
}

/**
 * Replaces every occurrence of each needle, longest first, ignoring case and
 * whatever whitespace has been put between its characters.
 */
function removeAll(
	text: string,
	needles: readonly string[],
	replacement: string
): string {
	let cleaned = text;
	for (const needle of [...needles].sort((a, b) => b.length - a.length)) {
		const pattern = spacedPattern(needle);
		if (pattern) {
			cleaned = cleaned.replace(pattern, replacement);
		}
	}
	return cleaned;
}

/** The forms in which the connection's address can appear in a message. */
function addressForms(baseUrl: string): string[] {
	const forms = new Set<string>([baseUrl]);
	if (URL.canParse(baseUrl)) {
		const url = new URL(baseUrl);
		forms.add(url.origin);
		forms.add(url.host);
		forms.add(url.hostname);
	}
	return [...forms];
}

/** The text without invisible characters, and with each control or separator character as a space. */
function withoutHiddenCharacters(text: string): string {
	let cleaned = "";
	for (const char of text.replace(INVISIBLE_CHARACTERS, "")) {
		cleaned += isWithin(char.codePointAt(0) ?? 0, SPACED_RANGES) ? " " : char;
	}
	return cleaned;
}

/**
 * The provider's message made fit to show: invisible characters removed and
 * control characters made spaces first, so that nothing hidden can split the
 * key or the address; then the key, bearer tokens, tokens that start `sk-` and
 * the address removed, the key and address wherever whitespace has been put
 * between their characters; then runs of space collapsed to single spaces, and
 * the result cut to `MAX_PROVIDER_MESSAGE_CHARS` characters.
 * Empty when nothing readable is left.
 */
export function cleanProviderMessage(
	message: string,
	secrets: ProviderSecrets
): string {
	let text = withoutHiddenCharacters(message);
	if (secrets.apiKey && secrets.apiKey.length >= MIN_KEY_CHARS_TO_REPLACE) {
		text = removeAll(text, [secrets.apiKey], REDACTED_KEY);
	}
	text = text
		.replace(BEARER_TOKEN, `Bearer ${REDACTED_KEY}`)
		.replace(SK_TOKEN, REDACTED_KEY);
	text = removeAll(text, addressForms(secrets.baseUrl), REDACTED_ADDRESS)
		.replace(SPACE_RUNS, " ")
		.trim();
	return text.length > MAX_PROVIDER_MESSAGE_CHARS
		? `${text.slice(0, MAX_PROVIDER_MESSAGE_CHARS - 1).trimEnd()}…`
		: text;
}

/** The failure underneath the SDK's retry wrapper, if it is wrapped. */
function underlying(error: unknown): unknown {
	return RetryError.isInstance(error) ? error.lastError : error;
}

/**
 * The text for the user when a reply fails: nothing but the provider's own
 * message, cleaned, when the provider answered with an error. Anything else (a
 * refused address, a dropped connection, a failure inside the SDK), and a
 * provider message with nothing readable in it, gives the fixed text, since
 * that message was not written for the user.
 */
export function providerErrorMessage(
	error: unknown,
	secrets: ProviderSecrets
): string {
	const failure = underlying(error);
	if (!APICallError.isInstance(failure)) {
		return PROVIDER_ERROR_TEXT;
	}
	return cleanProviderMessage(failure.message, secrets) || PROVIDER_ERROR_TEXT;
}
