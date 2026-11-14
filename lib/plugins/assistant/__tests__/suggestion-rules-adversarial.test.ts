import { describe, expect, it } from "vitest";
import {
	planEdit,
	planNewElement,
} from "@/lib/plugins/assistant/suggestion-rules";
import type { TreeNode } from "@/lib/schemas/case-export";

const DEFINED_TERM = /defined term/i;
const DEFINED_OR_NAMED = /defined|term|named/i;
const TERM = "{window#k3f9x2m7qa}";
const NAMED = { id: "k3f9x2m7qa", name: "window", text: "five minutes" };

function node(
	type: TreeNode["type"],
	overrides: Partial<TreeNode> = {}
): TreeNode {
	return {
		id: "id-1",
		type,
		name: "P1",
		description: "Original text",
		inSandbox: false,
		children: [],
		...overrides,
	};
}

function refused(plan: { suggested: boolean }) {
	if (plan.suggested) {
		throw new Error("Expected a refusal, got a suggestion");
	}
	return plan as { reason: string; suggested: false };
}

function suggested(plan: { suggested: boolean }) {
	if (!plan.suggested) {
		throw new Error(`Expected a suggestion, got ${JSON.stringify(plan)}`);
	}
	return plan as Extract<ReturnType<typeof planEdit>, { suggested: true }> & {
		changes: Record<string, { after: unknown; before: unknown }>;
	};
}

describe("planEdit: fields an element type does not have", () => {
	it.each([
		["EVIDENCE", "assumption"],
		["EVIDENCE", "justification"],
		["EVIDENCE", "context"],
		["JUSTIFICATION", "assumption"],
		["JUSTIFICATION", "context"],
		["ASSUMPTION", "justification"],
		["ASSUMPTION", "context"],
	] as const)("refuses %s with a %s", (type, field) => {
		const request = { [field]: field === "context" ? ["text"] : "text" };

		const plan = planEdit(node(type), request);

		expect(refused(plan).reason).toContain(field);
	});

	it("refuses the whole request when one of its fields does not apply, not just that field", () => {
		const plan = planEdit(node("EVIDENCE"), {
			description: "A better description",
			assumption: "Not an evidence field",
		});

		expect(plan.suggested).toBe(false);
	});

	it.each([
		"GOAL",
		"STRATEGY",
		"PROPERTY_CLAIM",
	] as const)("accepts all four fields on a %s", (type) => {
		const plan = suggested(
			planEdit(node(type, { assumption: "a", justification: "j" }), {
				description: "New description",
				assumption: "New assumption",
				justification: "New justification",
				context: ["New context"],
			})
		);

		expect(Object.keys(plan.changes).sort()).toEqual([
			"assumption",
			"context",
			"description",
			"justification",
		]);
	});

	it.each([
		"AWAY_GOAL",
		"MODULE",
		"CONTRACT",
	] as const)("refuses to reword a %s, whichever field is asked for", (type) => {
		expect(planEdit(node(type), { description: "New text" }).suggested).toBe(
			false
		);
		expect(planEdit(node(type), { assumption: "New text" }).suggested).toBe(
			false
		);
	});

	it("refuses a request that names no field", () => {
		expect(planEdit(node("GOAL"), {}).suggested).toBe(false);
		expect(
			planEdit(node("GOAL"), { description: undefined, context: undefined })
				.suggested
		).toBe(false);
	});
});

describe("planEdit: empty and oversized text", () => {
	it.each([
		"",
		" ",
		"\n\t  \n",
		" ",
		"　 ﻿",
	])("refuses a description of %j", (text) => {
		expect(planEdit(node("GOAL"), { description: text }).suggested).toBe(false);
	});

	it.each([
		"assumption",
		"justification",
	] as const)("refuses to empty the %s", (field) => {
		const plan = planEdit(node("GOAL", { [field]: "Present" }), {
			[field]: "   ",
		});

		expect(plan.suggested).toBe(false);
	});

	it.each([
		[[]],
		[[""]],
		[["Fine", "   "]],
		[["\n"]],
	])("refuses the context list %j", (context) => {
		const plan = planEdit(node("GOAL", { context: ["Old entry"] }), {
			context,
		});

		expect(plan.suggested).toBe(false);
	});

	it("accepts text of exactly 5000 characters and refuses 5001", () => {
		expect(
			planEdit(node("GOAL"), { description: "x".repeat(5000) }).suggested
		).toBe(true);
		expect(
			planEdit(node("GOAL"), { description: "x".repeat(5001) }).suggested
		).toBe(false);
	});

	it.each([
		"assumption",
		"justification",
	] as const)("holds the %s to the same 5000-character limit", (field) => {
		expect(
			planEdit(node("GOAL"), { [field]: "y".repeat(5000) }).suggested
		).toBe(true);
		expect(
			planEdit(node("GOAL"), { [field]: "y".repeat(5001) }).suggested
		).toBe(false);
	});

	it("counts the length of the trimmed text, since the server saves it trimmed", () => {
		const padded = `  ${"x".repeat(5000)}\n\n`;

		const plan = suggested(planEdit(node("GOAL"), { description: padded }));

		expect((plan.changes.description?.after as string).length).toBe(5000);
	});

	it("holds each context entry to the limit, and refuses the whole list for one long entry", () => {
		expect(
			planEdit(node("GOAL"), { context: ["ok", "z".repeat(5000)] }).suggested
		).toBe(true);
		expect(
			planEdit(node("GOAL"), { context: ["ok", "z".repeat(5001)] }).suggested
		).toBe(false);
	});
});

