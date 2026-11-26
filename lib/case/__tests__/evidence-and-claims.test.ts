import { describe, expect, it } from "vitest";
import type {
	EvidenceResponse,
	PropertyClaimResponse,
} from "@/lib/services/case-response-types";
import { addEvidenceToClaim } from "../evidence";
import { addPropertyClaimToNested } from "../property-claims";

const evidence = (id: string) => ({ id }) as unknown as EvidenceResponse;
const claim = (id: string) => ({ id }) as unknown as PropertyClaimResponse;

describe("addEvidenceToClaim", () => {
	it("starts the evidence list of a claim that has none", () => {
		const claimNode = { id: "c1" };
		const added = evidence("e1");
		expect(addEvidenceToClaim([claimNode], "c1", added)).toBe(true);
		expect(claimNode).toStrictEqual({ id: "c1", evidence: [added] });
	});

	it("appends after the evidence a claim already has", () => {
		const first = evidence("e1");
		const second = evidence("e2");
		const claimNode = { id: "c1", evidence: [first] };
		expect(addEvidenceToClaim([claimNode], "c1", second)).toBe(true);
		expect(claimNode.evidence).toStrictEqual([first, second]);
	});

	it("finds a claim nested under a strategy", () => {
		const claimNode = { id: "c2" };
		const tree = [{ id: "s1", strategies: [], propertyClaims: [claimNode] }];
		expect(addEvidenceToClaim(tree, "c2", evidence("e1"))).toBe(true);
		expect(claimNode).toHaveProperty("evidence");
	});

	it("reports false and changes nothing when the claim is missing", () => {
		const claimNode = { id: "c1" };
		expect(addEvidenceToClaim([claimNode], "nope", evidence("e1"))).toBe(false);
		expect(claimNode).toStrictEqual({ id: "c1" });
	});
});

describe("addPropertyClaimToNested", () => {
	it("starts the claim list of a parent that has none", () => {
		const parent = { id: "p1" };
		const added = claim("c1");
		expect(addPropertyClaimToNested([parent], "p1", added)).toBe(true);
		expect(parent).toStrictEqual({ id: "p1", propertyClaims: [added] });
	});

	it("appends after the claims a parent already has", () => {
		const first = claim("c1");
		const second = claim("c2");
		const parent = { id: "p1", propertyClaims: [first] };
		expect(addPropertyClaimToNested([parent], "p1", second)).toBe(true);
		expect(parent.propertyClaims).toStrictEqual([first, second]);
	});

	it("reports false and changes nothing when the parent is missing", () => {
		const parent = { id: "p1" };
		expect(addPropertyClaimToNested([parent], "nope", claim("c1"))).toBe(false);
		expect(parent).toStrictEqual({ id: "p1" });
	});
});
