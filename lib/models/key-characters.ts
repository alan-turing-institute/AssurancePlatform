const PRINTABLE_ASCII = /^[!-~]+$/;

/**
 * Whether a string is one or more printable ASCII characters (U+0021 to
 * U+007E): no space, no control character and nothing above ASCII. Provider
 * keys are ASCII. The HTTP client refuses a header value with a character
 * above U+00FF, and its error message names the character.
 */
export function isPrintableAscii(value: string): boolean {
	return PRINTABLE_ASCII.test(value);
}

/**
 * Whether a string holds a control character (U+0000 to U+001F, or U+007F).
 * Trimming removes whitespace at the ends only, so a key can still carry NUL,
 * CR or LF inside it. A header built from such a key is refused by the HTTP
 * client with an error that quotes the whole header value, key included.
 */
export function hasControlCharacter(value: string): boolean {
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0;
		if (code <= 0x1f || code === 0x7f) {
			return true;
		}
	}
	return false;
}
