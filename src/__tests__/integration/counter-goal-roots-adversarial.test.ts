import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { importCase } from "@/lib/services/case-import-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	type ExportedNode,
	exportIdCounts,
	fetchIdCounts,
	linkEvidence,
	physicalOrder,
	viewed,
} from "../utils/counter-goal-kit";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * A case can hold a counter-goal with no parent next to its top goal (older
 * stored data, an import, an edit that cleared a parent). Whichever of the two
 * the database happens to return first, the case must be read from the
 * ordinary goal: the fetch's `goals`, the export's root and the publish
 * snapshot all keep the real argument.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
});

type RowOrder = "counter-goal first" | "top goal first";

interface RootClash {
	caseId: string;
	claimId: string;
	counterGoalId: string;
	counterGoalSupportId: string;
	evidenceId: string;
	goalId: string;
	ownerId: string;
	supportedCounterGoalId: string;
}

/**
 * The real argument (G1, a claim and a piece of evidence), a counter-goal
 * hung from the claim, and one parentless counter-goal with a claim of its
 * own. The two roots are written in the order asked for.
 */
async function buildRootClash(
	ownerId: string,
	order: RowOrder,
	flipWithUpdate: boolean
): Promise<RootClash> {
	const testCase = await createTestCase(ownerId);
	const caseId = testCase.id;

	const writeParentless = () =>
		createTestElement(caseId, ownerId, {
			elementType: "GOAL",
			name: "CG9",
			description: "parentless counter-goal",
			isDefeater: true,
		});
	const writeTop = () =>
		createTestElement(caseId, ownerId, {
			elementType: "GOAL",
			name: "G1",
			description: "top goal",
			role: "TOP_LEVEL",
		});

	// With an update, the roots are written in the opposite order first and the
	// row that should end up later is rewritten, which moves its new version
	// behind the other root in the table.
	const writeCounterFirst = (order === "counter-goal first") !== flipWithUpdate;
	let parentless: Awaited<ReturnType<typeof writeParentless>>;
	let top: Awaited<ReturnType<typeof writeTop>>;
	if (writeCounterFirst) {
		parentless = await writeParentless();
		top = await writeTop();
	} else {
		top = await writeTop();
		parentless = await writeParentless();
	}

	const claim = await createTestElement(caseId, ownerId, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		description: "claim",
		parentId: top.id,
	});
	const evidence = await createTestElement(caseId, ownerId, {
		elementType: "EVIDENCE",
		name: "E1",
		description: "evidence",
		url: "https://example.com/e1",
	});
	await linkEvidence(evidence.id, claim.id);
	const attached = await createTestElement(caseId, ownerId, {
		elementType: "GOAL",
		name: "CG1",
		description: "counter-goal against the claim",
		parentId: claim.id,
		isDefeater: true,
		defeatsElementId: claim.id,
	});
	await createTestElement(caseId, ownerId, {
		elementType: "PROPERTY_CLAIM",
		name: "CG1.1",
		description: "claim supporting the attached counter-goal",
		parentId: attached.id,
	});
	const parentlessSupport = await createTestElement(caseId, ownerId, {
		elementType: "PROPERTY_CLAIM",
		name: "CG9.1",
		description: "claim under the parentless counter-goal",
		parentId: parentless.id,
	});

	if (flipWithUpdate) {
		// Rewriting the row that was written first moves it behind the other.
		const first = writeCounterFirst ? parentless : top;
		await prisma.assuranceElement.update({
			where: { id: first.id },
			data: { description: `${first.description} (edited)` },
		});
	}

	return {
		ownerId,
		caseId,
		goalId: top.id,
		claimId: claim.id,
		evidenceId: evidence.id,
		counterGoalId: parentless.id,
		supportedCounterGoalId: attached.id,
		counterGoalSupportId: parentlessSupport.id,
	};
}

const SCENARIOS: Array<{ flip: boolean; label: string; order: RowOrder }> = [
	{
		label: "written counter-goal first",
		order: "counter-goal first",
		flip: false,
	},
	{ label: "written top goal first", order: "top goal first", flip: false },
	{
		label: "counter-goal first after the top goal is edited",
		order: "counter-goal first",
		flip: true,
	},
	{
		label: "top goal first after the counter-goal is edited",
		order: "top goal first",
		flip: true,
	},
];

