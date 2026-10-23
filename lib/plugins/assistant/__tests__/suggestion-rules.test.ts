import { describe, expect, it } from "vitest";
import type { TreeNode } from "@/lib/schemas/case-export";
import { planEdit, planNewElement } from "../suggestion-rules";

const node = (overrides: Partial<TreeNode> = {}): TreeNode => ({
	id: "p1",
	type: "PROPERTY_CLAIM",
	name: "P1",
	description: "The model is accurate",
	inSandbox: false,
	children: [],
	...overrides,
});

/** The reason a plan was refused, or an empty string when it was not. */
const reasonOf = (plan: object): string =>
	"reason" in plan && typeof plan.reason === "string" ? plan.reason : "";

describe("planEdit", () => {
	it("suggests a reword with the stored text as before and the trimmed new text as after", () => {
		const plan = planEdit(node(), {
			description: "  The model is accurate to 2%  ",
		});

		expect(plan).toEqual({
			suggested: true,
			kind: "edit",
			elementId: "p1",
			elementType: "property_claim",
			label: "P1",
			changes: {
				description: {
					before: "The model is accurate",
					after: "The model is accurate to 2%",
				},
			},
		});
	});

	it("reads a field the element does not have yet as empty", () => {
		const plan = planEdit(node(), {
			assumption: "Test data is representative",
		});

		expect(plan).toMatchObject({
			changes: {
				assumption: { before: "", after: "Test data is representative" },
			},
		});
	});

	it("lists only the fields that would change", () => {
		const plan = planEdit(node({ justification: "Peer reviewed" }), {
			description: "The model is accurate",
			justification: "Reviewed by two experts",
		});

		expect(plan).toMatchObject({
			changes: { justification: { before: "Peer reviewed" } },
		});
		expect(plan).not.toHaveProperty("changes.description");
	});

	it("refuses when nothing would change, and when nothing was given", () => {
		expect(
			reasonOf(planEdit(node(), { description: " The model is accurate " }))
		).toContain("same as the current");
		expect(reasonOf(planEdit(node(), {}))).toContain("No new text");
	});

	it("refuses a field the element type does not have", () => {
		expect(
			reasonOf(planEdit(node({ type: "EVIDENCE" }), { assumption: "x" }))
		).toContain("evidence has no assumption field");
		expect(
			reasonOf(planEdit(node({ type: "EVIDENCE" }), { context: ["x"] }))
		).toContain("evidence has no context field");
		expect(
			reasonOf(planEdit(node({ type: "ASSUMPTION" }), { justification: "x" }))
		).toContain("assumption has no justification field");
	});

	it("refuses to empty a field, whether the value is blank or the context list is empty", () => {
		expect(reasonOf(planEdit(node(), { description: "   " }))).toContain(
			"cannot be emptied"
		);
		expect(reasonOf(planEdit(node(), { context: [] }))).toContain(
			"cannot be emptied"
		);
		expect(reasonOf(planEdit(node(), { context: ["fine", " "] }))).toContain(
			"cannot be emptied"
		);
	});

	it("refuses text over the server's 5,000 characters, and accepts exactly 5,000", () => {
		expect(
			reasonOf(planEdit(node(), { description: "x".repeat(5001) }))
		).toContain("over 5000");
		expect(planEdit(node(), { description: "x".repeat(5000) })).toMatchObject({
			suggested: true,
		});
		expect(
			reasonOf(planEdit(node(), { context: ["x".repeat(5001)] }))
		).toContain("over 5000");
	});

	it("refuses to reword a field that refers to a defined term, naming the element", () => {
		const plan = planEdit(
			node({ description: "Alerts arrive within {window#k3f9x2m7qa}" }),
			{ description: "Alerts arrive quickly" }
		);

		expect(reasonOf(plan)).toContain(
			"description of P1 refers to a defined term"
		);
	});

	it("refuses new text that holds a defined-term reference, in a field, in a context entry or in a new element", () => {
		const reference = "within {window#k3f9x2m7qa}";

		expect(reasonOf(planEdit(node(), { description: reference }))).toContain(
			"contains a reference to a defined term"
		);
		expect(
			reasonOf(planEdit(node(), { context: ["Fine", reference] }))
		).toContain("contains a reference to a defined term");
		expect(
			reasonOf(planNewElement(node(), "evidence", `Alerts arrive ${reference}`))
		).toContain("contains a reference to a defined term");
		expect(
			planEdit(node(), { description: "Braces {like this} are only text" })
		).toMatchObject({ suggested: true });
	});

	it("still rewords another field of an element whose description refers to a term", () => {
		const plan = planEdit(
			node({ description: "Alerts arrive within {window#k3f9x2m7qa}" }),
			{ justification: "Agreed with operations" }
		);

		expect(plan).toMatchObject({ suggested: true });
	});

	it("refuses a context list that defines terms, or whose text refers to one", () => {
		const defines = node({
			context: [{ id: "k3f9x2m7qa", name: "window", text: "Ten minutes" }],
		});
		const refers = node({ context: ["Within {window#k3f9x2m7qa}"] });

		expect(reasonOf(planEdit(defines, { context: ["Ten minutes"] }))).toContain(
			"defines terms"
		);
		expect(reasonOf(planEdit(refers, { context: ["Quickly"] }))).toContain(
			"defines terms or refers"
		);
	});

	it("suggests a context rewording from a list of plain entries", () => {
		const plan = planEdit(node({ context: ["Hospital A", "Hospital B"] }), {
			context: ["Hospital A", "Hospitals B and C"],
		});

		expect(plan).toMatchObject({
			changes: {
				context: {
					before: ["Hospital A", "Hospital B"],
					after: ["Hospital A", "Hospitals B and C"],
				},
			},
		});
	});

	it.each([
		"AWAY_GOAL",
		"MODULE",
	])("refuses to edit an element of type %s, which points at another case", (type) => {
		expect(
			reasonOf(
				planEdit(node({ type: type as TreeNode["type"] }), { description: "x" })
			)
		).toContain("point at other cases");
	});

	it("names an element with no label by its kind", () => {
		expect(
			reasonOf(
				planEdit(node({ name: null, description: "{a#k3f9x2m7qa}" }), {
					description: "x",
				})
			)
		).toContain("description of this claim refers");
	});
});

