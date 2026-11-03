import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublishedItems } from "@/actions/discover";
import prisma from "@/lib/prisma";
import { restoreCase, softDeleteCase } from "@/lib/services/case-trash-service";
import {
	getPublishedItemBySlug,
	getPublishedItems,
} from "@/lib/services/discover-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import { seedPlaceholderClaim } from "../utils/placeholder-kit";
import { createTestComment, createTestUser } from "../utils/prisma-factories";
import {
	KINDS,
	type Kind,
	openCase,
	publishedRows,
	TYPE_FOR_KIND,
} from "../utils/publish-type-kit";
import { ref, SYS, setText, variableWorld } from "../utils/variables-kit";

/**
 * What the public reads return for a published case and a published pattern:
 * the Discover list, the item by slug and `/api/public/discover/[slug]`. The
 * type is the stored type, content comes through whole, nothing private rides
 * along, and archived rows behave as they did.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

const HINT = "Say what this claim asserts about the system";

/** Fields a list entry may have, and the fields an item by slug may have. */
const SUMMARY_KEYS = [
	"archivedAt",
	"authors",
	"description",
	"featureImageUrl",
	"id",
	"publishedAt",
	"sector",
	"slug",
	"title",
	"type",
];
const DETAIL_KEYS = [...SUMMARY_KEYS, "content"].sort();

async function getItem(slug: string) {
	const { GET } = await import("@/app/api/public/discover/[slug]/route");
	return await GET(
		new NextRequest(`http://localhost:3000/api/public/discover/${slug}`),
		{ params: Promise.resolve({ slug }) }
	);
}

/** Every object anywhere inside a value that the test accepts. */
function collect(
	value: unknown,
	accept: (node: Record<string, unknown>) => boolean,
	found: Record<string, unknown>[] = []
): Record<string, unknown>[] {
	if (Array.isArray(value)) {
		for (const entry of value) {
			collect(entry, accept, found);
		}
	} else if (value !== null && typeof value === "object") {
		const node = value as Record<string, unknown>;
		if (accept(node)) {
			found.push(node);
		}
		for (const entry of Object.values(node)) {
			collect(entry, accept, found);
		}
	}
	return found;
}

/** A published pattern whose argument holds a placeholder with a hint and a variable with no value. */
async function publishedPattern() {
	const world = await variableWorld("PATTERN");
	await setText(world.strategyId, {
		description: `Argue over ${ref("system", SYS)}`,
	});
	await seedPlaceholderClaim(world, { name: "P9", placeholderHint: HINT });
	expectSuccess(await publishAssuranceCase(world.ownerId, world.caseId));
	const [row] = await publishedRows(world.caseId);
	if (!row) {
		throw new Error("the pattern was not published");
	}
	return { ...world, slug: row.slug, rowId: row.id };
}

async function publishedOf(kind: Kind) {
	const open = await openCase(kind, { withInformation: true });
	expectSuccess(await publishAssuranceCase(open.ownerId, open.caseId));
	const [row] = await publishedRows(open.caseId);
	if (!row) {
		throw new Error("nothing was published");
	}
	return { ...open, slug: row.slug, rowId: row.id };
}

