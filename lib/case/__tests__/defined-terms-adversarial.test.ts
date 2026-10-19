import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import {
	caseUsesDefinedTerms,
	findTermById,
	formatReference,
	hasReference,
	noticeElementName,
	parseContextEntries,
	parseReferences,
	plainContextEntry,
	plainReferenceText,
	termsInReach,
	toPlainCase,
} from "../defined-terms";

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";
const ID_C = "cccccccccc";

function node(
	name: string,
	overrides: Partial<TreeNode> = {},
	children: TreeNode[] = []
): TreeNode {
	return {
		id: randomUUID(),
		type: "PROPERTY_CLAIM",
		name,
		description: `${name} description`,
		inSandbox: false,
		children,
		...overrides,
	};
}

function caseOf(tree: TreeNode): CaseExportNested {
	return {
		version: "1.1",
		exportedAt: "2026-01-01T00:00:00.000Z",
		case: { name: "Case", description: "A case" },
		tree,
	} as CaseExportNested;
}

function named(id: string, name: string, text: string, value?: string) {
	return value === undefined ? { id, name, text } : { id, name, text, value };
}

function deepFreeze<T>(value: T): T {
	if (typeof value === "object" && value !== null) {
		for (const inner of Object.values(value)) {
			deepFreeze(inner);
		}
		Object.freeze(value);
	}
	return value;
}

describe("parseReferences", () => {
	// Each of these looks a little like a reference and must stay plain text.
	const NOT_REFERENCES = [
		"{window#abcdefghi}",
		"{window#abcdefghijk}",
		"{window#ABCDEFGHIJ}",
		"{window#abcdefghi!}",
		"{#abcdefghij}",
		"{a#b#abcdefghij}",
		"{win\ndow#abcdefghij}",
		"{like this}",
		"{window#abcdefghij",
		"window#abcdefghij}",
		"{}",
	];

	it.each(NOT_REFERENCES)("treats %j as ordinary text", (text) => {
		expect(parseReferences(text)).toEqual([{ type: "text", text }]);
		expect(hasReference(text)).toBe(false);
	});

	it("finds every reference and loses no character of the text around them", () => {
		const text = `Over a {window#${ID_A}}, not a {{window#${ID_B}}} or {x}.\n{ other #${ID_C}}`;
		const segments = parseReferences(text);
		expect(
			segments
				.filter((segment) => segment.type === "reference")
				.map((segment) => segment.id)
		).toEqual([ID_A, ID_B, ID_C]);
		expect(
			segments
				.map((segment) =>
					segment.type === "text" ? segment.text : segment.raw
				)
				.join("")
		).toBe(text);
	});

	it("keeps a name with spaces and punctuation that the token grammar allows", () => {
		const [segment] = parseReferences(`{two words-and_more#${ID_A}}`);
		expect(segment).toMatchObject({
			type: "reference",
			name: "two words-and_more",
			id: ID_A,
		});
		expect(formatReference("two words-and_more", ID_A)).toBe(
			`{two words-and_more#${ID_A}}`
		);
	});
});

describe("parseReferences on hostile text", () => {
	it("stays fast on very long text that almost matches the token form", () => {
		const long = 200_000;
		const inputs = [
			`{${"a".repeat(long)}`,
			`{${"a".repeat(long)}#${"b".repeat(9)}`,
			"{a".repeat(long),
			`${"{x#abcdefghi".repeat(long / 10)}`,
			`{${"a#".repeat(long / 2)}`,
		];
		const started = Date.now();
		for (const input of inputs) {
			expect(parseReferences(input).length).toBeGreaterThan(0);
			expect(hasReference(input)).toBe(false);
		}
		expect(Date.now() - started).toBeLessThan(3000);
	});
});

describe("reach", () => {
	const g1 = {
		id: "g1",
		name: "G1",
		context: [named(ID_A, "window", "broad interval", "10 minutes")],
	};
	const s2 = {
		id: "s2",
		name: "S2",
		context: [named(ID_B, "window", "narrow interval"), "plain text entry"],
	};
	const p3 = { id: "p3", name: "P3", context: [] };

	it("lists the nearest definition first when two share a name", () => {
		const terms = termsInReach([p3, s2, g1]);
		expect(terms.map((term) => [term.id, term.definedOn.elementName])).toEqual([
			[ID_B, "S2"],
			[ID_A, "G1"],
		]);
	});

	it("does not list the entries of a sibling branch", () => {
		const siblingBranch = {
			id: "s9",
			name: "S9",
			context: [named(ID_C, "secret", "only on the other branch")],
		};
		// The chain of a claim under S2 runs S2 -> G1 and never visits S9.
		const reach = termsInReach([p3, s2, g1]);
		expect(reach.map((term) => term.id)).not.toContain(ID_C);
		// And the sibling's own chain does not see S2's entry.
		expect(
			termsInReach([siblingBranch, g1]).map((term) => term.id)
		).not.toContain(ID_B);
	});

	it("resolves a duplicated id to the nearest element that holds it", () => {
		const first = termsInReach([
			{ id: "near", name: "N", context: [named(ID_A, "near", "near text")] },
			{ id: "far", name: "F", context: [named(ID_A, "far", "far text")] },
		]);
		expect(findTermById(first, ID_A)?.text).toBe("near text");
	});
});

