import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import { importCase } from "@/lib/services/case-import-service";
import { flattenNestedToFlat } from "@/lib/transforms/nested-to-flat";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	importOk,
	NODE,
	richFlatFile,
	richNestedFile,
} from "../utils/case-kind-kit";
import {
	createPublishedRow,
	makePattern,
	snapshotWithComments,
} from "../utils/pattern-start-kit";
import { startOk, viaService } from "../utils/pattern-starters";
import { putElement } from "../utils/placeholder-kit";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Markers and hints through export and import in the nested and flat
 * formats, through a case started from a pattern, and the version rules a
 * file with a placeholder must follow.
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

const HINT = "Say what the claim asserts";

type User = Awaited<ReturnType<typeof createTestUser>>;

function findNode(root: TreeNode, name: string): TreeNode {
	const pending = [root];
	for (let node = pending.pop(); node; node = pending.pop()) {
		if (node.name === name) {
			return node;
		}
		pending.push(...node.children);
	}
	throw new Error(`No element named ${name} in the tree`);
}

/** A stored case from the rich file, with P1 an empty placeholder with a hint and A1 a placeholder with text and no hint. */
async function markedCase(owner: User, version: "1.0" | "1.1" = "1.1") {
	const { caseId } = await importOk(owner.id, richNestedFile({ version }));
	await prisma.assuranceElement.updateMany({
		where: { caseId, name: "P1" },
		data: { isPlaceholder: true, placeholderHint: HINT, description: "" },
	});
	await prisma.assuranceElement.updateMany({
		where: { caseId, name: "A1" },
		data: { isPlaceholder: true, description: "A draft assumption" },
	});
	return caseId;
}

async function exported(
	owner: User,
	caseId: string
): Promise<CaseExportNested> {
	return expectSuccess(await exportCase(owner.id, caseId));
}

/** The markers, hints and text of a stored case's elements, by element name. */
async function markersOf(caseId: string) {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId },
		select: {
			name: true,
			description: true,
			isPlaceholder: true,
			placeholderHint: true,
			fromPattern: true,
			modifiedFromPattern: true,
		},
		orderBy: { name: "asc" },
	});
	return Object.fromEntries(
		rows.map(({ name, ...rest }) => [name ?? "", rest])
	);
}

describe("the nested export of a case with placeholders", () => {
	it("is version 1.1 and holds the marker and hint of each placeholder, and nothing on the other elements", async () => {
		const owner = await createTestUser();
		const caseId = await markedCase(owner);

		const file = await exported(owner, caseId);

		expect(file.version).toBe("1.1");
		expect(findNode(file.tree, "P1")).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
			description: "",
		});
		const draft = findNode(file.tree, "A1");
		expect(draft.isPlaceholder).toBe(true);
		expect(draft).not.toHaveProperty("placeholderHint");
		const goal = findNode(file.tree, "G1");
		expect(goal).not.toHaveProperty("isPlaceholder");
		expect(goal).not.toHaveProperty("placeholderHint");
	});

	it("goes back to version 1.0 once the last placeholder is written", async () => {
		const owner = await createTestUser();
		const { caseId } = await importOk(
			owner.id,
			richNestedFile({ version: "1.0" })
		);
		await prisma.assuranceElement.updateMany({
			where: { caseId, name: "P1" },
			data: { isPlaceholder: true, placeholderHint: HINT },
		});
		await mockAuth(owner.id, owner.username, owner.email);
		expect((await exported(owner, caseId)).version).toBe("1.1");
		const claim = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId, name: "P1" },
		});

		await putElement(claim.id, { description: "The claim, written" });
		const after = await exported(owner, caseId);

		expect(after.version).toBe("1.0");
		expect(findNode(after.tree, "P1")).not.toHaveProperty("isPlaceholder");
		expect(findNode(after.tree, "P1")).not.toHaveProperty("placeholderHint");
	});

	it("leaves out the hint of an element that is no longer a placeholder, and stays version 1.0", async () => {
		const owner = await createTestUser();
		const { caseId } = await importOk(
			owner.id,
			richNestedFile({ version: "1.0" })
		);
		await prisma.assuranceElement.updateMany({
			where: { caseId, name: "P1" },
			data: { isPlaceholder: false, placeholderHint: HINT },
		});

		const file = await exported(owner, caseId);

		expect(file.version).toBe("1.0");
		expect(JSON.stringify(file)).not.toContain(HINT);
	});

	it("imports into a new case with every marker, hint and text as it was", async () => {
		const owner = await createTestUser();
		const caseId = await markedCase(owner);
		const file = await exported(owner, caseId);

		const copy = await importOk(owner.id, file);

		expect(await markersOf(copy.caseId)).toEqual(await markersOf(caseId));
		expect((await exported(owner, copy.caseId)).version).toBe("1.1");
	});

	it("imports as a pattern with its markers", async () => {
		const owner = await createTestUser();
		const caseId = await markedCase(owner);
		const file = await exported(owner, caseId);

		const copy = await importOk(owner.id, file, { kind: "PATTERN" });

		const markers = await markersOf(copy.caseId);
		expect(markers.P1).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
		});
		expect(markers.A1?.isPlaceholder).toBe(true);
	});
});

