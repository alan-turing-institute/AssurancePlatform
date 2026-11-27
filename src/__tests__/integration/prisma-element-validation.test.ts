import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

const FAILED_PATTERN = /^Element validation failed for /;
const MODULE_FAILED_PATTERN = /^Element validation failed for MODULE: /;
const REF_THEN_EMBED_PATTERN = /moduleReferenceId: [^\n]*, moduleEmbedType: /;

afterEach(() => {
	vi.unstubAllEnvs();
});

async function seed() {
	const user = await createTestUser();
	const theCase = await createTestCase(user.id);
	return { createdById: user.id, caseId: theCase.id };
}

async function stored(id: string) {
	return await prisma.assuranceElement.findUniqueOrThrow({ where: { id } });
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
	try {
		await promise;
	} catch (error) {
		return error as Error;
	}
	throw new Error("expected the write to be refused");
}

// ---------------------------------------------------------------- create

describe("element write check: create", () => {
	it("stores a valid element's own fields", async () => {
		const { caseId, createdById } = await seed();

		const row = await prisma.assuranceElement.create({
			data: {
				caseId,
				createdById,
				elementType: "PROPERTY_CLAIM",
				name: "P1",
				description: "A claim",
				level: 2,
				justification: "Because",
				assumption: "Given",
				context: ["one note"],
			},
		});

		const back = await stored(row.id);
		expect(back.elementType).toBe("PROPERTY_CLAIM");
		expect(back.level).toBe(2);
		expect(back.justification).toBe("Because");
		expect(back.assumption).toBe("Given");
		expect(back.context).toStrictEqual(["one note"]);
	});

	it("keeps the evidence address fields on evidence", async () => {
		const { caseId, createdById } = await seed();

		const row = await prisma.assuranceElement.create({
			data: {
				caseId,
				createdById,
				elementType: "EVIDENCE",
				description: "A report",
				url: "https://example.org/a",
				urls: ["https://example.org/a", "https://example.org/b"],
			},
		});

		const back = await stored(row.id);
		expect(back.url).toBe("https://example.org/a");
		expect(back.urls).toStrictEqual([
			"https://example.org/a",
			"https://example.org/b",
		]);
	});

	it("drops fields that do not belong to a goal", async () => {
		const { caseId, createdById } = await seed();
		const other = await createTestCase(createdById);

		const row = await prisma.assuranceElement.create({
			data: {
				caseId,
				createdById,
				elementType: "GOAL",
				description: "A goal",
				url: "https://example.org/x",
				urls: ["https://example.org/x"],
				level: 3,
				moduleReferenceId: other.id,
				moduleEmbedType: "COPY",
				modulePublicSummary: "summary",
				role: "TOP_LEVEL",
				justification: "kept for goals",
			},
		});

		const back = await stored(row.id);
		expect(back.url).toBeNull();
		expect(back.urls).toStrictEqual([]);
		expect(back.level).toBeNull();
		expect(back.moduleReferenceId).toBeNull();
		expect(back.moduleEmbedType).toBeNull();
		expect(back.modulePublicSummary).toBeNull();
		expect(back.role).toBe("TOP_LEVEL");
		expect(back.justification).toBe("kept for goals");
	});

	it("drops fields that do not belong to evidence", async () => {
		const { caseId, createdById } = await seed();

		const row = await prisma.assuranceElement.create({
			data: {
				caseId,
				createdById,
				elementType: "EVIDENCE",
				description: "A report",
				justification: "not for evidence",
				assumption: "not for evidence",
				context: ["not for evidence"],
				level: 1,
				role: "SUPPORTING",
			},
		});

		const back = await stored(row.id);
		expect(back.justification).toBeNull();
		expect(back.assumption).toBeNull();
		expect(back.context).toStrictEqual([]);
		expect(back.level).toBeNull();
		expect(back.role).toBeNull();
	});

	it("keeps the module fields on a module and an away goal's reference", async () => {
		const { caseId, createdById } = await seed();
		const target = await createTestCase(createdById);

		const mod = await prisma.assuranceElement.create({
			data: {
				caseId,
				createdById,
				elementType: "MODULE",
				description: "A module",
				moduleReferenceId: target.id,
				moduleEmbedType: "REFERENCE",
				modulePublicSummary: "public",
			},
		});
		const away = await prisma.assuranceElement.create({
			data: {
				caseId,
				createdById,
				elementType: "AWAY_GOAL",
				description: "An away goal",
				moduleReferenceId: target.id,
				moduleEmbedType: "COPY",
			},
		});

		const backModule = await stored(mod.id);
		expect(backModule.moduleReferenceId).toBe(target.id);
		expect(backModule.moduleEmbedType).toBe("REFERENCE");
		expect(backModule.modulePublicSummary).toBe("public");
		const backAway = await stored(away.id);
		expect(backAway.moduleReferenceId).toBe(target.id);
		expect(backAway.moduleEmbedType).toBeNull();
	});

	const REFUSED: [string, Record<string, unknown>, string][] = [
		[
			"a module with no reference or embed type",
			{ elementType: "MODULE" },
			"moduleReferenceId",
		],
		[
			"an away goal with no reference",
			{ elementType: "AWAY_GOAL" },
			"moduleReferenceId",
		],
		[
			"a claim at level zero",
			{ elementType: "PROPERTY_CLAIM", level: 0 },
			"level",
		],
		[
			"an element that defeats something with an id that is not an id",
			{ elementType: "GOAL", defeatsElementId: "not-an-id" },
			"defeatsElementId",
		],
		[
			"an element with no description",
			{ elementType: "GOAL", description: undefined },
			"description",
		],
	];

	it.each(
		REFUSED
	)("refuses %s and stores nothing", async (_label, extra, field) => {
		const { caseId, createdById } = await seed();
		const data = { caseId, createdById, description: "text", ...extra };

		const error = await rejection(
			prisma.assuranceElement.create({
				data: data as unknown as Prisma.AssuranceElementUncheckedCreateInput,
			})
		);

		expect(error).toBeInstanceOf(Error);
		expect(error).not.toBeInstanceOf(Prisma.PrismaClientValidationError);
		expect(error.message).toMatch(FAILED_PATTERN);
		expect(error.message).toContain(`${field}: `);
		expect(error.message).toContain(String(extra.elementType));
		expect(await prisma.assuranceElement.count()).toBe(0);
	});

	it("lists every failing field, separated by a comma and a space", async () => {
		const { caseId, createdById } = await seed();

		const error = await rejection(
			prisma.assuranceElement.create({
				data: { caseId, createdById, elementType: "MODULE", description: "d" },
			})
		);

		expect(error.message).toMatch(MODULE_FAILED_PATTERN);
		expect(error.message).toMatch(REF_THEN_EMBED_PATTERN);
	});

	it("accepts a claim at level one", async () => {
		const { caseId, createdById } = await seed();

		const row = await prisma.assuranceElement.create({
			data: {
				caseId,
				createdById,
				elementType: "PROPERTY_CLAIM",
				description: "text",
				level: 1,
			},
		});

		expect((await stored(row.id)).level).toBe(1);
	});

	it("leaves a write that has no element type to the database's own refusal", async () => {
		const { caseId, createdById } = await seed();

		const error = await rejection(
			prisma.assuranceElement.create({
				data: {
					caseId,
					createdById,
					description: "no type",
				} as unknown as Prisma.AssuranceElementUncheckedCreateInput,
			})
		);

		expect(error).toBeInstanceOf(Prisma.PrismaClientValidationError);
		expect(error.message).not.toMatch(FAILED_PATTERN);
	});
});

