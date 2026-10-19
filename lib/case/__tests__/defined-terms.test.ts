import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import {
	caseUsesDefinedTerms,
	findTermById,
	formatReference,
	hasReference,
	type PlainCase,
	parseContextEntries,
	parseReferences,
	plainContextEntry,
	plainReferenceText,
	termsInReach,
	toPlainCase,
} from "../defined-terms";

const WINDOW_ID = "k3f9x2m7qa";
const NARROW_ID = "p4n8c2d6xz";

function node(
	id: string,
	name: string,
	overrides: Partial<TreeNode> = {},
	children: TreeNode[] = []
): TreeNode {
	return {
		id,
		type: "PROPERTY_CLAIM",
		name,
		description: "",
		inSandbox: false,
		children,
		...overrides,
	};
}

function exportOf(tree: TreeNode): CaseExportNested {
	return {
		version: "1.1",
		exportedAt: "2026-10-19T00:00:00.000Z",
		case: { name: "Case", description: "" },
		tree,
	};
}

describe("parseReferences", () => {
	it("splits text into plain runs and references", () => {
		expect(
			parseReferences(`Within the {window#${WINDOW_ID}} no two aircraft meet.`)
		).toEqual([
			{ type: "text", text: "Within the " },
			{
				type: "reference",
				name: "window",
				id: WINDOW_ID,
				raw: `{window#${WINDOW_ID}}`,
			},
			{ type: "text", text: " no two aircraft meet." },
		]);
	});

	it("treats braces that do not form a reference as ordinary text", () => {
		const text = `Set {like this}, {window#short}, {#${WINDOW_ID}} and {a#${WINDOW_ID}x}.`;
		expect(parseReferences(text)).toEqual([{ type: "text", text }]);
		expect(hasReference(text)).toBe(false);
	});

	it("finds a reference that follows a stray opening brace", () => {
		const segments = parseReferences(`{ {window#${WINDOW_ID}}`);
		expect(segments.map((segment) => segment.type)).toEqual([
			"text",
			"reference",
		]);
	});

	it("writes a reference as the name, a hash and the id", () => {
		expect(formatReference("window", WINDOW_ID)).toBe(`{window#${WINDOW_ID}}`);
	});
});

describe("parseContextEntries", () => {
	it("keeps strings, rebuilds records from their four fields and drops anything else", () => {
		expect(
			parseContextEntries([
				"plain",
				{
					id: WINDOW_ID,
					name: "window",
					text: "the interval",
					value: "5 minutes",
					hidden: false,
				},
				{ id: NARROW_ID, name: "narrow", text: "tight", value: 3 },
				{ id: NARROW_ID, name: "no text" },
				null,
				42,
				["nested"],
			])
		).toEqual([
			"plain",
			{
				id: WINDOW_ID,
				name: "window",
				text: "the interval",
				value: "5 minutes",
			},
			{ id: NARROW_ID, name: "narrow", text: "tight" },
		]);
	});

	it("returns an empty list for a value that is not a list", () => {
		expect(parseContextEntries(null)).toEqual([]);
		expect(parseContextEntries({ id: WINDOW_ID })).toEqual([]);
	});
});

describe("termsInReach", () => {
	const g1 = {
		id: "g1",
		name: "G1",
		context: [
			"plain text",
			{ id: WINDOW_ID, name: "window", text: "broad", value: "5 minutes" },
		],
	};
	const s2 = {
		id: "s2",
		name: "S2",
		context: [{ id: NARROW_ID, name: "window", text: "narrow" }],
	};

	it("lists the element's own entries and those above it, nearest first", () => {
		const terms = termsInReach([{ id: "p1", name: "P1" }, s2, g1]);
		expect(terms.map((term) => [term.id, term.definedOn.elementName])).toEqual([
			[NARROW_ID, "S2"],
			[WINDOW_ID, "G1"],
		]);
		expect(terms[1]?.value).toBe("5 minutes");
		expect(terms[0]?.value).toBeUndefined();
	});

	it("finds a term by id, preferring the nearer one", () => {
		const terms = termsInReach([s2, g1]);
		expect(findTermById(terms, WINDOW_ID)?.text).toBe("broad");
		expect(findTermById(terms, "zzzzzzzzzz")).toBeUndefined();
	});
});

