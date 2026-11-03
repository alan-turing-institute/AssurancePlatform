import { configure, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
	type DefinedTerm,
	plainReferenceText,
	termsInReach,
} from "@/lib/case/defined-terms";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { renderWithReactFlow } from "@/src/__tests__/utils/test-utils";
import SearchNodes from "../../../cases/search-nodes";
import BaseNode from "../base-node";
import ReferenceText from "../reference-text";
import {
	plainDescription,
	previewParts,
	searchableDescription,
} from "../reference-text-utils";

// The dialogs, editors and cards are slow to settle on a busy machine.
configure({ asyncUtilTimeout: 10_000 });

/**
 * What a card, a list and a search show for a variable: the value in place of
 * the name, "[name]" while there is none, the name alone for any other term,
 * and nothing of a value read as markup or as a reference.
 */

const SYS = "aaaaaaaaaa";
const WIN = "bbbbbbbbbb";
const OTHER = "cccccccccc";

type Entry = Extract<ContextEntry, object>;

const variable = (value?: string, name = "system", id = SYS): Entry => ({
	id,
	name,
	text: "the system under test",
	...(value === undefined ? {} : { value }),
	variable: true,
});
const ordinary = (value?: string, name = "window", id = WIN): Entry => ({
	id,
	name,
	text: "the moving interval",
	...(value === undefined ? {} : { value }),
});
const reach = (...entries: Entry[]): DefinedTerm[] =>
	termsInReach([{ id: "g1", name: "G1", context: entries }]);
const ref = (name: string, id: string) => `{${name}#${id}}`;

const IMG = "<img src=x onerror=alert(1)>";
const SCRIPT = "<script>window.__pwned = true</script>";
const MARKUP_SELECTOR = "img, script, b, iframe, svg, a, h1";
const NOT_SET = /not set/i;
/** What would be markup in a card; the card draws its own icons as svg. */
const MARKUP_IN_CARD = "img, script, b, iframe, h1";

function words(container: HTMLElement) {
	return Array.from(container.querySelectorAll("[data-reference-id]"));
}

/** The words a person sees for the parts: names and values, no ellipsis. */
function shown(parts: ReturnType<typeof previewParts>["parts"]): string {
	return parts
		.map((part) => (part.type === "text" ? part.text : part.name))
		.join("");
}

