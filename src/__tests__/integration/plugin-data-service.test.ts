import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	deletePluginData,
	listPluginDataForCase,
	readPluginData,
	writePluginData,
} from "@/lib/services/plugin-data-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

const KNOWN_PLUGIN_ID = "tea.health";
const OTHER_NAMESPACE = "tea.other-namespace"; // deliberately not manifest-registered — seeded directly, never through the service
const UNKNOWN_PLUGIN_ID = "tea.does-not-exist";
const NOT_ENABLED_PATTERN = /is not enabled/;
// Single generic message for non-existent, soft-deleted, and cross-case
// mismatch alike (no enumeration oracle — see plugin-data-service.ts's
// validateElementBelongsToCase).
const ELEMENT_NOT_FOUND = "Element not found";

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const element = await createTestElement(testCase.id, owner.id);
	return { owner, testCase, element };
}

// ============================================
// Case-level read/write round trip
// ============================================

describe("plugin-data-service — case-level data", () => {
	it("returns null when no case-level row exists yet", async () => {
		const { owner, testCase } = await setup();
		// Not `expectSuccess`: its `data === null` branch is designed for
		// void-result services (delete/reset) and returns `undefined` rather
		// than asserting the value — here `null` is the meaningful "no row
		// yet" payload, so assert on the raw ServiceResult directly.
		const result = await readPluginData(KNOWN_PLUGIN_ID, owner.id, {
			caseId: testCase.id,
		});
		expect("error" in result).toBe(false);
		expect("data" in result && result.data).toBeNull();
	});

	it("writes then reads back case-level data", async () => {
		const { owner, testCase } = await setup();
		const written = expectSuccess(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id },
				{ score: 0.9 }
			)
		);
		expect(written.elementId).toBeNull();
		expect(written.data).toEqual({ score: 0.9 });

		const read = expectSuccess(
			await readPluginData(KNOWN_PLUGIN_ID, owner.id, { caseId: testCase.id })
		);
		expect(read?.data).toEqual({ score: 0.9 });
	});

	it("a second write updates the same row rather than creating a duplicate", async () => {
		const { owner, testCase } = await setup();
		const first = expectSuccess(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id },
				{ score: 0.5 }
			)
		);
		const second = expectSuccess(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id },
				{ score: 0.7 }
			)
		);
		expect(second.id).toBe(first.id);

		const rows = await prisma.pluginData.findMany({
			where: {
				pluginId: KNOWN_PLUGIN_ID,
				caseId: testCase.id,
				elementId: null,
			},
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.data).toEqual({ score: 0.7 });
	});
});

// ============================================
// Element-level read/write round trip
// ============================================

describe("plugin-data-service — element-level data", () => {
	it("writes then reads back element-level data", async () => {
		const { owner, testCase, element } = await setup();
		const written = expectSuccess(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id, elementId: element.id },
				{ score: 0.4 }
			)
		);
		expect(written.elementId).toBe(element.id);

		const read = expectSuccess(
			await readPluginData(KNOWN_PLUGIN_ID, owner.id, {
				caseId: testCase.id,
				elementId: element.id,
			})
		);
		expect(read?.data).toEqual({ score: 0.4 });
	});

	it("keeps case-level and element-level rows independent for the same plugin+case", async () => {
		const { owner, testCase, element } = await setup();
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id },
			{ scope: "case" }
		);
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id, elementId: element.id },
			{ scope: "element" }
		);

		const list = expectSuccess(
			await listPluginDataForCase(KNOWN_PLUGIN_ID, owner.id, testCase.id)
		);
		expect(list).toHaveLength(2);
		const caseRow = list.find((r) => r.elementId === null);
		const elementRow = list.find((r) => r.elementId === element.id);
		expect(caseRow?.data).toEqual({ scope: "case" });
		expect(elementRow?.data).toEqual({ scope: "element" });
	});

	it("deletes a single element-level row without touching the case-level row", async () => {
		const { owner, testCase, element } = await setup();
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id },
			{ scope: "case" }
		);
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id, elementId: element.id },
			{ scope: "element" }
		);

		expectSuccess(
			await deletePluginData(KNOWN_PLUGIN_ID, owner.id, {
				caseId: testCase.id,
				elementId: element.id,
			})
		);

		const remaining = expectSuccess(
			await listPluginDataForCase(KNOWN_PLUGIN_ID, owner.id, testCase.id)
		);
		expect(remaining).toHaveLength(1);
		expect(remaining[0]!.elementId).toBeNull();
	});
});

