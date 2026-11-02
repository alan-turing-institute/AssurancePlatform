import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { importCase } from "@/lib/services/case-import-service";

/**
 * Fixtures for the case-kind tests: case files in the nested and flat formats
 * that hold every kind of element an import can create (nested claims, a
 * claim-level defeater, a counter-goal under evidence, assumption and
 * justification elements, an away goal and a module), and readers for what an
 * import wrote.
 */

/** Ids of the elements in the rich files, shared by the nested and flat forms. */
export const NODE = {
	goal: "30000000-0000-4000-8000-000000000001",
	strategy: "30000000-0000-4000-8000-000000000002",
	claim: "30000000-0000-4000-8000-000000000003",
	subClaim: "30000000-0000-4000-8000-000000000004",
	evidence: "30000000-0000-4000-8000-000000000005",
	claimDefeater: "30000000-0000-4000-8000-000000000006",
	assumption: "30000000-0000-4000-8000-000000000007",
	justification: "30000000-0000-4000-8000-000000000008",
	awayGoal: "30000000-0000-4000-8000-000000000009",
	module: "30000000-0000-4000-8000-00000000000a",
	counterGoal: "30000000-0000-4000-8000-00000000000b",
} as const;

export type NodeKey = keyof typeof NODE;

/** How many elements an import of a rich file creates. */
export const RICH_ELEMENT_COUNT = Object.keys(NODE).length;

export interface RichFileOptions {
	/** Extra keys on the `case` object. */
	caseFields?: Record<string, unknown>;
	/** A case for the away goal and the module to point at. */
	citedCaseId?: string;
	/** Extra keys on every element. */
	everyElement?: Record<string, unknown>;
	/** An explicit `fromPattern` value to write on the named elements. */
	fromPattern?: Partial<Record<NodeKey, boolean>>;
	/** Extra keys beside `version`, `case` and `tree` / `elements`. */
	topLevel?: Record<string, unknown>;
	/** Nested files only. */
	version?: "1.0" | "1.1";
}

function citation(citedCaseId: string | undefined) {
	return citedCaseId ? { moduleReferenceId: citedCaseId } : {};
}

/** A nested-format file holding one of every kind of element. */
export function richNestedFile(
	options: RichFileOptions = {}
): Record<string, unknown> {
	const {
		caseFields = {},
		citedCaseId,
		everyElement = {},
		fromPattern = {},
		topLevel = {},
		version = "1.0",
	} = options;

	const make = (
		key: NodeKey,
		fields: Record<string, unknown>
	): Record<string, unknown> => ({
		id: NODE[key],
		inSandbox: false,
		...(key in fromPattern ? { fromPattern: fromPattern[key] } : {}),
		...everyElement,
		...fields,
		children: (fields.children as unknown[] | undefined) ?? [],
	});

	const counterGoal = make("counterGoal", {
		type: "GOAL",
		name: "CG1",
		description: "A counter-goal under the evidence",
		isDefeater: true,
		defeatsElementId: NODE.evidence,
	});
	const evidence = make("evidence", {
		type: "EVIDENCE",
		name: "E1",
		description: "The evidence",
		url: "https://example.com/evidence",
		children: [counterGoal],
	});
	const subClaim = make("subClaim", {
		type: "PROPERTY_CLAIM",
		name: "P1.1",
		description: "A claim under a claim",
		level: 2,
		children: [evidence],
	});
	const claimDefeater = make("claimDefeater", {
		type: "PROPERTY_CLAIM",
		name: "CP1",
		description: "A defeater of the claim",
		isDefeater: true,
		defeatsElementId: NODE.claim,
	});
	const assumption = make("assumption", {
		type: "ASSUMPTION",
		name: "A1",
		description: "An assumption beside the claim",
	});
	const claim = make("claim", {
		type: "PROPERTY_CLAIM",
		name: "P1",
		description: "The claim",
		level: 1,
		children: [subClaim, claimDefeater, assumption],
	});
	const justification = make("justification", {
		type: "JUSTIFICATION",
		name: "J1",
		description: "A justification beside the strategy",
	});
	const awayGoal = make("awayGoal", {
		type: "AWAY_GOAL",
		name: "AG1",
		description: "An away goal",
		...citation(citedCaseId),
	});
	const module = make("module", {
		type: "MODULE",
		name: "M1",
		description: "A module",
		moduleEmbedType: "COPY",
		...citation(citedCaseId),
	});
	const strategy = make("strategy", {
		type: "STRATEGY",
		name: "S1",
		description: "The strategy",
		children: [claim, justification, awayGoal, module],
	});
	const goal = make("goal", {
		type: "GOAL",
		name: "G1",
		description: "The goal",
		role: "TOP_LEVEL",
		children: [strategy],
	});

	return {
		version,
		exportedAt: new Date().toISOString(),
		case: {
			name: "File case name",
			description: "File case description",
			...caseFields,
		},
		tree: goal,
		...topLevel,
	};
}