describe("the parts of a card's text", () => {
	const text = `A ${ref("system", SYS)} here`;

	it("shows a variable's value as the word of its reference, with no flag that it is unset", () => {
		const { parts, truncated } = previewParts(
			text,
			reach(variable("AcmeBot")),
			180
		);
		expect(truncated).toBe(false);
		expect(parts).toHaveLength(3);
		expect(parts[1]).toMatchObject({
			type: "reference",
			id: SYS,
			name: "AcmeBot",
		});
		expect(parts[1]).not.toHaveProperty("unfilled", true);
	});

	it("shows [name] flagged as unset while there is no value", () => {
		const { parts } = previewParts(text, reach(variable()), 180);
		expect(parts[1]).toMatchObject({ name: "[system]", unfilled: true });
	});

	it.each([
		["spaces", "   "],
		["a newline", "\n"],
		["an empty string", ""],
	])("flags a variable whose value is %s as unset", (_what, value) => {
		const { parts } = previewParts(text, reach(variable(value)), 180);
		expect(parts[1]).toMatchObject({ name: "[system]", unfilled: true });
	});

	it("keeps an ordinary term's name, whatever its value, and never flags it", () => {
		for (const term of [ordinary("5 minutes"), ordinary(), ordinary("   ")]) {
			const { parts } = previewParts(
				`In ${ref("window", WIN)}`,
				reach(term),
				180
			);
			expect(parts[1]).toMatchObject({ name: "window" });
			expect(parts[1]).not.toHaveProperty("unfilled", true);
		}
	});

	it("keeps the stored name for a variable that is out of reach, and never flags it", () => {
		const { parts } = previewParts(text, [], 180);
		expect(parts[1]).toMatchObject({ name: "system", term: undefined });
		expect(parts[1]).not.toHaveProperty("unfilled", true);
	});

	it("keeps the reference id on a variable's part, so the card can find the term", () => {
		const terms = reach(variable("AcmeBot"));
		const { parts } = previewParts(text, terms, 180);
		expect(parts[1]).toMatchObject({ id: SYS, term: terms[0] });
	});

	it("cuts a long value like ordinary text, to the room that is left", () => {
		const value = "0123456789".repeat(5);
		const { parts, truncated } = previewParts(
			`Pre ${ref("system", SYS)} post`,
			reach(variable(value)),
			20
		);
		expect(truncated).toBe(true);
		expect(shown(parts)).toBe(`Pre ${value.slice(0, 16)}`);
		expect(parts.at(-1)).toMatchObject({ type: "reference" });
	});

	it("shows a value that exactly fills the room in full and does not say it was cut", () => {
		const { parts, truncated } = previewParts(
			ref("system", SYS),
			reach(variable("x".repeat(40))),
			40
		);
		expect(truncated).toBe(false);
		expect(shown(parts)).toBe("x".repeat(40));
	});

	it("cuts a value one character too long", () => {
		const { parts, truncated } = previewParts(
			ref("system", SYS),
			reach(variable("x".repeat(41))),
			40
		);
		expect(truncated).toBe(true);
		expect(shown(parts)).toBe("x".repeat(40));
	});

	it("drops the space a cut leaves at the end of a value", () => {
		const { parts, truncated } = previewParts(
			ref("system", SYS),
			reach(variable("AcmeBot Ltd")),
			8
		);
		expect(truncated).toBe(true);
		expect(shown(parts)).toBe("AcmeBot");
	});

	it("leaves out an unset variable's [name] whole when it does not fit, as it does a name", () => {
		const { parts, truncated } = previewParts(
			`abc ${ref("system", SYS)}`,
			reach(variable()),
			8
		);
		expect(truncated).toBe(true);
		expect(shown(parts)).toBe("abc");
		expect(parts.some((part) => part.type === "reference")).toBe(false);
	});

	it("starts nothing after the room has gone, and never leaves an empty word behind", () => {
		const { parts, truncated } = previewParts(
			`${"a".repeat(10)}${ref("system", SYS)}`,
			reach(variable("AcmeBot")),
			10
		);
		expect(truncated).toBe(true);
		expect(shown(parts)).toBe("a".repeat(10));
		expect(parts.some((part) => part.type === "reference")).toBe(false);
	});

	it("counts the words seen, not the stored token, when it decides to cut", () => {
		const stored = `${"a".repeat(170)}${ref("system", SYS)}`;
		expect(stored.length).toBeGreaterThan(180);
		const fits = previewParts(stored, reach(variable("0123456789")), 180);
		expect(fits.truncated).toBe(false);
		const cut = previewParts(stored, reach(variable("0123456789A")), 180);
		expect(cut.truncated).toBe(true);
		expect(shown(cut.parts)).toBe(`${"a".repeat(170)}0123456789`);
	});

	it("keeps the cut within the room for every room from zero up, with no empty word", () => {
		const terms = reach(variable("AcmeBot Ltd"), ordinary("5"));
		const input = `Hello ${ref("system", SYS)} and ${ref("window", WIN)} then ${ref("system", SYS)} the end`;
		const full = shown(previewParts(input, terms, 10_000).parts);
		for (let room = 0; room <= full.length + 2; room++) {
			const { parts, truncated } = previewParts(input, terms, room);
			const text = shown(parts);
			expect(text.length).toBeLessThanOrEqual(room);
			expect(full.startsWith(text)).toBe(true);
			expect(truncated).toBe(text.length < full.length);
			for (const part of parts) {
				if (part.type === "reference") {
					expect(part.name.length).toBeGreaterThan(0);
				}
			}
		}
	});

	it.each([
		["markup", IMG],
		["a script", SCRIPT],
		["a reference", `{other#${OTHER}}`],
		["braces", "{}{"],
	])("keeps a value of %s in one word, as it was written", (_what, value) => {
		const { parts } = previewParts(
			ref("system", SYS),
			reach(variable(value), variable("FILLED", "other", OTHER)),
			180
		);
		expect(parts).toHaveLength(1);
		expect(parts[0]).toMatchObject({ type: "reference", name: value });
	});
});

