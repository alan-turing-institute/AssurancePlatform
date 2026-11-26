import { describe, expect, it } from "vitest";
import { MessageResponse } from "@/components/ai-elements/message";
import { REPLY_MARKDOWN_PROPS } from "@/lib/plugins/assistant/reply-markdown";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";

/** Draws markdown the way the assistant panel draws a reply. */
function drawReply(markdown: string) {
	return renderWithoutProviders(
		<MessageResponse {...REPLY_MARKDOWN_PROPS}>{markdown}</MessageResponse>
	);
}

/** Markdown for `levels` quotations inside one another, with `text` at the bottom. */
const nestedQuotes = (levels: number, text: string) =>
	`${"> ".repeat(levels)}${text}`;

describe("links in a reply", () => {
	it.each([
		["http", "http://example.com/page"],
		["https", "https://example.com/page"],
		["mailto", "mailto:someone@example.com"],
	])("keeps a %s link live, behind the confirmation step", (_protocol, address) => {
		drawReply(`See [the link](${address}) now`);

		expect(
			screen.getByRole("button", { name: "the link" })
		).toBeInTheDocument();
	});

	it.each([
		["tel", "tel:+441234567890"],
		["irc", "irc://irc.example.com/room"],
		["xmpp", "xmpp:someone@example.com"],
		["javascript", "javascript:alert(1)"],
	])("shows a %s link as plain text", (_protocol, address) => {
		const { container } = drawReply(`See [the link](${address}) now`);

		expect(screen.queryByRole("button", { name: "the link" })).toBeNull();
		expect(container.querySelector("a")).toBeNull();
		expect(container).toHaveTextContent("the link");
	});
});

describe("images in a reply", () => {
	it.each([
		["a web address", "https://example.com/picture.png"],
		["inline data", "data:image/png;base64,iVBORw0KGgo="],
	])("shows an image from %s as its alt text and fetches nothing", (_source, address) => {
		const { container } = drawReply(`![the picture](${address})`);

		expect(container.querySelector("img")).toBeNull();
		expect(container).toHaveTextContent("the picture");
	});
});

describe("deeply nested replies", () => {
	it.each([
		[1, 1],
		[49, 49],
		[50, 50],
		[51, 50],
		[200, 50],
	])("draws %i nested quotations as %i levels", (levels, drawn) => {
		const { container } = drawReply(nestedQuotes(levels, "bottom"));

		expect(container.querySelectorAll("blockquote")).toHaveLength(drawn);
		expect(container).toHaveTextContent("bottom");
	});

	it("keeps the text under the cut-off levels in reading order", () => {
		const { container } = drawReply(
			nestedQuotes(80, "first **second** third _fourth_ fifth")
		);

		expect(container.textContent?.replace(/\s+/g, " ").trim()).toBe(
			"first second third fourth fifth"
		);
	});
});