describe("plain-text copy of a reference", () => {
	it("writes the current name after a rename, not the name stored in the token", () => {
		const terms = termsInReach([
			{ id: "g1", name: "G1", context: [named(ID_A, "interval", "meaning")] },
		]);
		expect(plainReferenceText(`Within the {window#${ID_A}} only`, terms)).toBe(
			"Within the {interval} only"
		);
	});

	it("falls back to the stored name when the entry is out of reach", () => {
		expect(plainReferenceText(`The {window#${ID_A}} only`, [])).toBe(
			"The {window} only"
		);
	});

	it("writes a named entry as name: meaning (value: ...)", () => {
		expect(
			plainContextEntry(named(ID_A, "window", "the interval", "5 minutes"))
		).toBe("window: the interval (value: 5 minutes)");
		expect(plainContextEntry(named(ID_A, "window", "the interval"))).toBe(
			"window: the interval"
		);
		expect(
			plainContextEntry(named(ID_A, "window", "the interval", "   "))
		).toBe("window: the interval");
		expect(plainContextEntry(named(ID_A, "window", "  ", "5 minutes"))).toBe(
			"window (value: 5 minutes)"
		);
		expect(plainContextEntry("just text")).toBe("just text");
	});

	it("passes markup in a name, meaning or value through as characters, neither escaping nor stripping it", () => {
		const hostile = "<img src=x onerror=alert(1)><script>alert(2)</script>";
		const entry = named(ID_A, "window", hostile, hostile);
		expect(plainContextEntry(entry)).toBe(
			`window: ${hostile} (value: ${hostile})`
		);
		expect(plainReferenceText(`{${hostile}#${ID_B}}`)).toBe(`{${hostile}}`);
	});

	it("names an element in a notice by its label, else by its description in plain form", () => {
		expect(
			noticeElementName({ name: "P1", description: `x {a#${ID_A}}` })
		).toBe("P1");
		expect(
			noticeElementName({ name: null, description: `x {a#${ID_A}} y` })
		).toBe("x {a} y");
	});
});

describe("parseContextEntries", () => {
	it("keeps strings and the four fields of a record, and drops everything else without throwing", () => {
		const parsed = parseContextEntries([
			"one",
			{ id: ID_A, name: "w", text: "t", value: "v", hidden: false, extra: 1 },
			{ id: ID_B, name: "w2", text: "t2", value: 5 },
			{ id: ID_C, name: "missing text" },
			null,
			7,
			["nested"],
			{ id: 1, name: "x", text: "y" },
		]);
		expect(parsed).toEqual([
			"one",
			{ id: ID_A, name: "w", text: "t", value: "v" },
			{ id: ID_B, name: "w2", text: "t2" },
		]);
		expect(parseContextEntries(null)).toEqual([]);
		expect(parseContextEntries("text")).toEqual([]);
		expect(parseContextEntries({})).toEqual([]);
	});
});

