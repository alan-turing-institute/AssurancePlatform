// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
/**
 * What every reader of a case sees when it holds named context entries and
 * references: the export file, the document exports, the Case Assistant's
 * tools and the rules check. Cases are set up straight in the database, so
 * these tests do not depend on the write paths under test elsewhere.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentExportData } from "@/actions/export-document";
import { toPlainCase } from "@/lib/case/defined-terms";
import { createTemplateFromPreset, exporterRegistry } from "@/lib/export";
import { getAvailablePresets } from "@/lib/export/templates";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

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

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";
const SECRET = "confidential meaning of another case";

const BROAD = {
	id: ID_A,
	name: "interval",
	text: "broad meaning",
	value: "10 minutes",
};
const NARROW = {
	id: ID_B,
	name: "narrow",
	text: "narrower meaning",
	value: "1 minute",
};

async function setFields(
	elementId: string,
	fields: {
		context?: unknown[];
		description?: string;
		assumption?: string;
		justification?: string;
	}
) {
	if (fields.context !== undefined) {
		await prisma.$executeRaw`UPDATE assurance_elements SET context = ${JSON.stringify(fields.context)}::jsonb WHERE id = ${elementId}`;
	}
	if (fields.description !== undefined) {
		await prisma.$executeRaw`UPDATE assurance_elements SET description = ${fields.description} WHERE id = ${elementId}`;
	}
	if (fields.assumption !== undefined) {
		await prisma.$executeRaw`UPDATE assurance_elements SET assumption = ${fields.assumption} WHERE id = ${elementId}`;
	}
	if (fields.justification !== undefined) {
		await prisma.$executeRaw`UPDATE assurance_elements SET justification = ${fields.justification} WHERE id = ${elementId}`;
	}
}

interface NamedCase {
	caseId: string;
	goalId: string;
	p1Id: string;
	p2Id: string;
	s1Id: string;
	userId: string;
}

/**
 * G1 holds `interval` (with a stale name in the claims' tokens), S1 holds
 * `narrow`; P1 sits under S1 and sees both, P2 sits on the other branch under
 * S2 and sees only G1's entry.
 */
async function buildNamedCase(): Promise<NamedCase> {
	const user = await createTestUser();
	const testCase = await createTestCase(user.id);
	const goal = await createTestElement(testCase.id, user.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	const s1 = await createTestElement(testCase.id, user.id, {
		elementType: "STRATEGY",
		name: "S1",
		parentId: goal.id,
	});
	const s2 = await createTestElement(testCase.id, user.id, {
		elementType: "STRATEGY",
		name: "S2",
		parentId: goal.id,
	});
	const p1 = await createTestElement(testCase.id, user.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: s1.id,
	});
	const p2 = await createTestElement(testCase.id, user.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P2",
		parentId: s2.id,
	});
	await setFields(goal.id, {
		context: ["A plain entry", BROAD],
		description: `The system works within the {window#${ID_A}}`,
	});
	await setFields(s1.id, { context: [NARROW] });
	await setFields(p1.id, {
		description: `Within the {narrow#${ID_B}} and the {window#${ID_A}}`,
		assumption: `Assumes {window#${ID_A}}`,
		justification: `Because {narrow#${ID_B}}`,
		context: ["claim plain"],
	});
	await setFields(p2.id, {
		description: `Sibling uses {stale#${ID_B}} and {window#${ID_A}}`,
	});
	await mockAuth(user.id, user.username, user.email);
	return {
		userId: user.id,
		caseId: testCase.id,
		goalId: goal.id,
		s1Id: s1.id,
		p1Id: p1.id,
		p2Id: p2.id,
	};
}

async function plainCaseOf(world: NamedCase) {
	const exported = await exportCase(world.userId, world.caseId, {
		includeComments: false,
	});
	if (!("data" in exported)) {
		throw new Error(exported.error);
	}
	return { exported: exported.data, plain: toPlainCase(exported.data) };
}

function findNode<T extends { name: string | null; children: T[] }>(
	node: T,
	name: string
): T | undefined {
	if (node.name === name) {
		return node;
	}
	for (const child of node.children) {
		const found = findNode(child, name);
		if (found) {
			return found;
		}
	}
	return;
}

