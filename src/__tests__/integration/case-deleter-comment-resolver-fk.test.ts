/**
 * Foreign-key behaviour for the two constraints added by
 * `prisma/migrations/20260923000000_reconcile_schema_drift`
 * (AP-QA-004): `assurance_cases.deleted_by_id` -> users and
 * `comments.resolved_by_id` -> users.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/** See extension-foundations.test.ts for the source of this helper's pattern. */
async function expectPrismaErrorCode(
	promise: Promise<unknown>,
	code: "P2002" | "P2003"
): Promise<void> {
	const error = await promise.catch((caught: unknown) => caught);
	// biome-ignore lint/suspicious/noMisplacedAssertion: helper called from within it() blocks
	expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
	// biome-ignore lint/suspicious/noMisplacedAssertion: helper called from within it() blocks
	expect((error as Prisma.PrismaClientKnownRequestError).code).toBe(code);
}

describe("assurance_cases.deleted_by_id foreign key", () => {
	it("is set NULL when the deleting user is deleted", async () => {
		const creator = await createTestUser();
		const deleter = await createTestUser();
		const testCase = await createTestCase(creator.id);
		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: { deletedAt: new Date(), deletedById: deleter.id },
		});

		await prisma.user.delete({ where: { id: deleter.id } });

		const inDb = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
		});
		expect(inDb?.deletedById).toBeNull();
	});

	it("rejects a deletedById that does not reference an existing user", async () => {
		const creator = await createTestUser();

		await expectPrismaErrorCode(
			prisma.assuranceCase.create({
				data: {
					name: "Case with bogus deleter",
					description: "desc",
					createdById: creator.id,
					deletedAt: new Date(),
					deletedById: randomUUID(),
				},
			}),
			"P2003"
		);
	});
});

describe("comments.resolved_by_id foreign key", () => {
	it("is set NULL when the resolving user is deleted", async () => {
		const author = await createTestUser();
		const resolver = await createTestUser();
		const comment = await prisma.comment.create({
			data: { content: "needs a look", authorId: author.id },
		});
		await prisma.comment.update({
			where: { id: comment.id },
			data: {
				resolved: true,
				resolvedById: resolver.id,
				resolvedAt: new Date(),
			},
		});

		await prisma.user.delete({ where: { id: resolver.id } });

		const inDb = await prisma.comment.findUnique({ where: { id: comment.id } });
		expect(inDb?.resolvedById).toBeNull();
	});

	it("rejects a resolvedById that does not reference an existing user", async () => {
		const author = await createTestUser();

		await expectPrismaErrorCode(
			prisma.comment.create({
				data: {
					content: "needs a look",
					authorId: author.id,
					resolved: true,
					resolvedById: randomUUID(),
					resolvedAt: new Date(),
				},
			}),
			"P2003"
		);
	});
});
