/**
 * Characters for the sign-in identifier tests, built from code points so the
 * source holds no invisible or look-alike characters.
 */
const at = (codePoint: number): string => String.fromCodePoint(codePoint);

export const NO_BREAK_SPACE = at(0x00_a0);

/** Non-ASCII capitals that some database locales fold to ASCII lowercase. */
export const DOTTED_CAPITAL_I = at(0x01_30);
export const KELVIN_SIGN = at(0x21_2a);
export const FULLWIDTH_CAPITAL_A = at(0xff_21);

/** Every character that `String.prototype.trim` removes, with a label. */
export const TRIMMED_WHITESPACE: ReadonlyArray<readonly [string, string]> = [
	["a space", " "],
	["a tab", "\t"],
	["a line feed", "\n"],
	["a vertical tab", "\v"],
	["a form feed", "\f"],
	["a carriage return", "\r"],
	["a no-break space", NO_BREAK_SPACE],
	["an ogham space mark", at(0x16_80)],
	["an en quad", at(0x20_00)],
	["an em space", at(0x20_03)],
	["a hair space", at(0x20_0a)],
	["a line separator", at(0x20_28)],
	["a paragraph separator", at(0x20_29)],
	["a narrow no-break space", at(0x20_2f)],
	["a medium mathematical space", at(0x20_5f)],
	["an ideographic space", at(0x30_00)],
	["a byte order mark", at(0xfe_ff)],
];