describe.each(
	SCENARIOS
)("a parentless counter-goal beside the top goal ($label)", ({
	order,
	flip,
}) => {
	async function setUp() {
		const owner = await createTestUser();
		const clash = await buildRootClash(owner.id, order, flip);
		const rows = await physicalOrder(clash.caseId);
		const topIndex = rows.indexOf(clash.goalId);
		const counterIndex = rows.indexOf(clash.counterGoalId);
		// The scenario only means something if the rows really sit that way.
		const rowsInIntendedOrder =
			order === "counter-goal first"
				? counterIndex < topIndex
				: topIndex < counterIndex;
		return { owner, clash, rowsInIntendedOrder };
	}

	it("puts the ordinary goal first in the case fetch and keeps its whole argument", async () => {
		const { owner, clash, rowsInIntendedOrder } = await setUp();
		expect(rowsInIntendedOrder).toBe(true);

		const result = viewed(await fetchCaseFromPrisma(clash.caseId, owner.id));

		expect(result.error).toBeUndefined();
		const goals = result.data?.goals ?? [];
		expect(goals[0]?.id).toBe(clash.goalId);
		const counts = fetchIdCounts(goals);
		expect(counts.get(clash.goalId)).toBe(1);
		expect(counts.get(clash.claimId)).toBe(1);
		expect(counts.get(clash.evidenceId)).toBe(1);
		expect(counts.get(clash.supportedCounterGoalId)).toBe(1);
		// Nothing of the parentless counter-goal's own branch is drawn as if it
		// were part of the argument.
		expect(counts.has(clash.counterGoalSupportId)).toBe(false);
	});

	it("roots the export on the ordinary goal and keeps its whole argument", async () => {
		const { owner, clash, rowsInIntendedOrder } = await setUp();
		expect(rowsInIntendedOrder).toBe(true);

		const result = viewed(
			await exportCase(owner.id, clash.caseId, {
				includeComments: false,
			})
		);

		expect(result.error).toBeUndefined();
		const tree = result.data?.tree as unknown as ExportedNode;
		expect(tree.id).toBe(clash.goalId);
		expect(tree.type).toBe("GOAL");
		expect(tree.isDefeater).toBeUndefined();
		const counts = exportIdCounts(tree);
		expect(counts.get(clash.claimId)).toBe(1);
		expect(counts.get(clash.evidenceId)).toBe(1);
		expect(counts.get(clash.supportedCounterGoalId)).toBe(1);
		expect(counts.has(clash.counterGoalSupportId)).toBe(false);
	});

	it("freezes the real argument into the publish snapshot", async () => {
		const { owner, clash, rowsInIntendedOrder } = await setUp();
		expect(rowsInIntendedOrder).toBe(true);

		const { publishAssuranceCase } = await import(
			"@/lib/services/publish-service"
		);
		const published = await publishAssuranceCase(owner.id, clash.caseId);
		if ("error" in published) {
			throw new Error(published.error);
		}

		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.data.publishedId },
		});
		const content = row.content as unknown as { tree: ExportedNode };
		expect(content.tree.id).toBe(clash.goalId);
		const counts = exportIdCounts(content.tree);
		expect(counts.get(clash.claimId)).toBe(1);
		expect(counts.get(clash.evidenceId)).toBe(1);
		expect(counts.get(clash.supportedCounterGoalId)).toBe(1);
	});

	it("returns the ordinary goal first from the case route", async () => {
		const { owner, clash, rowsInIntendedOrder } = await setUp();
		expect(rowsInIntendedOrder).toBe(true);
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/cases/[id]/route");
		const response = await GET(
			new NextRequest(`http://localhost:3000/api/cases/${clash.caseId}`),
			{ params: Promise.resolve({ id: clash.caseId }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.goals[0].id).toBe(clash.goalId);
	});
});

describe("a parentless counter-goal arriving through import", () => {
	function flatFile(counterGoalFirst: boolean) {
		const goalId = crypto.randomUUID();
		const counterGoalId = crypto.randomUUID();
		const claimId = crypto.randomUUID();
		const evidenceId = crypto.randomUUID();
		const goal = {
			id: goalId,
			elementType: "GOAL",
			role: "TOP_LEVEL",
			parentId: null,
			name: "G1",
			description: "imported top goal",
			inSandbox: false,
		};
		const counterGoal = {
			id: counterGoalId,
			elementType: "GOAL",
			parentId: null,
			name: "CG1",
			description: "imported parentless counter-goal",
			isDefeater: true,
			defeatsElementId: goalId,
			inSandbox: false,
		};
		const claim = {
			id: claimId,
			elementType: "PROPERTY_CLAIM",
			parentId: goalId,
			name: "P1",
			description: "imported claim",
			inSandbox: false,
		};
		const evidence = {
			id: evidenceId,
			elementType: "EVIDENCE",
			parentId: null,
			name: "E1",
			description: "imported evidence",
			url: "https://example.com/imported",
			inSandbox: false,
		};
		return {
			ids: { goalId, claimId, evidenceId },
			file: {
				version: "2.0",
				exportedAt: new Date().toISOString(),
				case: { name: "Imported", description: "" },
				elements: counterGoalFirst
					? [counterGoal, goal, claim, evidence]
					: [goal, claim, evidence, counterGoal],
				evidenceLinks: [{ evidenceId, claimId }],
			},
		};
	}

	it.each([
		["counter-goal listed first", true],
		["top goal listed first", false],
	])("reads the imported case from its ordinary goal (%s)", async (_label, counterGoalFirst) => {
		const owner = await createTestUser();
		const { file } = flatFile(counterGoalFirst);

		const imported = await importCase(owner.id, file);
		if ("error" in imported) {
			throw new Error(imported.error);
		}
		const caseId = imported.data.caseId;

		const fetched = viewed(await fetchCaseFromPrisma(caseId, owner.id));
		const goalRow = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId, elementType: "GOAL", isDefeater: false },
		});
		expect(fetched.data?.goals?.[0]?.id).toBe(goalRow.id);
		const exported = viewed(
			await exportCase(owner.id, caseId, {
				includeComments: false,
			})
		);
		const tree = exported.data?.tree as unknown as ExportedNode;
		expect(tree.id).toBe(goalRow.id);
		const counts = exportIdCounts(tree);
		const claimRow = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId, elementType: "PROPERTY_CLAIM" },
		});
		const evidenceRow = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId, elementType: "EVIDENCE" },
		});
		expect(counts.get(claimRow.id)).toBe(1);
		expect(counts.get(evidenceRow.id)).toBe(1);
	});
});
