// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentExportData } from "@/actions/export-document";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import prisma from "@/lib/prisma";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import {
	createCaseFromPattern,
	readPatternVariables,
} from "@/lib/services/case-from-pattern-service";
import { importCase } from "@/lib/services/case-import-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	claimHealthCaller,
	claimIn,
	healthWorld,
	TOOL_OPTIONS,
} from "../utils/assistant-claim-health-kit";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	childNames,
	descriptionsInOrder,
	differingOrders,
	firstOf,
	nodeAt,
	readUnderEveryRowOrder,
} from "../utils/export-order-kit";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";
import { setContext, variableEntry } from "../utils/variables-kit";

/**
 * The order of an exported case's children, whatever order the database
 * returns rows in. Cases are written straight to the database in an order that
 * is neither the defined order nor its reverse; the rows are then handed to the
 * export in many different orders, as a database may return them after its
 * statistics change.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

type User = Awaited<ReturnType<typeof createTestUser>>;
type ElementType =
	| "GOAL"
	| "STRATEGY"
	| "PROPERTY_CLAIM"
	| "EVIDENCE"
	| "MODULE"
	| "AWAY_GOAL";

let sequence = 0;

interface SiblingCase {
	ag1: string;
	caseId: string;
	counterGoalIds: string[];
	e1: string;
	e2: string;
	e3: string;
	g1: string;
	m1: string;
	p1: string;
	p2: string;
	p10: string;
	s1: string;
}

/** What G1's children read as, in the diagram's order. */
const G1_CHILDREN = ["P1", "P2", "P10", "S1", "E1", "E2", "AG1", "M1"];

async function siblingCase(
	owner: User,
	kind: "CASE" | "PATTERN" = "CASE"
): Promise<SiblingCase> {
	const kase = await createTestCase(owner.id, { kind });
	const target = await createTestCase(owner.id);
	const make = (
		elementType: ElementType,
		name: string,
		parentId?: string,
		extra: Record<string, unknown> = {}
	) => {
		sequence += 1;
		return createTestElement(kase.id, owner.id, {
			elementType,
			name,
			description: `${name} number ${sequence}`,
			parentId,
			...extra,
		});
	};
	const g1 = await make("GOAL", "G1", undefined, { role: "TOP_LEVEL" });
	// created in an order that is neither the defined one nor its reverse
	const p10 = await make("PROPERTY_CLAIM", "P10", g1.id);
	const m1 = await make("MODULE", "M1", g1.id, {
		moduleReferenceId: target.id,
		moduleEmbedType: "REFERENCE",
	});
	const p2 = await make("PROPERTY_CLAIM", "P2", g1.id);
	const ag1 = await make("AWAY_GOAL", "AG1", g1.id, {
		moduleReferenceId: target.id,
	});
	const p1 = await make("PROPERTY_CLAIM", "P1", g1.id);
	const s1 = await make("STRATEGY", "S1", g1.id);
	await make("PROPERTY_CLAIM", "P1.10", p1.id);
	await make("PROPERTY_CLAIM", "P1.2", p1.id);
	await make("PROPERTY_CLAIM", "P11", s1.id);
	const e2 = await make("EVIDENCE", "E2", undefined, {
		url: "https://example.com/e2",
	});
	const e1 = await make("EVIDENCE", "E1", undefined, {
		url: "https://example.com/e1",
	});
	const e3 = await make("EVIDENCE", "E3", undefined, {
		url: "https://example.com/e3",
	});
	// linked in the order E2, E1
	await prisma.evidenceLink.create({
		data: { evidenceId: e2.id, claimId: g1.id },
	});
	await prisma.evidenceLink.create({
		data: { evidenceId: e1.id, claimId: g1.id },
	});
	// E3 is shared by P2 and P1; the copy under P1 comes first in the written tree
	await prisma.evidenceLink.create({
		data: { evidenceId: e3.id, claimId: p2.id },
	});
	await prisma.evidenceLink.create({
		data: { evidenceId: e3.id, claimId: p1.id },
	});
	const counterGoalIds: string[] = [];
	for (const name of ["CG10", "CG2", "CG1"]) {
		const counter = await make("GOAL", name, e3.id, {
			isDefeater: true,
			defeatsElementId: e3.id,
		});
		counterGoalIds.push(counter.id);
	}
	return {
		caseId: kase.id,
		g1: g1.id,
		p1: p1.id,
		p2: p2.id,
		p10: p10.id,
		s1: s1.id,
		ag1: ag1.id,
		m1: m1.id,
		e1: e1.id,
		e2: e2.id,
		e3: e3.id,
		counterGoalIds,
	};
}