describe("the description in plain form", () => {
	const description = `The ${ref("system", SYS)} and ${ref("window", WIN)}`;

	it("shows a variable as its value and any other term as {name}", () => {
		const data = {
			description,
			termsInReach: reach(variable("AcmeBot"), ordinary("5 minutes")),
		};
		expect(plainDescription(data)).toBe("The AcmeBot and {window}");
	});

	it("shows an unset variable as [name]", () => {
		const data = { description, termsInReach: reach(variable(), ordinary()) };
		expect(plainDescription(data)).toBe("The [system] and {window}");
	});

	it("shows a reference with no terms as {name}", () => {
		expect(plainDescription({ description })).toBe("The {system} and {window}");
		expect(plainDescription({ description, termsInReach: "x" })).toBe(
			"The {system} and {window}"
		);
		expect(plainDescription(undefined)).toBe("");
	});

	it("matches the plain-text copy the exports use, for every hostile value", () => {
		for (const value of [IMG, `{other#${OTHER}}`, "}", "=", "a\nb", "$&"]) {
			const terms = reach(variable(value));
			expect(plainDescription({ description, termsInReach: terms })).toBe(
				plainReferenceText(description, terms)
			);
		}
	});
});

describe("the text a search is matched against", () => {
	const description = `The ${ref("system", SYS)} and ${ref("window", WIN)}`;
	const terms = reach(variable("AcmeBot"), ordinary("5 minutes"));

	it("holds the words shown and the name of each variable mentioned", () => {
		const text = searchableDescription({ description, termsInReach: terms });
		expect(text).toContain("AcmeBot");
		expect(text).toContain("system");
		expect(text).toContain("{window}");
	});

	it("does not hold an ordinary term's value or id, or the id of a variable", () => {
		const text = searchableDescription({ description, termsInReach: terms });
		expect(text).not.toContain("5 minutes");
		expect(text).not.toContain(WIN);
		expect(text).not.toContain(SYS);
	});

	it("is exactly the plain form when no variable is mentioned", () => {
		const data = { description, termsInReach: reach(ordinary("5")) };
		expect(searchableDescription(data)).toBe(plainDescription(data));
		expect(searchableDescription({ description: "plain" })).toBe("plain");
	});

	it("does not hold the name of a variable the text does not mention", () => {
		const data = {
			description: "Nothing here",
			termsInReach: reach(variable("AcmeBot")),
		};
		expect(searchableDescription(data)).toBe("Nothing here");
	});

	it("does not hold the name of a variable that is out of reach", () => {
		expect(
			searchableDescription({ description: ref("system", SYS) })
		).not.toContain("[");
	});
});

