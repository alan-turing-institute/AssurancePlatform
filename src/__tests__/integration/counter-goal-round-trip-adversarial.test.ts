import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import {
	importCase,
	validateImportData,
} from "@/lib/services/case-import-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	type ArgumentFixture,
	addChild,
	addCounterGoal,
	buildArgument,
	linkEvidence,
	viewed,
} from "../utils/counter-goal-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

/**
 * Export then import must give back the same case: every element once, under
 * the same parent, with the same defeated element and the same evidence links.
 * Counter-goals can hang from evidence, which the export repeats under every
 * claim that links it, so the import has to take what hangs from the evidence
 * once.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
});

interface ElementShape {
	defeats: string | null;
	description: string;
	isDefeater: boolean;
	name: string | null;
	parent: string | null;
	type: string;
}

interface CaseShape {
	elements: ElementShape[];
	links: Array<{ claim: string; evidence: string }>;
}

/** A case reduced to what must survive a round trip, keyed by description. */
async function shapeOf(caseId: string): Promise<CaseShape> {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId, deletedAt: null },
	});
	const descriptionOf = new Map(rows.map((row) => [row.id, row.description]));
	const links = await prisma.evidenceLink.findMany({
		where: { claim: { caseId } },
	});
	return {
		elements: rows
			.map((row) => ({
				description: row.description,
				type: row.elementType,
				name: row.name,
				isDefeater: row.isDefeater,
				parent: row.parentId ? (descriptionOf.get(row.parentId) ?? "?") : null,
				defeats: row.defeatsElementId
					? (descriptionOf.get(row.defeatsElementId) ?? "?")
					: null,
			}))
			.sort((a, b) => a.description.localeCompare(b.description)),
		links: links
			.map((link) => ({
				evidence: descriptionOf.get(link.evidenceId) ?? "?",
				claim: descriptionOf.get(link.claimId) ?? "?",
			}))
			.sort((a, b) =>
				`${a.evidence}|${a.claim}`.localeCompare(`${b.evidence}|${b.claim}`)
			),
	};
}

async function roundTrip(ownerId: string, caseId: string) {
	const exported = viewed(
		await exportCase(ownerId, caseId, {
			includeComments: false,
		})
	);
	if (exported.error || !exported.data) {
		throw new Error(exported.error ?? "no export");
	}
	// Through text, as a file would travel.
	const file = JSON.parse(JSON.stringify(exported.data));
	const imported = await importCase(ownerId, file);
	if ("error" in imported) {
		throw new Error(
			`${imported.error}: ${(imported.validationErrors ?? []).join("; ")}`
		);
	}
	return { file, imported: imported.data };
}

/**
 * Round-trips the case and asserts the copy matches it element for element.
 * Called from within test blocks, like the repository's other assertion
 * helpers.
 */
async function expectRoundTripKeepsCase(ownerId: string, caseId: string) {
	const before = await shapeOf(caseId);
	const { imported } = await roundTrip(ownerId, caseId);
	const after = await shapeOf(imported.caseId);

	const descriptions = after.elements.map((element) => element.description);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(imported.warnings).toEqual([]);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(new Set(descriptions).size).toBe(descriptions.length);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(imported.elementCount).toBe(before.elements.length);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(imported.evidenceLinkCount).toBe(before.links.length);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(after.elements).toEqual(before.elements);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(after.links).toEqual(before.links);
	return { before, after, imported };
}

function evidenceNamed(fx: ArgumentFixture, name: string, description: string) {
	return createTestElement(fx.caseId, fx.ownerId, {
		elementType: "EVIDENCE",
		name,
		description,
		url: `https://example.com/${name.toLowerCase()}`,
	});
}

