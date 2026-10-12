import { APICallError, RetryError } from "ai";

/**
 * What the user is told when the model provider fails. The provider's own
 * words are shown to the user whose account they concern (for example, a model
 * that needs an age confirmation before use), cleaned first: the user's key
 * and any bearer token are replaced, the connection's address is removed, and
 * the text is cut to a short line. They are never written to a log.
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
const SPECIAL_REGEX_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const SPACE_RUNS = / {2,}/g;
const REDACTED_KEY = "[key removed]";
const REDACTED_ADDRESS = "[address removed]";

/** Replaces every occurrence of each needle, longest first, ignoring case. */
function removeAll(
	text: string,
	needles: readonly string[],
	replacement: string
): string {
	let cleaned = text;
	for (const needle of [...needles].sort((a, b) => b.length - a.length)) {
		if (needle.length > 0) {
			cleaned = cleaned.replace(
				new RegExp(needle.replace(SPECIAL_REGEX_CHARACTERS, "\\$&"), "gi"),
				replacement
			);
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

/** Each control character (including line breaks and tabs) as a space. */
function withoutControlCharacters(text: string): string {
	let cleaned = "";
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		cleaned += code <= 0x1f || code === 0x7f ? " " : char;
	}
	return cleaned;
}

/**
 * The provider's message made fit to show: the key, bearer tokens and the
 * address removed, control characters and runs of space collapsed to single
 * spaces, and the result cut to `MAX_PROVIDER_MESSAGE_CHARS` characters.
 * Empty when nothing readable is left.
 */
export function cleanProviderMessage(
	message: string,
	secrets: ProviderSecrets
): string {
	let text = message;
	if (secrets.apiKey && secrets.apiKey.length >= MIN_KEY_CHARS_TO_REPLACE) {
		text = removeAll(text, [secrets.apiKey], REDACTED_KEY);
	}
	text = text.replace(BEARER_TOKEN, `Bearer ${REDACTED_KEY}`);
	text = removeAll(text, addressForms(secrets.baseUrl), REDACTED_ADDRESS);
	text = withoutControlCharacters(text).replace(SPACE_RUNS, " ").trim();
	return text.length > MAX_PROVIDER_MESSAGE_CHARS
		? `${text.slice(0, MAX_PROVIDER_MESSAGE_CHARS - 1).trimEnd()}…`
		: text;
}

/** The failure underneath the SDK's retry wrapper, if it is wrapped. */
function underlying(error: unknown): unknown {
	return RetryError.isInstance(error) ? error.lastError : error;
}

/**
 * The text for the user when a reply fails. A provider's HTTP answer gives
 * its own message and status, cleaned; anything else (a refused address, a
 * dropped connection, a failure inside the SDK) gives the fixed text alone,
 * since its message was not written by the provider.
 */
export function providerErrorMessage(
	error: unknown,
	secrets: ProviderSecrets
): string {
	const failure = underlying(error);
	if (!APICallError.isInstance(failure)) {
		return PROVIDER_ERROR_TEXT;
	}
	const said = cleanProviderMessage(failure.message, secrets);
	if (said.length === 0) {
		return PROVIDER_ERROR_TEXT;
	}
	const status =
		typeof failure.statusCode === "number"
			? ` (HTTP ${failure.statusCode})`
			: "";
	return `${PROVIDER_ERROR_TEXT} It said${status}: ${said}`;
}
