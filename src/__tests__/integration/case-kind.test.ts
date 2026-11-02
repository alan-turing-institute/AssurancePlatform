import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createNestedCaseJSON,
	createNestedCaseWithChainJSON,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * A case has a kind, CASE or PATTERN. This covers how the kind travels through
 * import and export, the options importCase takes for it, the lists that keep
 * patterns out, and the link from a case to the pattern it was started from.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

function patternFile(kind?: string) {
	return createNestedCaseJSON({
		version: "1.1",
		case: {
			name: "Pattern file",
			description: "A pattern",
			...(kind ? { kind } : {}),
		},
	});
}

async function importWith(
	userId: string,
	file: unknown,
	options?: Record<string, unknown>
) {
	const { importCase } = await import("@/lib/services/case-import-service");
	return expectSuccess(await importCase(userId, file, options));
}

/** A copy of a nested tree in which every node says it was changed since it came from a pattern. */
function withEveryElementModified(
	node: Record<string, unknown>
): Record<string, unknown> {
	const children =
		(node.children as Record<string, unknown>[] | undefined) ?? [];
	return {
		...node,
		modifiedFromPattern: true,
		children: children.map(withEveryElementModified),
	};
}

async function storedCase(caseId: string) {
	return await prisma.assuranceCase.findUniqueOrThrow({
		where: { id: caseId },
	});
}

describe("importCase and the kind of the new case", () => {
	it("makes an ordinary case from a file with no kind", async () => {
		const user = await createTestUser();

		const data = await importWith(user.id, createNestedCaseJSON());

		expect((await storedCase(data.caseId)).kind).toBe("CASE");
	});

	it("makes a pattern from a nested file whose case.kind is PATTERN", async () => {
		const user = await createTestUser();

		const data = await importWith(user.id, patternFile("PATTERN"));

		expect((await storedCase(data.caseId)).kind).toBe("PATTERN");
	});

	it("makes a pattern from a flat file whose case.kind is PATTERN", async () => {
		const user = await createTestUser();
		const flatFile = {
			version: "2.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Flat pattern", description: "A pattern", kind: "PATTERN" },
			elements: [
				{
					id: "20000000-0000-4000-8000-000000000001",
					elementType: "GOAL",
					role: "TOP_LEVEL",
					parentId: null,
					name: "G1",
					description: "The goal",
					inSandbox: false,
				},
			],
			evidenceLinks: [],
		};

		const data = await importWith(user.id, flatFile);

		expect((await storedCase(data.caseId)).kind).toBe("PATTERN");
	});

	it("lets the kind option override the file's kind in either direction", async () => {
		const user = await createTestUser();

		const asCase = await importWith(user.id, patternFile("PATTERN"), {
			kind: "CASE",
		});
		const asPattern = await importWith(user.id, patternFile(), {
			kind: "PATTERN",
		});

		expect((await storedCase(asCase.caseId)).kind).toBe("CASE");
		expect((await storedCase(asPattern.caseId)).kind).toBe("PATTERN");
	});

	it("replaces the file's name and description with the name and description options", async () => {
		const user = await createTestUser();

		const data = await importWith(user.id, createNestedCaseJSON(), {
			name: "Started from a pattern",
			description: "Written for this case",
		});

		const stored = await storedCase(data.caseId);
		expect(data.caseName).toBe("Started from a pattern");
		expect(stored.name).toBe("Started from a pattern");
		expect(stored.description).toBe("Written for this case");
	});

	it("keeps the file's name and description when the options are not given", async () => {
		const user = await createTestUser();

		const data = await importWith(user.id, createNestedCaseJSON());

		const stored = await storedCase(data.caseId);
		expect(stored.name).toBe("Test Import Case");
		expect(stored.description).toBe("A case created for import testing");
	});

	it("records the source pattern from the option", async () => {
		const user = await createTestUser();
		const pattern = await createTestCase(user.id, { kind: "PATTERN" });

		const data = await importWith(user.id, createNestedCaseJSON(), {
			sourcePatternId: pattern.id,
		});

		expect((await storedCase(data.caseId)).sourcePatternId).toBe(pattern.id);
	});

	it("ignores a source pattern written in the file", async () => {
		const user = await createTestUser();
		const pattern = await createTestCase(user.id, { kind: "PATTERN" });
		const file = createNestedCaseJSON({
			case: {
				name: "Claims a source",
				description: "Names a pattern in its own case object",
				sourcePatternId: pattern.id,
			},
		});

		const data = await importWith(user.id, file);

		expect((await storedCase(data.caseId)).sourcePatternId).toBeNull();
	});

	it("marks every element as from a pattern, and as not yet modified, when markFromPattern is set", async () => {
		const user = await createTestUser();
		const file = createNestedCaseWithChainJSON();
		file.tree = withEveryElementModified(file.tree as Record<string, unknown>);

		const data = await importWith(user.id, file, {
			markFromPattern: true,
		});

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: data.caseId },
		});
		expect(elements).toHaveLength(4);
		expect(elements.every((element) => element.fromPattern)).toBe(true);
		expect(
			elements.every((element) => element.modifiedFromPattern === false)
		).toBe(true);
	});

	it("leaves elements as the file has them when markFromPattern is not set", async () => {
		const user = await createTestUser();

		const data = await importWith(user.id, createNestedCaseWithChainJSON());

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: data.caseId },
		});
		expect(elements.some((element) => element.fromPattern)).toBe(false);
	});
});

