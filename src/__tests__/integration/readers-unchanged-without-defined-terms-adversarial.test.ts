// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
/**
 * A case with no named context entries and no references reads exactly as it
 * did before the feature: the export file, the document export data, the Case
 * Assistant's tools and the rules check all return the case as it is stored.
 * It uses only code that exists before the change, so it passes on both.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentExportData } from "@/actions/export-document";
import { lintCase } from "@/lib/plugins/assistant/linter/lint-case";
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

beforeEach(async () => {
	await mockNoAuth();
});

const ASSISTANT_OPTIONS = { toolCallId: "call", messages: [] };

async function runTool(
	tools: ReturnType<typeof createCaseTools>,
	name: "read_case" | "lint_case"
): Promise<unknown> {
	const tool = tools[name];
	if (!tool.execute) {
		throw new Error(`${name} has no execute`);
	}
	return await (
		tool.execute as (input: unknown, options: unknown) => Promise<unknown>
	)({}, ASSISTANT_OPTIONS);
}

describe("a case without named entries", () => {
	it("is exported as 1.0 and reads the same through the document export and the assistant", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const testCase = await createTestCase(user.id);
		const goal = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "G1",
			role: "TOP_LEVEL",
		});
		const strategy = await createTestElement(testCase.id, user.id, {
			elementType: "STRATEGY",
			name: "S1",
			parentId: goal.id,
		});
		const claim = await createTestElement(testCase.id, user.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: strategy.id,
		});
		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: {
				context: ["Deployed in one hospital.", "Uses {braces} and #hash"],
				description: "The system is acceptably fair, {as agreed}.",
				assumption: "Data are representative.",
			},
		});
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: {
				description: "Gaps are small.",
				justification: "Because we measured.",
			},
		});

		const exported = await exportCase(user.id, testCase.id, {
			includeComments: false,
		});
		if (!("data" in exported)) {
			throw new Error(exported.error);
		}
		expect(exported.data.version).toBe("1.0");
		expect(exported.data.tree.context).toEqual([
			"Deployed in one hospital.",
			"Uses {braces} and #hash",
		]);
		expect(exported.data.tree.description).toBe(
			"The system is acceptably fair, {as agreed}."
		);

		const documentData = await getDocumentExportData(testCase.id, {
			includeComments: false,
		});
		expect(documentData).toEqual({ data: exported.data });

		const tools = createCaseTools(user.id, testCase.id);
		const read = (await runTool(tools, "read_case")) as {
			tree: unknown;
			case: unknown;
		};
		expect(read.tree).toEqual(exported.data.tree);
		expect(read.case).toEqual(exported.data.case);

		const lint = (await runTool(tools, "lint_case")) as Record<string, unknown>;
		expect(lint).toEqual({ found: true, ...lintCase(exported.data as never) });
	});
});
