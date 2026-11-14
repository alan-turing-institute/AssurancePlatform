import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { CaseExportNestedSchema } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import { importCase } from "@/lib/services/case-import-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import { buildArgument } from "../utils/counter-goal-kit";
import {
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * What an export says about the kind of the case, and when it moves the file
 * to version 1.1. An ordinary case keeps the file it always had.
 */

const NAMED_ENTRY = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the interval over which separation is measured",
	value: "5 minutes",
};

async function argumentOfKind(kind: "CASE" | "PATTERN") {
	const owner = await createTestUser();
	const fixture = await buildArgument(owner.id);
	if (kind === "PATTERN") {
		await prisma.assuranceCase.update({
			where: { id: fixture.caseId },
			data: { kind },
		});
	}
	return { owner, ...fixture };
}

async function addNamedEntry(goalId: string) {
	await prisma.assuranceElement.update({
		where: { id: goalId },
		data: { context: ["plain", NAMED_ENTRY] },
	});
}

async function exported(userId: string, caseId: string) {
	return expectSuccess(await exportCase(userId, caseId));
}

describe("exporting a pattern", () => {
	it("writes version 1.1 and names the kind in the case object", async () => {
		const { owner, caseId } = await argumentOfKind("PATTERN");

		const data = await exported(owner.id, caseId);

		expect(data.version).toBe("1.1");
		expect(data.case.kind).toBe("PATTERN");
		expect(Object.keys(data.case).sort()).toEqual([
			"description",
			"kind",
			"name",
		]);
	});

	it("writes version 1.1 with the kind when the comments option is off", async () => {
		const { owner, caseId } = await argumentOfKind("PATTERN");

		const data = expectSuccess(
			await exportCase(owner.id, caseId, { includeComments: false })
		);

		expect(data.version).toBe("1.1");
		expect(data.case.kind).toBe("PATTERN");
	});

	it("writes version 1.1 with the kind when it also holds a named context entry", async () => {
		const { owner, caseId, goal } = await argumentOfKind("PATTERN");
		await addNamedEntry(goal.id);

		const data = await exported(owner.id, caseId);

		expect(data.version).toBe("1.1");
		expect(data.case.kind).toBe("PATTERN");
		expect(data.tree.context).toEqual(["plain", NAMED_ENTRY]);
	});

	it("gives a file the current schema accepts, and keeps the kind through JSON text", async () => {
		const { owner, caseId } = await argumentOfKind("PATTERN");
		const data = await exported(owner.id, caseId);

		const reread = CaseExportNestedSchema.safeParse(
			JSON.parse(JSON.stringify(data))
		);

		expect(reread.success).toBe(true);
		expect(reread.data?.case.kind).toBe("PATTERN");
		expect(reread.data?.version).toBe("1.1");
	});

	it("is shown only to someone who may view the pattern", async () => {
		const { owner, caseId } = await argumentOfKind("PATTERN");
		const stranger = await createTestUser();
		const viewer = await createTestUser();
		await createTestPermission(caseId, viewer.id, owner.id, "VIEW");

		expectError(await exportCase(stranger.id, caseId));
		const seen = await exported(viewer.id, caseId);

		expect(seen.case.kind).toBe("PATTERN");
	});
});

describe("exporting an ordinary case", () => {
	it("writes version 1.0 with name and description in the case object and no kind key", async () => {
		const { owner, caseId } = await argumentOfKind("CASE");

		const data = await exported(owner.id, caseId);

		expect(data.version).toBe("1.0");
		expect(Object.keys(data)).toEqual([
			"version",
			"exportedAt",
			"case",
			"tree",
		]);
		expect(Object.keys(data.case)).toEqual(["name", "description"]);
		expect(Object.hasOwn(data.case, "kind")).toBe(false);
	});

	it("leaves the word kind out of the serialised file altogether", async () => {
		const { owner, caseId } = await argumentOfKind("CASE");

		const data = await exported(owner.id, caseId);

		const text = JSON.stringify(data);
		expect(text).not.toContain('"kind"');
		expect(text).not.toContain("PATTERN");
	});

	it("still writes version 1.1, with no kind key, when it holds a named context entry", async () => {
		const { owner, caseId, goal } = await argumentOfKind("CASE");
		await addNamedEntry(goal.id);

		const data = await exported(owner.id, caseId);

		expect(data.version).toBe("1.1");
		expect(Object.keys(data.case)).toEqual(["name", "description"]);
		expect(JSON.stringify(data)).not.toContain('"kind"');
	});

	it("writes the same kind-free case object when the comments option is off", async () => {
		const { owner, caseId } = await argumentOfKind("CASE");

		const data = expectSuccess(
			await exportCase(owner.id, caseId, { includeComments: false })
		);

		expect(data.version).toBe("1.0");
		expect(Object.keys(data.case)).toEqual(["name", "description"]);
	});
});

describe("a case whose kind is changed in the database", () => {
	it("is exported as a pattern, and as a plain 1.0 case again once it is a case again", async () => {
		const { owner, caseId } = await argumentOfKind("CASE");

		const asCase = await exported(owner.id, caseId);
		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: { kind: "PATTERN" },
		});
		const asPattern = await exported(owner.id, caseId);
		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: { kind: "CASE" },
		});
		const backAsCase = await exported(owner.id, caseId);

		expect(asCase.version).toBe("1.0");
		expect(asPattern.version).toBe("1.1");
		expect(asPattern.case.kind).toBe("PATTERN");
		expect(backAsCase.version).toBe("1.0");
		expect(Object.hasOwn(backAsCase.case, "kind")).toBe(false);
		expect(backAsCase.tree).toEqual(asCase.tree);
	});
});

describe("export, import and export again", () => {
	it("returns a pattern as a pattern with the same case object", async () => {
		const { owner, caseId } = await argumentOfKind("PATTERN");
		const first = await exported(owner.id, caseId);

		const imported = await importCase(
			owner.id,
			JSON.parse(JSON.stringify(first))
		);
		if (!("data" in imported)) {
			throw new Error(imported.error);
		}
		const second = await exported(owner.id, imported.data.caseId);

		expect(second.version).toBe("1.1");
		expect(second.case).toEqual(first.case);
		expect(second.tree.children.length).toBe(first.tree.children.length);
	});

	it("returns an ordinary case as an ordinary 1.0 case", async () => {
		const { owner, caseId } = await argumentOfKind("CASE");
		const first = await exported(owner.id, caseId);

		const imported = await importCase(
			owner.id,
			JSON.parse(JSON.stringify(first))
		);
		if (!("data" in imported)) {
			throw new Error(imported.error);
		}
		const second = await exported(owner.id, imported.data.caseId);

		expect(second.version).toBe("1.0");
		expect(Object.keys(second.case)).toEqual(["name", "description"]);
	});

	it("makes an ordinary case of an exported pattern when the import asks for a case", async () => {
		const { owner, caseId } = await argumentOfKind("PATTERN");
		const first = await exported(owner.id, caseId);

		const imported = await importCase(owner.id, first, { kind: "CASE" });
		if (!("data" in imported)) {
			throw new Error(imported.error);
		}
		const second = await exported(owner.id, imported.data.caseId);

		expect(second.version).toBe("1.0");
		expect(Object.hasOwn(second.case, "kind")).toBe(false);
	});
});
