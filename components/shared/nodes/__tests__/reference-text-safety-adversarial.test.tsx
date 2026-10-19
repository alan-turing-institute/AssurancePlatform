import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { type DefinedTerm, termsInReach } from "@/lib/case/defined-terms";
import ReferenceText from "../reference-text";
import { plainDescription, previewParts } from "../reference-text-utils";

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";

const IMG = "<img src=x onerror=alert(1)>";
const SCRIPT = "<script>window.__pwned = true</script>";
const MARKUP_SELECTOR = "img, script, b, iframe, svg";

function termWith(name: string, text: string, value: string): DefinedTerm[] {
	return termsInReach([
		{
			id: "g1",
			name: `G1 ${IMG}`,
			context: [{ id: ID_A, name, text, value }],
		},
	]);
}

describe("a reference whose name, meaning or value holds markup", () => {
	it("draws the stored name of a missing definition as text", () => {
		const { container } = render(
			<ReferenceText
				terms={[]}
				text={`See {${IMG}#${ID_B}} and {${SCRIPT}#${ID_A}}.`}
			/>
		);
		expect(container.querySelector(MARKUP_SELECTOR)).toBeNull();
		expect(container.textContent).toContain(IMG);
		expect(container.textContent).toContain(SCRIPT);
		expect(
			(window as unknown as { __pwned?: boolean }).__pwned
		).toBeUndefined();
	});

	it("draws a found term's name, meaning, value and origin as text, in the card and in the tooltip", async () => {
		const user = userEvent.setup();
		const terms = termWith(IMG, `${SCRIPT} ${IMG}`, `${IMG}${SCRIPT}`);
		const { container } = render(
			<ReferenceText terms={terms} text={`Inside {x#${ID_A}}`} withTooltips />
		);
		const word = container.querySelector("[data-reference-id]");
		expect(word).not.toBeNull();
		await user.hover(word as Element);
		expect(document.body.querySelector(MARKUP_SELECTOR)).toBeNull();
		expect(document.body.textContent).toContain(IMG);
		expect(document.body.textContent).toContain(SCRIPT);
		expect(
			(window as unknown as { __pwned?: boolean }).__pwned
		).toBeUndefined();
	});

	it("keeps a reference in a collapsed, cut-short card as text too", () => {
		const terms = termWith(IMG, "meaning", "value");
		const { container } = render(
			<ReferenceText maxLength={200} terms={terms} text={`{x#${ID_A}} tail`} />
		);
		expect(container.querySelector(MARKUP_SELECTOR)).toBeNull();
		expect(container.textContent).toBe(`${IMG} tail`);
	});
});

describe("the highlighted word", () => {
	const terms = termWith("window", "meaning", "value");
	const text = `In the {old#${ID_A}} and the {gone#${ID_B}}.`;

	it("marks a found word and a missing one differently, and tells a screen reader only about the missing one", () => {
		const { container } = render(<ReferenceText terms={terms} text={text} />);
		const words = Array.from(container.querySelectorAll("[data-reference-id]"));
		expect(
			words.map((word) => [
				word.getAttribute("data-reference-id"),
				word.getAttribute("data-reference-state"),
				word.textContent,
			])
		).toEqual([
			[ID_A, "found", "window"],
			[ID_B, "not-found", "gone (definition not found)"],
		]);
		expect(container.querySelectorAll(".sr-only")).toHaveLength(1);
	});

	it("is not focusable, so a card gains no control for keyboard users", () => {
		const { container } = render(
			<ReferenceText terms={terms} text={text} withTooltips />
		);
		for (const word of Array.from(
			container.querySelectorAll("[data-reference-id]")
		)) {
			expect(word.getAttribute("tabindex")).toBeNull();
			expect(word.getAttribute("role")).toBeNull();
			expect(word.closest("button, a, [tabindex]")).toBeNull();
		}
	});

	it("gives a collapsed card's words no tooltip of their own", async () => {
		const user = userEvent.setup();
		const { container } = render(<ReferenceText terms={terms} text={text} />);
		const word = container.querySelector("[data-reference-id]");
		await user.hover(word as Element);
		expect(document.body.textContent).not.toContain("meaning");
		expect(document.body.textContent).not.toContain("value");
		expect(document.querySelector('[role="tooltip"]')).toBeNull();
	});

	it("shows a found word's meaning, value and origin, and a missing word's note, in the tooltip of an expanded card", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<ReferenceText terms={terms} text={text} withTooltips />
		);
		const [found, missing] = Array.from(
			container.querySelectorAll("[data-reference-id]")
		);
		await user.hover(found as Element);
		expect(document.body.textContent).toContain("meaning");
		expect(document.body.textContent).toContain("Value: value");
		expect(document.body.textContent).toContain("Defined on");
		await user.unhover(found as Element);
		await user.hover(missing as Element);
		expect(document.body.textContent).toContain(
			"No definition of 'gone' above this element"
		);
	});
});

