import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Features from "../features";

/**
 * The feature list is a definition list: its only elements are terms and
 * descriptions (or groups of them), each term followed by a description.
 */

function flattened(dl: Element): Element[] {
	return Array.from(dl.children).flatMap((child) =>
		child.tagName === "DIV" ? Array.from(child.children) : [child]
	);
}

describe("Features", () => {
	it("holds only dt and dd elements, in term-then-description pairs", () => {
		const { container } = render(<Features />);

		const dl = container.querySelector("dl");
		expect(dl).not.toBeNull();
		const tags = flattened(dl as Element).map((el) => el.tagName);
		expect(tags.length).toBeGreaterThan(0);
		expect(tags.length % 2).toBe(0);
		tags.forEach((tag, index) => {
			expect(tag).toBe(index % 2 === 0 ? "DT" : "DD");
		});
	});

	it("keeps every feature name and description text", () => {
		const { container } = render(<Features />);

		const terms = container.querySelectorAll("dt");
		const descriptions = container.querySelectorAll("dd");
		expect(terms.length).toBe(descriptions.length);
		for (const el of [...terms, ...descriptions]) {
			expect(el.textContent?.trim()).not.toBe("");
		}
	});
});