describe("plain text", () => {
	const terms = termsInReach([
		{
			id: "g1",
			name: "G1",
			context: [{ id: WINDOW_ID, name: "window", text: "the interval" }],
		},
	]);

	it("writes a reference with the entry's current name", () => {
		expect(plainReferenceText(`Inside the {win#${WINDOW_ID}}.`, terms)).toBe(
			"Inside the {window}."
		);
	});

	it("falls back to the stored name when the definition is out of reach", () => {
		expect(plainReferenceText(`Inside the {win#${WINDOW_ID}}.`, [])).toBe(
			"Inside the {win}."
		);
		expect(plainReferenceText(`Inside the {win#${WINDOW_ID}}.`)).toBe(
			"Inside the {win}."
		);
	});

	it("leaves text without references exactly as it was", () => {
		expect(plainReferenceText("{like this} & <b>", terms)).toBe(
			"{like this} & <b>"
		);
	});

	it("writes a named entry as name, meaning and value", () => {
		expect(
			plainContextEntry({
				id: WINDOW_ID,
				name: "window",
				text: "the interval",
				value: "5 minutes",
			})
		).toBe("window: the interval (value: 5 minutes)");
		expect(
			plainContextEntry({ id: WINDOW_ID, name: "window", text: "the interval" })
		).toBe("window: the interval");
		expect(plainContextEntry("unchanged")).toBe("unchanged");
	});
});

describe("toPlainCase", () => {
	function buildCase(): CaseExportNested {
		const claimUnderG1 = node("p1", "P1", {
			description: `The {win#${WINDOW_ID}} is respected and {gone#${NARROW_ID}} is not.`,
			justification: `Because of {window#${WINDOW_ID}}.`,
		});
		const sideBranch = node("s2", "S2", {
			type: "STRATEGY",
			context: [{ id: NARROW_ID, name: "narrow", text: "tight" }],
		});
		const evidence = node("e1", "E1", {
			type: "EVIDENCE",
			description: `Measured over the {window#${WINDOW_ID}}.`,
		});
		const root = node(
			"g1",
			"G1",
			{
				type: "GOAL",
				description: "Goal",
				context: [
					"plain context",
					{
						id: WINDOW_ID,
						name: "window",
						text: "the interval",
						value: "5 minutes",
					},
				],
			},
			[claimUnderG1, sideBranch, node("p3", "P3", {}, [evidence])]
		);
		return exportOf(root);
	}

	it("returns every context entry as a string and every reference as {name}", () => {
		const plain = toPlainCase(buildCase());
		const [claim, , branch] = plain.tree.children;
		expect(plain.tree.context).toEqual([
			"plain context",
			"window: the interval (value: 5 minutes)",
		]);
		expect(claim?.description).toBe(
			"The {window} is respected and {gone} is not."
		);
		expect(claim?.justification).toBe("Because of {window}.");
		expect(branch?.children[0]?.description).toBe(
			"Measured over the {window}."
		);
	});

	it("is the only way from the stored case to the plain case", () => {
		const stored = buildCase();
		// @ts-expect-error a stored case holds named entries, so it is not a PlainCase
		const asPlain: PlainCase = stored;
		expect(asPlain).toBe(stored);
		expect(toPlainCase(stored)).not.toBe(stored);
	});

	it("does not change the case it is given", () => {
		const source = buildCase();
		const before = JSON.stringify(source);
		toPlainCase(source);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("keeps the other fields of the case and of each node", () => {
		const plain = toPlainCase(buildCase());
		expect(plain.version).toBe("1.1");
		expect(plain.case).toEqual({ name: "Case", description: "" });
		expect(plain.tree.children.map((child) => child.id)).toEqual([
			"p1",
			"s2",
			"p3",
		]);
	});

	it("resolves a name that has changed since the reference was written", () => {
		const renamed = buildCase();
		const root = renamed.tree as TreeNode;
		root.context = [{ id: WINDOW_ID, name: "interval", text: "x" }];
		expect(toPlainCase(renamed).tree.children[0]?.description).toContain(
			"The {interval} is respected"
		);
	});

	it("does not reach a definition on a sibling branch, and shows the stored name instead", () => {
		const defined = node("s2", "S2", {
			type: "STRATEGY",
			context: [{ id: WINDOW_ID, name: "window", text: "the interval" }],
		});
		const moved = node("p1", "P1", {
			description: `The {win#${WINDOW_ID}} is respected.`,
		});
		const root = node("g1", "G1", { type: "GOAL" }, [
			defined,
			node("p3", "P3", {}, [moved]),
		]);
		expect(
			toPlainCase(exportOf(root)).tree.children[1]?.children[0]?.description
		).toBe("The {win} is respected.");
	});
});

describe("caseUsesDefinedTerms", () => {
	it("is false for a case of plain strings and ordinary braces", () => {
		expect(
			caseUsesDefinedTerms(
				node("g1", "G1", {
					description: "Uses {braces}",
					context: ["plain"],
				})
			)
		).toBe(false);
	});

	it("is true when any element holds a named entry", () => {
		const entry = { id: WINDOW_ID, name: "window", text: "x" };
		expect(
			caseUsesDefinedTerms(
				node("g1", "G1", {}, [node("p1", "P1", { context: [entry] })])
			)
		).toBe(true);
	});

	it("is true when any element's text holds a reference", () => {
		expect(
			caseUsesDefinedTerms(
				node("g1", "G1", {}, [
					node("p1", "P1", { description: `See {w#${WINDOW_ID}}` }),
				])
			)
		).toBe(true);
	});
});
