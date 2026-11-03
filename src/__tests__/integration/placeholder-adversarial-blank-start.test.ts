import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listCitableGoals } from "@/actions/cited-element-picker";
import { getDocumentExportData } from "@/actions/export-document";
import { createTemplateFromPreset, exporterRegistry } from "@/lib/export";
import { getAvailablePresets } from "@/lib/export/templates";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import prisma from "@/lib/prisma";
import type { CaseKind } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import {
	createCase,
	fetchCaseFromPrisma,
	listOwnAndDirectlySharedCases,
} from "@/lib/services/case-fetch-service";
import { importCase } from "@/lib/services/case-import-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	ASSISTANT_PATH,
	KINDS,
	putElement,
	type World,
} from "../utils/placeholder-kit";
import {
	createTestCaseInformation,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * A new blank case or pattern starts with a top-level goal that is a
 * placeholder with a hint and no text. Everything that reads a case has to
 * cope with that empty goal, and writing it behaves as it does for any
 * placeholder: in a case it clears, in a pattern it does not.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const TOP_GOAL_HINT = "Describe your top-level assurance goal";

async function blankStart(kind: CaseKind) {
	const user = await createTestUser();
	const created = expectSuccess(
		await createCase(user.id, { name: `Blank ${kind}`, kind })
	);
	await mockAuth(user.id, user.username, user.email);
	const goal = await prisma.assuranceElement.findFirstOrThrow({
		where: { caseId: created.id },
	});
	const world: World = {
		caseId: created.id,
		goalId: goal.id,
		kind,
		ownerId: user.id,
		seedClaim: () => {
			throw new Error("A blank start has no claims to seed");
		},
	};
	return { user, caseId: created.id, goal, world };
}

describe.each(KINDS)("a new blank %s", (kind) => {
	it("holds one goal, G1, that is a placeholder with the hint and no text", async () => {
		const { caseId } = await blankStart(kind);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId },
		});

		expect(elements).toHaveLength(1);
		expect(elements[0]).toMatchObject({
			name: "G1",
			elementType: "GOAL",
			role: "TOP_LEVEL",
			isPlaceholder: true,
			placeholderHint: TOP_GOAL_HINT,
			description: "",
		});
	});

	it("exports as version 1.1 with the goal marked, and imports again with the goal still marked and empty", async () => {
		const { user, caseId } = await blankStart(kind);

		const file = expectSuccess(await exportCase(user.id, caseId));
		const imported = await importCase(user.id, file, { kind });

		expect(file.version).toBe("1.1");
		expect(file.tree).toMatchObject({
			name: "G1",
			isPlaceholder: true,
			placeholderHint: TOP_GOAL_HINT,
			description: "",
		});
		if (!("data" in imported)) {
			throw new Error(`import failed: ${imported.error}`);
		}
		expect(
			await prisma.assuranceElement.findFirstOrThrow({
				where: { caseId: imported.data.caseId },
			})
		).toMatchObject({
			isPlaceholder: true,
			placeholderHint: TOP_GOAL_HINT,
			description: "",
		});
	});

	it("is read by the case fetch with the goal's empty text, marker and hint, and appears in the case list", async () => {
		const { user, caseId } = await blankStart(kind);

		const fetched = expectSuccess(await fetchCaseFromPrisma(caseId, user.id));
		const listed = await listOwnAndDirectlySharedCases(user.id, kind);

		expect(fetched.goals).toHaveLength(1);
		expect(fetched.goals?.[0]).toMatchObject({
			name: "G1",
			description: "",
			isPlaceholder: true,
			placeholderHint: TOP_GOAL_HINT,
		});
		expect(listed.map((summary) => summary.id)).toContain(caseId);
	});

	it("is read by the Case Assistant's tools as an element still to fill in, including the rules check, which does not fail", async () => {
		const { user, caseId } = await blankStart(kind);
		const tools = createCaseTools(user.id, caseId);
		const options = { toolCallId: "call", messages: [] };

		const read = await (
			tools.read_case.execute as (i: unknown, o: unknown) => Promise<unknown>
		)({}, options);
		const lint = await (
			tools.lint_case.execute as (i: unknown, o: unknown) => Promise<unknown>
		)({}, options);

		expect(read).toMatchObject({
			found: true,
			tree: {
				name: "G1",
				description: `{to fill in: ${TOP_GOAL_HINT}}`,
				isPlaceholder: true,
			},
		});
		expect(lint).toMatchObject({
			found: true,
			findings: expect.any(Array),
			questions: expect.any(Array),
		});
	});

	it("is handed to every document export without an exception and without printing a missing value", async () => {
		const { caseId } = await blankStart(kind);
		const result = await getDocumentExportData(caseId, {
			includeComments: false,
		});
		if (!("data" in result)) {
			throw new Error(result.error);
		}
		const exporter = exporterRegistry.get("markdown");
		if (!exporter) {
			throw new Error("no markdown exporter is registered");
		}

		for (const preset of getAvailablePresets()) {
			const template = createTemplateFromPreset(preset, {});
			const document = await template.render({ caseData: result.data });
			const exported = await exporter.export(document, { caseName: "Blank" });
			if (!(exported.success && "content" in exported)) {
				throw new Error(`the markdown export of ${preset} failed`);
			}
			expect(exported.content).not.toContain("undefined");
			expect(exported.content).not.toContain("null");
			expect(exported.content).not.toContain("[object Object]");
		}
	});

	it("is offered as a goal another case can cite, without the instruction standing in for its text", async () => {
		const { caseId } = await blankStart(kind);

		const result = await listCitableGoals(caseId);

		if (!result.success) {
			throw new Error(result.error);
		}
		expect(JSON.stringify(result.data)).not.toContain("undefined");
	});
});