describe("toPlainCase", () => {
	function reachTree() {
		const evidence = node("E1", {
			type: "EVIDENCE",
			description: `Evidence cites {window#${ID_A}}`,
		});
		const claimUnderS2 = node(
			"P1",
			{
				description: `Within the {narrow#${ID_B}} and the {window#${ID_A}}`,
				assumption: `Assumes {window#${ID_A}}`,
				justification: `Because {narrow#${ID_B}}`,
			},
			[evidence]
		);
		const s2 = node(
			"S2",
			{
				type: "STRATEGY",
				context: [named(ID_B, "narrow", "narrower meaning", "1 minute")],
			},
			[claimUnderS2]
		);
		// A sibling branch that tries to use S2's entry, which is not in its reach.
		const claimUnderS3 = node("P2", {
			description: `Sibling uses {stale#${ID_B}} and {window#${ID_A}}`,
		});
		const s3 = node("S3", { type: "STRATEGY" }, [claimUnderS3]);
		const g1 = node(
			"G1",
			{
				type: "GOAL",
				context: [
					"A plain entry",
					named(ID_A, "interval", "broad meaning", "10 minutes"),
				],
			},
			[s2, s3]
		);
		return { g1, s2, s3, claimUnderS2, claimUnderS3 };
	}

	it("resolves a reference on the element and its ancestors, and not on a sibling branch", () => {
		const { g1 } = reachTree();
		const plain = toPlainCase(caseOf(g1));
		const [s2, s3] = plain.tree.children;
		const p1 = s2?.children[0];
		const p2 = s3?.children[0];
		// P1 is under S2 and G1: both entries resolve, with their current names.
		expect(p1?.description).toBe("Within the {narrow} and the {interval}");
		expect(p1?.assumption).toBe("Assumes {interval}");
		expect(p1?.justification).toBe("Because {narrow}");
		// P2 is on the other branch: S2's entry is out of reach, so the token's
		// own (stale) name is what is written; G1's entry still resolves.
		expect(p2?.description).toBe("Sibling uses {stale} and {interval}");
	});

	it("turns every context entry into a string", () => {
		const { g1 } = reachTree();
		const plain = toPlainCase(caseOf(g1));
		expect(plain.tree.context).toEqual([
			"A plain entry",
			"interval: broad meaning (value: 10 minutes)",
		]);
		expect(plain.tree.children[0]?.context).toEqual([
			"narrow: narrower meaning (value: 1 minute)",
		]);
	});

	it("never leaves a stored token or a record in the copy", () => {
		const { g1 } = reachTree();
		const text = JSON.stringify(toPlainCase(caseOf(g1)));
		expect(text).not.toContain(ID_A);
		expect(text).not.toContain(ID_B);
		expect(text).not.toContain("[object Object]");
	});

	it("does not resolve an id that belongs to another case, and never carries that case's text", () => {
		const otherCase = caseOf(
			node("G1", {
				type: "GOAL",
				context: [
					named(
						ID_C,
						"secret",
						"confidential text of another case",
						"value-of-another-case"
					),
				],
			})
		);
		const mine = caseOf(
			node("G1", {
				type: "GOAL",
				description: `Crafted {leaked#${ID_C}}`,
				context: ["mine"],
			})
		);
		// The copy of the other case contains its own text; this case's does not.
		const plainMine = JSON.stringify(toPlainCase(mine));
		expect(plainMine).toContain("Crafted {leaked}");
		expect(plainMine).not.toContain("confidential");
		expect(plainMine).not.toContain("secret");
		expect(plainMine).not.toContain("value-of-another-case");
		expect(JSON.stringify(toPlainCase(otherCase))).toContain("confidential");
	});

	it("leaves a case without named entries or references exactly as it was", () => {
		const evidence = node("E1", {
			type: "EVIDENCE",
			description: "Uses {braces} and #hash {like#this}",
			url: "https://example.org",
			assertionStatus: "ASSERTED",
		});
		const claim = node(
			"P1",
			{
				assumption: null,
				justification: "Because.",
				context: ["entry one", "entry {two}"],
				level: 1,
			},
			[evidence]
		);
		const goal = node("G1", { type: "GOAL", role: "TOP_LEVEL", context: [] }, [
			claim,
		]);
		const original = caseOf(goal);
		const before = structuredClone(original);
		const plain = toPlainCase(deepFreeze(original));
		expect(plain).toEqual(before);
		// toEqual ignores keys holding undefined; the copy must not add any.
		expect(Object.keys(plain.tree.children[0] ?? {}).sort()).toEqual(
			Object.keys(before.tree.children[0] ?? {}).sort()
		);
	});

	it("does not change the case it was given", () => {
		const { g1 } = reachTree();
		const original = deepFreeze(caseOf(g1));
		expect(() => toPlainCase(original)).not.toThrow();
	});
});

describe("caseUsesDefinedTerms", () => {
	it("is false for a case of plain text, braces and plain context entries", () => {
		const root = node("G1", { type: "GOAL", context: ["a", "{b}"] }, [
			node("P1", { description: "Text with {braces} and a #hash" }),
		]);
		expect(caseUsesDefinedTerms(root)).toBe(false);
	});

	it("is true for a named entry, however deep, and for a reference in any text field", () => {
		const entry: ContextEntry = named(ID_A, "w", "t");
		expect(
			caseUsesDefinedTerms(
				node("G1", {}, [node("S1", {}, [node("P1", { context: [entry] })])])
			)
		).toBe(true);
		for (const field of ["description", "assumption", "justification"]) {
			expect(
				caseUsesDefinedTerms(
					node("G1", {}, [node("P1", { [field]: `see {w#${ID_A}}` })])
				)
			).toBe(true);
		}
	});
});
