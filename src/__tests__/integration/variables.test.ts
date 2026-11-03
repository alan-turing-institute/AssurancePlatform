import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { detectChanges } from "@/lib/services/change-detection-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Variables: a named context entry marked `variable: true` shows its value
 * wherever it is mentioned. A case with a mentioned variable that has no value
 * cannot be published; a pattern can. The marker survives saving, export and
 * import, and a changed value counts as a change to a published copy.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const SYSTEM_ID = "k3f9x2m7qa";
const SYSTEM = {
	id: SYSTEM_ID,
	name: "system",
	text: "the system this case is about",
	variable: true as const,
};
const MENTION = `Safe on {system#${SYSTEM_ID}}.`;

beforeEach(async () => {
	await mockNoAuth();
});

interface Scene {
	caseId: string;
	claimId: string;
	goalId: string;
	ownerId: string;
}

/** A case or pattern with complete case information, a goal that defines the variable and a claim that mentions it. */
async function sceneWith(
	variable: Record<string, unknown> = SYSTEM,
	options: { kind?: "CASE" | "PATTERN"; mention?: string } = {}
): Promise<Scene> {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id, {
		kind: options.kind ?? "CASE",
	});
	await createTestCaseInformation(testCase.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
		description: "The system is acceptably safe",
	});
	await prisma.assuranceElement.update({
		where: { id: goal.id },
		data: { context: [variable] as never },
	});
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: goal.id,
		description: options.mention ?? MENTION,
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return {
		caseId: testCase.id,
		claimId: claim.id,
		goalId: goal.id,
		ownerId: owner.id,
	};
}

function setVariable(scene: Scene, variable: Record<string, unknown>) {
	return prisma.assuranceElement.update({
		where: { id: scene.goalId },
		data: { context: [variable] as never },
	});
}

async function publishRoute(caseId: string) {
	const { POST } = await import("@/app/api/cases/[id]/publish/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/publish`, {
			method: "POST",
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function statusRoute(caseId: string) {
	const { PATCH } = await import("@/app/api/cases/[id]/status/route");
	return await PATCH(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/status`, {
			method: "PATCH",
			body: JSON.stringify({ targetStatus: "PUBLISHED" }),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

describe.each([
	["the publish route", publishRoute],
	["the status route", statusRoute],
])("publishing through %s a case that mentions a variable", (_label, publish) => {
	it("is refused while the variable has no value, with how many", async () => {
		const scene = await sceneWith();

		const response = await publish(scene.caseId);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("VALIDATION");
		expect(body.error).toBe("1 variable with no value");
		const row = await prisma.assuranceCase.findUnique({
			where: { id: scene.caseId },
		});
		expect(row?.published).toBe(false);
	});

	it("counts a value of only blanks as none, and goes ahead once the variable has a value", async () => {
		const scene = await sceneWith({ ...SYSTEM, value: "   " });

		const refused = await publish(scene.caseId);
		await setVariable(scene, { ...SYSTEM, value: "AcmeBot" });
		const accepted = await publish(scene.caseId);

		expect((await refused.json()).error).toBe("1 variable with no value");
		expect(accepted.status).toBe(200);
	});

	it("says how many of each are left when placeholders remain too", async () => {
		const scene = await sceneWith();
		await createTestElement(scene.caseId, scene.ownerId, {
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: scene.goalId,
			description: "",
			isPlaceholder: true,
		});

		const response = await publish(scene.caseId);

		expect((await response.json()).error).toBe(
			"1 element still to fill in; 1 variable with no value"
		);
	});

	it("counts a variable once however often it is mentioned, evidence included", async () => {
		const scene = await sceneWith();
		const evidence = await createTestElement(scene.caseId, scene.ownerId, {
			elementType: "EVIDENCE",
			name: "E1",
			description: `Tested on {system#${SYSTEM_ID}}.`,
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: evidence.id, claimId: scene.claimId },
		});

		const response = await publish(scene.caseId);

		expect((await response.json()).error).toBe("1 variable with no value");
	});

	it("goes ahead when the variable with no value is not mentioned", async () => {
		const scene = await sceneWith(SYSTEM, { mention: "No mention." });

		expect((await publish(scene.caseId)).status).toBe(200);
	});

	it("goes ahead when the term with no value is not a variable", async () => {
		const scene = await sceneWith({ ...SYSTEM, variable: undefined });

		expect((await publish(scene.caseId)).status).toBe(200);
	});

	it("goes ahead for a pattern, which is never held back by an empty variable", async () => {
		const scene = await sceneWith(SYSTEM, { kind: "PATTERN" });

		const response = await publish(scene.caseId);

		expect(response.status).toBe(200);
	});

	it("does not count a mention where the variable is out of reach", async () => {
		const scene = await sceneWith(SYSTEM, { mention: "Plain." });
		const strategy = await createTestElement(scene.caseId, scene.ownerId, {
			elementType: "STRATEGY",
			name: "S1",
			parentId: scene.goalId,
			description: "Another branch",
		});
		await prisma.assuranceElement.update({
			where: { id: strategy.id },
			data: {
				context: [{ ...SYSTEM, id: "p4n8c2d6xz", name: "other" }] as never,
			},
		});
		await prisma.assuranceElement.update({
			where: { id: scene.claimId },
			data: { description: "Mentions {other#p4n8c2d6xz}." },
		});

		const response = await publish(scene.caseId);

		expect(response.status).toBe(200);
	});
});