// ============================================
// elementId <-> caseId integrity (nanaki QA finding 4 — CRITICAL)
// ============================================

describe("plugin-data-service — elementId/caseId mismatch", () => {
	it("rejects a write whose elementId belongs to a different case with the generic not-found message (no enumeration oracle)", async () => {
		const { owner, testCase } = await setup();
		const otherCase = await createTestCase(owner.id);
		const elementInOtherCase = await createTestElement(otherCase.id, owner.id);

		const result = await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id, elementId: elementInOtherCase.id },
			{ score: 0.1 }
		);
		expectError(result, ELEMENT_NOT_FOUND);

		// Nothing was written under either case for this element.
		const rows = await prisma.pluginData.findMany({
			where: { pluginId: KNOWN_PLUGIN_ID, elementId: elementInOtherCase.id },
		});
		expect(rows).toHaveLength(0);
	});

	it("rejects a read whose elementId belongs to a different case with the generic not-found message (no enumeration oracle)", async () => {
		const { owner, testCase } = await setup();
		const otherCase = await createTestCase(owner.id);
		const elementInOtherCase = await createTestElement(otherCase.id, owner.id);

		const result = await readPluginData(KNOWN_PLUGIN_ID, owner.id, {
			caseId: testCase.id,
			elementId: elementInOtherCase.id,
		});
		expectError(result, ELEMENT_NOT_FOUND);
	});

	it("rejects an elementId that does not exist at all with the same generic message", async () => {
		const { owner, testCase } = await setup();
		const result = await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{
				caseId: testCase.id,
				elementId: "00000000-0000-0000-0000-000000000000",
			},
			{ score: 0.1 }
		);
		expectError(result, ELEMENT_NOT_FOUND);

		// Nothing was written for the non-existent element.
		const rows = await prisma.pluginData.findMany({
			where: {
				pluginId: KNOWN_PLUGIN_ID,
				elementId: "00000000-0000-0000-0000-000000000000",
			},
		});
		expect(rows).toHaveLength(0);
	});

	it("rejects an elementId belonging to a soft-deleted element with the same generic message", async () => {
		const { owner, testCase, element } = await setup();
		await prisma.assuranceElement.update({
			where: { id: element.id },
			data: { deletedAt: new Date(), deletedById: owner.id },
		});

		const result = await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id, elementId: element.id },
			{ score: 0.1 }
		);
		expectError(result, ELEMENT_NOT_FOUND);

		// Nothing was written for the soft-deleted element.
		const rows = await prisma.pluginData.findMany({
			where: { pluginId: KNOWN_PLUGIN_ID, elementId: element.id },
		});
		expect(rows).toHaveLength(0);
	});
});

// ============================================
// Empty-string elementId (item 3 — must not silently fall through to
// case-level semantics)
// ============================================

describe("plugin-data-service — empty-string elementId", () => {
	it("rejects an empty-string elementId on write rather than silently treating it as case-level", async () => {
		const { owner, testCase } = await setup();
		const result = await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id, elementId: "" },
			{ score: 0.1 }
		);
		expectError(result, "elementId must not be empty");

		const rows = await prisma.pluginData.findMany({
			where: { pluginId: KNOWN_PLUGIN_ID, caseId: testCase.id },
		});
		expect(rows).toHaveLength(0);
	});

	it("rejects an empty-string elementId on read rather than silently treating it as case-level", async () => {
		const { owner, testCase } = await setup();
		// A real case-level row exists — if "" fell through to case-level
		// semantics, this read would wrongly return it.
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id },
			{ score: 0.9 }
		);

		const result = await readPluginData(KNOWN_PLUGIN_ID, owner.id, {
			caseId: testCase.id,
			elementId: "",
		});
		expectError(result, "elementId must not be empty");
	});
});

// ============================================
// Concurrent case-level upsert race (item 5 — the P2002 catch->fallback
// path in upsertCaseLevelPluginData is otherwise never exercised)
// ============================================