const ASSISTANT_OPTIONS = { toolCallId: "call", messages: [] };

async function runTool(
	tools: ReturnType<typeof createCaseTools>,
	name: "read_case" | "read_element" | "lint_case",
	input: Record<string, unknown> = {}
): Promise<unknown> {
	const tool = tools[name];
	if (!tool.execute) {
		throw new Error(`${name} has no execute`);
	}
	return await (
		tool.execute as (input: unknown, options: unknown) => Promise<unknown>
	)(input, ASSISTANT_OPTIONS);
}

describe("the export file", () => {
	it("is version 1.1, holds the entries as stored, and names the four fields of an entry only", async () => {
		const world = await buildNamedCase();
		// A stored record with keys the model does not define.
		await setFields(world.goalId, {
			context: ["A plain entry", { ...BROAD, hidden: false, stray: { a: 1 } }],
		});
		const { exported } = await plainCaseOf(world);
		expect(exported.version).toBe("1.1");
		expect(exported.tree.context).toEqual(["A plain entry", BROAD]);
		expect(JSON.stringify(exported)).not.toContain("stray");
		expect(JSON.stringify(exported)).not.toContain("hidden");
	});

	it("stays version 1.0 for a case of plain context and braces, and goes to 1.1 for a reference alone", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const testCase = await createTestCase(user.id);
		const goal = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "G1",
			role: "TOP_LEVEL",
		});
		await setFields(goal.id, {
			context: ["plain", "with {braces} and #hash"],
			description: "Text with {braces}, {a#b} and {name#short}",
		});

		const first = await exportCase(user.id, testCase.id, {
			includeComments: false,
		});
		expect("data" in first && first.data.version).toBe("1.0");

		await setFields(goal.id, { description: `Now {w#${ID_A}}` });
		const second = await exportCase(user.id, testCase.id, {
			includeComments: false,
		});
		expect("data" in second && second.data.version).toBe("1.1");
	});

	it("re-imports with every reference still resolving, to the same words", async () => {
		const world = await buildNamedCase();
		const { GET } = await import("@/app/api/cases/export/route");
		const exportResponse = await GET(
			new NextRequest(
				`http://localhost:3000/api/cases/export?id=${world.caseId}&includeComments=false`
			)
		);
		expect(exportResponse.status).toBe(200);
		const file = await exportResponse.text();

		const { POST } = await import("@/app/api/cases/import/route");
		const imported = await POST(
			new NextRequest("http://localhost:3000/api/cases/import", {
				method: "POST",
				body: file,
				headers: { "Content-Type": "application/json" },
			})
		);
		expect(imported.status).toBe(200);
		const { id: newCaseId } = await imported.json();
		expect(newCaseId).not.toBe(world.caseId);

		const original = await plainCaseOf(world);
		const copy = await exportCase(world.userId, newCaseId, {
			includeComments: false,
		});
		if (!("data" in copy)) {
			throw new Error(copy.error);
		}
		const copyPlain = toPlainCase(copy.data);
		const words = (node: typeof copyPlain.tree): unknown => ({
			name: node.name,
			description: node.description,
			assumption: node.assumption ?? null,
			justification: node.justification ?? null,
			context: node.context ?? null,
			children: node.children.map(words),
		});
		expect(words(copyPlain.tree)).toEqual(words(original.plain.tree));
		expect(copy.data.version).toBe("1.1");
		// The stored form carries the same entries and tokens, with new element ids.
		expect(findNode(copy.data.tree, "G1")?.context).toEqual([
			"A plain entry",
			BROAD,
		]);
		expect(findNode(copy.data.tree, "P1")?.description).toBe(
			`Within the {narrow#${ID_B}} and the {window#${ID_A}}`
		);
	});
});