describe("writing the goal of a new blank case", () => {
	it("takes the marker off through the element route", async () => {
		const { goal } = await blankStart("CASE");

		await putElement(goal.id, { description: "The system is safe" });

		expect(
			await prisma.assuranceElement.findUniqueOrThrow({
				where: { id: goal.id },
			})
		).toMatchObject({
			isPlaceholder: false,
			description: "The system is safe",
		});
	});

	it("takes the marker off when the Case Assistant's suggestion is applied", async () => {
		const { world, goal } = await blankStart("CASE");
		const tools = createCaseTools(world.ownerId, world.caseId, {
			suggestions: true,
		});
		const suggest = tools.suggest_edit?.execute as
			| ((i: unknown, o: unknown) => Promise<{ suggested?: boolean }>)
			| undefined;
		const suggestion = await suggest?.(
			{ elementId: goal.id, description: "The system is safe" },
			{ toolCallId: "call", messages: [] }
		);
		expect(suggestion?.suggested).toBe(true);

		const applied = await ASSISTANT_PATH.write(world, goal.id, {
			description: "The system is safe",
		});

		expect(applied).toBe(true);
		expect(
			(
				await prisma.assuranceElement.findUniqueOrThrow({
					where: { id: goal.id },
				})
			).isPlaceholder
		).toBe(false);
	});

	it("leaves the marker on in a pattern, where the author switches it off", async () => {
		const { goal } = await blankStart("PATTERN");

		await putElement(goal.id, { description: "The system is safe" });
		const written = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: goal.id },
		});
		await putElement(goal.id, { isPlaceholder: false });
		const switchedOff = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: goal.id },
		});

		expect(written.isPlaceholder).toBe(true);
		expect(switchedOff.isPlaceholder).toBe(false);
	});
});

describe("publishing a new blank case", () => {
	async function publish(caseId: string) {
		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		return await POST(
			new NextRequest(`http://localhost:3000/api/cases/${caseId}/publish`, {
				method: "POST",
			}),
			{ params: Promise.resolve({ id: caseId }) }
		);
	}

	it("is refused until the goal is written, with a count of one", async () => {
		const { caseId, goal } = await blankStart("CASE");
		await createTestCaseInformation(caseId);

		const refused = await publish(caseId);
		await putElement(goal.id, { description: "The system is safe" });
		const accepted = await publish(caseId);

		expect(refused.status).toBe(400);
		expect((await refused.json()).error).toBe("1 element still to fill in");
		expect(accepted.status).toBe(200);
	});

	it("is not refused for a blank pattern", async () => {
		const { caseId } = await blankStart("PATTERN");
		await createTestCaseInformation(caseId);

		const response = await publish(caseId);

		expect(response.status).toBe(200);
	});
});
