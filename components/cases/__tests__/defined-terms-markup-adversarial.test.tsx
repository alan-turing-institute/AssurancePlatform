// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helper is called from within it() blocks
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AttributeSection from "@/components/shared/nodes/attribute-section";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import ReferenceSuggestionList from "../reference-suggestion-list";
import TermsInReachList from "../terms-in-reach-list";

const IMG = "<img src=x onerror=alert(1)>";
const SCRIPT = "<script>window.__pwned = true</script>";
const BOLD = "<b>bold</b>";
const MARKUP_SELECTOR = "img, script, b, iframe, object";

function hostileTerm(): DefinedTerm {
	return {
		id: "aaaaaaaaaa",
		name: `${BOLD} name`,
		text: `${IMG} meaning`,
		value: `${SCRIPT} value`,
		definedOn: { elementId: "g1", elementName: `G1 ${BOLD}` },
	};
}

function expectTextOnly(root: ParentNode, ...texts: string[]) {
	expect(root.querySelector(MARKUP_SELECTOR)).toBeNull();
	const content = (root as Element).textContent ?? "";
	for (const text of texts) {
		expect(content).toContain(text);
	}
	expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
}

describe("a name, meaning or value that holds markup, in the edit dialog and on an expanded card", () => {
	it("is listed as text under 'Terms you can use here'", () => {
		const { container } = render(<TermsInReachList terms={[hostileTerm()]} />);
		expectTextOnly(container, BOLD, IMG, SCRIPT);
	});

	it("is listed as text in the pick-list that opens on {", () => {
		render(
			<ReferenceSuggestionList
				activeIndex={0}
				hasTerms
				list={{
					items: [hostileTerm()],
					position: null,
					query: "",
					select: vi.fn(),
				}}
				listId="list"
				onClose={vi.fn()}
				onHover={vi.fn()}
			/>
		);
		expectTextOnly(document.body, BOLD, IMG, SCRIPT);
	});

	it("is written as text in the context section of an expanded card", () => {
		const term = hostileTerm();
		const { container } = render(
			<AttributeSection
				assumption={`Assumes {${IMG}#bbbbbbbbbb}`}
				context={[
					{
						id: "aaaaaaaaaa",
						name: term.name,
						text: term.text,
						value: term.value,
					},
					`plain ${BOLD}`,
				]}
				justification={"Because {x#aaaaaaaaaa}"}
				nodeType="goal"
				terms={[term]}
			/>
		);
		expectTextOnly(container, BOLD, IMG, SCRIPT);
	});
});