describe("the plain-text copy", () => {
	it("resolves each reference on its element and its ancestors only, with the current name", async () => {
		const world = await buildNamedCase();
		const { plain } = await plainCaseOf(world);
		const p1 = findNode(plain.tree, "P1");
		const p2 = findNode(plain.tree, "P2");
		expect(p1?.description).toBe("Within the {narrow} and the {interval}");
		expect(p1?.assumption).toBe("Assumes {interval}");
		expect(p1?.justification).toBe("Because {narrow}");
		expect(p2?.description).toBe("Sibling uses {stale} and {interval}");
		expect(plain.tree.description).toBe(
			"The system works within the {interval}"
		);
		expect(plain.tree.context).toEqual([
			"A plain entry",
			"interval: broad meaning (value: 10 minutes)",
		]);
	});

	it("follows a rename, and shows not-found once the element moves out of reach", async () => {
		const world = await buildNamedCase();
		await setFields(world.s1Id, {
			context: [{ ...NARROW, name: "tighter" }],
		});
		let { plain } = await plainCaseOf(world);
		expect(findNode(plain.tree, "P1")?.description).toBe(
			"Within the {tighter} and the {interval}"
		);

		// Move P1 under S2: S1's entry is no longer in reach.
		const s2 = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: world.caseId, name: "S2" },
		});
		await prisma.$executeRaw`UPDATE assurance_elements SET parent_id = ${s2.id} WHERE id = ${world.p1Id}`;
		({ plain } = await plainCaseOf(world));
		expect(findNode(plain.tree, "P1")?.description).toBe(
			"Within the {narrow} and the {interval}"
		);
		expect(findNode(plain.tree, "P1")?.justification).toBe("Because {narrow}");
	});

	it("never resolves an id from another case and never carries that case's text", async () => {
		const world = await buildNamedCase();
		const other = await createTestUser();
		const otherCase = await createTestCase(other.id);
		const otherGoal = await createTestElement(otherCase.id, other.id, {
			elementType: "GOAL",
			name: "G1",
			role: "TOP_LEVEL",
		});
		await setFields(otherGoal.id, {
			context: [
				{ id: "zzzzzzzzzz", name: "secret", text: SECRET, value: "42-secret" },
			],
		});
		// A crafted token in this case names the other case's entry id.
		await setFields(world.p2Id, {
			description: "Crafted {leaked#zzzzzzzzzz} token",
		});

		const { plain, exported } = await plainCaseOf(world);
		expect(findNode(plain.tree, "P2")?.description).toBe(
			"Crafted {leaked} token"
		);

		const fetched = await (
			await import("@/lib/services/case-fetch-service")
		).fetchCaseFromPrisma(world.caseId, world.userId);
		const everything = [
			JSON.stringify(plain),
			JSON.stringify(exported),
			JSON.stringify(fetched),
			JSON.stringify(
				await getDocumentExportData(world.caseId, { includeComments: false })
			),
			JSON.stringify(
				await runTool(createCaseTools(world.userId, world.caseId), "read_case")
			),
			JSON.stringify(
				await runTool(createCaseTools(world.userId, world.caseId), "lint_case")
			),
		].join("\n");
		expect(everything).not.toContain(SECRET);
		expect(everything).not.toContain("42-secret");
	});

	it("is handed to the document exports, which write {name} and one line per entry", async () => {
		const world = await buildNamedCase();
		const result = await getDocumentExportData(world.caseId, {
			includeComments: false,
		});
		if (!("data" in result)) {
			throw new Error(result.error);
		}
		const text = JSON.stringify(result.data);
		expect(text).not.toContain(ID_A);
		expect(text).not.toContain(ID_B);
		expect(text).not.toContain("[object Object]");

		const exporter = exporterRegistry.get("markdown");
		if (!exporter) {
			throw new Error("no markdown exporter is registered");
		}
		for (const preset of getAvailablePresets()) {
			const template = createTemplateFromPreset(preset, {});
			const document = await template.render({ caseData: result.data });
			const exported = await exporter.export(document, { caseName: "Case" });
			if (!(exported.success && "content" in exported)) {
				throw new Error(`the markdown export of ${preset} failed`);
			}
			expect(exported.content).not.toContain(ID_A);
			expect(exported.content).not.toContain(ID_B);
			expect(exported.content).not.toContain("[object Object]");
			if (preset === "full-report") {
				expect(exported.content).toContain("{interval}");
				expect(exported.content).toContain("{narrow}");
				// The Markdown exporter backslash-escapes brackets in some places.
				expect(exported.content.replaceAll("\\", "")).toContain(
					"interval: broad meaning (value: 10 minutes)"
				);
			}
		}
	});
});