describe("element write check: create with the check switched off", () => {
	it("stores an invalid element and its unrelated fields unchanged", async () => {
		vi.stubEnv("SKIP_ELEMENT_VALIDATION", "true");
		const { caseId, createdById } = await seed();

		const invalid = await prisma.assuranceElement.create({
			data: { caseId, createdById, elementType: "MODULE", description: "d" },
		});
		const unclean = await prisma.assuranceElement.create({
			data: {
				caseId,
				createdById,
				elementType: "GOAL",
				description: "d",
				url: "https://example.org/kept",
			},
		});

		expect((await stored(invalid.id)).elementType).toBe("MODULE");
		expect((await stored(unclean.id)).url).toBe("https://example.org/kept");
	});

	it.each([
		"",
		"false",
		"TRUE",
		"1",
	])("still checks when the setting is %j", async (value) => {
		vi.stubEnv("SKIP_ELEMENT_VALIDATION", value);
		const { caseId, createdById } = await seed();

		const error = await rejection(
			prisma.assuranceElement.create({
				data: { caseId, createdById, elementType: "MODULE", description: "d" },
			})
		);

		expect(error.message).toMatch(MODULE_FAILED_PATTERN);
	});
});

// ---------------------------------------------------------------- update

describe("element write check: update", () => {
	it("keeps the fields that belong to the element type named in the update", async () => {
		const { caseId, createdById } = await seed();
		const evidence = await createTestElement(caseId, createdById, {
			elementType: "EVIDENCE",
		});

		await prisma.assuranceElement.update({
			where: { id: evidence.id },
			data: {
				elementType: "EVIDENCE",
				url: "https://example.org/new",
				urls: ["https://example.org/new"],
				description: "changed",
			},
		});

		const back = await stored(evidence.id);
		expect(back.url).toBe("https://example.org/new");
		expect(back.urls).toStrictEqual(["https://example.org/new"]);
		expect(back.description).toBe("changed");
	});

	it("drops fields that do not belong to the element type named in the update", async () => {
		const { caseId, createdById } = await seed();
		const goal = await createTestElement(caseId, createdById, {
			elementType: "GOAL",
		});

		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: {
				elementType: "GOAL",
				url: "https://example.org/x",
				level: 4,
				description: "changed",
			},
		});

		const back = await stored(goal.id);
		expect(back.url).toBeNull();
		expect(back.level).toBeNull();
		expect(back.description).toBe("changed");
	});

	it("stores a change to a field of the element's own type when the update names no element type", async () => {
		const { caseId, createdById } = await seed();
		const evidence = await createTestElement(caseId, createdById, {
			elementType: "EVIDENCE",
		});

		await prisma.assuranceElement.update({
			where: { id: evidence.id },
			data: { description: "only this", url: "https://example.org/sent" },
		});

		const back = await stored(evidence.id);
		expect(back.description).toBe("only this");
		expect(back.url).toBe("https://example.org/sent");
	});

	it("does not clean when the check is switched off", async () => {
		vi.stubEnv("SKIP_ELEMENT_VALIDATION", "true");
		const { caseId, createdById } = await seed();
		const goal = await createTestElement(caseId, createdById, {
			elementType: "GOAL",
		});

		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: { elementType: "GOAL", url: "https://example.org/kept" },
		});

		expect((await stored(goal.id)).url).toBe("https://example.org/kept");
	});

	it.each([
		"",
		"false",
		"TRUE",
	])("still cleans when the setting is %j", async (value) => {
		vi.stubEnv("SKIP_ELEMENT_VALIDATION", value);
		const { caseId, createdById } = await seed();
		const goal = await createTestElement(caseId, createdById, {
			elementType: "GOAL",
		});

		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: { elementType: "GOAL", url: "https://example.org/dropped" },
		});

		expect((await stored(goal.id)).url).toBeNull();
	});
});