describe("exportCase and the kind of the exported case", () => {
	async function exported(userId: string, caseId: string) {
		const { exportCase } = await import("@/lib/services/case-export-service");
		return expectSuccess(await exportCase(userId, caseId));
	}

	async function caseWithGoal(kind: "CASE" | "PATTERN") {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, { kind });
		await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
			role: "TOP_LEVEL",
		});
		return { owner, testCase };
	}

	it("writes an ordinary case as 1.0 with no kind in its case object", async () => {
		const { owner, testCase } = await caseWithGoal("CASE");

		const data = await exported(owner.id, testCase.id);

		expect(data.version).toBe("1.0");
		expect(data.case).toEqual({
			name: testCase.name,
			description: testCase.description,
		});
	});

	it("writes a pattern as 1.1 with case.kind PATTERN", async () => {
		const { owner, testCase } = await caseWithGoal("PATTERN");

		const data = await exported(owner.id, testCase.id);

		expect(data.version).toBe("1.1");
		expect(data.case.kind).toBe("PATTERN");
	});

	it("brings a pattern back as a pattern when its export is imported", async () => {
		const { owner, testCase } = await caseWithGoal("PATTERN");
		const data = await exported(owner.id, testCase.id);

		const imported = await importWith(owner.id, data);

		expect((await storedCase(imported.caseId)).kind).toBe("PATTERN");
	});
});

describe("lists that are meant for ordinary cases", () => {
	it("listUserCases leaves out a pattern the user owns and one shared with them", async () => {
		const user = await createTestUser();
		const other = await createTestUser();
		const ordinary = await createTestCase(user.id);
		const ownPattern = await createTestCase(user.id, { kind: "PATTERN" });
		const sharedPattern = await createTestCase(other.id, { kind: "PATTERN" });
		await createTestPermission(sharedPattern.id, user.id, other.id, "VIEW");

		const { listUserCases } = await import("@/lib/services/case-fetch-service");
		const data = expectSuccess(await listUserCases(user.id));

		expect(data.map((c) => c.id)).toEqual([ordinary.id]);
		expect(data.map((c) => c.id)).not.toContain(ownPattern.id);
		expect(data[0]?.kind).toBe("CASE");
	});

	it("fetchAssuranceCases, which feeds the dashboard and the integrations grant form, leaves out a pattern", async () => {
		const user = await createTestUser();
		const ordinary = await createTestCase(user.id);
		const pattern = await createTestCase(user.id, { kind: "PATTERN" });
		await mockAuth(user.id, user.username, user.email ?? undefined);

		const { fetchAssuranceCases } = await import("@/actions/assurance-cases");
		const cases = await fetchAssuranceCases();

		const ids = (cases ?? []).map((c) => c.id);
		expect(ids).toContain(ordinary.id);
		expect(ids).not.toContain(pattern.id);
	});

	it("listCitableCases leaves out an owned pattern, a pattern shared with the user and one shared with their team", async () => {
		const user = await createTestUser();
		const other = await createTestUser();
		const team = await createTestTeam(other.id);
		await addTeamMember(team.id, user.id, "MEMBER", other.id);
		const ordinary = await createTestCase(user.id);
		const ownPattern = await createTestCase(user.id, { kind: "PATTERN" });
		const sharedPattern = await createTestCase(other.id, { kind: "PATTERN" });
		await createTestPermission(sharedPattern.id, user.id, other.id, "VIEW");
		const teamPattern = await createTestCase(other.id, { kind: "PATTERN" });
		await createTestTeamPermission(teamPattern.id, team.id, other.id, "VIEW");
		const sharedCase = await createTestCase(other.id);
		await createTestPermission(sharedCase.id, user.id, other.id, "VIEW");
		await mockAuth(user.id, user.username, user.email ?? undefined);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result.success).toBe(true);
		if (result.success) {
			const ids = result.data.map((c) => c.id).sort();
			expect(ids).toEqual([ordinary.id, sharedCase.id].sort());
			expect(ids).not.toContain(ownPattern.id);
			expect(ids).not.toContain(sharedPattern.id);
			expect(ids).not.toContain(teamPattern.id);
		}
	});
});

describe("case responses and the kind", () => {
	it("fetchCaseFromPrisma gives the kind of the case it returns", async () => {
		const owner = await createTestUser();
		const ordinary = await createTestCase(owner.id);
		const pattern = await createTestCase(owner.id, { kind: "PATTERN" });

		const { fetchCaseFromPrisma } = await import(
			"@/lib/services/case-fetch-service"
		);
		const asCase = expectSuccess(
			await fetchCaseFromPrisma(ordinary.id, owner.id)
		);
		const asPattern = expectSuccess(
			await fetchCaseFromPrisma(pattern.id, owner.id)
		);

		expect(asCase.kind).toBe("CASE");
		expect(asPattern.kind).toBe("PATTERN");
	});

	it("listSharedCases gives the kind of each case it returns", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const sharedCase = await createTestCase(owner.id);
		await createTestPermission(sharedCase.id, viewer.id, owner.id, "VIEW");

		const { listSharedCases } = await import(
			"@/lib/services/case-fetch-service"
		);
		const data = expectSuccess(await listSharedCases(viewer.id));

		expect(data.map((c) => [c.id, c.kind])).toEqual([[sharedCase.id, "CASE"]]);
	});
});

describe("the source pattern link", () => {
	it("is cleared on a case when its pattern is deleted for good", async () => {
		const owner = await createTestUser();
		const pattern = await createTestCase(owner.id, { kind: "PATTERN" });
		const derived = await importWith(owner.id, createNestedCaseJSON(), {
			sourcePatternId: pattern.id,
		});

		await prisma.assuranceCase.delete({ where: { id: pattern.id } });

		expect((await storedCase(derived.caseId)).sourcePatternId).toBeNull();
	});
});
