import type { Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { convertAssuranceCase } from "../convert-case";
import {
	type DefinedTerm,
	findTermById,
	plainReferenceText,
} from "../defined-terms";

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";
const ID_C = "cccccccccc";
const ID_FOREIGN = "zzzzzzzzzz";

function entry(id: string, name: string, text = `${name} meaning`) {
	return { id, name, text };
}

/**
 * G1 holds `interval`; S1 narrows it with its own `interval` and holds `narrow`;
 * P1 is under S1, P2 under S2 on the other branch, P3 directly under G1.
 */
function buildCase(overrides: { p2Description?: string } = {}) {
	const claim = (id: string, name: string, description = "") => ({
		id,
		type: "property_claim",
		name,
		description,
		context: [],
		evidence: [],
		propertyClaims: [],
	});
	return {
		id: "case",
		goals: [
			{
				id: "g1",
				type: "goal",
				name: "G1",
				description: `Uses {x#${ID_A}}`,
				context: ["plain", entry(ID_A, "interval")],
				strategies: [
					{
						id: "s1",
						type: "strategy",
						name: "S1",
						context: [entry(ID_B, "interval"), entry(ID_C, "narrow")],
						propertyClaims: [claim("p1", "P1", `{x#${ID_C}} {y#${ID_B}}`)],
					},
					{
						id: "s2",
						type: "strategy",
						name: "S2",
						context: [],
						propertyClaims: [
							claim(
								"p2",
								"P2",
								overrides.p2Description ?? `{narrow#${ID_C}} {z#${ID_FOREIGN}}`
							),
						],
					},
				],
				propertyClaims: [claim("p3", "P3")],
			},
		],
	};
}

function termsOf(nodes: Node[], name: string): DefinedTerm[] {
	const node = nodes.find((candidate) => candidate.data.name === name);
	if (!node) {
		throw new Error(`no card named ${name}`);
	}
	return node.data.termsInReach as DefinedTerm[];
}

describe("the terms each card can reach", () => {
	const { caseNodes } = convertAssuranceCase(buildCase() as never);

	it("lists an element's own terms, then those above, nearest first", () => {
		expect(termsOf(caseNodes, "P1").map((term) => term.id)).toEqual([
			ID_B,
			ID_C,
			ID_A,
		]);
		expect(termsOf(caseNodes, "S1").map((term) => term.id)).toEqual([
			ID_B,
			ID_C,
			ID_A,
		]);
	});

	it("never includes the terms of a sibling branch", () => {
		for (const name of ["S2", "P2", "P3", "G1"]) {
			expect(termsOf(caseNodes, name).map((term) => term.id)).toEqual([ID_A]);
		}
	});

	it("labels each term with the element it is defined on", () => {
		const terms = termsOf(caseNodes, "P1");
		expect(terms.map((term) => term.definedOn.elementName)).toEqual([
			"S1",
			"S1",
			"G1",
		]);
	});

	it("does not resolve an id that no element above defines, such as another case's", () => {
		for (const name of ["G1", "S1", "P1", "S2", "P2", "P3"]) {
			expect(
				findTermById(termsOf(caseNodes, name), ID_FOREIGN)
			).toBeUndefined();
		}
	});

	it("reads a reference as the nearest definition's name, and as the stored name when none is above", () => {
		const p1 = caseNodes.find((node) => node.data.name === "P1");
		const p2 = caseNodes.find((node) => node.data.name === "P2");
		expect(
			plainReferenceText(String(p1?.data.description), termsOf(caseNodes, "P1"))
		).toBe("{narrow} {interval}");
		// P2 is on the other branch: S1's `narrow` is out of reach, so the
		// stored name is what is shown, and the foreign id stays unresolved.
		expect(
			plainReferenceText(String(p2?.data.description), termsOf(caseNodes, "P2"))
		).toBe("{narrow} {z}");
	});

	it("gives a card whose element has no named entry the same list as its parent", () => {
		expect(termsOf(caseNodes, "P3")).toEqual(termsOf(caseNodes, "G1"));
	});
});