describe("updating a published copy", () => {
	it("is refused when a variable has lost its value since", async () => {
		const scene = await sceneWith({ ...SYSTEM, value: "AcmeBot" });
		expect((await publishRoute(scene.caseId)).status).toBe(200);
		await setVariable(scene, SYSTEM);

		const response = await statusRoute(scene.caseId);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 variable with no value");
	});

	it("sees a changed value as a change to publish, and an unchanged case as none", async () => {
		const scene = await sceneWith({ ...SYSTEM, value: "AcmeBot" });
		expect((await publishRoute(scene.caseId)).status).toBe(200);
		expect(
			await detectChanges(scene.ownerId, scene.caseId, false)
		).toMatchObject({ data: { hasChanges: false } });

		await setVariable(scene, { ...SYSTEM, value: "RoboCorp" });

		expect(
			await detectChanges(scene.ownerId, scene.caseId, false)
		).toMatchObject({ data: { hasChanges: true } });
	});

	it("does not see a changed value of an ordinary term as a change, because change detection compares no context except variables (a gap that was there before variables)", async () => {
		const ordinary = { ...SYSTEM, variable: undefined, value: "AcmeBot" };
		const scene = await sceneWith(ordinary);
		expect((await publishRoute(scene.caseId)).status).toBe(200);

		await setVariable(scene, { ...ordinary, value: "RoboCorp" });

		expect(
			await detectChanges(scene.ownerId, scene.caseId, false)
		).toMatchObject({ data: { hasChanges: false } });
	});
});

describe("saving, export and import", () => {
	it("saves the marker through the element route and returns it", async () => {
		const scene = await sceneWith(SYSTEM);
		const { PUT } = await import("@/app/api/elements/[id]/route");
		const context = ["plain", { ...SYSTEM, value: "AcmeBot" }];

		const response = await PUT(
			new NextRequest(`http://localhost:3000/api/elements/${scene.goalId}`, {
				method: "PUT",
				body: JSON.stringify({ context }),
				headers: { "Content-Type": "application/json" },
			}),
			{ params: Promise.resolve({ id: scene.goalId }) }
		);

		expect(response.status).toBe(200);
		expect((await response.json()).context).toEqual(context);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: scene.goalId },
		});
		expect(row?.context).toEqual(context);
	});

	it("refuses a marker that is not exactly true", async () => {
		const scene = await sceneWith(SYSTEM);
		const { PUT } = await import("@/app/api/elements/[id]/route");

		const response = await PUT(
			new NextRequest(`http://localhost:3000/api/elements/${scene.goalId}`, {
				method: "PUT",
				body: JSON.stringify({ context: [{ ...SYSTEM, variable: "yes" }] }),
				headers: { "Content-Type": "application/json" },
			}),
			{ params: Promise.resolve({ id: scene.goalId }) }
		);

		expect(response.status).toBe(400);
	});

	it("exports the marker as version 1.1 and gets it back from an import", async () => {
		const scene = await sceneWith({ ...SYSTEM, value: "AcmeBot" });
		const { exportCase } = await import("@/lib/services/case-export-service");
		const { importCase } = await import("@/lib/services/case-import-service");

		const first = expectSuccess(await exportCase(scene.ownerId, scene.caseId));
		const imported = expectSuccess(await importCase(scene.ownerId, first));
		const second = expectSuccess(
			await exportCase(scene.ownerId, imported.caseId)
		);

		expect(first.version).toBe("1.1");
		expect(first.tree.context).toEqual([{ ...SYSTEM, value: "AcmeBot" }]);
		expect(second.tree.context).toEqual([{ ...SYSTEM, value: "AcmeBot" }]);
		expect(second.tree.children[0]?.description).toBe(MENTION);
	});

	it("shows the value, not the name, in the document export", async () => {
		const scene = await sceneWith({ ...SYSTEM, value: "AcmeBot" });
		const { getDocumentExportData } = await import("@/actions/export-document");

		const result = await getDocumentExportData(scene.caseId, {
			includeComments: false,
		});

		if (!("data" in result)) {
			throw new Error(result.error);
		}
		expect(result.data.tree.children[0]?.description).toBe("Safe on AcmeBot.");
		expect(result.data.tree.context).toEqual([
			"system: the system this case is about (variable: AcmeBot)",
		]);
	});
});
