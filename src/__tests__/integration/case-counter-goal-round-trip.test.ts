import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import { importCase } from "@/lib/services/case-import-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * A case's elements and evidence links, described by element name so two
 * copies of the same case compare equal whatever ids they were given.
 */
async function describeCase(caseId: string) {
	const elements = await prisma.assuranceElement.findMany({
		where: { caseId, deletedAt: null },
	});
	const nameOf = new Map(elements.map((el) => [el.id, el.name]));
	const links = await prisma.evidenceLink.findMany({
		where: { evidence: { caseId } },
	});
	return {
		elements: elements
			.map((el) => ({
				name: el.name,
				type: el.elementType,
				parent: el.parentId ? nameOf.get(el.parentId) : null,
				isDefeater: el.isDefeater,
				defeats: el.defeatsElementId ? nameOf.get(el.defeatsElementId) : null,
			}))
			.sort((a, b) => String(a.name).localeCompare(String(b.name))),
		links: links
			.map(
				(link) =>
					`${nameOf.get(link.evidenceId)} -> ${nameOf.get(link.claimId)}`
			)
			.sort(),
	};
}

describe("counter-goals through export and import", () => {
	it("keeps a counter-goal under evidence linked to two claims, with its support, exactly once", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const make = (
			elementType: "GOAL" | "PROPERTY_CLAIM" | "EVIDENCE",
			name: string,
			extra: {
				parentId?: string;
				isDefeater?: boolean;
				defeatsElementId?: string;
			} = {}
		) =>
			createTestElement(testCase.id, owner.id, { elementType, name, ...extra });

		const goal = await make("GOAL", "G1");
		const first = await make("PROPERTY_CLAIM", "P1", { parentId: goal.id });
		const second = await make("PROPERTY_CLAIM", "P2", { parentId: goal.id });
		const shared = await make("EVIDENCE", "E1");
		const counter = await make("GOAL", "CG1", {
			parentId: shared.id,
			isDefeater: true,
			defeatsElementId: shared.id,
		});
		const support = await make("PROPERTY_CLAIM", "P3", {
			parentId: counter.id,
		});
		const own = await make("EVIDENCE", "E2");
		await prisma.evidenceLink.createMany({
			data: [
				{ evidenceId: shared.id, claimId: first.id },
				{ evidenceId: shared.id, claimId: second.id },
				// The counter-goal's support reuses the evidence it challenges.
				{ evidenceId: shared.id, claimId: support.id },
				{ evidenceId: own.id, claimId: support.id },
			],
		});
		const before = await describeCase(testCase.id);
		expect(before.elements).toHaveLength(7);
		expect(before.links).toHaveLength(4);

		const exported = expectSuccess(await exportCase(owner.id, testCase.id));
		// Through a file, as a download and re-upload would be.
		const file = JSON.parse(JSON.stringify(exported));
		const imported = expectSuccess(await importCase(owner.id, file));

		expect(imported.elementCount).toBe(7);
		expect(imported.evidenceLinkCount).toBe(4);
		expect(await describeCase(imported.caseId)).toEqual(before);
	});
});