async function exported(
	userId: string,
	caseId: string,
	includeComments = false
): Promise<CaseExportNested> {
	return expectSuccess(await exportCase(userId, caseId, { includeComments }));
}

function treeUnderEveryRowOrder(userId: string, caseId: string) {
	return readUnderEveryRowOrder(
		async () => (await exported(userId, caseId)).tree
	);
}

describe("an exported case's children, whatever order the rows come back in", () => {
	it("are the diagram's order: claims and strategies, then evidence, then away goals and modules", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);

		const readings = await treeUnderEveryRowOrder(owner.id, fx.caseId);

		expect(differingOrders(readings)).toEqual([]);
		const tree = firstOf(readings);
		expect(childNames(tree)).toEqual(G1_CHILDREN);
		expect(childNames(nodeAt(tree, fx.p1))).toEqual(["P1.2", "P1.10", "E3"]);
		expect(childNames(nodeAt(tree, fx.s1))).toEqual(["P11"]);
	});

	it("are the same on the database's own order, before and after every row is rewritten and the statistics refreshed", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);
		const before = await exported(owner.id, fx.caseId);

		const rows = await prisma.assuranceElement.findMany({
			where: { caseId: fx.caseId },
			select: { id: true, description: true },
			orderBy: { id: "desc" },
		});
		for (const row of rows) {
			await prisma.assuranceElement.update({
				where: { id: row.id },
				data: { description: row.description },
			});
		}
		await prisma.$executeRawUnsafe("ANALYZE assurance_elements");
		await prisma.$executeRawUnsafe("ANALYZE evidence_links");
		const after = await exported(owner.id, fx.caseId);

		expect(after.tree).toEqual(before.tree);
		expect(childNames(after.tree)).toEqual(G1_CHILDREN);
	});

	it("give shared evidence's counter-goals, in order, to its first copy only", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);

		const readings = await treeUnderEveryRowOrder(owner.id, fx.caseId);

		expect(differingOrders(readings)).toEqual([]);
		const tree = firstOf(readings);
		expect(childNames(nodeAt(tree, fx.p1, fx.e3))).toEqual([
			"CG1",
			"CG2",
			"CG10",
		]);
		expect(nodeAt(tree, fx.p2, fx.e3).children).toEqual([]);
	});

	it("are ordered by element id when siblings share a name, whatever order the rows come in", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const goal = await createTestElement(kase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
			role: "TOP_LEVEL",
		});
		const ids: string[] = [];
		for (let i = 0; i < 8; i++) {
			const sibling = await createTestElement(kase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				name: "P1",
				parentId: goal.id,
			});
			ids.push(sibling.id);
		}
		const evidenceIds: string[] = [];
		for (let i = 0; i < 6; i++) {
			const piece = await createTestElement(kase.id, owner.id, {
				elementType: "EVIDENCE",
				name: "E3",
				url: `https://example.com/${i}`,
			});
			await prisma.evidenceLink.create({
				data: { evidenceId: piece.id, claimId: goal.id },
			});
			evidenceIds.push(piece.id);
		}

		const readings = await treeUnderEveryRowOrder(owner.id, kase.id);

		expect(differingOrders(readings)).toEqual([]);
		const tree = firstOf(readings);
		expect((tree.children ?? []).map((n) => n.id)).toEqual([
			...[...ids].sort(),
			...[...evidenceIds].sort(),
		]);
	});

	it("are placed by their names and kinds when elements have no name, an empty name or free text", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const goal = await createTestElement(kase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
			role: "TOP_LEVEL",
		});
		const names: (string | null)[] = [
			"zebra",
			null,
			"P10",
			"",
			"P2",
			"Apple",
			"p2",
			"P01",
			"P1",
			"É1",
			"e1",
			"😀10",
			"😀2",
			"P9007199254740993",
			"P9007199254740992",
			"P007",
			"P8",
			" P1",
			"P1 ",
			"P1.2",
			"P1.10",
		];
		for (const [index, name] of names.entries()) {
			const created = await createTestElement(kase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
				description: `claim ${index}`,
			});
			await prisma.assuranceElement.update({
				where: { id: created.id },
				data: { name },
			});
		}

		const readings = await treeUnderEveryRowOrder(owner.id, kase.id);

		expect(differingOrders(readings)).toEqual([]);
		const written = childNames(firstOf(readings));
		const place = (name: string | null) => written.indexOf(name);
		// a missing or empty name comes first
		expect(place(null)).toBeLessThan(place("zebra"));
		expect(place("")).toBeLessThan(place("zebra"));
		expect(Math.max(place(null), place(""))).toBeLessThan(
			Math.min(...written.filter(Boolean).map((n) => written.indexOf(n)))
		);
		// numbers compare as numbers
		expect(place("P1")).toBeLessThan(place("P2"));
		expect(place("P2")).toBeLessThan(place("P10"));
		expect(place("P8")).toBeLessThan(place("P10"));
		expect(place("P007")).toBeLessThan(place("P8"));
		expect(place("P1.2")).toBeLessThan(place("P1.10"));
		expect(place("P9007199254740992")).toBeLessThan(place("P9007199254740993"));
		expect(place("😀2")).toBeLessThan(place("😀10"));
		// letters compare without regard to case, then the number
		expect(place("p2")).toBeLessThan(place("P10"));
	});
});

