import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Features from "../features";

/**
 * The feature list is a description list: each feature is a term followed by
 * its description, grouped in a wrapper, and nothing else sits in the list.
 */

describe("the landing features list", () => {
	it("holds a term and a description for every feature and nothing else", () => {
		const { container } = render(<Features />);

		const list = container.querySelector("dl");
		expect(list).not.toBeNull();
		const groups = Array.from(list?.children ?? []);
		expect(groups.length).toBeGreaterThan(0);
		for (const group of groups) {
			expect(Array.from(group.children).map((el) => el.tagName)).toEqual([
				"DT",
				"DD",
			]);
		}
	});
});