describe("the plain-text description used by search, move and attach", () => {
	it("returns markup unchanged as characters and uses the current name", () => {
		const terms = termWith("renamed", "meaning", "value");
		expect(
			plainDescription({
				description: `${IMG} {stale#${ID_A}}`,
				termsInReach: terms,
			})
		).toBe(`${IMG} {renamed}`);
	});

	it("copes with data that holds no description or no terms", () => {
		expect(plainDescription(undefined)).toBe("");
		expect(plainDescription({})).toBe("");
		expect(plainDescription({ description: 5, termsInReach: "x" })).toBe("");
		expect(
			plainDescription({ description: `a {b#${ID_A}}`, termsInReach: {} })
		).toBe("a {b}");
	});
});

describe("previewParts on text without references", () => {
	/** How a collapsed card cut its description before references existed. */
	function cutAsBefore(text: string, maxLength = 180): string {
		if (text.length <= maxLength) {
			return text;
		}
		return `${text.slice(0, maxLength).trim()}...`;
	}

	function cutNow(text: string, maxLength = 180): string {
		const { parts, truncated } = previewParts(text, [], maxLength);
		const shown = parts
			.map((part) => (part.type === "text" ? part.text : part.name))
			.join("");
		return truncated ? `${shown}...` : shown;
	}

	it("cuts exactly where it always cut, for every length around the limit", () => {
		const words =
			"the quick brown fox jumps over the lazy dog and keeps going ";
		const base = words.repeat(8);
		for (let length = 0; length <= 300; length++) {
			const text = base.slice(0, length);
			expect(cutNow(text)).toBe(cutAsBefore(text));
		}
	});

	it("leaves braces and hashes that are not references in place, and cuts the same", () => {
		const text = `${"{not} a #reference {at#all} ".repeat(12)}`;
		for (const limit of [10, 50, 180, 181, 400]) {
			expect(cutNow(text, limit)).toBe(cutAsBefore(text, limit));
		}
	});
});

describe("previewParts: cutting text to the characters people see", () => {
	const terms = termsInReach([
		{
			id: "g1",
			name: "G1",
			context: [{ id: ID_A, name: "window", text: "meaning" }],
		},
	]);
	const text = `Within the {old#${ID_A}} of ten, then more {gone#${ID_B}} text`;

	function visible(parts: ReturnType<typeof previewParts>["parts"]): string {
		return parts
			.map((part) => (part.type === "text" ? part.text : part.name))
			.join("");
	}

	it("counts a reference as the name shown, not as its stored characters", () => {
		const { parts, truncated } = previewParts(text, terms, 1000);
		expect(truncated).toBe(false);
		expect(visible(parts)).toBe(
			"Within the window of ten, then more gone text"
		);
	});

	it("never exceeds the limit, never splits a reference, and says when text was left out", () => {
		const full = "Within the window of ten, then more gone text";
		for (let limit = 0; limit <= full.length + 2; limit++) {
			const { parts, truncated } = previewParts(text, terms, limit);
			const shown = visible(parts);
			expect(shown.length).toBeLessThanOrEqual(limit);
			expect(full.startsWith(shown.trimEnd())).toBe(true);
			expect(truncated).toBe(limit < full.length);
			for (const part of parts) {
				if (part.type === "reference") {
					expect(["window", "gone"]).toContain(part.name);
				} else {
					expect(part.text).not.toContain("{");
				}
			}
		}
	});

	it("marks a reference found or not by whether the term is in reach", () => {
		const { parts } = previewParts(text, terms, 1000);
		const references = parts.filter((part) => part.type === "reference");
		expect(
			references.map((part) => [part.name, part.term !== undefined])
		).toEqual([
			["window", true],
			["gone", false],
		]);
	});
});