describe("plugin-data-service — concurrent case-level upsert", () => {
	it("survives two concurrent case-level writes with exactly one row surviving, holding one of the two payloads", async () => {
		const { owner, testCase } = await setup();

		const [resultA, resultB] = await Promise.all([
			writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id },
				{ writer: "a" }
			),
			writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id },
				{ writer: "b" }
			),
		]);
		expectSuccess(resultA);
		expectSuccess(resultB);

		const rows = await prisma.pluginData.findMany({
			where: {
				pluginId: KNOWN_PLUGIN_ID,
				caseId: testCase.id,
				elementId: null,
			},
		});
		expect(rows).toHaveLength(1);
		expect([{ writer: "a" }, { writer: "b" }]).toContainEqual(rows[0]!.data);
	});
});

// ============================================
// Namespace isolation
// ============================================

describe("plugin-data-service — namespace isolation", () => {
	it("does not return another plugin's row for the same case/element", async () => {
		const { owner, testCase, element } = await setup();
		await prisma.pluginData.create({
			data: {
				pluginId: OTHER_NAMESPACE,
				caseId: testCase.id,
				elementId: element.id,
				data: { belongsTo: OTHER_NAMESPACE },
			},
		});

		const read = await readPluginData(KNOWN_PLUGIN_ID, owner.id, {
			caseId: testCase.id,
			elementId: element.id,
		});
		expect("error" in read).toBe(false);
		expect("data" in read && read.data).toBeNull();
	});

	it("does not include another plugin's rows in listPluginDataForCase", async () => {
		const { owner, testCase } = await setup();
		await prisma.pluginData.create({
			data: {
				pluginId: OTHER_NAMESPACE,
				caseId: testCase.id,
				elementId: null,
				data: { belongsTo: OTHER_NAMESPACE },
			},
		});
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id },
			{ belongsTo: KNOWN_PLUGIN_ID }
		);

		const list = expectSuccess(
			await listPluginDataForCase(KNOWN_PLUGIN_ID, owner.id, testCase.id)
		);
		expect(list).toHaveLength(1);
		expect(list[0]!.pluginId).toBe(KNOWN_PLUGIN_ID);
	});

	it("writing under one pluginId creates a separate row rather than overwriting another plugin's existing row", async () => {
		const { owner, testCase } = await setup();
		const otherRow = await prisma.pluginData.create({
			data: {
				pluginId: OTHER_NAMESPACE,
				caseId: testCase.id,
				elementId: null,
				data: { belongsTo: OTHER_NAMESPACE },
			},
		});

		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id },
			{ belongsTo: KNOWN_PLUGIN_ID }
		);

		const untouchedOtherRow = await prisma.pluginData.findUniqueOrThrow({
			where: { id: otherRow.id },
		});
		expect(untouchedOtherRow.data).toEqual({ belongsTo: OTHER_NAMESPACE });

		const rows = await prisma.pluginData.findMany({
			where: { caseId: testCase.id, elementId: null },
		});
		expect(rows).toHaveLength(2);
	});

	it("deleting under one pluginId does not delete another plugin's row at the same location", async () => {
		const { owner, testCase } = await setup();
		const otherRow = await prisma.pluginData.create({
			data: {
				pluginId: OTHER_NAMESPACE,
				caseId: testCase.id,
				elementId: null,
				data: { belongsTo: OTHER_NAMESPACE },
			},
		});
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id },
			{ belongsTo: KNOWN_PLUGIN_ID }
		);

		expectSuccess(
			await deletePluginData(KNOWN_PLUGIN_ID, owner.id, { caseId: testCase.id })
		);

		const stillThere = await prisma.pluginData.findUnique({
			where: { id: otherRow.id },
		});
		expect(stillThere).not.toBeNull();
	});
});

// ============================================
// Permission matrix (repo convention: owner; EDIT/VIEW via direct share and
// via team; no permission; non-existent case)
// ============================================