describe("the cited-goal picker", () => {
	it("offers a goal's description in plain form, because the form copies it into an element of another case", async () => {
		const world = await buildNamedCase();
		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals(world.caseId);
		if (!result.success) {
			throw new Error(result.error);
		}
		const goal = result.data.find((candidate) => candidate.name === "G1");
		// The stored token carries the entry's id; what is offered is plain text.
		expect(JSON.stringify(result.data)).not.toContain(ID_A);
		expect([
			"The system works within the {interval}",
			"The system works within the {window}",
		]).toContain(goal?.description);
	});
});

describe("the selected element in the assistant's prompt", () => {
	it("carries the element's text in plain form, resolved on its own branch", async () => {
		const world = await buildNamedCase();
		const { resolveSelectedElement, selectionPrompt } = await import(
			"@/lib/plugins/assistant/selected-element"
		);
		const inReach = await resolveSelectedElement(
			world.userId,
			world.caseId,
			world.p1Id
		);
		expect(inReach?.text).toBe("Within the {narrow} and the {interval}");
		const otherBranch = await resolveSelectedElement(
			world.userId,
			world.caseId,
			world.p2Id
		);
		expect(otherBranch?.text).toBe("Sibling uses {stale} and {interval}");
		const prompt = `${selectionPrompt(inReach)}${selectionPrompt(otherBranch)}`;
		expect(prompt).not.toContain(ID_A);
		expect(prompt).not.toContain(ID_B);
	});
});

describe("the Case Assistant's tools", () => {
	it("read_case and read_element show {name} and the entry as one string, never a token or a record", async () => {
		const world = await buildNamedCase();
		const tools = createCaseTools(world.userId, world.caseId);
		const whole = JSON.stringify(await runTool(tools, "read_case"));
		const one = JSON.stringify(
			await runTool(tools, "read_element", { elementId: world.p1Id })
		);
		for (const text of [whole, one]) {
			expect(text).not.toContain(ID_A);
			expect(text).not.toContain(ID_B);
			expect(text).not.toContain("[object Object]");
			expect(text).not.toContain('"hidden"');
		}
		expect(whole).toContain("{interval}");
		expect(whole).toContain("interval: broad meaning (value: 10 minutes)");
		expect(one).toContain("Within the {narrow} and the {interval}");
	});

	it("lint_case gives the same findings on a case with named entries as on the same text written as plain strings", async () => {
		const named = await buildNamedCase();
		const plainWorld = await buildNamedCase();
		// The same case again, with every entry and token already in plain form.
		const { plain } = await plainCaseOf(named);
		const rows = await prisma.assuranceElement.findMany({
			where: { caseId: plainWorld.caseId },
		});
		for (const row of rows) {
			const node = findNode(plain.tree, row.name ?? "");
			if (!node) {
				continue;
			}
			await prisma.$executeRaw`UPDATE assurance_elements SET context = ${JSON.stringify(node.context ?? [])}::jsonb, description = ${node.description}, assumption = ${node.assumption ?? null}, justification = ${node.justification ?? null} WHERE id = ${row.id}`;
		}

		// The order of siblings that were created together is the database's to
		// choose, so each list of results is compared in a fixed order.
		const lint = async (world: NamedCase) => {
			const result = (await runTool(
				createCaseTools(world.userId, world.caseId),
				"lint_case"
			)) as Record<string, unknown>;
			const canonical = Object.fromEntries(
				Object.entries(result).map(([key, value]) => [
					key,
					Array.isArray(value)
						? value.map((item) => JSON.stringify(item)).sort()
						: value,
				])
			);
			return JSON.stringify(canonical).replaceAll(world.caseId, "CASE");
		};
		await mockAuth(named.userId);
		const withNamed = await lint(named);
		await mockAuth(plainWorld.userId);
		const withPlain = await lint(plainWorld);
		expect(withNamed).not.toContain(ID_A);
		expect(withNamed).not.toContain("[object Object]");
		expect(withNamed).toBe(withPlain);
	});
});
