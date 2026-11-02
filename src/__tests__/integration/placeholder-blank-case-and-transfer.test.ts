import { describe, expect, it } from "vitest";
import { toPlainCase } from "@/lib/case/defined-terms";
import { exporterRegistry } from "@/lib/export";
import { createTemplateFromPreset } from "@/lib/export/templates";
import { RULESET } from "@/lib/plugins/assistant/linter/ruleset";
import { checkStructure } from "@/lib/plugins/assistant/linter/structural";
import prisma from "@/lib/prisma";
import { CaseExportNestedSchema } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import {
	createCase,
	fetchCaseFromPrisma,
} from "@/lib/services/case-fetch-service";
import { createCaseFromPattern } from "@/lib/services/case-from-pattern-service";
import { importCase } from "@/lib/services/case-import-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Placeholders in the places they travel: the top goal of a new blank case or
 * pattern, the readers of that goal while it has no text, and export, import
 * and starting a case from a pattern.
 */

const TOP_GOAL_HINT = "Describe your top-level assurance goal";

describe.each(["CASE", "PATTERN"] as const)("a new blank %s", (kind) => {
	it("starts with a top goal that is a placeholder with no text and the hint", async () => {
		const user = await createTestUser();

		const { id } = expectSuccess(
			await createCase(user.id, { name: "Blank", kind })
		);

		const goal = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: id },
		});
		expect(goal).toMatchObject({
			name: "G1",
			description: "",
			isPlaceholder: true,
			placeholderHint: TOP_GOAL_HINT,
		});
		const fetched = expectSuccess(await fetchCaseFromPrisma(id, user.id));
		expect(fetched.goals?.[0]).toMatchObject({
			description: "",
			isPlaceholder: true,
			placeholderHint: TOP_GOAL_HINT,
		});
	});

	it("is read without error while its goal has no text", async () => {
		const user = await createTestUser();
		const { id } = expectSuccess(
			await createCase(user.id, { name: "Blank", kind })
		);

		const exported = expectSuccess(await exportCase(user.id, id));
		const plain = toPlainCase(exported);
		const document = await createTemplateFromPreset("full-report").render({
			caseData: plain,
		});
		const documents = await Promise.all(
			(["markdown", "docx", "pdf"] as const).map((format) =>
				exporterRegistry.get(format)?.export(document, { caseName: "Blank" })
			)
		);

		expect(exported.tree).toMatchObject({
			description: "",
			isPlaceholder: true,
		});
		expect(CaseExportNestedSchema.safeParse(exported).success).toBe(true);
		expect(() => checkStructure(plain, RULESET)).not.toThrow();
		expect(documents.map((result) => result?.success)).toEqual([
			true,
			true,
			true,
		]);
	});
});

/** A pattern with one placeholder claim (with a hint) and one ordinary claim. */
async function patternWithPlaceholder(ownerId: string) {
	const pattern = await createTestCase(ownerId, { kind: "PATTERN" });
	const goal = await createTestElement(pattern.id, ownerId, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	await createTestElement(pattern.id, ownerId, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: goal.id,
		description: "",
		isPlaceholder: true,
		placeholderHint: "Name a hazard",
	});
	await createTestElement(pattern.id, ownerId, {
		elementType: "PROPERTY_CLAIM",
		name: "P2",
		parentId: goal.id,
		description: "Already written",
	});
	return pattern.id;
}

function markersOf(caseId: string) {
	return prisma.assuranceElement.findMany({
		where: { caseId },
		orderBy: { name: "asc" },
		select: {
			name: true,
			isPlaceholder: true,
			placeholderHint: true,
			fromPattern: true,
		},
	});
}

describe("placeholders in export, import and a case started from a pattern", () => {
	it("keeps the markers through export and import, as a version 1.1 file", async () => {
		const user = await createTestUser();
		const patternId = await patternWithPlaceholder(user.id);

		const exported = expectSuccess(await exportCase(user.id, patternId));
		const imported = expectSuccess(await importCase(user.id, exported));

		expect(exported.version).toBe("1.1");
		expect(await markersOf(imported.caseId)).toEqual([
			{
				name: "G1",
				isPlaceholder: false,
				placeholderHint: null,
				fromPattern: false,
			},
			{
				name: "P1",
				isPlaceholder: true,
				placeholderHint: "Name a hazard",
				fromPattern: false,
			},
			{
				name: "P2",
				isPlaceholder: false,
				placeholderHint: null,
				fromPattern: false,
			},
		]);
	});

	it("exports a case with no placeholder as before, as version 1.0", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		await createTestElement(testCase.id, user.id, { elementType: "GOAL" });

		const exported = expectSuccess(await exportCase(user.id, testCase.id));

		expect(exported.version).toBe("1.0");
		expect(JSON.stringify(exported)).not.toContain("isPlaceholder");
	});

	it("arrives as a placeholder, from the pattern, in a case started from it", async () => {
		const user = await createTestUser();
		const patternId = await patternWithPlaceholder(user.id);

		const started = expectSuccess(
			await createCaseFromPattern(
				user.id,
				{ patternCaseId: patternId },
				"New",
				"Started from a pattern"
			)
		);

		expect(await markersOf(started.id)).toEqual([
			{
				name: "G1",
				isPlaceholder: false,
				placeholderHint: null,
				fromPattern: true,
			},
			{
				name: "P1",
				isPlaceholder: true,
				placeholderHint: "Name a hazard",
				fromPattern: true,
			},
			{
				name: "P2",
				isPlaceholder: false,
				placeholderHint: null,
				fromPattern: true,
			},
		]);
	});
});
