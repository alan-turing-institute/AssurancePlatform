import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublishableItemDetailResponse } from "@/lib/services/discover-transforms";
import FrozenSnapshotSection from "../frozen-snapshot-section";
import PatternVariables from "../pattern-variables";

/**
 * The variables list on a published pattern's page: what it lists from the
 * frozen snapshot, how it shows what the snapshot holds, and when it is not
 * there at all.
 */

vi.mock(
	"@/hooks/modal-hooks",
	async (importOriginal) => await importOriginal()
);

const SYSTEM = "k3f9x2m7qa";
const OWNER = "p4n8c2d6xz";
const WINDOW = "q1w2e3r4t5";
const DEFAULT_VALUE = /Default value/;
const DOWNLOAD_JSON = /Download JSON/;
const USE_THIS_PATTERN = /Use this pattern/;

type Entry = Record<string, unknown> | string;

function variable(id: string, name: string, text: string, value?: unknown) {
	return value === undefined
		? { id, name, text, variable: true }
		: { id, name, text, value, variable: true };
}

function snapshot(...context: Entry[]) {
	return {
		version: "1.1",
		tree: { id: "g1", name: "G1", description: "Goal", children: [], context },
	};
}

function node(name: string, context: Entry[], children: unknown[] = []) {
	return { id: name, name, description: name, context, children };
}

function itemOf(
	type: PublishableItemDetailResponse["type"],
	content: unknown
): PublishableItemDetailResponse {
	return {
		id: "item-1",
		slug: "a-published-item",
		title: "A published item",
		description: "What the item is for",
		type,
		archivedAt: null,
		authors: null,
		featureImageUrl: null,
		publishedAt: "2026-10-01T00:00:00.000Z",
		sector: null,
		content,
	};
}

const namesShown = () =>
	screen.getAllByRole("term").map((term) => term.textContent);

describe("the variables list of a published pattern", () => {
	it("lists the variables of every element, the top one's first and each element's before those beneath it", () => {
		const content = {
			tree: node(
				"G1",
				[variable("g1aaaaaaaa", "first", "on the goal")],
				[
					node(
						"S1",
						[variable("s1aaaaaaaa", "second", "on the strategy")],
						[
							node(
								"P1",
								[variable("p1aaaaaaaa", "third", "on a claim")],
								[
									node("P1.1", [
										variable("p11aaaaaaa", "fourth", "on a sub-claim"),
									]),
								]
							),
						]
					),
					node("S2", [variable("s2aaaaaaaa", "fifth", "on another strategy")]),
				]
			),
		};

		render(<PatternVariables content={content} />);

		expect(namesShown()).toEqual([
			"first",
			"second",
			"third",
			"fourth",
			"fifth",
		]);
	});

	it("shows two variables of the same name, each with its own meaning", () => {
		render(
			<PatternVariables
				content={snapshot(
					variable(SYSTEM, "system", "the outer system"),
					variable(OWNER, "system", "the nested system")
				)}
			/>
		);

		expect(screen.getAllByText("system")).toHaveLength(2);
		expect(screen.getByText("the outer system")).toBeVisible();
		expect(screen.getByText("the nested system")).toBeVisible();
	});

	it("lists a variable that has no meaning by name alone", () => {
		render(
			<PatternVariables content={snapshot(variable(SYSTEM, "system", ""))} />
		);

		expect(namesShown()).toEqual(["system"]);
		expect(screen.queryByText(DEFAULT_VALUE)).not.toBeInTheDocument();
		expect(document.querySelectorAll("dd")).toHaveLength(0);
	});

	it("shows a default value without the spaces around it, and none when it is only spaces", () => {
		render(
			<PatternVariables
				content={snapshot(
					variable(SYSTEM, "padded", "x", "  Padded  "),
					variable(OWNER, "blank", "y", " \t\n "),
					variable(WINDOW, "empty", "z", "")
				)}
			/>
		);

		expect(screen.getAllByText(DEFAULT_VALUE)).toHaveLength(1);
		expect(screen.getByText("Padded")).toBeVisible();
	});

	it("shows a default value that is not text as no value", () => {
		render(
			<PatternVariables
				content={snapshot(
					variable(SYSTEM, "number", "x", 5),
					variable(OWNER, "object", "y", { a: 1 }),
					variable(WINDOW, "list", "z", ["a"])
				)}
			/>
		);

		expect(namesShown()).toEqual(["number", "object", "list"]);
		expect(screen.queryByText(DEFAULT_VALUE)).not.toBeInTheDocument();
	});

	it("writes a meaning with other variables as they show, and other names in braces", () => {
		render(
			<PatternVariables
				content={snapshot(
					variable(
						SYSTEM,
						"system",
						`run by {owner#${OWNER}} for {tenant#aaaaaaaaaa} within {window#${WINDOW}}`
					),
					variable(OWNER, "owner", "who answers", "Alice"),
					{ id: WINDOW, name: "window", text: "an interval" },
					variable("aaaaaaaaaa", "tenant", "the tenant")
				)}
			/>
		);

		expect(
			screen.getByText("run by Alice for [tenant] within {window}")
		).toBeVisible();
	});

	it("shows every kind of markup in a name, meaning or value as text", () => {
		const html = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
		const { container } = render(
			<PatternVariables
				content={snapshot(
					variable(
						SYSTEM,
						"<b>name</b>",
						html,
						"<a href='javascript:alert(3)'>go</a>"
					),
					variable(OWNER, "&lt;i&gt;", "&amp; &lt;u&gt;", "&lt;script&gt;")
				)}
			/>
		);

		expect(screen.getByText("<b>name</b>")).toBeVisible();
		expect(screen.getByText(html)).toBeVisible();
		expect(
			screen.getByText("<a href='javascript:alert(3)'>go</a>")
		).toBeVisible();
		expect(screen.getByText("&lt;i&gt;")).toBeVisible();
		expect(screen.getByText("&amp; &lt;u&gt;")).toBeVisible();
		expect(screen.getByText("&lt;script&gt;")).toBeVisible();
		for (const tag of ["img", "script", "a", "b", "i", "u"]) {
			expect(container.querySelector(tag), tag).toBeNull();
		}
	});

	it("shows a very long meaning and value without dropping the other variables", () => {
		render(
			<PatternVariables
				content={snapshot(
					variable(SYSTEM, "long", "m".repeat(20_000), "v".repeat(20_000)),
					variable(OWNER, "short", "brief")
				)}
			/>
		);

		expect(namesShown()).toEqual(["long", "short"]);
		expect(screen.getByText("brief")).toBeVisible();
	});

	it("lists hundreds of variables, each once", () => {
		const entries = Array.from({ length: 400 }, (_, index) =>
			variable(
				`v${String(index).padStart(9, "0")}`,
				`name ${index}`,
				`meaning ${index}`
			)
		);

		render(<PatternVariables content={snapshot(...entries)} />);

		expect(screen.getAllByRole("term")).toHaveLength(400);
		expect(screen.getByText("name 399")).toBeVisible();
	});

	it("lists a variable on an element a thousand levels down", () => {
		let deepest: unknown = node("deep", [
			variable(SYSTEM, "found", "at the bottom"),
		]);
		for (let level = 0; level < 1000; level++) {
			deepest = node(`L${level}`, [], [deepest]);
		}

		render(<PatternVariables content={{ tree: deepest }} />);

		expect(namesShown()).toEqual(["found"]);
	});

	it("has a heading, and one term for each variable", () => {
		render(
			<PatternVariables
				content={snapshot(
					variable(SYSTEM, "system", "x"),
					variable(OWNER, "owner", "y")
				)}
			/>
		);

		expect(screen.getByRole("heading", { name: "Variables" })).toBeVisible();
		expect(screen.getAllByRole("term")).toHaveLength(2);
	});
});

