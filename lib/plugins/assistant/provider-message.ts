import { APICallError, RetryError } from "ai";

/**
 * What the user is told when the model provider fails. The provider's own
 * words are shown to the user whose account they concern (for example, a model
 * that needs an age confirmation before use), cleaned first: invisible
 * characters are removed and control characters become spaces, then the user's
 * key, any bearer token, any `sk-` token and any masked key are replaced, the
 * connection's address is removed, and the text is cut to a short line. They
 * are never written to a log.
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
/**
 * A token that starts `sk-`, masked or not. A full stop belongs to it only
 * when more of the token follows, so the stop that ends a sentence stays.
 */
const SK_TOKEN = /\bsk-(?:[\w*-]|\.(?=[\w*-])){4,}/gi;
/**
 * A token holding a run of four or more `*`, whatever its prefix, with
 * everything attached on either side of the run. Providers mask a key this
 * way and leave its first and last characters showing. Quotes, brackets,
 * commas and semicolons end a token, and so does the stop that ends a
 * sentence. The match starts only at the start of a token, so a long message
 * is scanned once. Markdown emphasis never has four `*` in a row.
 */
const MASKED_TOKEN =
	/(?<![^\s"',;()<>])[^\s"',;()<>]*\*{4,}(?:[^\s"',;()<>]*[^\s"',;()<>.:!?])?/g;
const SPECIAL_REGEX_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const SPACE_RUNS = / {2,}/g;
const REDACTED_KEY = "[key removed]";
const REDACTED_ADDRESS = "[address removed]";
/**
 * Stands for a removed key until every pass has run, so that a later pass
 * cannot take the placeholder's own text for part of a token. The message has
 * no NUL character by then, since control characters have become spaces.
 */
const KEY_MARK = "\u0000";

type CodePointRange = readonly [first: number, last: number];

/**
 * Characters that show nothing but can sit inside a key to stop it matching:
 * every format character (soft hyphens, direction marks, zero-width characters,
 * invisible operators, tag characters and the byte order mark among them) and
 * every other default-ignorable character, which adds the variation selectors,
 * the combining grapheme joiner and the Hangul fillers.
 */
const INVISIBLE_CHARACTERS = /\p{Cf}|\p{Default_Ignorable_Code_Point}/gu;

/** Control characters (line breaks and tabs among them) and the Unicode line and paragraph separators. */
const SPACED_RANGES: readonly CodePointRange[] = [
	[0x00, 0x1f],
	[0x7f, 0x9f],
	[0x20_28, 0x20_29],
];

const WHITESPACE = /\s/;

const isWithin = (code: number, ranges: readonly CodePointRange[]): boolean =>
	ranges.some(([first, last]) => code >= first && code <= last);

/** A letter or digit of any script is not allowed next to a whole-word match. */
const NOT_AFTER_WORD_CHARACTER = String.raw`(?<![\p{L}\p{N}])`;
const NOT_BEFORE_WORD_CHARACTER = String.raw`(?![\p{L}\p{N}])`;

/**
 * A pattern for the needle that allows any whitespace between its characters,
 * ignoring case. With `wholeWord`, a letter or digit next to the match on
 * either side means it is not one.
 */
function spacedPattern(needle: string, wholeWord: boolean): RegExp | null {
	const characters = [...needle].filter((char) => !WHITESPACE.test(char));
	if (characters.length === 0) {
		return null;
	}
	const body = characters
		.map((char) => char.replace(SPECIAL_REGEX_CHARACTERS, "\\$&"))
		.join("\\s*");
	return wholeWord
		? new RegExp(
				`${NOT_AFTER_WORD_CHARACTER}${body}${NOT_BEFORE_WORD_CHARACTER}`,
				"giu"
			)
		: new RegExp(body, "gi");
}

/**
 * Replaces every occurrence of each needle, longest first, ignoring case and
 * whatever whitespace has been put between its characters. With `wholeWord`,
 * only where no letter or digit touches the match.
 */
function removeAll(
	text: string,
	needles: readonly string[],
	replacement: string,
	wholeWord: boolean
): string {
	let cleaned = text;
	for (const needle of [...needles].sort((a, b) => b.length - a.length)) {
		const pattern = spacedPattern(needle, wholeWord);
		if (pattern) {
			cleaned = cleaned.replace(pattern, replacement);
		}
	}
	return cleaned;
}

/**
 * The forms in which the connection's address can appear in a message. A form
 * shorter than this is left out, because it would match ordinary text: a host
 * called `ai` is two letters.
 */
const MIN_ADDRESS_FORM_CHARS = 3;

function addressForms(baseUrl: string): string[] {
	const forms = new Set<string>([baseUrl]);
	if (URL.canParse(baseUrl)) {
		const url = new URL(baseUrl);
		forms.add(url.origin);
		forms.add(url.host);
		forms.add(url.hostname);
	}
	return [...forms].filter((form) => form.length >= MIN_ADDRESS_FORM_CHARS);
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
 * key or the address; then the key, bearer tokens, tokens that start `sk-`,
 * tokens holding a run of `*` (a masked key) and the address removed, the key
 * and address wherever whitespace has been put between their characters, and
 * the address only as a whole word, so that no letter or digit touches it;
 * then runs of space collapsed to single spaces, and the result cut to
 * `MAX_PROVIDER_MESSAGE_CHARS` characters.
 * Empty when nothing readable is left.
 */
export function cleanProviderMessage(
	message: string,
	secrets: ProviderSecrets
): string {
	let text = withoutHiddenCharacters(message);
	if (secrets.apiKey && secrets.apiKey.length >= MIN_KEY_CHARS_TO_REPLACE) {
		text = removeAll(text, [secrets.apiKey], KEY_MARK, false);
	}
	text = text
		.replace(BEARER_TOKEN, `Bearer ${KEY_MARK}`)
		.replace(SK_TOKEN, KEY_MARK)
		.replace(MASKED_TOKEN, KEY_MARK);
	text = removeAll(text, addressForms(secrets.baseUrl), REDACTED_ADDRESS, true)
		.replaceAll(KEY_MARK, REDACTED_KEY)
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
