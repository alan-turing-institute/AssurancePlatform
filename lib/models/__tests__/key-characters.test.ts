import { describe, expect, it } from "vitest";
import { hasControlCharacter, isPrintableAscii } from "../key-characters";

describe("isPrintableAscii", () => {
	it.each([
		["a single printable character", "a"],
		["the first printable character, an exclamation mark", "!"],
		["the last printable character, a tilde", "~"],
		["a typical key", "test-key_0123.ABC"],
	])("accepts %s", (_label, value) => {
		expect(isPrintableAscii(value)).toBe(true);
	});

	it.each([
		["an empty string", ""],
		["a space on its own", " "],
		["a space inside", "test key"],
		["a leading space", " test-key"],
		["a trailing space", "test-key "],
		["a trailing newline", "test-key\n"],
		["a tab inside", "test\tkey"],
		["the delete character", "test\u007fkey"],
		["a character just above ASCII", "test\u0080key"],
		["a letter with an accent", "tést-key"],
		["a character above U+00FF", "test–key"],
	])("rejects %s", (_label, value) => {
		expect(isPrintableAscii(value)).toBe(false);
	});
});

describe("hasControlCharacter", () => {
	it.each([
		["NUL", "ab\u0000cd"],
		["a tab", "ab\tcd"],
		["a line feed", "ab\ncd"],
		["a carriage return", "ab\rcd"],
		["the last C0 control, U+001F", "ab\u001fcd"],
		["delete, U+007F", "ab\u007fcd"],
		["a control character at the start", "\u0001abcd"],
		["a control character at the end", "abcd\u0001"],
	])("finds %s", (_label, value) => {
		expect(hasControlCharacter(value)).toBe(true);
	});

	it.each([
		["an empty string", ""],
		["a space, U+0020, just above the controls", "ab cd"],
		["a tilde, U+007E, just below delete", "ab~cd"],
		["a character just above delete, U+0080", "ab\u0080cd"],
		["an ordinary key", "test-key-123"],
		["a character outside the first plane", "ab\u{1F511}cd"],
	])("finds none in %s", (_label, value) => {
		expect(hasControlCharacter(value)).toBe(false);
	});
});