describe("plugin-data-service — permission matrix", () => {
	it("allows the case owner to read and write", async () => {
		const { owner, testCase } = await setup();
		expectSuccess(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id },
				{ ok: true }
			)
		);
	});

	it("allows a direct EDIT share to write", async () => {
		const { owner, testCase } = await setup();
		const editor = await createTestUser();
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

		expectSuccess(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				editor.id,
				{ caseId: testCase.id },
				{ ok: true }
			)
		);
	});

	it("allows a direct VIEW share to read but refuses it to write", async () => {
		const { owner, testCase } = await setup();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id },
			{ ok: true }
		);

		expectSuccess(
			await readPluginData(KNOWN_PLUGIN_ID, viewer.id, { caseId: testCase.id })
		);
		expectError(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				viewer.id,
				{ caseId: testCase.id },
				{ ok: false }
			)
		);
	});

	it("allows a team EDIT share to write", async () => {
		const { owner, testCase } = await setup();
		const teamMember = await createTestUser();
		const team = await createTestTeam(teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");

		expectSuccess(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				teamMember.id,
				{ caseId: testCase.id },
				{ ok: true }
			)
		);
	});

	it("refuses a user with no permission on the case", async () => {
		const { testCase } = await setup();
		const stranger = await createTestUser();

		expectError(
			await readPluginData(KNOWN_PLUGIN_ID, stranger.id, {
				caseId: testCase.id,
			})
		);
	});

	it("returns the same error for a non-existent case and for no permission (no enumeration oracle)", async () => {
		const { owner } = await setup();
		const stranger = await createTestUser();
		const otherCase = await createTestCase(owner.id);

		const notFoundResult = await readPluginData(KNOWN_PLUGIN_ID, owner.id, {
			caseId: "00000000-0000-0000-0000-000000000000",
		});
		const noAccessResult = await readPluginData(KNOWN_PLUGIN_ID, stranger.id, {
			caseId: otherCase.id,
		});
		expectSameError(notFoundResult, noAccessResult);
	});
});

// ============================================
// Disabled-plugin behaviour (work item 4) — refused, not purged
// ============================================

describe("plugin-data-service — disabled plugin", () => {
	it("refuses reads and writes when the plugin is off for the caller", async () => {
		const { owner, testCase } = await setup();
		await setPluginEnabledForUser(KNOWN_PLUGIN_ID, owner.id, {
			enabled: false,
		});

		expectError(
			await readPluginData(KNOWN_PLUGIN_ID, owner.id, { caseId: testCase.id }),
			NOT_ENABLED_PATTERN
		);
		expectError(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id },
				{ ok: true }
			),
			NOT_ENABLED_PATTERN
		);
	});

	it("does not delete existing rows when the plugin is subsequently disabled — they sit inert", async () => {
		const { owner, testCase } = await setup();
		const written = expectSuccess(
			await writePluginData(
				KNOWN_PLUGIN_ID,
				owner.id,
				{ caseId: testCase.id },
				{ score: 0.9 }
			)
		);

		await setPluginEnabledForUser(KNOWN_PLUGIN_ID, owner.id, {
			enabled: false,
		});

		// The service refuses to serve it back to this (now-disabled-for)
		// caller, but the row itself is untouched in the database.
		expectError(
			await readPluginData(KNOWN_PLUGIN_ID, owner.id, { caseId: testCase.id }),
			NOT_ENABLED_PATTERN
		);
		const stillThere = await prisma.pluginData.findUniqueOrThrow({
			where: { id: written.id },
		});
		expect(stillThere.data).toEqual({ score: 0.9 });
	});

	it("re-enabling makes previously-written data visible again, unchanged", async () => {
		const { owner, testCase } = await setup();
		await writePluginData(
			KNOWN_PLUGIN_ID,
			owner.id,
			{ caseId: testCase.id },
			{ score: 0.6 }
		);
		await setPluginEnabledForUser(KNOWN_PLUGIN_ID, owner.id, {
			enabled: false,
		});
		await setPluginEnabledForUser(KNOWN_PLUGIN_ID, owner.id, { enabled: true });

		const read = expectSuccess(
			await readPluginData(KNOWN_PLUGIN_ID, owner.id, { caseId: testCase.id })
		);
		expect(read?.data).toEqual({ score: 0.6 });
	});

	it("refuses an unregistered plugin id even with full case permission", async () => {
		const { owner, testCase } = await setup();
		expectError(
			await readPluginData(UNKNOWN_PLUGIN_ID, owner.id, { caseId: testCase.id })
		);
	});
});