describe("the root of an exported case", () => {
	it("is the top-level goal rather than a stray goal with no name, whatever order the rows come in", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const top = await createTestElement(kase.id, owner.id, {
			elementType: "GOAL",
			name: "G7",
			role: "TOP_LEVEL",
		});
		await createTestElement(kase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: top.id,
		});
		const stray = await createTestElement(kase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await prisma.assuranceElement.update({
			where: { id: stray.id },
			data: { name: null },
		});
		const emptyStray = await createTestElement(kase.id, owner.id, {
			elementType: "GOAL",
			name: "G2",
		});
		await prisma.assuranceElement.update({
			where: { id: emptyStray.id },
			data: { name: "" },
		});

		const readings = await treeUnderEveryRowOrder(owner.id, kase.id);

		expect(differingOrders(readings)).toEqual([]);
		expect(firstOf(readings).id).toBe(top.id);
	});

	it("is the first of several parentless goals in name order when none is marked top-level", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const ids: Record<string, string> = {};
		for (const name of ["G10", "G2", "G1"]) {
			const goal = await createTestElement(kase.id, owner.id, {
				elementType: "GOAL",
				name,
			});
			ids[name] = goal.id;
		}

		const readings = await treeUnderEveryRowOrder(owner.id, kase.id);

		expect(differingOrders(readings)).toEqual([]);
		expect(firstOf(readings).id).toBe(ids.G1);
	});

	it("is a counter-goal when it is the only parentless goal, and the same one every time", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const ids: string[] = [];
		for (const name of ["G10", "G2", "G1"]) {
			const counter = await createTestElement(kase.id, owner.id, {
				elementType: "GOAL",
				name,
				isDefeater: true,
			});
			ids.push(counter.id);
		}
		const first = ids[2] as string;

		const readings = await treeUnderEveryRowOrder(owner.id, kase.id);

		expect(differingOrders(readings)).toEqual([]);
		expect(firstOf(readings).id).toBe(first);
	});
});

describe("the comments on an exported element", () => {
	it("are in order of time, then element id, when several share a time", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);
		const same = new Date("2026-03-01T10:00:00.000Z");
		const idOf = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
		const make = (n: number, createdAt: Date) =>
			prisma.comment.create({
				data: {
					id: idOf(n),
					authorId: owner.id,
					elementId: fx.p1,
					content: `comment ${n}`,
					createdAt,
				},
			});
		// written with the largest ids first, so storage order is the opposite of id order
		await make(5, same);
		await make(4, same);
		await make(3, same);
		await make(2, same);
		await make(1, same);
		await make(9, new Date("2026-03-01T09:00:00.000Z"));
		await make(0, new Date("2026-03-01T11:00:00.000Z"));
		await prisma.$executeRawUnsafe(
			"UPDATE comments SET content = content WHERE content IN ('comment 3', 'comment 1')"
		);

		const readings = await readUnderEveryRowOrder(
			async () =>
				nodeAt((await exported(owner.id, fx.caseId, true)).tree, fx.p1).comments
		);

		expect(differingOrders(readings)).toEqual([]);
		expect((firstOf(readings) ?? []).map((comment) => comment.content)).toEqual(
			[
				"comment 9",
				"comment 1",
				"comment 2",
				"comment 3",
				"comment 4",
				"comment 5",
				"comment 0",
			]
		);
	});
});

