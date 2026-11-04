import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	countPlaceholders,
	countUnsetVariables,
	fillInCountMessage,
	treeNodes,
} from "@/lib/case/placeholders";
import prisma from "@/lib/prisma";
import type { TreeNode } from "@/lib/schemas/case-export";
import { requireCaseInformationComplete } from "@/lib/services/case-information-service";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import {
	publishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { seedPlaceholderClaim } from "../utils/placeholder-kit";
import {
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import {
	imageCopyProblems,
	newScene,
	publishedFileKeys,
} from "../utils/publish-race-kit";
import {
	inconsistencies,
	publishedRows,
	storedState,
	TYPE_FOR_KIND,
} from "../utils/publish-type-kit";
import {
	PUBLISH_ROUTES,
	publishCase,
	ref,
	SYS,
	setContext,
	setStatus,
	setText,
	snapshotCount,
	type VariableWorld,
	variableEntry,
	variableWorld,
} from "../utils/variables-kit";

/**
 * Whatever happens to a case between the moment its argument is read for the
 * snapshot and the moment the snapshot is written, nothing with an element
 * still to fill in, or a variable with no value, is published as a case. The
 * read is made to return and then the change is made, so the change lands
 * after the read and before the write: a pattern turned into a case, a case
 * turned into a pattern and back, a placeholder marked, a value cleared, an
 * export that does not say what kind of case it is.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("@/lib/services/sse-connection-manager")
	>()),
	emitSSEEvent: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

interface Hook {
	/** Changes the stored case. */
	change: () => Promise<unknown> | unknown;
	/** Changes what the export returns. */
	transform?: (result: unknown) => unknown;
}

const exportHook = vi.hoisted(() => ({
	calls: 0,
	fired: false,
	run: null as Hook | null,
	target: 0,
}));

// The real export, except that the export a test names is followed by the
// hook it queued. A hook may change the stored case and may change what the
// export returns. A request makes one export to check the case and one to
// compose the snapshot, and which of them are made differs between the
// routes, so the tests name the export by its place in the request.
vi.mock("@/lib/services/case-export-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/case-export-service")>();
	return {
		...actual,
		exportCase: vi.fn(async (...args: Parameters<typeof actual.exportCase>) => {
			const result = await actual.exportCase(...args);
			exportHook.calls += 1;
			const hook = exportHook.run;
			if (hook && exportHook.calls === exportHook.target) {
				exportHook.run = null;
				exportHook.fired = true;
				await hook.change();
				return hook.transform ? hook.transform(result) : result;
			}
			return result;
		}),
	};
});

beforeEach(async () => {
	exportHook.calls = 0;
	exportHook.fired = false;
	exportHook.run = null;
	exportHook.target = 0;
	await mockNoAuth();
});

/** Runs `hook` once the `n`th export of the request has finished, before it is handed back. */
function afterExportNumber(
	n: number,
	change: Hook["change"],
	transform?: Hook["transform"]
) {
	exportHook.calls = 0;
	exportHook.target = n;
	exportHook.run = { change, transform };
}

/**
 * A change that lands after the `n`th export of a request. A request that
 * makes fewer exports never reaches it, and the test skips: nothing happened
 * between the read and the write for it to be held to.
 */
function skipUnlessChangeLanded(skip: (note?: string) => never) {
	if (!exportHook.fired) {
		skip("the request made fewer exports than this change waits for");
	}
}

/** The places in a request after which a change can land. */
const WINDOWS = [1, 2, 3];

/** The same export with `case.kind` left out, as a file written before the kind existed. */
function withoutKind(result: unknown): unknown {
	const copy = structuredClone(result) as {
		data?: { case?: { kind?: string } };
	};
	if (copy.data?.case) {
		copy.data.case.kind = undefined;
	}
	return copy;
}

/** What is still to fill in on each stored snapshot that calls itself a case. */
async function fillInsOnStoredCases(caseId: string): Promise<string[]> {
	const rows = await publishedRows(caseId);
	return rows.flatMap((row) => {
		const content = row.content as unknown as {
			case?: { kind?: string };
			tree: TreeNode;
		};
		if (content.case?.kind === "PATTERN") {
			return [];
		}
		const left = fillInCountMessage({
			placeholders: countPlaceholders(treeNodes(content.tree)),
			unsetVariables: countUnsetVariables(content.tree),
		});
		return left ? [left] : [];
	});
}