describe("when the list is not shown", () => {
	it.each([
		["nothing", undefined],
		["null", null],
		["a number", 5],
		["text", "a pattern"],
		["an array", [snapshot(variable(SYSTEM, "system", "x"))]],
		["an empty object", {}],
		["a tree that is null", { tree: null }],
		["a tree that is an array", { tree: [] }],
		[
			"a tree whose children are not a list",
			{ tree: { children: {}, context: {} } },
		],
		[
			"only plain lines and ordinary names",
			snapshot("A plain line", {
				id: WINDOW,
				name: "window",
				text: "an interval",
			}),
		],
		[
			"a name marked as a variable by something other than true",
			snapshot(
				{ id: SYSTEM, name: "a", text: "x", variable: false },
				{ id: OWNER, name: "b", text: "y", variable: "true" },
				{ id: WINDOW, name: "c", text: "z", variable: 1 }
			),
		],
		[
			"entries that are not whole",
			snapshot(
				{ id: SYSTEM, name: "a" },
				{ name: "b", text: "y", variable: true },
				{
					id: 5,
					name: "c",
					text: "z",
					variable: true,
				}
			),
		],
		[
			"junk in the context and children",
			{
				tree: {
					context: [null, 5, [], { variable: true }],
					children: [null, "x", [], 5],
				},
			},
		],
	])("is empty for a snapshot holding %s", (_label, content) => {
		const { container } = render(<PatternVariables content={content} />);

		expect(container).toBeEmptyDOMElement();
	});

	it("is not on the page of a published ordinary case, whatever the snapshot holds", () => {
		render(
			<FrozenSnapshotSection
				item={itemOf(
					"ASSURANCE_CASE",
					snapshot(variable(SYSTEM, "system", "the system"))
				)}
			/>
		);

		expect(
			screen.queryByRole("heading", { name: "Variables" })
		).not.toBeInTheDocument();
		expect(screen.queryByText("the system")).not.toBeInTheDocument();
	});

	it("is on the page of a published pattern, beside the button", () => {
		render(
			<FrozenSnapshotSection
				item={itemOf(
					"ARGUMENT_PATTERN",
					snapshot(variable(SYSTEM, "system", "the system"))
				)}
			/>
		);

		const section = screen.getByRole("heading", { name: "Frozen snapshot" })
			.parentElement as HTMLElement;
		expect(
			within(section).getByRole("button", { name: USE_THIS_PATTERN })
		).toBeVisible();
		expect(
			within(section).getByRole("heading", { name: "Variables" })
		).toBeVisible();
	});

	it("leaves the rest of a published pattern's section as it was when there are no variables", () => {
		render(
			<FrozenSnapshotSection
				item={itemOf("ARGUMENT_PATTERN", snapshot("plain"))}
			/>
		);

		expect(
			screen.getByRole("heading", { name: "Frozen snapshot" })
		).toBeVisible();
		expect(screen.getByRole("button", { name: DOWNLOAD_JSON })).toBeVisible();
		expect(
			screen.getByRole("button", { name: USE_THIS_PATTERN })
		).toBeVisible();
		expect(
			screen.queryByRole("heading", { name: "Variables" })
		).not.toBeInTheDocument();
	});
});
