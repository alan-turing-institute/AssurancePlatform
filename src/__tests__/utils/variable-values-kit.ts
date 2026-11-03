import { randomUUID } from "node:crypto";
import { type PlainTreeNode, toPlainCase } from "@/lib/case/defined-terms";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import type { Prisma } from "@/src/generated/prisma";
import { createPublishedRow, fullStateOf } from "./pattern-start-kit";
import type { Source } from "./pattern-starters";
import { createTestPermission, createTestUser } from "./prisma-factories";

/**
 * Fixtures for the tests of giving values to a pattern's variables when a case
 * is started from it: a pattern whose five variables sit at four depths of its
 * argument (two of them share a name), a named entry that is not a variable,
 * references to all of them in the text of the elements, the two places a
 * pattern can be started from, and readers that show what a new case holds.
 */

type User = Awaited<ReturnType<typeof createTestUser>>;

/** Entry ids; ten lowercase letters or digits each. */
export const ID = {
	/** Variable `system` on the goal. */
	system: "sysaaaaaa1",
	/** Variable `owner` on the goal, which the pattern gives a value. */
	owner: "ownaaaaaa2",
	/** A named entry on the goal that is NOT a variable. */
	window: "winaaaaaa3",
	/** Variable `scope` on the strategy. */
	scope: "scopeaaaa4",
	/** Variable `dataset` on the sub-claim, three levels down. */
	dataset: "dataaaaaa5",
	/** A second variable called `system`, on the claim. */
	nested: "subaaaaaa6",
} as const;

export const DEFAULT_OWNER = "Default Owner";

export const NOT_A_VARIABLE =
	"That pattern has no variable to give that value to";
export const NOT_FOUND = "Pattern not found";
export const NOT_A_PATTERN = "That case is not a pattern";

/** The five variables, in tree order, as the dialog lists them. */
export const VARIABLE_IDS = [
	ID.system,
	ID.owner,
	ID.scope,
	ID.nested,
	ID.dataset,
] as const;

const ref = (name: string, id: string) => `{${name}#${id}}`;

function variableEntry(id: string, name: string, text: string, value?: string) {
	return value === undefined
		? { id, name, text, variable: true }
		: { id, name, text, value, variable: true };
}

/** The text of every element, with a reference to each name it can reach. */
const TEXT = {
	goal: `Goal: ${ref("system", ID.system)} run by ${ref("owner", ID.owner)}`,
	strategy: `Strategy over ${ref("scope", ID.scope)} of ${ref("system", ID.system)}`,
	strategyJustification: `Because ${ref("system", ID.system)} matters`,
	claim: `Claim about ${ref("system", ID.system)} and ${ref("system", ID.nested)} within ${ref("window", ID.window)}`,
	claimAssumption: `Assumes ${ref("owner", ID.owner)} is available`,
	subClaim: `Sub-claim uses ${ref("dataset", ID.dataset)}`,
	evidence: `Evidence for ${ref("dataset", ID.dataset)} on ${ref("system", ID.system)}`,
} as const;

export const MEANING = {
	system: "the system under test",
	owner: "who answers for it",
	scope: "what the strategy covers",
	nested: "the nested system",
	dataset: "the data used",
	window: "the moving interval",
} as const;

interface PatternOptions {
	kind?: "CASE" | "PATTERN";
	name?: string;
	/** What the pattern gives `owner`; `null` for no value. */
	ownerDefault?: string | null;
	/** What the pattern gives `system`; none by default. */
	systemDefault?: string;
}

export interface SeededPattern {
	byName: Record<string, string>;
	id: string;
}

async function seedElement(
	caseId: string,
	createdById: string,
	fields: {
		assumption?: string;
		context?: unknown[];
		description: string;
		elementType: "EVIDENCE" | "GOAL" | "PROPERTY_CLAIM" | "STRATEGY";
		inSandbox?: boolean;
		justification?: string;
		level?: number;
		name: string;
		parentId?: string | null;
		role?: "TOP_LEVEL";
		url?: string;
	}
) {
	const { context, ...rest } = fields;
	return await prisma.assuranceElement.create({
		data: {
			caseId,
			createdById,
			...rest,
			...(context ? { context: context as Prisma.InputJsonValue } : {}),
		},
	});
}

/**
 * A pattern (or, with `kind: "CASE"`, an ordinary case of the same shape)
 * written straight to the database: G1 > S1 > P1 > P1.1 > E1, the evidence
 * linked to P1.1, with variables on G1, S1, P1 and P1.1.
 */
