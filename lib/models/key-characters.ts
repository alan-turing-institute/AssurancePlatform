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
