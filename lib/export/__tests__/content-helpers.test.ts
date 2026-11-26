import { describe, expect, it } from "vitest";
import { escapeMarkdownTableCell } from "../utils";
import { truncateText } from "../utils/content-helpers";

describe("truncateText", () => {
	it.each([
		["shorter than the limit", "abcdefgh", "abcdefgh"],
		["exactly the limit", "abcdefghij", "abcdefghij"],
		["one over the limit", "abcdefghijk", "abcdefg..."],
		["far over the limit", "abcdefghijklmnopqrstuvwxyz", "abcdefg..."],
	])("with text %s", (_label, text, expected) => {
		expect(truncateText(text, 10)).toBe(expected);
	});

	it("keeps the result within the limit, ellipsis included", () => {
		expect(truncateText("x".repeat(200), 100)).toHaveLength(100);
	});
});

describe("escapeMarkdownTableCell line breaks", () => {
	it.each([
		["a line feed", "a\nb"],
		["a carriage return", "a\rb"],
		["a carriage return and line feed", "a\r\nb"],
	])("turns %s into one space", (_label, text) => {
		expect(escapeMarkdownTableCell(text)).toBe("a b");
	});

	it("turns each break into a space and trims the ends", () => {
		expect(escapeMarkdownTableCell("\na\n\nb\r\n")).toBe("a  b");
	});
});