export async function makePatternWithVariables(
	owner: User,
	options: PatternOptions = {}
): Promise<SeededPattern> {
	const ownerDefault =
		options.ownerDefault === undefined ? DEFAULT_OWNER : options.ownerDefault;
	const created = await prisma.assuranceCase.create({
		data: {
			name: options.name ?? `Pattern ${randomUUID().slice(0, 8)}`,
			description: "A pattern with variables",
			createdById: owner.id,
			kind: options.kind ?? "PATTERN",
		},
	});
	const goal = await seedElement(created.id, owner.id, {
		elementType: "GOAL",
		role: "TOP_LEVEL",
		name: "G1",
		description: TEXT.goal,
		context: [
			"A plain note",
			variableEntry(ID.system, "system", MEANING.system, options.systemDefault),
			variableEntry(
				ID.owner,
				"owner",
				MEANING.owner,
				ownerDefault ?? undefined
			),
			{
				id: ID.window,
				name: "window",
				text: MEANING.window,
				value: "5 minutes",
			},
		],
	});
	const strategy = await seedElement(created.id, owner.id, {
		elementType: "STRATEGY",
		name: "S1",
		parentId: goal.id,
		description: TEXT.strategy,
		justification: TEXT.strategyJustification,
		context: [variableEntry(ID.scope, "scope", MEANING.scope)],
	});
	const claim = await seedElement(created.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: strategy.id,
		level: 1,
		description: TEXT.claim,
		assumption: TEXT.claimAssumption,
		context: [variableEntry(ID.nested, "system", MEANING.nested)],
	});
	const subClaim = await seedElement(created.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1.1",
		parentId: claim.id,
		level: 2,
		description: TEXT.subClaim,
		context: [variableEntry(ID.dataset, "dataset", MEANING.dataset)],
	});
	const evidence = await seedElement(created.id, owner.id, {
		elementType: "EVIDENCE",
		name: "E1",
		description: TEXT.evidence,
		url: "https://example.com/evidence",
	});
	await prisma.evidenceLink.create({
		data: { evidenceId: evidence.id, claimId: subClaim.id },
	});
	return {
		id: created.id,
		byName: {
			G1: goal.id,
			S1: strategy.id,
			P1: claim.id,
			"P1.1": subClaim.id,
			E1: evidence.id,
		},
	};
}

/** A second pattern whose only variable has an id the first one does not. */
export async function makeOtherPattern(owner: User) {
	const created = await prisma.assuranceCase.create({
		data: {
			name: `Other ${randomUUID().slice(0, 8)}`,
			description: "Another pattern",
			createdById: owner.id,
			kind: "PATTERN",
		},
	});
	await seedElement(created.id, owner.id, {
		elementType: "GOAL",
		role: "TOP_LEVEL",
		name: "G1",
		description: "Another goal",
		context: [variableEntry("othaaaaaa9", "other", "another variable")],
	});
	return { id: created.id, variableId: "othaaaaaa9" };
}

export const SANDBOX_IDS = {
	/** On a detached claim: no parent, in the sandbox. */
	detached: "detaaaaaa7",
	/** On a claim beneath the detached claim. */
	beneathDetached: "undraaaaa8",
	/** On a claim that has a parent but is marked as in the sandbox. */
	flagged: "flagaaaaaa",
} as const;

/** Adds claims that hold variables but are not part of the argument tree. */
export async function addSandboxVariables(owner: User, pattern: SeededPattern) {
	const detached = await seedElement(pattern.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "D1",
		parentId: null,
		inSandbox: true,
		level: 1,
		description: "A claim moved to the sandbox",
		context: [variableEntry(SANDBOX_IDS.detached, "detached", "x")],
	});
	await seedElement(pattern.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "D2",
		parentId: detached.id,
		inSandbox: true,
		level: 2,
		description: "A claim beneath the detached claim",
		context: [variableEntry(SANDBOX_IDS.beneathDetached, "beneath", "y")],
	});
	await seedElement(pattern.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "F1",
		parentId: pattern.byName.S1 ?? null,
		inSandbox: true,
		level: 1,
		description: "A claim in the tree but marked as in the sandbox",
		context: [variableEntry(SANDBOX_IDS.flagged, "flagged", "z")],
	});
}

interface ScenarioOptions extends PatternOptions {
	/** Changes the pattern after it is written and before it is shared or published. */
	prepare?: (owner: User, pattern: SeededPattern) => Promise<void>;
}

/** Where a pattern is started from, with someone who can start from it. */
export interface Scenario {
	/** The pattern's owner. */
	owner: User;
	pattern: SeededPattern;
	/** The pattern case the source is, or came from. */
	patternId: string;
	/** The slug, for a published source. */
	slug?: string;
	source: Source;
	/** The user who starts the case. */
	user: User;
}

/** A pattern case that `user` can view but does not own. */
export async function patternCaseScenario(
	options: ScenarioOptions = {}
): Promise<Scenario> {
	const owner = await createTestUser();
	const pattern = await makePatternWithVariables(owner, options);
	await options.prepare?.(owner, pattern);
	const user = await createTestUser();
	await createTestPermission(pattern.id, user.id, owner.id, "VIEW");
	return {
		owner,
		patternId: pattern.id,
		pattern,
		source: { patternCaseId: pattern.id },
		user,
	};
}

