import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Export and import of a case that holds named context entries: the version
 * written, the fields each entry keeps, the round trip through import, and the
 * plain-text copy the document exporters receive.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const WINDOW = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the interval over which separation is measured",
	value: "5 minutes",
};

beforeEach(async () => {
	await mockNoAuth();
});

async function setup(
	goalContext: unknown[],
	claimDescription = "Separation holds."
) {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: goal.id,
		description: claimDescription,
	});
	await prisma.assuranceElement.update({
		where: { id: goal.id },
		data: { context: goalContext as never },
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, testCase, goal, claim };
}

async function exported(userId: string, caseId: string) {
	const { exportCase } = await import("@/lib/services/case-export-service");
	return expectSuccess(await exportCase(userId, caseId));
}

describe("exportCase and the file version", () => {
	it("writes 1.0 for a case of plain-text context", async () => {
		const { owner, testCase } = await setup(["plain"]);

		const data = await exported(owner.id, testCase.id);

		expect(data.version).toBe("1.0");
	});

	it("writes 1.1 for a case that holds a named entry, keeping only its four fields", async () => {
		const { owner, testCase } = await setup([
			"plain",
			{ ...WINDOW, hidden: false },
		]);

		const data = await exported(owner.id, testCase.id);

		expect(data.version).toBe("1.1");
		expect(data.tree.context).toEqual(["plain", WINDOW]);
	});

	it("writes 1.1 for a case that only holds a reference in some text", async () => {
		const { owner, testCase } = await setup(
			["plain"],
			`Separation holds within the {window#${WINDOW.id}}.`
		);

		const data = await exported(owner.id, testCase.id);

		expect(data.version).toBe("1.1");
	});

	it("writes 1.0 when braces in some text are not a reference", async () => {
		const { owner, testCase } = await setup(["plain"], "Uses {braces} freely.");

		const data = await exported(owner.id, testCase.id);

		expect(data.version).toBe("1.0");
	});
});

describe("export, import and export again", () => {
	it("keeps each entry, its id and the references to it", async () => {
		const description = `Separation holds within the {window#${WINDOW.id}}.`;
		const { owner, testCase } = await setup(["plain", WINDOW], description);
		const first = await exported(owner.id, testCase.id);

		const { importCase } = await import("@/lib/services/case-import-service");
		const imported = await importCase(owner.id, first);
		if ("error" in imported) {
			throw new Error(imported.error);
		}
		const second = await exported(owner.id, imported.data.caseId);

		expect(second.version).toBe("1.1");
		expect(second.tree.context).toEqual(["plain", WINDOW]);
		expect(second.tree.children[0]?.description).toBe(description);
	});
});

describe("the document export action", () => {
	it("returns the case in plain text: entries as strings and references as {name}", async () => {
		const { testCase, goal } = await setup(
			["plain", WINDOW],
			`Separation holds within the {win#${WINDOW.id}}.`
		);
		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: { context: ["plain", { ...WINDOW, name: "interval" }] },
		});
		const { getDocumentExportData } = await import("@/actions/export-document");

		const result = await getDocumentExportData(testCase.id, {
			includeComments: false,
		});

		if (!("data" in result)) {
			throw new Error(result.error);
		}
		expect(result.data.tree.context).toEqual([
			"plain",
			`interval: ${WINDOW.text} (value: 5 minutes)`,
		]);
		expect(result.data.tree.children[0]?.description).toBe(
			"Separation holds within the {interval}."
		);
	});
});
