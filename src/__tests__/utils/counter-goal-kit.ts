import prisma from "@/lib/prisma";
import type { AssuranceElement } from "@/src/generated/prisma";
import { createTestCase, createTestElement } from "./prisma-factories";

/**
 * Fixtures and tree readers for counter-goal (goal-type defeater) tests.
 *
 * Elements are written straight through Prisma, so a test can store shapes the
 * services refuse to create (a counter-goal with no parent, for example) and
 * check how the read paths cope with them.
 */

export interface ArgumentFixture {
	caseId: string;
	/** A claim directly under the top goal. */
	claim: AssuranceElement;
	/** Evidence supporting one claim only. */
	evidenceOne: AssuranceElement;
	/** Evidence linked to two claims: `claim` and `strategyClaim`. */
	evidenceShared: AssuranceElement;
	/** The case's top goal. */
	goal: AssuranceElement;
	ownerId: string;
	/** A strategy under the top goal. */
	strategy: AssuranceElement;
	/** A claim under the strategy. */
	strategyClaim: AssuranceElement;
}

/**
 * A service result seen with both `data` and `error` optional, so a test can
 * read either one without narrowing the result first.
 */
export function viewed<T>(result: { data: T } | { error: string }): {
	data?: T;
	error?: string;
} {
	return result;
}

export function linkEvidence(
	evidenceId: string,
	claimId: string
): Promise<unknown> {
	return prisma.evidenceLink.create({ data: { evidenceId, claimId } });
}

/**
 * A small real argument: G1 with a claim and a strategy, a claim beneath the
 * strategy, and two pieces of evidence (one linked to a single claim, one to
 * two claims). Every description is unique so a copy of the case made by
 * export and import can be compared element by element.
 */
export async function buildArgument(ownerId: string): Promise<ArgumentFixture> {
	const testCase = await createTestCase(ownerId);
	const caseId = testCase.id;
	const goal = await createTestElement(caseId, ownerId, {
		elementType: "GOAL",
		name: "G1",
		description: "top goal",
		role: "TOP_LEVEL",
	});
	const strategy = await createTestElement(caseId, ownerId, {
		elementType: "STRATEGY",
		name: "S1",
		description: "strategy",
		parentId: goal.id,
	});
	const claim = await createTestElement(caseId, ownerId, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		description: "claim",
		parentId: goal.id,
	});
	const strategyClaim = await createTestElement(caseId, ownerId, {
		elementType: "PROPERTY_CLAIM",
		name: "P2",
		description: "strategy claim",
		parentId: strategy.id,
	});
	const evidenceOne = await createTestElement(caseId, ownerId, {
		elementType: "EVIDENCE",
		name: "E1",
		description: "evidence for one claim",
		url: "https://example.com/e1",
	});
	const evidenceShared = await createTestElement(caseId, ownerId, {
		elementType: "EVIDENCE",
		name: "E2",
		description: "evidence for two claims",
		url: "https://example.com/e2",
	});
	await linkEvidence(evidenceOne.id, claim.id);
	await linkEvidence(evidenceShared.id, claim.id);
	await linkEvidence(evidenceShared.id, strategyClaim.id);
	return {
		caseId,
		ownerId,
		goal,
		strategy,
		claim,
		strategyClaim,
		evidenceOne,
		evidenceShared,
	};
}

/**
 * Stores a counter-goal. `defeatsElementId` defaults to the parent, which is
 * how the diagram's "Add defeater" action sets it.
 */
export function addCounterGoal(
	fixture: Pick<ArgumentFixture, "caseId" | "ownerId">,
	options: {
		defeatsElementId?: string | null;
		description: string;
		name: string;
		parentId?: string;
	}
): Promise<AssuranceElement> {
	return createTestElement(fixture.caseId, fixture.ownerId, {
		elementType: "GOAL",
		name: options.name,
		description: options.description,
		parentId: options.parentId,
		isDefeater: true,
		defeatsElementId:
			options.defeatsElementId === undefined
				? (options.parentId ?? null)
				: options.defeatsElementId,
	});
}

/** A claim, strategy or the like, supporting (parented to) another element. */
export function addChild(
	fixture: Pick<ArgumentFixture, "caseId" | "ownerId">,
	options: {
		description: string;
		elementType: "PROPERTY_CLAIM" | "STRATEGY";
		name: string;
		parentId: string;
	}
): Promise<AssuranceElement> {
	return createTestElement(fixture.caseId, fixture.ownerId, options);
}

// ---------------------------------------------------------------------------
// Tree readers
// ---------------------------------------------------------------------------

const SKIPPED_KEYS: ReadonlySet<string> = new Set(["context", "comments"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every node of a case fetch's `goals` tree, in visit order. A node is an
 * object with a string `id` found inside any child array; context entries
 * and comments are not nodes.
 */
export function fetchNodes(goals: unknown): Record<string, unknown>[] {
	const found: Record<string, unknown>[] = [];
	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const item of value) {
				visit(item);
			}
			return;
		}
		if (!isRecord(value)) {
			return;
		}
		if (typeof value.id === "string") {
			found.push(value);
		}
		for (const [key, child] of Object.entries(value)) {
			if (!SKIPPED_KEYS.has(key)) {
				visit(child);
			}
		}
	};
	visit(goals);
	return found;
}

/** Ids of the nodes in a fetch whose `goals` list holds the given counter-goal. */
export function ownersOf(goals: unknown, counterGoalId: string): string[] {
	return fetchNodes(goals)
		.filter((node) =>
			Array.isArray(node.goals)
				? (node.goals as { id: string }[]).some(
						(goal) => goal.id === counterGoalId
					)
				: false
		)
		.map((node) => node.id as string);
}

/** How many times each element id occurs in a case fetch's `goals` tree. */
export function fetchIdCounts(goals: unknown): Map<string, number> {
	const counts = new Map<string, number>();
	for (const node of fetchNodes(goals)) {
		const id = node.id as string;
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return counts;
}

export interface ExportedNode {
	children: ExportedNode[];
	defeatsElementId?: string;
	description: string;
	id: string;
	isDefeater?: boolean;
	name: string | null;
	type: string;
}

/** Every node of an exported tree, root first, depth first. */
export function exportNodes(root: ExportedNode): ExportedNode[] {
	const found: ExportedNode[] = [];
	const visit = (node: ExportedNode): void => {
		found.push(node);
		for (const child of node.children) {
			visit(child);
		}
	};
	visit(root);
	return found;
}

/** How many times each element id occurs in an exported tree. */
export function exportIdCounts(root: ExportedNode): Map<string, number> {
	const counts = new Map<string, number>();
	for (const node of exportNodes(root)) {
		counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
	}
	return counts;
}

/** The ctid-ordered ids of a case's elements: the order a plain scan returns them in. */
export async function physicalOrder(caseId: string): Promise<string[]> {
	const rows = await prisma.$queryRaw<{ id: string }[]>`
		SELECT id FROM assurance_elements WHERE case_id = ${caseId} ORDER BY ctid
	`;
	return rows.map((row) => row.id);
}