async function mention(world: VariableWorld) {
	await setText(world.claimId, {
		description: `Operators are trained on ${ref("system", SYS)}`,
	});
}

const NOT_OK = [400, 409];

const ROUTE_WINDOWS = PUBLISH_ROUTES.flatMap(([label, publish]) =>
	WINDOWS.map((n) => [label, n, publish] as const)
);

describe.each(
	ROUTE_WINDOWS
)("publishing through %s with a change after export %i", (_label, n, publish) => {
	it("refuses a pattern that is turned into a case, and publishes nothing", async ({
		skip,
	}) => {
		const world = await variableWorld("PATTERN");
		await seedPlaceholderClaim(world);
		afterExportNumber(n, () =>
			convertCaseKind(world.ownerId, world.caseId, "CASE")
		);

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect(NOT_OK).toContain(response.status);
		expect(await snapshotCount(world.caseId)).toBe(0);
		expect(await fillInsOnStoredCases(world.caseId)).toEqual([]);
	});

	it("refuses a pattern with an unset variable that is turned into a case, and publishes nothing", async ({
		skip,
	}) => {
		const world = await variableWorld("PATTERN");
		await mention(world);
		afterExportNumber(n, () =>
			convertCaseKind(world.ownerId, world.caseId, "CASE")
		);

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect(NOT_OK).toContain(response.status);
		expect(await snapshotCount(world.caseId)).toBe(0);
	});

	it("never publishes a case with a placeholder that was marked after the read", async ({
		skip,
	}) => {
		const world = await variableWorld("CASE", "the pump");
		await mention(world);
		afterExportNumber(n, async () => {
			await seedPlaceholderClaim(world);
		});

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		expect(await fillInsOnStoredCases(world.caseId)).toEqual([]);
		expect(inconsistencies(await storedState(world.caseId))).toEqual([]);
	});

	it("never publishes a case with a variable whose value was cleared after the read", async ({
		skip,
	}) => {
		const world = await variableWorld("CASE", "the pump");
		await mention(world);
		afterExportNumber(n, () => setContext(world.goalId, [variableEntry()]));

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		expect(await fillInsOnStoredCases(world.caseId)).toEqual([]);
	});

	it("refuses a case whose variable had no value when read, even if a value is given before the write", async ({
		skip,
	}) => {
		const world = await variableWorld("CASE");
		await mention(world);
		afterExportNumber(n, () =>
			setContext(world.goalId, [variableEntry("the pump")])
		);

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 variable with no value");
		expect(await snapshotCount(world.caseId)).toBe(0);
	});

	it("refuses a case whose placeholder was written between the read and the write, since the snapshot still has it", async ({
		skip,
	}) => {
		const world = await variableWorld("CASE", "the pump");
		const placeholder = await seedPlaceholderClaim(world);
		afterExportNumber(n, () =>
			prisma.assuranceElement.update({
				where: { id: placeholder.id },
				data: { isPlaceholder: false, description: "Written in time" },
			})
		);

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
		expect(await snapshotCount(world.caseId)).toBe(0);
	});

	it("never publishes a case that was turned into a pattern, given a placeholder and turned back", async ({
		skip,
	}) => {
		const world = await variableWorld("CASE", "the pump");
		afterExportNumber(n, async () => {
			await convertCaseKind(world.ownerId, world.caseId, "PATTERN");
			await seedPlaceholderClaim(world);
			await convertCaseKind(world.ownerId, world.caseId, "CASE");
		});

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		expect(await fillInsOnStoredCases(world.caseId)).toEqual([]);
		expect(inconsistencies(await storedState(world.caseId))).toEqual([]);
	});

	it("leaves a pattern turned into a case and back either unpublished or published as the pattern it is", async ({
		skip,
	}) => {
		const world = await variableWorld("PATTERN");
		await seedPlaceholderClaim(world);
		afterExportNumber(n, async () => {
			await convertCaseKind(world.ownerId, world.caseId, "CASE");
			await convertCaseKind(world.ownerId, world.caseId, "PATTERN");
		});

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		const state = await storedState(world.caseId);
		expect(state.stored.kind).toBe("PATTERN");
		expect(inconsistencies(state)).toEqual([]);
		expect(state.rows.every((row) => row.type === TYPE_FOR_KIND.PATTERN)).toBe(
			true
		);
	});

	it("refuses a case with a placeholder whose export does not say what kind it is", async ({
		skip,
	}) => {
		const world = await variableWorld("CASE", "the pump");
		await seedPlaceholderClaim(world);
		afterExportNumber(n, () => undefined, withoutKind);

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
		expect(await snapshotCount(world.caseId)).toBe(0);
	});

	it("publishes a clean case whose export does not say what kind it is, as a case", async ({
		skip,
	}) => {
		const world = await variableWorld("CASE", "the pump");
		afterExportNumber(n, () => undefined, withoutKind);

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect(response.status).toBe(200);
		const state = await storedState(world.caseId);
		expect(state.rows.map((row) => row.type)).toEqual([TYPE_FOR_KIND.CASE]);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("never writes a pattern with a placeholder whose snapshot does not say it is a pattern", async ({
		skip,
	}) => {
		const world = await variableWorld("PATTERN");
		await seedPlaceholderClaim(world);
		afterExportNumber(n, () => undefined, withoutKind);

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		expect(inconsistencies(await storedState(world.caseId))).toEqual([]);
	});

	it("never writes a clean pattern whose snapshot does not say it is a pattern", async ({
		skip,
	}) => {
		const world = await variableWorld("PATTERN");
		afterExportNumber(n, () => undefined, withoutKind);

		const response = await publish(world.caseId);
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		expect(inconsistencies(await storedState(world.caseId))).toEqual([]);
	});
});

describe.each(
	WINDOWS
)("updating a published case through the status route with a change after export %i", (n) => {
	async function publishedWorld() {
		const world = await variableWorld("CASE", "the pump");
		await mention(world);
		expectSuccess(await publishAssuranceCase(world.ownerId, world.caseId));
		return world;
	}

	it("never republishes a case with a placeholder that was marked after the read", async ({
		skip,
	}) => {
		const world = await publishedWorld();
		afterExportNumber(n, async () => {
			await seedPlaceholderClaim(world);
		});

		const response = await setStatus(world.caseId, "PUBLISHED");
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		expect(await fillInsOnStoredCases(world.caseId)).toEqual([]);
		expect(inconsistencies(await storedState(world.caseId))).toEqual([]);
	});

	it("never republishes a case with a variable whose value was cleared after the read", async ({
		skip,
	}) => {
		const world = await publishedWorld();
		afterExportNumber(n, () => setContext(world.goalId, [variableEntry()]));

		const response = await setStatus(world.caseId, "PUBLISHED");
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		expect(await fillInsOnStoredCases(world.caseId)).toEqual([]);
	});

	it("never publishes a case again with a placeholder that was marked after the read", async ({
		skip,
	}) => {
		const world = await publishedWorld();
		afterExportNumber(n, async () => {
			await seedPlaceholderClaim(world);
		});

		const response = await publishCase(world.caseId);
		skipUnlessChangeLanded(skip);

		expect([200, ...NOT_OK]).toContain(response.status);
		expect(await fillInsOnStoredCases(world.caseId)).toEqual([]);
	});
});

describe.each(
	PUBLISH_ROUTES
)("publishing through %s without the right to edit", (_label, publish) => {
	it("answers a viewer with permission denied, not with what is left to fill in", async () => {
		const world = await variableWorld("CASE");
		await mention(world);
		await seedPlaceholderClaim(world);
		const viewer = await createTestUser();
		await createTestPermission(world.caseId, viewer.id, world.ownerId, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const response = await publish(world.caseId);

		expect(response.status).toBe(403);
		expect(JSON.stringify(await response.json())).not.toContain("fill in");
		expect(await snapshotCount(world.caseId)).toBe(0);
	});

	it("answers someone with no access the same way", async () => {
		const world = await variableWorld("CASE");
		await seedPlaceholderClaim(world);
		const stranger = await createTestUser();
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const response = await publish(world.caseId);

		expect(response.status).toBe(403);
		expect(await snapshotCount(world.caseId)).toBe(0);
	});
});

describe("republishing", () => {
	it("is refused once a placeholder is marked, and leaves the published version as it was", async () => {
		const world = await variableWorld("CASE", "the pump");
		await mention(world);
		expectSuccess(await publishAssuranceCase(world.ownerId, world.caseId));
		const before = await publishedRows(world.caseId);
		await seedPlaceholderClaim(world);

		const response = await setStatus(world.caseId, "PUBLISHED");

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("1 element still to fill in");
		expect((await publishedRows(world.caseId)).map((row) => row.id)).toEqual(
			before.map((row) => row.id)
		);
		expect(inconsistencies(await storedState(world.caseId))).toEqual([]);
	});
});

describe("the publish services on their own", () => {
	it("refuse a first publish of a case with a placeholder and an unset variable, naming both", async () => {
		const world = await variableWorld("CASE");
		await mention(world);
		await seedPlaceholderClaim(world);

		const result = await publishAssuranceCase(world.ownerId, world.caseId);

		expect(result).toEqual({
			error: "1 element still to fill in; 1 variable with no value",
		});
		expect(await snapshotCount(world.caseId)).toBe(0);
	});

	it("refuse a republish of a case that has since gained an unset variable", async () => {
		const world = await variableWorld("CASE", "the pump");
		await mention(world);
		expectSuccess(await publishAssuranceCase(world.ownerId, world.caseId));
		await setContext(world.goalId, [variableEntry()]);

		const result = await updatePublishedCase(world.ownerId, world.caseId);

		expect(result).toEqual({ error: "1 variable with no value" });
		expect(await snapshotCount(world.caseId)).toBe(1);
	});

	it("publish a pattern that has a placeholder and an unset variable", async () => {
		const world = await variableWorld("PATTERN");
		await mention(world);
		await seedPlaceholderClaim(world);

		const result = await publishAssuranceCase(world.ownerId, world.caseId);

		expect(result).toHaveProperty("data");
		expect((await publishedRows(world.caseId)).map((row) => row.type)).toEqual([
			TYPE_FOR_KIND.PATTERN,
		]);
	});

	it("refuse a pattern turned into a case after the case information was checked", async () => {
		const world = await variableWorld("PATTERN");
		await seedPlaceholderClaim(world);
		expect(
			await requireCaseInformationComplete(world.ownerId, world.caseId)
		).toEqual({ data: true });
		await convertCaseKind(world.ownerId, world.caseId, "CASE");

		const result = await publishAssuranceCase(world.ownerId, world.caseId);

		expect(result).toEqual({ error: "1 element still to fill in" });
		expect(await snapshotCount(world.caseId)).toBe(0);
	});

	it("leave no image copy behind when they refuse a case with something to fill in", async () => {
		const scene = await newScene();
		const goal = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: scene.caseId, elementType: "GOAL" },
		});
		await createTestElement(scene.caseId, scene.ownerId, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			description: "",
			isPlaceholder: true,
			parentId: goal.id,
		});
		const before = await publishedFileKeys();

		const result = await publishAssuranceCase(scene.ownerId, scene.caseId);

		expect(result).toEqual({ error: "1 element still to fill in" });
		expect(await imageCopyProblems(before)).toEqual([]);
		expect(await publishedFileKeys()).toEqual(before);
	});

	it("leave no image copy behind when a conversion after the read makes them refuse", async () => {
		const scene = await newScene("PATTERN");
		afterExportNumber(1, () =>
			convertCaseKind(scene.ownerId, scene.caseId, "CASE")
		);
		const before = await publishedFileKeys();

		const result = await publishAssuranceCase(scene.ownerId, scene.caseId);

		expect(result).toHaveProperty("error");
		expect(await snapshotCount(scene.caseId)).toBe(0);
		expect(await imageCopyProblems(before)).toEqual([]);
	});
});