describe("planEdit: defined terms", () => {
	it.each([
		["at the start", `${TERM} must stay open`],
		["in the middle", `The ${TERM} must stay open`],
		["at the end", `Stay open for the ${TERM}`],
		["twice", `${TERM} and ${TERM}`],
		["on its own line", `First line\n${TERM}\nLast line`],
	])("refuses to reword a description with a reference %s", (_where, stored) => {
		const plan = planEdit(node("PROPERTY_CLAIM", { description: stored }), {
			description: "Completely new wording",
		});

		expect(refused(plan).reason).toMatch(DEFINED_TERM);
	});

	it.each([
		"assumption",
		"justification",
	] as const)("refuses to reword a %s that holds a reference", (field) => {
		const plan = planEdit(node("GOAL", { [field]: `Relies on ${TERM}.` }), {
			[field]: "New wording",
		});

		expect(refused(plan).reason).toMatch(DEFINED_TERM);
	});

	it("leaves a field alone only when it is the field that holds the reference", () => {
		const plan = suggested(
			planEdit(node("GOAL", { assumption: `Relies on ${TERM}.` }), {
				description: "New description",
			})
		);

		expect(Object.keys(plan.changes)).toEqual(["description"]);
	});

	it("makes no partial suggestion when one requested field holds a reference", () => {
		const plan = planEdit(
			node("GOAL", { justification: `Because of ${TERM}.` }),
			{ description: "New description", justification: "New justification" }
		);

		expect(plan.suggested).toBe(false);
	});

	it.each([
		["a flattened name", "The {window} must stay open"],
		["an id that is too short", "The {window#k3f9x2m7q} must stay open"],
		["an id in capitals", "The {window#K3F9X2M7QA} must stay open"],
		["an id that is too long", "The {window#k3f9x2m7qab} must stay open"],
		["a name with a line break", "The {win\ndow#k3f9x2m7qa} must stay open"],
		["a bare brace", "Uses a { in a formula"],
	])("does not treat %s as a reference", (_what, stored) => {
		const plan = planEdit(node("GOAL", { description: stored }), {
			description: "New wording",
		});

		expect(plan.suggested).toBe(true);
	});

	it("refuses a context list that holds a reference, even when it is the only plain entry", () => {
		const plan = planEdit(
			node("GOAL", { context: ["Plain", `Uses ${TERM}`] }),
			{ context: ["New entry"] }
		);

		expect(plan.suggested).toBe(false);
	});

	it.each([
		["named entry first", [NAMED, "Plain entry"]],
		["named entry last", ["Plain entry", NAMED]],
		["only named entries", [NAMED]],
	])("refuses to reword a context list with %s", (_where, stored) => {
		const plan = planEdit(node("GOAL", { context: stored }), {
			context: ["Plain entry"],
		});

		expect(refused(plan).reason).toMatch(DEFINED_OR_NAMED);
	});

	it("allows a context list of plain entries, whatever the other fields hold", () => {
		const plan = planEdit(
			node("GOAL", { description: `Uses ${TERM}`, context: ["Old entry"] }),
			{ context: ["New entry"] }
		);

		expect(plan.suggested).toBe(true);
	});
});

describe("planEdit: what the suggestion carries", () => {
	it("takes the before text trimmed from the stored value and the after text trimmed", () => {
		const plan = suggested(
			planEdit(node("GOAL", { description: "  Stored  \n" }), {
				description: "\n  Suggested  ",
			})
		);

		expect(plan.changes.description).toEqual({
			before: "Stored",
			after: "Suggested",
		});
	});

	it("reads a missing or null stored field as empty", () => {
		const plan = suggested(
			planEdit(node("GOAL", { assumption: null }), {
				assumption: "A new assumption",
				justification: "A new justification",
			})
		);

		expect(plan.changes.assumption?.before).toBe("");
		expect(plan.changes.justification?.before).toBe("");
	});

	it("names the element by its id, lower-case type and trimmed label", () => {
		const plan = suggested(
			planEdit(node("PROPERTY_CLAIM", { id: "abc", name: " P7 " }), {
				description: "New",
			})
		);

		expect(plan).toMatchObject({
			kind: "edit",
			elementId: "abc",
			elementType: "property_claim",
			label: "P7",
		});
	});

	it("gives an empty label to an element with none", () => {
		const plan = suggested(
			planEdit(node("GOAL", { name: null }), { description: "New" })
		);

		expect(plan).toMatchObject({ label: "" });
	});

	it("keeps only the fields that change", () => {
		const plan = suggested(
			planEdit(node("GOAL", { assumption: "Same" }), {
				description: "Different",
				assumption: "  Same  ",
			})
		);

		expect(Object.keys(plan.changes)).toEqual(["description"]);
	});

	it.each([
		["identical text", "Original text"],
		["text that differs only by space", "  Original text \n"],
	])("refuses %s, since nothing would change", (_what, text) => {
		expect(planEdit(node("GOAL"), { description: text }).suggested).toBe(false);
	});

	it("treats a context list in a different order as a change, and the same list as none", () => {
		const element = node("GOAL", { context: ["one", "two"] });

		const reordered = suggested(planEdit(element, { context: ["two", "one"] }));
		const same = planEdit(element, { context: [" one", "two "] });

		expect(reordered.changes.context).toEqual({
			before: ["one", "two"],
			after: ["two", "one"],
		});
		expect(same.suggested).toBe(false);
	});

	it("reads a goal with no context as an empty list", () => {
		const plan = suggested(
			planEdit(node("GOAL", { context: undefined }), { context: ["First"] })
		);

		expect(plan.changes.context).toEqual({ before: [], after: ["First"] });
	});
});