describe("a reference drawn as a word", () => {
	it("draws a variable's value as text in the word, and marks no value as unset", () => {
		const { container } = render(
			<ReferenceText
				terms={reach(variable("AcmeBot"), variable(undefined, "other", OTHER))}
				text={`${ref("system", SYS)} ${ref("other", OTHER)}`}
			/>
		);
		const [set, unset] = words(container);
		expect(set?.textContent).toBe("AcmeBot");
		expect(set?.hasAttribute("data-reference-unfilled")).toBe(false);
		expect(unset?.textContent).toContain("[other]");
		expect(unset?.hasAttribute("data-reference-unfilled")).toBe(true);
		expect(set?.getAttribute("data-reference-state")).toBe("found");
		expect(unset?.getAttribute("data-reference-state")).toBe("found");
	});

	it("tells a screen reader that an unset variable has no value, and says nothing extra of a set one", () => {
		const { container } = render(
			<ReferenceText
				terms={reach(variable("AcmeBot"), variable(undefined, "other", OTHER))}
				text={`${ref("system", SYS)} ${ref("other", OTHER)}`}
			/>
		);
		const [set, unset] = words(container);
		expect(set?.querySelector(".sr-only")).toBeNull();
		expect(unset?.querySelector(".sr-only")?.textContent).toMatch(NOT_SET);
	});

	it("draws an ordinary term exactly as before", () => {
		const { container } = render(
			<ReferenceText terms={reach(ordinary("5"))} text={ref("window", WIN)} />
		);
		const [word] = words(container);
		expect(word?.textContent).toBe("window");
		expect(word?.hasAttribute("data-reference-unfilled")).toBe(false);
		expect(word?.className).toContain("bg-primary/15");
		expect(word?.className).not.toContain("border-dashed");
	});

	it("draws a set variable like a found term and an unset one in a way that is not colour alone", () => {
		const { container } = render(
			<ReferenceText
				terms={reach(variable("AcmeBot"), variable(undefined, "other", OTHER))}
				text={`${ref("system", SYS)} ${ref("other", OTHER)}`}
			/>
		);
		const [set, unset] = words(container);
		expect(set?.className).toContain("bg-primary/15");
		expect(unset?.className).toContain("border-dashed");
		expect(unset?.className).not.toBe(set?.className);
	});

	it("draws a variable that is out of reach as a missing definition, not as an unset variable", () => {
		const { container } = render(
			<ReferenceText terms={[]} text={ref("system", SYS)} />
		);
		const [word] = words(container);
		expect(word?.getAttribute("data-reference-state")).toBe("not-found");
		expect(word?.hasAttribute("data-reference-unfilled")).toBe(false);
		expect(word?.textContent).toContain("system");
		expect(word?.textContent).not.toContain("[system]");
	});

	it.each([
		["markup", IMG],
		["a script", SCRIPT],
		["a heading and emphasis", "# **bold** [x](https://example.test)"],
	])("draws a value of %s as text", (_what, value) => {
		const { container } = render(
			<ReferenceText
				maxLength={400}
				terms={reach(variable(value))}
				text={`Inside ${ref("system", SYS)} tail`}
			/>
		);
		expect(container.querySelector(MARKUP_SELECTOR)).toBeNull();
		expect(container.textContent).toBe(`Inside ${value} tail`);
		expect(
			(window as unknown as { __pwned?: boolean }).__pwned
		).toBeUndefined();
	});

	it("draws a value that holds a reference as that text, not as the term it names", () => {
		const terms = reach(
			variable(`{other#${OTHER}}`),
			variable("FILLED", "other", OTHER)
		);
		const { container } = render(
			<ReferenceText terms={terms} text={ref("system", SYS)} />
		);
		expect(words(container)).toHaveLength(1);
		expect(container.textContent).toBe(`{other#${OTHER}}`);
	});

	it("shows the value, or that it is not set, in the tooltip of an expanded card, as text", async () => {
		const user = userEvent.setup();
		const terms = reach(
			variable(`${IMG}${SCRIPT}`),
			variable(undefined, "other", OTHER)
		);
		const { container } = render(
			<ReferenceText
				terms={terms}
				text={`${ref("system", SYS)} ${ref("other", OTHER)}`}
				withTooltips
			/>
		);
		const [set, unset] = words(container);
		await user.hover(set as Element);
		expect(document.body.querySelector(MARKUP_SELECTOR)).toBeNull();
		expect(document.body.textContent).toContain(IMG);
		expect(document.body.textContent).toContain("the system under test");
		await user.unhover(set as Element);
		await user.hover(unset as Element);
		await waitFor(() => expect(document.body.textContent).toMatch(NOT_SET));
	});

	it("keeps an ordinary term's value in the tooltip as before", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<ReferenceText
				terms={reach(ordinary("5 minutes"))}
				text={ref("window", WIN)}
				withTooltips
			/>
		);
		await user.hover(words(container)[0] as Element);
		expect(document.body.textContent).toContain("Value: 5 minutes");
		expect(document.body.textContent).not.toMatch(NOT_SET);
	});
});

