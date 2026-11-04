import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SanitisedHtml } from "../sanitised-html";

describe("SanitisedHtml — class attribute", () => {
	it("renders a description without any class from its text", () => {
		const { container } = render(
			<SanitisedHtml html='<div class="fixed inset-0 z-50 bg-background"><h2 class="text-4xl">Heading</h2><p class="p-8">Body <strong class="font-bold">text</strong></p></div>' />
		);

		expect(container.querySelectorAll("[class]")).toHaveLength(0);
		expect(container.querySelector("h2")?.textContent).toBe("Heading");
		expect(container.querySelector("p > strong")?.textContent).toBe("text");
	});

	it("keeps the wrapper's own class and gives nothing inside it a class", () => {
		const { container } = render(
			<SanitisedHtml
				className="prose max-w-none"
				html='<p class="fixed inset-0">one</p><ul class="x"><li class="y">two</li></ul><a class="z" href="https://example.com/">three</a>'
			/>
		);

		const classed = Array.from(container.querySelectorAll("[class]"));
		expect(classed).toHaveLength(1);
		expect(classed[0]).toBe(container.firstElementChild);
		expect(classed[0]?.className).toBe("prose max-w-none");
		expect(container.textContent).toBe("onetwothree");
	});

	it("still renders the formatting a description may use", () => {
		const { container } = render(
			<SanitisedHtml html="<p><strong>bold</strong> <em>italic</em></p><ol><li>one</li></ol>" />
		);

		expect(container.querySelector("strong")?.textContent).toBe("bold");
		expect(container.querySelector("em")?.textContent).toBe("italic");
		expect(container.querySelector("ol > li")?.textContent).toBe("one");
	});
});