/** The snapshot a publish would freeze for a pattern case. */
export async function snapshotOf(owner: User, caseId: string) {
	const exported = await exportCase(owner.id, caseId, {
		includeComments: false,
	});
	if (!("data" in exported)) {
		throw new Error(`export failed: ${exported.error}`);
	}
	return {
		...exported.data,
		pluginData: {},
		caseInformation: { summary: "Published summary" },
	};
}

/** A pattern published on Discover, started by a user with no access to it. */
export async function publishedScenario(
	options: ScenarioOptions & { archived?: boolean } = {}
): Promise<Scenario> {
	const owner = await createTestUser();
	const pattern = await makePatternWithVariables(owner, options);
	await options.prepare?.(owner, pattern);
	const slug = `pattern-${randomUUID().slice(0, 8)}`;
	await createPublishedRow({
		slug,
		assuranceCaseId: pattern.id,
		content: await snapshotOf(owner, pattern.id),
		archivedAt: options.archived ? new Date() : null,
	});
	return {
		owner,
		patternId: pattern.id,
		pattern,
		slug,
		source: { publishedSlug: slug },
		user: await createTestUser(),
	};
}

export const SCENARIOS: [string, () => Promise<Scenario>][] = [
	["a pattern case the user can view", () => patternCaseScenario()],
	["a published pattern", () => publishedScenario()],
];

/** Everything a start could change in the pattern and its published rows. */
export async function sourceState(patternId: string) {
	return {
		pattern: await fullStateOf(patternId),
		published: await prisma.publishedAssuranceCase.findMany({
			orderBy: { id: "asc" },
		}),
	};
}

interface StoredEntry {
	element: string;
	name: string;
	value?: string;
	variable: boolean;
}

/**
 * The named context entries stored on a case's elements, by entry id. A key
 * is absent from `value` when the entry has no value.
 */
export async function storedEntries(caseId: string) {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId, deletedAt: null },
		select: { name: true, context: true },
	});
	const entries: Record<string, StoredEntry> = {};
	for (const row of rows) {
		for (const item of Array.isArray(row.context) ? row.context : []) {
			if (typeof item !== "object" || item === null || Array.isArray(item)) {
				continue;
			}
			const entry = item as Record<string, unknown>;
			entries[String(entry.id)] = {
				element: row.name ?? "?",
				name: String(entry.name),
				variable: entry.variable === true,
				...("value" in entry ? { value: entry.value as string } : {}),
			};
		}
	}
	return entries;
}

/** The raw stored context list of the element named `name`. */
export async function storedContextOf(caseId: string, name: string) {
	const row = await prisma.assuranceElement.findFirstOrThrow({
		where: { caseId, name },
		select: { context: true },
	});
	return row.context;
}

export interface ShownText {
	assumption?: string;
	context?: string[];
	description: string;
	justification?: string;
}

function collect(node: PlainTreeNode, into: Record<string, ShownText>) {
	into[node.name ?? "?"] = {
		description: node.description,
		...(node.assumption ? { assumption: node.assumption } : {}),
		...(node.justification ? { justification: node.justification } : {}),
		...(node.context ? { context: node.context } : {}),
	};
	for (const child of node.children) {
		collect(child, into);
	}
}

/**
 * What every element of a case says, as a reader sees it: references written
 * as their value, `[name]` or `{name}`.
 */
export async function shownTexts(userId: string, caseId: string) {
	const exported = await exportCase(userId, caseId, { includeComments: false });
	if (!("data" in exported)) {
		throw new Error(`export failed: ${exported.error}`);
	}
	const shown: Record<string, ShownText> = {};
	collect(toPlainCase(exported.data).tree, shown);
	return shown;
}

type VariableKey = "dataset" | "nested" | "owner" | "scope" | "system";

/**
 * The text each element shows when the variables show as `shown`. A variable
 * missing from `shown` shows as its name in square brackets.
 */
export function expectedTexts(
	shown: Partial<Record<VariableKey, string>>
): Record<string, Omit<ShownText, "context">> {
	const display = (key: VariableKey) =>
		shown[key] ?? `[${key === "nested" ? "system" : key}]`;
	return {
		G1: {
			description: `Goal: ${display("system")} run by ${display("owner")}`,
		},
		S1: {
			description: `Strategy over ${display("scope")} of ${display("system")}`,
			justification: `Because ${display("system")} matters`,
		},
		P1: {
			description: `Claim about ${display("system")} and ${display("nested")} within {window}`,
			assumption: `Assumes ${display("owner")} is available`,
		},
		"P1.1": { description: `Sub-claim uses ${display("dataset")}` },
		E1: {
			description: `Evidence for ${display("dataset")} on ${display("system")}`,
		},
	};
}

/** The pattern's text exactly as stored, per element name. */
export async function storedTexts(caseId: string) {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId, deletedAt: null },
		orderBy: { name: "asc" },
		select: {
			name: true,
			description: true,
			assumption: true,
			justification: true,
		},
	});
	return rows;
}
