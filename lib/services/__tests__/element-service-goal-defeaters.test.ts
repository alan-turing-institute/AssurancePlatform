import { describe, expect, it, vi } from "vitest";
import type { TxClient } from "@/lib/utils/tree-traversal";
import { createElementWithin } from "../element-service";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

function database(existingGoalIsDefeater: boolean) {
	const findFirst = vi.fn().mockImplementation(({ where }) => {
		if (where.id) {
			return { id: where.id, caseId: "case", deletedAt: null };
		}
		return existingGoalIsDefeater && where.isDefeater === false
			? null
			: { id: "existing" };
	});
	const create = vi.fn().mockImplementation(({ data }) => ({
		...data,
		id: "new-goal",
		createdAt: new Date("2026-01-01"),
		inSandbox: false,
		level: null,
	}));
	const db = {
		assuranceElement: {
			findFirst,
			count: vi.fn().mockResolvedValue(0),
			create,
		},
		assuranceCase: { update: vi.fn().mockResolvedValue({}) },
	};
	return { tx: db as unknown as TxClient, findFirst, create };
}

describe("goal uniqueness and defeaters", () => {
	it("accepts a GOAL defeater while a top goal exists", async () => {
		const { tx, findFirst, create } = database(false);
		const result = await createElementWithin(tx, "user", {
			caseId: "case",
			elementType: "goal",
			isDefeater: true,
			parentId: "existing",
			defeatsElementId: "existing",
		});

		expect(result).toMatchObject({ data: { name: "CG1", isDefeater: true } });
		expect(create).toHaveBeenCalledOnce();
		expect(findFirst).not.toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ elementType: "GOAL" }),
			})
		);
	});

	it("refuses a second plain GOAL", async () => {
		const { tx, create } = database(false);
		expect(
			await createElementWithin(tx, "user", {
				caseId: "case",
				elementType: "goal",
			})
		).toEqual({ error: "A case can only have one goal claim" });
		expect(create).not.toHaveBeenCalled();
	});

	it("accepts a plain top goal when only a defeater goal exists", async () => {
		const { tx, findFirst } = database(true);
		expect(
			await createElementWithin(tx, "user", {
				caseId: "case",
				elementType: "goal",
			})
		).toMatchObject({ data: { name: "G1" } });
		expect(findFirst).toHaveBeenCalledWith({
			where: {
				caseId: "case",
				elementType: "GOAL",
				isDefeater: false,
				deletedAt: null,
			},
			select: { id: true },
		});
	});
});