describe("export then import with counter-goals", () => {
	it("keeps counter-goals against the top goal, a strategy and a claim", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addCounterGoal(fx, {
			name: "CG1",
			description: "against the top goal",
			parentId: fx.goal.id,
		});
		await addCounterGoal(fx, {
			name: "CG2",
			description: "against the strategy",
			parentId: fx.strategy.id,
		});
		await addCounterGoal(fx, {
			name: "CG3",
			description: "against the claim",
			parentId: fx.claim.id,
		});

		const { after } = await expectRoundTripKeepsCase(owner.id, fx.caseId);

		const against = after.elements.filter((element) => element.isDefeater);
		expect(against.map((element) => element.defeats).sort()).toEqual([
			"claim",
			"strategy",
			"top goal",
		]);
	});

	it("keeps a counter-goal beneath evidence linked to one claim, with its own support", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "against the evidence",
			parentId: fx.evidenceOne.id,
		});
		const strategy = await addChild(fx, {
			elementType: "STRATEGY",
			name: "S2",
			description: "counter-goal strategy",
			parentId: counterGoal.id,
		});
		await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "counter-goal claim",
			parentId: counterGoal.id,
		});
		const deep = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P4",
			description: "counter-goal strategy claim",
			parentId: strategy.id,
		});
		const support = await evidenceNamed(fx, "E3", "counter-goal evidence");
		await linkEvidence(support.id, deep.id);

		const { after } = await expectRoundTripKeepsCase(owner.id, fx.caseId);

		const kept = after.elements.find(
			(e) => e.description === "against the evidence"
		);
		expect(kept?.parent).toBe("evidence for one claim");
		expect(kept?.defeats).toBe("evidence for one claim");
	});

	it("keeps a counter-goal beneath evidence linked to two claims, exactly once", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "against the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim supporting the counter-goal",
			parentId: counterGoal.id,
		});
		await addCounterGoal(fx, {
			name: "CG2",
			description: "against the counter-goal",
			parentId: counterGoal.id,
		});

		const { after, imported } = await expectRoundTripKeepsCase(
			owner.id,
			fx.caseId
		);

		expect(
			after.elements.filter(
				(e) => e.description === "against the shared evidence"
			)
		).toHaveLength(1);
		expect(
			after.links.filter((link) => link.evidence === "evidence for two claims")
		).toHaveLength(2);
		expect(imported.warnings).toHaveLength(0);
	});

	it("links the evidence of a counter-goal's own claim once, however many claims repeat the shared evidence above it", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "against the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		const support = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim supporting the counter-goal",
			parentId: counterGoal.id,
		});
		const supportEvidence = await evidenceNamed(
			fx,
			"E3",
			"evidence for the counter-goal's claim"
		);
		await linkEvidence(supportEvidence.id, support.id);

		const { after } = await expectRoundTripKeepsCase(owner.id, fx.caseId);

		expect(
			after.links.filter(
				(link) => link.evidence === "evidence for the counter-goal's claim"
			)
		).toHaveLength(1);
	});

	it("keeps evidence shared by three claims whose counter-goals and supports sit beneath it", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const third = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P5",
			description: "third claim using the shared evidence",
			parentId: fx.goal.id,
		});
		await linkEvidence(fx.evidenceShared.id, third.id);
		const one = await addCounterGoal(fx, {
			name: "CG1",
			description: "first counter-goal on the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		await addCounterGoal(fx, {
			name: "CG2",
			description: "second counter-goal on the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P6",
			description: "claim under the first counter-goal",
			parentId: one.id,
		});

		const { after } = await expectRoundTripKeepsCase(owner.id, fx.caseId);

		expect(
			after.links.filter((link) => link.evidence === "evidence for two claims")
		).toHaveLength(3);
	});

	it("keeps counter-goals nested under counter-goals under evidence", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const outer = await addCounterGoal(fx, {
			name: "CG1",
			description: "outer counter-goal",
			parentId: fx.evidenceShared.id,
		});
		const middle = await addCounterGoal(fx, {
			name: "CG2",
			description: "middle counter-goal",
			parentId: outer.id,
		});
		await addCounterGoal(fx, {
			name: "CG3",
			description: "inner counter-goal",
			parentId: middle.id,
		});

		const { after } = await expectRoundTripKeepsCase(owner.id, fx.caseId);

		const byDescription = new Map(
			after.elements.map((e) => [e.description, e])
		);
		expect(byDescription.get("middle counter-goal")?.parent).toBe(
			"outer counter-goal"
		);
		expect(byDescription.get("inner counter-goal")?.parent).toBe(
			"middle counter-goal"
		);
		expect(byDescription.get("middle counter-goal")?.defeats).toBe(
			"outer counter-goal"
		);
	});

	it("keeps a counter-goal against one element that hangs from another", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addCounterGoal(fx, {
			name: "CG1",
			description: "hangs from the claim, challenges the top goal",
			parentId: fx.claim.id,
			defeatsElementId: fx.goal.id,
		});

		const { after } = await expectRoundTripKeepsCase(owner.id, fx.caseId);

		const kept = after.elements.find(
			(e) => e.description === "hangs from the claim, challenges the top goal"
		);
		expect(kept?.parent).toBe("claim");
		expect(kept?.defeats).toBe("top goal");
	});

	it("keeps evidence that is reused beneath its own counter-goal", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "against the evidence",
			parentId: fx.evidenceOne.id,
		});
		const loop = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim under the counter-goal",
			parentId: counterGoal.id,
		});
		await linkEvidence(fx.evidenceOne.id, loop.id);

		const { after } = await expectRoundTripKeepsCase(owner.id, fx.caseId);

		expect(
			after.links.filter((link) => link.evidence === "evidence for one claim")
		).toHaveLength(2);
	});

	it("keeps a chain of counter-goals whose evidence leads back to earlier evidence", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const evidenceTwo = await evidenceNamed(fx, "E3", "evidence in the chain");
		const first = await addCounterGoal(fx, {
			name: "CG1",
			description: "first counter-goal",
			parentId: fx.evidenceOne.id,
		});
		const firstClaim = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim under the first counter-goal",
			parentId: first.id,
		});
		await linkEvidence(evidenceTwo.id, firstClaim.id);
		const second = await addCounterGoal(fx, {
			name: "CG2",
			description: "second counter-goal",
			parentId: evidenceTwo.id,
		});
		const secondClaim = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P4",
			description: "claim under the second counter-goal",
			parentId: second.id,
		});
		await linkEvidence(fx.evidenceOne.id, secondClaim.id);

		await expectRoundTripKeepsCase(owner.id, fx.caseId);
	});

	it("gives the same case again when the imported copy is exported and imported once more", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const onEvidence = await addCounterGoal(fx, {
			name: "CG1",
			description: "against the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim under the counter-goal",
			parentId: onEvidence.id,
		});
		await addCounterGoal(fx, {
			name: "CG2",
			description: "against the claim",
			parentId: fx.claim.id,
		});

		const before = await shapeOf(fx.caseId);
		const first = await roundTrip(owner.id, fx.caseId);
		const second = await roundTrip(owner.id, first.imported.caseId);
		const after = await shapeOf(second.imported.caseId);

		expect(after).toEqual(before);
	});

	it("accepts the exported file as valid import data", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addCounterGoal(fx, {
			name: "CG1",
			description: "against the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		const exported = viewed(
			await exportCase(owner.id, fx.caseId, {
				includeComments: false,
			})
		);

		const verdict = await validateImportData(
			JSON.parse(JSON.stringify(exported.data))
		);

		expect(verdict.isValid).toBe(true);
		expect(verdict.errors).toBeUndefined();
	});

	it("leaves the source case unchanged", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addCounterGoal(fx, {
			name: "CG1",
			description: "against the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		const before = await shapeOf(fx.caseId);

		await roundTrip(owner.id, fx.caseId);

		expect(await shapeOf(fx.caseId)).toEqual(before);
	});
});