describe("the flat format", () => {
	it("carries the marker and hint of each placeholder when a nested export is flattened", async () => {
		const owner = await createTestUser();
		const caseId = await markedCase(owner);

		const flat = flattenNestedToFlat(await exported(owner, caseId));

		const claim = flat.elements.find((element) => element.name === "P1");
		expect(claim).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
		});
		const goal = flat.elements.find((element) => element.name === "G1");
		expect(goal?.isPlaceholder).not.toBe(true);
	});

	it("imports a flat file's markers and hints", async () => {
		const owner = await createTestUser();
		const file = richFlatFile() as { elements: Record<string, unknown>[] };
		for (const element of file.elements) {
			if (element.id === NODE.claim) {
				Object.assign(element, {
					isPlaceholder: true,
					placeholderHint: HINT,
					description: "",
				});
			}
		}

		const { caseId } = await importOk(owner.id, file);

		const markers = await markersOf(caseId);
		expect(markers.P1).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
			description: "",
		});
		expect(markers.G1?.isPlaceholder).toBe(false);
	});
});

describe("the version a file with placeholders must declare", () => {
	async function importWithFlags(
		version: "1.0" | "1.1",
		flags: Record<string, unknown>
	) {
		const owner = await createTestUser();
		const file = richNestedFile({ version }) as {
			tree: Record<string, unknown>;
		};
		Object.assign(file.tree, flags);
		const before = await prisma.assuranceCase.count();
		const result = await importCase(owner.id, file);
		return { result, created: (await prisma.assuranceCase.count()) - before };
	}

	it.each([
		["a marker", { isPlaceholder: true }],
		["a hint alone", { placeholderHint: HINT }],
		["a marker with a hint", { isPlaceholder: true, placeholderHint: HINT }],
	])('refuses a file that says "1.0" and holds %s, and creates nothing', async (_what, flags) => {
		const { result, created } = await importWithFlags("1.0", flags);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect((result.validationErrors ?? []).join(" ")).toContain("1.1");
		}
		expect(created).toBe(0);
	});

	it('accepts a file that says "1.0" and holds a marker that is off', async () => {
		const { result, created } = await importWithFlags("1.0", {
			isPlaceholder: false,
		});

		expect("data" in result).toBe(true);
		expect(created).toBe(1);
	});

	it('accepts a file that says "1.1" and holds a marker', async () => {
		const { result } = await importWithFlags("1.1", {
			isPlaceholder: true,
			placeholderHint: HINT,
		});

		expect("data" in result).toBe(true);
	});

	it.each([
		[
			"a hint of more than 500 characters",
			{ placeholderHint: "x".repeat(501) },
		],
		["a marker that is not true or false", { isPlaceholder: "yes" }],
	])("refuses a version 1.1 file with %s", async (_what, flags) => {
		const { result, created } = await importWithFlags("1.1", flags);

		expect("error" in result).toBe(true);
		expect(created).toBe(0);
	});
});

describe("a case started from a pattern with placeholders", () => {
	async function patternWithPlaceholders(owner: User) {
		const pattern = await makePattern(owner);
		await prisma.assuranceElement.updateMany({
			where: { caseId: pattern.id, name: "P1" },
			data: { isPlaceholder: true, placeholderHint: HINT, description: "" },
		});
		await prisma.assuranceElement.updateMany({
			where: { caseId: pattern.id, name: "S1" },
			data: { isPlaceholder: true },
		});
		return pattern;
	}

	it("keeps the markers, hints and empty text, and marks every element as from the pattern", async () => {
		const owner = await createTestUser();
		const pattern = await patternWithPlaceholders(owner);

		const started = await startOk(viaService, owner, {
			patternCaseId: pattern.id,
		});

		const markers = await markersOf(started.id);
		expect(markers.P1).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
			description: "",
			fromPattern: true,
			modifiedFromPattern: false,
		});
		expect(markers.S1).toMatchObject({
			isPlaceholder: true,
			fromPattern: true,
		});
		expect(markers.G1?.isPlaceholder).toBe(false);
	});

	it("clears and marks as modified the copy that is written, and leaves the pattern as it was", async () => {
		const owner = await createTestUser();
		const pattern = await patternWithPlaceholders(owner);
		const started = await startOk(viaService, owner, {
			patternCaseId: pattern.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);
		const copy = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: started.id, name: "P1" },
		});

		await putElement(copy.id, { description: "Written in the new case" });

		expect((await markersOf(started.id)).P1).toMatchObject({
			isPlaceholder: false,
			modifiedFromPattern: true,
			fromPattern: true,
		});
		expect((await markersOf(pattern.id)).P1).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
			description: "",
		});
	});

	it("keeps the markers when the pattern comes from a published snapshot", async () => {
		const owner = await createTestUser();
		const pattern = await patternWithPlaceholders(owner);
		await createPublishedRow({
			slug: "marked-pattern",
			content: await snapshotWithComments(owner, pattern.id),
		});

		const started = await startOk(viaService, owner, {
			publishedSlug: "marked-pattern",
		});

		expect((await markersOf(started.id)).P1).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
		});
	});

	it("makes no placeholders from a published snapshot of a pattern that has none", async () => {
		const owner = await createTestUser();
		const pattern = await makePattern(owner);
		await createPublishedRow({
			slug: "older-pattern",
			content: await snapshotWithComments(owner, pattern.id),
		});

		const started = await startOk(viaService, owner, {
			publishedSlug: "older-pattern",
		});

		const markers = await markersOf(started.id);
		expect(Object.values(markers).some((row) => row.isPlaceholder)).toBe(false);
	});
});