describe("planNewElement: where TEA allows a child", () => {
	it.each([
		["GOAL", "strategy", true],
		["GOAL", "property_claim", true],
		["GOAL", "evidence", false],
		["STRATEGY", "property_claim", true],
		["STRATEGY", "strategy", false],
		["STRATEGY", "evidence", false],
		["PROPERTY_CLAIM", "property_claim", true],
		["PROPERTY_CLAIM", "strategy", true],
		["PROPERTY_CLAIM", "evidence", true],
		["EVIDENCE", "strategy", false],
		["EVIDENCE", "property_claim", false],
		["EVIDENCE", "evidence", false],
		["AWAY_GOAL", "property_claim", false],
		["AWAY_GOAL", "evidence", false],
		["MODULE", "strategy", false],
		["MODULE", "property_claim", false],
		["JUSTIFICATION", "strategy", false],
		["ASSUMPTION", "property_claim", false],
		["CONTRACT", "evidence", false],
	] as const)("beneath a %s, a %s is allowed: %s", (parentType, child, allowed) => {
		const plan = planNewElement(node(parentType), child, "Some new text");

		expect(plan.suggested).toBe(allowed);
	});

	it("gives a refusal that is not a suggestion no parent or child fields to apply", () => {
		const plan = planNewElement(node("GOAL"), "evidence", "Some new text");

		expect(plan).not.toHaveProperty("parentId");
		expect(plan).not.toHaveProperty("childType");
		expect(refused(plan).reason.length).toBeGreaterThan(0);
	});

	it.each([
		["Property Claim", "property_claim"],
		["property-claim", "property_claim"],
		["PROPERTY_CLAIM", "property_claim"],
		["propertyClaim", "property_claim"],
		[" claim ", "property_claim"],
		["Strategy", "strategy"],
		["EVIDENCE", "evidence"],
	])("reads the child type %j as %s", (spelling, childType) => {
		const plan = suggested(
			planNewElement(node("PROPERTY_CLAIM"), spelling, "New text")
		);

		expect(plan).toMatchObject({ childType });
	});

	it.each([
		"goal",
		"away_goal",
		"away goal",
		"module",
		"assumption",
		"justification",
		"context",
		"",
		"   ",
	])("refuses to add a %j", (name) => {
		expect(planNewElement(node("GOAL"), name, "New text").suggested).toBe(
			false
		);
	});
});

describe("planNewElement: the text of the new element", () => {
	it.each(["", "   ", "\n\t"])("refuses a description of %j", (text) => {
		expect(planNewElement(node("GOAL"), "strategy", text).suggested).toBe(
			false
		);
	});

	it("accepts exactly 5000 characters and refuses 5001", () => {
		expect(
			planNewElement(node("GOAL"), "strategy", "s".repeat(5000)).suggested
		).toBe(true);
		expect(
			planNewElement(node("GOAL"), "strategy", "s".repeat(5001)).suggested
		).toBe(false);
	});

	it("measures the trimmed text and carries it trimmed", () => {
		const plan = suggested(
			planNewElement(node("GOAL"), "strategy", `\n ${"s".repeat(5000)}  `)
		);

		expect(plan).toMatchObject({ description: "s".repeat(5000) });
	});

	it("names the parent by its id, trimmed label and lower-case type", () => {
		const plan = suggested(
			planNewElement(
				node("PROPERTY_CLAIM", { id: "parent-9", name: " P9 " }),
				"evidence",
				"Test report"
			)
		);

		expect(plan).toMatchObject({
			kind: "new",
			parentId: "parent-9",
			parentLabel: "P9",
			parentType: "property_claim",
			childType: "evidence",
			description: "Test report",
		});
	});

	it("gives an empty parent label to a parent with none", () => {
		const plan = suggested(
			planNewElement(node("GOAL", { name: null }), "strategy", "Argue it")
		);

		expect(plan).toMatchObject({ parentLabel: "" });
	});
});
