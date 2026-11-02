// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTextFromHtml } from "@/lib/sanitize-html";
import type { PublishableItemSummaryResponse } from "@/lib/services/discover-transforms";
import PublishedItems from "../published-items";

const TEXT_NODE = 3;

/** Anything from the payloads below that would show an HTML parser was handed one. */
const PAYLOAD_MARKERS =
	/onerror|onload|alert\(|__pwned|<script|<img|<svg|<iframe/i;

function item(
	id: string,
	description: string | null
): PublishableItemSummaryResponse {
	return {
		id,
		slug: `case-${id}`,
		title: `Case ${id}`,
		description,
		type: "ASSURANCE_CASE",
		sector: null,
		authors: null,
		featureImageUrl: null,
		publishedAt: "2026-01-02T00:00:00.000Z",
		archivedAt: null,
	};
}

/** What React writes into the page for a text child. */
function escapeText(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

/** A card's description is the element straight after its title heading. */
function descriptionsIn(root: ParentNode): HTMLElement[] {
	return [...root.querySelectorAll("article")].map((card) => {
		const description = card.querySelector("h3")?.nextElementSibling;
		if (!(description instanceof HTMLElement)) {
			throw new Error("the card has no description element after its title");
		}
		return description;
	});
}

function attributeNamesStartingWithOn(root: ParentNode): string[] {
	return [...root.querySelectorAll("*")].flatMap((element) =>
		element
			.getAttributeNames()
			.filter((name) => name.toLowerCase().startsWith("on"))
	);
}

interface DescriptionCase {
	expected: string;
	html: string | null;
	name: string;
}

const DESCRIPTION_CASES: DescriptionCase[] = [
	{
		name: "an image whose error handler runs script, on its own",
		html: "<img src=x onerror=window.__pwned=1>",
		expected: "",
	},
	{
		name: "an image with an error handler followed by words",
		html: "<img src=x onerror=alert(1)>Plain words",
		expected: "Plain words",
	},
	{
		name: "the same image written as entities",
		html: "&lt;img src=x onerror=alert(1)&gt;",
		expected: "<img src=x onerror=alert(1)>",
	},
	{
		name: "the same image written as double-encoded entities",
		html: "&amp;lt;img src=x onerror=alert(1)&amp;gt;",
		expected: "&lt;img src=x onerror=alert(1)&gt;",
	},
	{
		name: "the same image written as numeric entities",
		html: "&#60;img src=x onerror=alert(1)&#62;",
		expected: "<img src=x onerror=alert(1)>",
	},
	{
		name: "a script element followed by words",
		html: "<script>window.__pwned = 1</script>after",
		expected: "after",
	},
	{
		name: "a script element written as entities",
		html: "&lt;script&gt;alert(1)&lt;/script&gt;",
		expected: "<script>alert(1)</script>",
	},
	{
		name: "an svg with a load handler around words",
		html: "<svg onload=alert(1)>Honest</svg> R&D",
		expected: "Honest R&D",
	},
	{
		name: "a frame pointing at a script address",
		html: "<iframe src=javascript:alert(1)></iframe>Words",
		expected: "Words",
	},
	{
		name: "a link with a script address",
		html: '<a href="javascript:alert(1)" onclick="alert(2)">Read more</a>',
		expected: "Read more",
	},
	{
		name: "honest paragraphs with an ampersand",
		html: "<p>First</p><p>Second &amp; third</p>",
		expected: "First Second & third",
	},
	{
		name: "plain text with an unescaped ampersand and angle brackets",
		html: "R&D costs 5 < 6 and 1<2 and 3>2",
		expected: "R&D costs 5 < 6 and 1<2 and 3>2",
	},
	{ name: "no description", html: null, expected: "" },
];

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("a published description shown on a Discover card", () => {
	it.each(
		DESCRIPTION_CASES
	)("is written as plain text, with no child elements, for $name", ({
		html,
		expected,
	}) => {
		const { container } = render(
			<PublishedItems items={[item("one", html)]} />
		);

		const descriptions = descriptionsIn(container);
		expect(descriptions).toHaveLength(1);
		const description = descriptions[0] as HTMLElement;
		expect(description.childElementCount).toBe(0);
		expect(description.children).toHaveLength(0);
		expect(description.textContent).toBe(expected);
		expect(
			[...description.childNodes].every((node) => node.nodeType === TEXT_NODE)
		).toBe(true);
		expect(description.innerHTML).toBe(escapeText(expected));
	});

	it("leaves no scripting hook anywhere on the page, with every payload listed together", () => {
		const items = DESCRIPTION_CASES.map((c, index) =>
			item(String(index), c.html)
		);
		const { container } = render(<PublishedItems items={items} />);

		expect(container.querySelectorAll("article")).toHaveLength(items.length);
		for (const [index, description] of descriptionsIn(container).entries()) {
			expect(description.childElementCount).toBe(0);
			expect(description.textContent).toBe(DESCRIPTION_CASES[index]?.expected);
		}
		expect(attributeNamesStartingWithOn(container)).toEqual([]);
		expect(
			container.querySelectorAll("script, iframe, object, embed")
		).toHaveLength(0);
		// One feature image per card and nothing a description could have added.
		expect(container.querySelectorAll("img")).toHaveLength(items.length);
		expect(
			(window as unknown as { __pwned?: unknown }).__pwned
		).toBeUndefined();
	});

	it("is never handed to an HTML parser while the list renders", () => {
		const innerHtml = vi.spyOn(Element.prototype, "innerHTML", "set");
		const outerHtml = vi.spyOn(Element.prototype, "outerHTML", "set");
		const adjacent = vi.spyOn(Element.prototype, "insertAdjacentHTML");
		const parser = vi.spyOn(DOMParser.prototype, "parseFromString");
		const fragment = vi.spyOn(Range.prototype, "createContextualFragment");

		render(
			<PublishedItems
				items={DESCRIPTION_CASES.map((c, index) => item(String(index), c.html))}
			/>
		);

		const handedToParser = [innerHtml, outerHtml, adjacent, parser, fragment]
			.flatMap((spy) => spy.mock.calls.map((args) => String(args[0])))
			.filter((html) => PAYLOAD_MARKERS.test(html));
		expect(handedToParser).toEqual([]);
	});

	it("shows, in the browser, the text the server computes for the same descriptions", () => {
		const items = [
			item("a", "<p>Tom &amp; Jerry</p><p>Second</p>"),
			item("b", "   padded with spaces   "),
			item("c", "<img src=x onerror=alert(1)>"),
			item("d", "&lt;img src=x onerror=alert(1)&gt;"),
			item("e", "line one<br>line two"),
			item("f", null),
		];
		const { container } = render(<PublishedItems items={items} />);
		const shown = descriptionsIn(container).map((d) => d.textContent);

		vi.stubGlobal("window", undefined);
		vi.stubGlobal("document", undefined);
		const onServer = items.map((i) => extractTextFromHtml(i.description ?? ""));
		vi.unstubAllGlobals();

		expect(shown).toEqual(onServer);
	});
});