describe("a card with a variable", () => {
	it("shows the value in the collapsed card, with no braces or id", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				description={`The ${ref("system", SYS)} is safe`}
				name="P1"
				nodeType="property"
				terms={reach(variable("AcmeBot"))}
			/>
		);
		expect(container.textContent).toContain("The AcmeBot is safe");
		expect(container.textContent).not.toContain(SYS);
		expect(container.textContent).not.toContain("{");
	});

	it("shows [name] in a dashed outline while there is no value", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				description={`The ${ref("system", SYS)} is safe`}
				name="P1"
				nodeType="property"
				terms={reach(variable())}
			/>
		);
		expect(container.textContent).toContain("[system]");
		expect(container.textContent).toContain("is safe");
		const [word] = words(container);
		expect(word?.hasAttribute("data-reference-unfilled")).toBe(true);
	});

	it("shows an ordinary term as its name, as before", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				description={`In the ${ref("window", WIN)}`}
				name="P1"
				nodeType="property"
				terms={reach(ordinary("5 minutes"))}
			/>
		);
		expect(container.textContent).toContain("In the window");
		expect(container.textContent).not.toContain("5 minutes");
		expect(words(container)[0]?.hasAttribute("data-reference-unfilled")).toBe(
			false
		);
	});

	it("writes a card given no terms as {name}, never as a value or [name]", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				description={`The ${ref("system", SYS)} is safe`}
				name="P1"
				nodeType="property"
			/>
		);
		expect(container.textContent).toContain("The {system} is safe");
		expect(container.textContent).not.toContain("[system]");
	});

	it("cuts a long text through the value, and shows the whole text with the value in the tooltip", async () => {
		const user = userEvent.setup();
		const value = "V".repeat(60);
		const description = `${"b".repeat(150)} ${ref("system", SYS)} and then more`;
		const { container } = renderWithReactFlow(
			<BaseNode
				description={description}
				name="P1"
				nodeType="property"
				terms={reach(variable(value))}
			/>
		);
		const shownText = container.querySelector("p")?.textContent ?? "";
		expect(shownText).toContain("...");
		expect(shownText).toContain("V".repeat(29));
		expect(shownText).not.toContain("V".repeat(31));
		expect(shownText).not.toContain("and then more");
		await user.hover(container.querySelector("p") as Element);
		await waitFor(() =>
			expect(document.body.textContent).toContain(
				`${"b".repeat(150)} ${value} and then more`
			)
		);
		expect(document.body.textContent).not.toContain(SYS);
		expect(document.body.textContent).not.toContain("{system}");
	});

	it("decides to cut by the value's length, not the token's", () => {
		const description = `${"c".repeat(170)}${ref("system", SYS)}`;
		const { container } = renderWithReactFlow(
			<BaseNode
				description={description}
				name="P1"
				nodeType="property"
				terms={reach(variable("0123456789"))}
			/>
		);
		expect(container.textContent).not.toContain("...");
		const cut = renderWithReactFlow(
			<BaseNode
				description={description}
				name="P2"
				nodeType="property"
				terms={reach(variable("0123456789ABC"))}
			/>
		);
		expect(cut.container.textContent).toContain("...");
	});

	it("shows the value in the assumption, the justification and a plain context line of an expanded card", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				assumption={`Assumes ${ref("system", SYS)}`}
				context={[
					variable("AcmeBot"),
					`scope ${ref("system", SYS)}`,
					ordinary("5 minutes"),
				]}
				description={`The ${ref("system", SYS)}`}
				initialExpanded
				justification={`Because ${ref("system", SYS)} and ${ref("window", WIN)}`}
				name="P1"
				nodeType="property"
				terms={reach(variable("AcmeBot"), ordinary("5 minutes"))}
			/>
		);
		const text = container.textContent ?? "";
		expect(text).toContain("Assumes AcmeBot");
		expect(text).toContain("Because AcmeBot and {window}");
		expect(text).toContain("scope AcmeBot");
		expect(text).toContain(
			"system — the system under test (variable: AcmeBot)"
		);
		expect(text).toContain("window — the moving interval (5 minutes)");
		expect(text).not.toContain(SYS);
	});

	it("says in the definition line that an unset variable is not set, and shows [name] where it is mentioned", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				assumption={`Assumes ${ref("system", SYS)}`}
				context={[variable(), variable("  ", "blank", OTHER)]}
				description="Plain"
				initialExpanded
				name="P1"
				nodeType="property"
				terms={reach(variable(), variable("  ", "blank", OTHER))}
			/>
		);
		const text = container.textContent ?? "";
		expect(text).toContain("Assumes [system]");
		expect(text).toContain(
			"system — the system under test (variable, not set)"
		);
		expect(text).toContain("blank — the system under test (variable, not set)");
	});

	it.each([
		["markup", IMG],
		["a newline", "one\ntwo"],
		["a reference", `{other#${OTHER}}`],
	])("writes a value of %s in a definition line as it was written, as text", (_what, value) => {
		const { container } = renderWithReactFlow(
			<BaseNode
				context={[variable(value)]}
				description="Plain"
				initialExpanded
				name="P1"
				nodeType="property"
				terms={reach(variable(value))}
			/>
		);
		expect(container.querySelector(MARKUP_IN_CARD)).toBeNull();
		expect(container.textContent).toContain(
			`system — the system under test (variable: ${value})`
		);
	});

	it("shows the tooltip of a variable's word on an expanded card with its meaning and current value", async () => {
		const user = userEvent.setup();
		const { container } = renderWithReactFlow(
			<BaseNode
				description={`The ${ref("system", SYS)}`}
				initialExpanded
				name="P1"
				nodeType="property"
				terms={reach(variable("AcmeBot"))}
			/>
		);
		await user.hover(words(container)[0] as Element);
		await waitFor(() =>
			expect(document.body.textContent).toContain("the system under test")
		);
		expect(document.body.textContent).toContain("AcmeBot");
		expect(document.body.textContent).toContain("Defined on G1");
	});
});