// ---------------------------------------------------------------- upsert

describe("element write check: upsert", () => {
	it("checks and cleans the create side when no row exists", async () => {
		const { caseId, createdById } = await seed();
		const id = randomUUID();

		await prisma.assuranceElement.upsert({
			where: { id },
			create: {
				id,
				caseId,
				createdById,
				elementType: "GOAL",
				description: "new",
				url: "https://example.org/dropped",
			},
			update: { description: "unused" },
		});

		const back = await stored(id);
		expect(back.description).toBe("new");
		expect(back.url).toBeNull();
	});

	it("refuses an invalid create side and stores nothing", async () => {
		const { caseId, createdById } = await seed();
		const id = randomUUID();

		const error = await rejection(
			prisma.assuranceElement.upsert({
				where: { id },
				create: {
					id,
					caseId,
					createdById,
					elementType: "MODULE",
					description: "d",
				},
				update: { description: "unused" },
			})
		);

		expect(error.message).toMatch(MODULE_FAILED_PATTERN);
		expect(await prisma.assuranceElement.count()).toBe(0);
	});

	it("cleans the update side when the row exists", async () => {
		const { caseId, createdById } = await seed();
		const goal = await createTestElement(caseId, createdById, {
			elementType: "GOAL",
		});

		await prisma.assuranceElement.upsert({
			where: { id: goal.id },
			create: {
				caseId,
				createdById,
				elementType: "GOAL",
				description: "unused",
			},
			update: {
				elementType: "GOAL",
				description: "updated",
				url: "https://example.org/dropped",
			},
		});

		const back = await stored(goal.id);
		expect(back.description).toBe("updated");
		expect(back.url).toBeNull();
	});

	it("keeps the update side's own fields when the row exists", async () => {
		const { caseId, createdById } = await seed();
		const evidence = await createTestElement(caseId, createdById, {
			elementType: "EVIDENCE",
		});

		await prisma.assuranceElement.upsert({
			where: { id: evidence.id },
			create: {
				caseId,
				createdById,
				elementType: "EVIDENCE",
				description: "unused",
			},
			update: { elementType: "EVIDENCE", url: "https://example.org/kept" },
		});

		expect((await stored(evidence.id)).url).toBe("https://example.org/kept");
	});

	it("does not check or clean when the check is switched off", async () => {
		vi.stubEnv("SKIP_ELEMENT_VALIDATION", "true");
		const { caseId, createdById } = await seed();
		const id = randomUUID();

		await prisma.assuranceElement.upsert({
			where: { id },
			create: {
				id,
				caseId,
				createdById,
				elementType: "MODULE",
				description: "d",
			},
			update: {},
		});
		await prisma.assuranceElement.upsert({
			where: { id },
			create: { caseId, createdById, elementType: "MODULE", description: "d" },
			update: { elementType: "MODULE", url: "https://example.org/kept" },
		});

		expect((await stored(id)).url).toBe("https://example.org/kept");
	});
});