/** A flat-format (version 2.0) file holding the same elements as `richNestedFile`. */
export function richFlatFile(
	options: RichFileOptions = {}
): Record<string, unknown> {
	const {
		caseFields = {},
		citedCaseId,
		everyElement = {},
		fromPattern = {},
		topLevel = {},
	} = options;

	const make = (
		key: NodeKey,
		parent: NodeKey | null,
		fields: Record<string, unknown>
	): Record<string, unknown> => ({
		id: NODE[key],
		parentId: parent ? NODE[parent] : null,
		inSandbox: false,
		...(key in fromPattern ? { fromPattern: fromPattern[key] } : {}),
		...everyElement,
		...fields,
	});

	return {
		version: "2.0",
		exportedAt: new Date().toISOString(),
		case: {
			name: "File case name",
			description: "File case description",
			...caseFields,
		},
		elements: [
			make("goal", null, {
				elementType: "GOAL",
				role: "TOP_LEVEL",
				name: "G1",
				description: "The goal",
			}),
			make("strategy", "goal", {
				elementType: "STRATEGY",
				name: "S1",
				description: "The strategy",
			}),
			make("claim", "strategy", {
				elementType: "PROPERTY_CLAIM",
				name: "P1",
				description: "The claim",
				level: 1,
			}),
			make("subClaim", "claim", {
				elementType: "PROPERTY_CLAIM",
				name: "P1.1",
				description: "A claim under a claim",
				level: 2,
			}),
			make("evidence", null, {
				elementType: "EVIDENCE",
				name: "E1",
				description: "The evidence",
				url: "https://example.com/evidence",
			}),
			make("claimDefeater", "claim", {
				elementType: "PROPERTY_CLAIM",
				name: "CP1",
				description: "A defeater of the claim",
				isDefeater: true,
				defeatsElementId: NODE.claim,
			}),
			make("assumption", "claim", {
				elementType: "ASSUMPTION",
				name: "A1",
				description: "An assumption beside the claim",
			}),
			make("justification", "strategy", {
				elementType: "JUSTIFICATION",
				name: "J1",
				description: "A justification beside the strategy",
			}),
			make("awayGoal", "strategy", {
				elementType: "AWAY_GOAL",
				name: "AG1",
				description: "An away goal",
				...citation(citedCaseId),
			}),
			make("module", "strategy", {
				elementType: "MODULE",
				name: "M1",
				description: "A module",
				moduleEmbedType: "COPY",
				...citation(citedCaseId),
			}),
			make("counterGoal", "evidence", {
				elementType: "GOAL",
				name: "CG1",
				description: "A counter-goal under the evidence",
				isDefeater: true,
				defeatsElementId: NODE.evidence,
			}),
		],
		evidenceLinks: [{ evidenceId: NODE.evidence, claimId: NODE.subClaim }],
		...topLevel,
	};
}

/** The file formats a test runs over. */
export const FILE_FORMATS: [string, (options?: RichFileOptions) => unknown][] =
	[
		["nested 1.0", (options) => richNestedFile({ ...options, version: "1.0" })],
		["nested 1.1", (options) => richNestedFile({ ...options, version: "1.1" })],
		["flat 2.0", (options) => richFlatFile(options)],
	];

/** Imports a file, failing the test unless the import succeeded. */
export async function importOk(
	userId: string,
	file: unknown,
	options?: Parameters<typeof importCase>[2]
) {
	const result = await importCase(userId, file, options);
	if (!("data" in result)) {
		throw new Error(
			`import failed: ${result.error} ${JSON.stringify(result.validationErrors)}`
		);
	}
	return result.data;
}

/** The kind, source link and name fields of a stored case. */
export function storedCase(caseId: string) {
	return prisma.assuranceCase.findUniqueOrThrow({
		where: { id: caseId },
		select: {
			id: true,
			name: true,
			description: true,
			kind: true,
			sourcePatternId: true,
			createdById: true,
		},
	});
}

/** The pattern flags of every element of a stored case, keyed by the element's name. */
export async function patternFlags(caseId: string) {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId },
		select: { name: true, fromPattern: true, modifiedFromPattern: true },
		orderBy: { name: "asc" },
	});
	return rows;
}

/** A case owned by `ownerId` that is a pattern, written straight to the database. */
export function createStoredPattern(ownerId: string, name?: string) {
	return prisma.assuranceCase.create({
		data: {
			name: name ?? `Pattern ${randomUUID().slice(0, 8)}`,
			description: "A pattern",
			createdById: ownerId,
			kind: "PATTERN",
		},
	});
}

/** An ordinary case owned by `ownerId`, written straight to the database. */
export function createStoredCase(ownerId: string, name?: string) {
	return prisma.assuranceCase.create({
		data: {
			name: name ?? `Case ${randomUUID().slice(0, 8)}`,
			description: "An ordinary case",
			createdById: ownerId,
			kind: "CASE",
		},
	});
}
