import type { Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { convertAssuranceCase } from "../convert-case";
import { type DefinedTerm, plainReferenceText } from "../defined-terms";

/**
 * The terms each card of the diagram carries when a variable is defined:
 * the flag and the value travel to every element below the definition,
 * evidence included, and to no other.
 */

const SYS = "aaaaaaaaaa";
const OTHER = "bbbbbbbbbb";
const ref = (name: string, id: string) => `{${name}#${id}}`;

function variable(id: string, name: string, value?: string) {
	return value === undefined
		? { id, name, text: "meaning", variable: true }
		: { id, name, text: "meaning", value, variable: true };
}

/**
 * G1 defines `system` and `other` (a variable of its own); S1 defines its own
 * variable called `system`; P1 sits under S1 with evidence E1; P2 sits under
 * G1 with evidence E2.
 */
function buildCase(
	options: { goalValue?: string; strategyValue?: string } = {}
) {
	const evidence = (id: string, name: string, description: string) => ({
		id,
		type: "evidence",
		name,
		description,
		URL: "",
		urls: [],
	});
	const claim = (
		id: string,
		name: string,
		description: string,
		items: ReturnType<typeof evidence>[]
	) => ({
		id,
		type: "property_claim",
		name,
		description,
		context: [],
		evidence: items,
		propertyClaims: [],
	});
	return {
		id: "case",
		goals: [
			{
				id: "g1",
				type: "goal",
				name: "G1",
				description: `The ${ref("system", SYS)}`,
				context: [
					variable(SYS, "system", options.goalValue),
					variable(OTHER, "other"),
				],
				strategies: [
					{
						id: "s1",
						type: "strategy",
						name: "S1",
						description: "Argue",
						context: [variable("cccccccccc", "system", options.strategyValue)],
						propertyClaims: [
							claim("p1", "P1", "Claim one", [
								evidence("e1", "E1", `Tested ${ref("system", SYS)}`),
							]),
						],
					},
				],
				propertyClaims: [
					claim("p2", "P2", "Claim two", [
						evidence("e2", "E2", `Tested ${ref("system", SYS)}`),
					]),
				],
			},
		],
	};
}

function card(nodes: Node[], name: string): Node {
	const node = nodes.find((candidate) => candidate.data.name === name);
	if (!node) {
		throw new Error(`no card named ${name}`);
	}
	return node;
}

function termsOf(nodes: Node[], name: string): DefinedTerm[] {
	return card(nodes, name).data.termsInReach as DefinedTerm[];
}

describe("the terms each card carries when a variable is defined", () => {
	const { caseNodes } = convertAssuranceCase(
		buildCase({ goalValue: "AcmeBot" }) as never
	);

	it("carries the flag and the value of a variable to every card at or below its definition", () => {
		for (const name of ["G1", "S1", "P1", "E1", "P2", "E2"]) {
			const term = termsOf(caseNodes, name).find(
				(candidate) => candidate.id === SYS
			);
			expect(term).toMatchObject({
				name: "system",
				value: "AcmeBot",
				variable: true,
			});
		}
	});

	it("carries a variable with no value without inventing one", () => {
		const term = termsOf(caseNodes, "E2").find(
			(candidate) => candidate.id === OTHER
		);
		expect(term?.variable).toBe(true);
		expect(term).not.toHaveProperty("value");
	});

	it("reads a mention on evidence through the card's terms as the value", () => {
		const e2 = card(caseNodes, "E2").data;
		expect(plainReferenceText(e2.description, e2.termsInReach)).toBe(
			"Tested AcmeBot"
		);
	});

	it("does not carry a variable defined lower down to a card above or beside it", () => {
		const lower = convertAssuranceCase(
			buildCase({ goalValue: "AcmeBot", strategyValue: "BetaBot" }) as never
		).caseNodes;
		const ids = (name: string) =>
			termsOf(lower, name).map((candidate) => candidate.id);
		expect(ids("G1")).not.toContain("cccccccccc");
		expect(ids("P2")).not.toContain("cccccccccc");
		expect(ids("E2")).not.toContain("cccccccccc");
		expect(ids("E1")).toContain("cccccccccc");
	});

	it("puts the nearer of two variables with the same name first, so the same word means different values on different branches", () => {
		const lower = convertAssuranceCase(
			buildCase({ goalValue: "AcmeBot", strategyValue: "BetaBot" }) as never
		).caseNodes;
		const e1 = card(lower, "E1").data;
		expect(
			plainReferenceText(`${ref("system", "cccccccccc")}`, e1.termsInReach)
		).toBe("BetaBot");
		expect(plainReferenceText(`${ref("system", SYS)}`, e1.termsInReach)).toBe(
			"AcmeBot"
		);
		const e2 = card(lower, "E2").data;
		expect(
			plainReferenceText(`${ref("system", "cccccccccc")}`, e2.termsInReach)
		).toBe("{system}");
	});

	it("gives the card's own text no value of its own for a name the card does not reach", () => {
		const e1 = card(caseNodes, "E1").data;
		expect(
			plainReferenceText(`${ref("elsewhere", "zzzzzzzzzz")}`, e1.termsInReach)
		).toBe("{elsewhere}");
	});

	it("carries nothing stray: a stored flag that is not exactly true makes an ordinary term", () => {
		const input = buildCase({ goalValue: "AcmeBot" });
		const goal = input.goals[0];
		if (!goal) {
			throw new Error("no goal");
		}
		goal.context = [
			{
				id: SYS,
				name: "system",
				text: "meaning",
				value: "AcmeBot",
				variable: "true",
			},
		] as never;
		const { caseNodes: nodes } = convertAssuranceCase(input as never);
		const term = termsOf(nodes, "E1").find((candidate) => candidate.id === SYS);
		expect(term?.variable).toBeUndefined();
		const e1 = card(nodes, "E1").data;
		expect(plainReferenceText(e1.description, e1.termsInReach)).toBe(
			"Tested {system}"
		);
	});
});
