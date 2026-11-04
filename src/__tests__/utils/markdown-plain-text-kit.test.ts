import { describe, expect, it } from "vitest";
import {
	bareAddresses,
	inlineLinkCount,
	linkTargets,
	readAs,
	unescapedPositions,
	withoutLinkTargets,
} from "./markdown-plain-text-kit";

/**
 * The Markdown tests rely on this reader to tell what a viewer would show and
 * link. These checks keep it from passing everything or flagging everything.
 */
describe("the Markdown test reader", () => {
	describe("an autolink to a web or mail address", () => {
		it.each([
			"<https://a.example/x>",
			"<http://a.example/x?a=1&b=2>",
			"<HTTPS://A.EXAMPLE/X>",
			"<mailto:me@a.example>",
			"<https://a.example/[1](javascript:alert(1))>",
			"<https://a.example/a\\>",
		])("is the exporter's own link, so %j holds no unescaped markup", (text) => {
			expect(unescapedPositions(text, "<")).toEqual([]);
			expect(unescapedPositions(text, "[")).toEqual([]);
			expect(unescapedPositions(text, "]")).toEqual([]);
		});

		it("is shown as its address, with nothing inside it read as markup", () => {
			expect(readAs("see <https://a.example/?a=1&b=2&lt;> now")).toBe(
				"see https://a.example/?a=1&b=2&lt; now"
			);
			expect(readAs("&lt;<https://a.example/x>>")).toBe(
				"<https://a.example/x>"
			);
			expect(readAs("<https://a.example/a\\b>")).toBe("https://a.example/a\\b");
		});

		it("is a link whose target is the address", () => {
			expect(
				linkTargets("a <https://a.example/x> b <mailto:me@a.example>")
			).toEqual(["https://a.example/x", "mailto:me@a.example"]);
			expect(
				linkTargets("<https://a.example/x](javascript:alert(1))>")
			).toEqual(["https://a.example/x](javascript:alert(1))"]);
			expect(inlineLinkCount("<https://a.example/x>")).toBe(0);
		});
	});

	describe("anything else that starts with an angle bracket", () => {
		it.each([
			"<javascript:alert(1)>",
			"<data:text/html,x>",
			"<ftp://a.example/x>",
			"<a@b.example>",
			"<https://a.example/x",
			"<https://a.example/x y>",
			"<https://a.example/<b>",
			"<img src=x onerror=alert(1)>",
			"<https://a.example/><img src=x>",
		])("still counts %j as markup", (text) => {
			expect(unescapedPositions(text, "<").length).toBeGreaterThan(0);
		});

		it("does not count an escaped or character-reference bracket", () => {
			expect(unescapedPositions("\\<https://a.example/x>", "<")).toEqual([]);
			expect(unescapedPositions("&lt;img src=x>", "<")).toEqual([]);
		});

		it("is read as a link when it is an autolink to another scheme", () => {
			expect(linkTargets("<javascript:alert(1)>")).toEqual([
				"javascript:alert(1)",
			]);
			expect(linkTargets("<a@b.example>")).toEqual(["mailto:a@b.example"]);
			expect(linkTargets("<img src=x>")).toEqual([]);
			expect(linkTargets("<img>")).toEqual([]);
		});
	});

	describe("a link written with brackets", () => {
		it("is found, with its target cut out of the text around it", () => {
			const text =
				"[a](<https://a.example/x)y>) and [b](https://b.example/(c))";

			expect(linkTargets(text)).toEqual([
				"https://a.example/x)y",
				"https://b.example/(c)",
			]);
			expect(inlineLinkCount(text)).toBe(2);
			expect(withoutLinkTargets(text)).toBe("[a]() and [b]()");
		});

		it("is not found when its closing bracket is escaped", () => {
			expect(linkTargets("[a\\](javascript:alert(1))")).toEqual([]);
		});
	});

	describe("an address left in plain text", () => {
		it("is reported, because a viewer that links text on sight would link it", () => {
			expect(bareAddresses("see https://a.example/?a=1\\&b=2 now")).toEqual([
				"https://a.example/?a=1\\&b=2",
			]);
			expect(bareAddresses("mailto:me@a.example")).toEqual([
				"mailto:me@a.example",
			]);
		});

		it("is not reported once it is an autolink", () => {
			expect(bareAddresses("see <https://a.example/?a=1&b=2> now")).toEqual([]);
		});
	});
});