describe("the public reads of a published pattern", () => {
	it("pass the type through in the list, the item by slug and the public API", async () => {
		const pattern = await publishedPattern();
		const published = await publishedOf("CASE");

		const list = expectSuccess(await getPublishedItems());
		const bySlug = expectSuccess(await getPublishedItemBySlug(pattern.slug));
		const response = await getItem(pattern.slug);

		expect(
			Object.fromEntries(list.map((item) => [item.slug, item.type]))
		).toEqual({
			[pattern.slug]: "ARGUMENT_PATTERN",
			[published.slug]: "ASSURANCE_CASE",
		});
		expect(bySlug.type).toBe("ARGUMENT_PATTERN");
		expect(response.status).toBe(200);
		expect((await response.json()).type).toBe("ARGUMENT_PATTERN");
	});

	it("keep its placeholders, their hints and its variables in the content, whole", async () => {
		const pattern = await publishedPattern();
		const stored = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: pattern.rowId },
		});

		const body = await (await getItem(pattern.slug)).json();
		const viaService = expectSuccess(
			await getPublishedItemBySlug(pattern.slug)
		);

		for (const content of [body.content, viaService.content]) {
			const placeholders = collect(
				content,
				(node) => node.isPlaceholder === true
			);
			expect(placeholders.map((node) => node.placeholderHint)).toEqual([HINT]);
			const variables = collect(
				content,
				(node) => node.variable === true && node.name === "system"
			);
			expect(variables).toHaveLength(1);
			expect(variables[0]).not.toHaveProperty("value");
			expect(JSON.stringify(content)).toContain(ref("system", SYS));
			expect((content as { case: { kind: string } }).case.kind).toBe("PATTERN");
		}
		expect(body.content.tree).toEqual(
			(stored.content as { tree: unknown }).tree
		);
	});

	it("return exactly the public fields for a pattern and for a case", async () => {
		const pattern = await publishedPattern();
		const published = await publishedOf("CASE");

		const list = await fetchPublishedItems();
		for (const item of list) {
			expect(Object.keys(item).sort()).toEqual([...SUMMARY_KEYS].sort());
		}
		for (const slug of [pattern.slug, published.slug]) {
			const body = await (await getItem(slug)).json();
			expect(Object.keys(body).sort()).toEqual(DETAIL_KEYS);
		}
	});

	it.each(
		KINDS
	)("carry nothing private of a published %s: no owner, case id, archive owner or comment", async (kind) => {
		const open = await openCase(kind, { withInformation: true });
		const owner = await prisma.user.findUniqueOrThrow({
			where: { id: open.ownerId },
		});
		const commenter = await createTestUser();
		await createTestComment(commenter.id, {
			caseId: open.caseId,
			content: "A private remark about the owner's plans",
		});
		expectSuccess(await publishAssuranceCase(open.ownerId, open.caseId));
		expectSuccess(
			await softDeleteCase(open.ownerId, open.caseId, {
				publishedCopy: "archive",
			})
		);
		const [row] = await publishedRows(open.caseId);
		expect(row?.archivedOwnerId).toBe(open.ownerId);

		const body = await (await getItem(row?.slug ?? "")).json();
		const list = await fetchPublishedItems();
		const everything = JSON.stringify([body, list]);

		expect(Object.keys(body).sort()).toEqual(DETAIL_KEYS);
		for (const secret of [
			open.ownerId,
			open.caseId,
			owner.email,
			commenter.email,
			commenter.username,
			"A private remark about the owner's plans",
			"assuranceCaseId",
			"archivedOwnerId",
			"isCurrent",
		]) {
			expect(everything).not.toContain(secret);
		}
	});

	it("serve a stored type as it is, whatever the live case's kind is now", async () => {
		const asCase = await publishedOf("CASE");
		const asPattern = await publishedOf("PATTERN");
		await prisma.publishedAssuranceCase.update({
			where: { id: asCase.rowId },
			data: { type: "ARGUMENT_PATTERN" },
		});
		await prisma.publishedAssuranceCase.update({
			where: { id: asPattern.rowId },
			data: { type: "ASSURANCE_CASE" },
		});

		expect((await (await getItem(asCase.slug)).json()).type).toBe(
			"ARGUMENT_PATTERN"
		);
		expect((await (await getItem(asPattern.slug)).json()).type).toBe(
			"ASSURANCE_CASE"
		);
		const list = expectSuccess(await getPublishedItems());
		expect(
			Object.fromEntries(list.map((item) => [item.slug, item.type]))
		).toEqual({
			[asCase.slug]: "ARGUMENT_PATTERN",
			[asPattern.slug]: "ASSURANCE_CASE",
		});
	});
});

describe.each(
	KINDS
)("the public reads after a %s is republished, unpublished or archived", (kind) => {
	const type = TYPE_FOR_KIND[kind];

	it("list one entry for the case, the latest, with the type, after an update", async () => {
		const { caseId, ownerId, slug } = await publishedOf(kind);
		const [first] = await publishedRows(caseId);
		expectSuccess(await updatePublishedCase(ownerId, caseId));

		const list = expectSuccess(await getPublishedItems());

		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ slug, type });
		expect(list[0]?.id).not.toBe(first?.id);
		const body = await (await getItem(slug)).json();
		expect(body).toMatchObject({ id: list[0]?.id, type });
	});

	it("leave nothing to read after an unpublish, and list it again with the type after a publish", async () => {
		const { caseId, ownerId, slug } = await publishedOf(kind);
		expectSuccess(await unpublishAssuranceCase(ownerId, caseId));

		expect(expectSuccess(await getPublishedItems())).toHaveLength(0);
		expect((await getItem(slug)).status).toBe(404);

		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		const list = expectSuccess(await getPublishedItems());
		expect(list.map((item) => item.type)).toEqual([type]);
		expect((await (await getItem(list[0]?.slug ?? "")).json()).type).toBe(type);
	});

	it("still list and serve an archived copy with its type and archive date, and drop the date on a restore", async () => {
		const { caseId, ownerId, slug } = await publishedOf(kind);
		expectSuccess(
			await softDeleteCase(ownerId, caseId, { publishedCopy: "archive" })
		);

		const list = expectSuccess(await getPublishedItems());
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ slug, type });
		expect(list[0]?.archivedAt).toBeInstanceOf(Date);
		const archived = await (await getItem(slug)).json();
		expect(archived.type).toBe(type);
		expect(typeof archived.archivedAt).toBe("string");

		expectSuccess(await restoreCase(ownerId, caseId));
		const restored = await (await getItem(slug)).json();
		expect(restored).toMatchObject({ type, archivedAt: null });
	});

	it("stop listing a copy that was removed with its case", async () => {
		const { caseId, ownerId, slug } = await publishedOf(kind);
		expectSuccess(await softDeleteCase(ownerId, caseId));

		expect(expectSuccess(await getPublishedItems())).toHaveLength(0);
		expect((await getItem(slug)).status).toBe(404);
	});
});