describe("searching a diagram that has variables", () => {
	const nodes = [
		{
			id: "n1",
			position: { x: 0, y: 0 },
			data: {
				name: "P1",
				description: `The ${ref("system", SYS)} is safe`,
				termsInReach: reach(variable("AcmeBot"), ordinary("5 minutes")),
			},
		},
		{
			id: "n2",
			position: { x: 0, y: 0 },
			data: {
				name: "P2",
				description: `In the ${ref("window", WIN)}`,
				termsInReach: reach(variable("AcmeBot"), ordinary("5 minutes")),
			},
		},
		{
			id: "n3",
			position: { x: 0, y: 0 },
			data: {
				name: "P3",
				description: `Needs a ${ref("other", OTHER)}`,
				termsInReach: reach(variable(undefined, "other", OTHER)),
			},
		},
		{
			id: "n4",
			position: { x: 0, y: 0 },
			data: { name: "P4", description: "Nothing to see" },
		},
	];

	let pageText = "";

	async function search(term: string) {
		const user = userEvent.setup();
		const { unmount } = render(
			<SearchNodes focusNode={() => undefined} nodes={nodes} />
		);
		await user.click(screen.getByRole("button", { name: "Search" }));
		const box = await screen.findByRole("textbox");
		if (term) {
			await user.click(box);
			// Pasted, because typing treats [ and { as the start of a key name.
			await user.paste(term);
		}
		const found = Array.from(
			document.querySelectorAll("button.group span.uppercase")
		).map((span) => span.textContent?.replace("Identifier: ", ""));
		pageText = document.body.textContent ?? "";
		unmount();
		return found;
	}

	it("finds a card by the value it shows", async () => {
		expect(await search("acmebot")).toEqual(["P1"]);
	});

	it("finds a card by the variable's name though the card shows the value", async () => {
		expect(await search("system")).toEqual(["P1"]);
	});

	it("finds an unset variable by the bracketed name it shows", async () => {
		expect(await search("[other]")).toEqual(["P3"]);
	});

	it("does not find a card by an ordinary term's value, as before", async () => {
		expect(await search("5 minutes")).toEqual([]);
		expect(await search("window")).toEqual(["P2"]);
	});

	it("does not find a card by the id in a stored reference", async () => {
		expect(await search(SYS)).toEqual([]);
		expect(await search("#")).toEqual([]);
	});

	it("lists the value, not the token, in the result", async () => {
		await search("acmebot");
		expect(pageText).toContain("The AcmeBot is safe");
		expect(pageText).not.toContain(SYS);
	});
});