describe("planNewElement", () => {
	it("suggests a claim beneath a goal, with the parent's id and label", () => {
		const plan = planNewElement(
			node({ id: "g1", type: "GOAL", name: "G1" }),
			"property_claim",
			" The model is accurate "
		);

		expect(plan).toEqual({
			suggested: true,
			kind: "new",
			parentId: "g1",
			parentLabel: "G1",
			parentType: "goal",
			childType: "property_claim",
			description: "The model is accurate",
		});
	});

	it.each([
		["GOAL", "strategy"],
		["GOAL", "property_claim"],
		["STRATEGY", "property_claim"],
		["PROPERTY_CLAIM", "property_claim"],
		["PROPERTY_CLAIM", "evidence"],
		["PROPERTY_CLAIM", "strategy"],
	])("allows %s to take %s", (parent, child) => {
		expect(
			planNewElement(node({ type: parent as TreeNode["type"] }), child, "text")
		).toMatchObject({ suggested: true, childType: child });
	});

	it.each([
		["GOAL", "evidence", "strategies and claims"],
		["STRATEGY", "evidence", "claims there"],
		["STRATEGY", "strategy", "claims there"],
		["EVIDENCE", "property_claim", "anything to be added beneath P1"],
		["ASSUMPTION", "property_claim", "anything to be added beneath P1"],
	])("refuses %s taking %s, saying what TEA does allow", (parent, child, reason) => {
		expect(
			reasonOf(
				planNewElement(
					node({ type: parent as TreeNode["type"] }),
					child,
					"text"
				)
			)
		).toContain(reason);
	});

	it("refuses a type the assistant does not add", () => {
		expect(reasonOf(planNewElement(node(), "goal", "text"))).toContain(
			"strategy, a new claim or new evidence"
		);
	});

	it("applies the same text rules as a reword", () => {
		expect(reasonOf(planNewElement(node(), "evidence", "  "))).toContain(
			"cannot be emptied"
		);
		expect(
			reasonOf(planNewElement(node(), "evidence", "x".repeat(5001)))
		).toContain("over 5000");
	});

	it("refuses a parent that is a counter-argument, whatever the child, and still rewords its text", () => {
		const counterArgument = node({ isDefeater: true });

		for (const child of ["strategy", "property_claim", "evidence"]) {
			expect(
				reasonOf(planNewElement(counterArgument, child, "text"))
			).toContain("P1 is a counter-argument");
		}
		expect(
			planEdit(counterArgument, { description: "Reworded" })
		).toMatchObject({ suggested: true });
	});
});

describe("planNewElement — the names it accepts for a type", () => {
	it.each([
		["strategy", "strategy"],
		["Property claim", "property_claim"],
		["property-claim", "property_claim"],
		["PROPERTY_CLAIM", "property_claim"],
		["claim", "property_claim"],
		["Evidence", "evidence"],
	])("reads %j as %s", (name, expected) => {
		expect(planNewElement(node(), name, "text")).toMatchObject({
			suggested: true,
			childType: expected,
		});
	});
});