describe("the readers built on the export", () => {
	it("give the document export data the diagram's order", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);
		await mockAuth(owner.id, owner.username, owner.email);

		const readings = await readUnderEveryRowOrder(async () => {
			const result = await getDocumentExportData(fx.caseId, {
				includeComments: false,
			});
			if (!("data" in result)) {
				throw new Error(result.error);
			}
			return result.data;
		});

		expect(differingOrders(readings)).toEqual([]);
		const tree = firstOf(readings).tree;
		expect(childNames(tree)).toEqual(G1_CHILDREN);
	});

	it("give the assistant's read_case the diagram's order", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);

		const readings = await readUnderEveryRowOrder(async () => {
			const tools = createCaseTools(owner.id, fx.caseId);
			return (await tools.read_case.execute?.({}, TOOL_OPTIONS)) as {
				tree: TreeNode;
			};
		});

		expect(differingOrders(readings)).toEqual([]);
		expect(childNames(firstOf(readings).tree)).toEqual(G1_CHILDREN);
	});

	it("give the assistant's lint_case labels in the diagram's order", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const goal = await createTestElement(kase.id, owner.id, {
			elementType: "GOAL",
			name: "G0",
			role: "TOP_LEVEL",
		});
		for (const name of ["G10", "G2", "G1"]) {
			await createTestElement(kase.id, owner.id, {
				elementType: "GOAL",
				name,
				parentId: goal.id,
				role: "TOP_LEVEL",
			});
		}

		const readings = await readUnderEveryRowOrder(async () => {
			const tools = createCaseTools(owner.id, kase.id);
			const result = (await tools.lint_case.execute?.({}, TOOL_OPTIONS)) as {
				findings: { ruleId: string; elementLabel: string; reason: string }[];
			};
			return result.findings.filter((f) => f.ruleId === "TREE01");
		});

		expect(differingOrders(readings)).toEqual([]);
		const finding = firstOf(readings)[0];
		expect(finding?.elementLabel).toBe("G0, G1, G2, G10");
		expect(finding?.reason).toContain("(G0, G1, G2, G10)");
	});

	it("give read_claim_health the first hundred claims in natural order", async () => {
		const world = await healthWorld();
		for (let n = 120; n >= 1; n--) {
			await claimIn(world, `P${n}`);
		}

		const readings = await readUnderEveryRowOrder(async () => {
			const result = await claimHealthCaller(world.owner.id, world.kase.id)();
			return {
				listed: result.claimsWithoutResults,
				left: result.claimsWithoutResultsTruncated,
			};
		});

		expect(differingOrders(readings)).toEqual([]);
		const first = firstOf(readings);
		expect(first?.listed).toEqual(
			Array.from({ length: 100 }, (_, i) => `P${i + 1}`)
		);
		expect(first?.left).toBe(20);
	});

	it("freeze the diagram's order into a published snapshot", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);

		const readings = await readUnderEveryRowOrder(async () => {
			const published = await publishAssuranceCase(owner.id, fx.caseId);
			if ("error" in published) {
				throw new Error(published.error);
			}
			const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
				where: { id: published.data.publishedId },
				select: { content: true },
			});
			await unpublishAssuranceCase(owner.id, fx.caseId);
			return (row.content as unknown as CaseExportNested).tree;
		});

		expect(differingOrders(readings)).toEqual([]);
		expect(childNames(firstOf(readings))).toEqual(G1_CHILDREN);
	});

	it("start a case from a pattern in the pattern's order, and list its variables in that order", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner, "PATTERN");
		const entries: [string, string, string][] = [
			[fx.p10, "v10", "aaaaaaaa10"],
			[fx.p2, "v2", "aaaaaaaaa2"],
			[fx.p1, "v1", "aaaaaaaaa1"],
		];
		for (const [elementId, name, id] of entries) {
			await setContext(elementId, [
				variableEntry("x", name, id, `meaning ${name}`),
			]);
		}
		const source = await exported(owner.id, fx.caseId);
		const expected = descriptionsInOrder(source.tree);

		const variables = await readUnderEveryRowOrder(async () => {
			const result = await readPatternVariables(owner.id, {
				patternCaseId: fx.caseId,
			});
			return expectSuccess(result).map((variable) => variable.name);
		});
		const copies = await readUnderEveryRowOrder(async () => {
			const started = expectSuccess(
				await createCaseFromPattern(
					owner.id,
					{ patternCaseId: fx.caseId },
					"Copy",
					"A copy"
				)
			);
			return descriptionsInOrder((await exported(owner.id, started.id)).tree);
		});

		expect(differingOrders(variables)).toEqual([]);
		expect(variables[0]?.value).toEqual(["v1", "v2", "v10"]);
		expect(differingOrders(copies)).toEqual([]);
		expect(copies[0]?.value).toEqual(expected);
		expect(childNames(source.tree)).toEqual(G1_CHILDREN);
	});
});

describe("export, import and export again", () => {
	async function copyOf(owner: User, file: CaseExportNested) {
		const imported = await importCase(
			owner.id,
			JSON.parse(JSON.stringify(file))
		);
		if (!("data" in imported)) {
			throw new Error(imported.error);
		}
		return imported.data.caseId;
	}

	it("keeps the order of a case's children, and of the evidence beneath them", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);
		const first = await exported(owner.id, fx.caseId);
		const caseId = await copyOf(owner, first);

		const readings = await readUnderEveryRowOrder(async () =>
			descriptionsInOrder((await exported(owner.id, caseId)).tree)
		);

		expect(differingOrders(readings)).toEqual([]);
		expect(firstOf(readings)).toEqual(descriptionsInOrder(first.tree));
	});

	it("keeps the order of siblings whose names only import can carry", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const goal = await createTestElement(kase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
			role: "TOP_LEVEL",
		});
		const names: (string | null)[] = [
			"zebra",
			"P10",
			"P2",
			"Apple",
			"p2",
			"P01",
			"P1",
			"P001",
			"É1",
			"e1",
			"😀10",
			"😀2",
			"P9007199254740993",
			"P9007199254740992",
			"P007",
			"P8",
		];
		for (const [index, name] of names.entries()) {
			await createTestElement(kase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
				name: name ?? undefined,
				description: `claim ${index}`,
			});
		}
		const first = await exported(owner.id, kase.id);

		for (let round = 0; round < 3; round++) {
			const caseId = await copyOf(owner, first);
			const readings = await readUnderEveryRowOrder(async () =>
				descriptionsInOrder((await exported(owner.id, caseId)).tree)
			);
			expect(differingOrders(readings)).toEqual([]);
			expect(firstOf(readings)).toEqual(descriptionsInOrder(first.tree));
		}
	});

	it("keeps the order of siblings that share a name and a kind", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const goal = await createTestElement(kase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
			role: "TOP_LEVEL",
		});
		for (let i = 0; i < 6; i++) {
			await createTestElement(kase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				name: "P1",
				parentId: goal.id,
				description: `twin ${i}`,
			});
		}
		const first = await exported(owner.id, kase.id);

		for (let round = 0; round < 6; round++) {
			const second = await exported(owner.id, await copyOf(owner, first));
			expect(descriptionsInOrder(second.tree)).toEqual(
				descriptionsInOrder(first.tree)
			);
		}
	});
});

describe("an element that is renamed or edited", () => {
	it("moves to where its new name sorts, and an edit that leaves the name alone moves nothing", async () => {
		const owner = await createTestUser();
		const fx = await siblingCase(owner);

		await prisma.assuranceElement.update({
			where: { id: fx.p1 },
			data: { description: "reworded" },
		});
		const edited = await readUnderEveryRowOrder(async () =>
			childNames((await exported(owner.id, fx.caseId)).tree)
		);
		expect(differingOrders(edited)).toEqual([]);
		expect(edited[0]?.value).toEqual(G1_CHILDREN);

		await prisma.assuranceElement.update({
			where: { id: fx.p1 },
			data: { name: "P11" },
		});
		const renamed = await readUnderEveryRowOrder(async () =>
			childNames((await exported(owner.id, fx.caseId)).tree)
		);
		expect(differingOrders(renamed)).toEqual([]);
		expect(renamed[0]?.value).toEqual([
			"P2",
			"P10",
			"P11",
			"S1",
			"E1",
			"E2",
			"AG1",
			"M1",
		]);
	});
});
