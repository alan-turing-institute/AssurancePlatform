import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	createElement,
	createElementWithin,
	deleteElement,
	deleteElementWithin,
	unlinkEvidenceWithin,
	updateElement,
	updateElementWithin,
} from "@/lib/services/element-service";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

class RolledBack extends Error {}

/** Runs `work` in a transaction that is then rolled back. */
async function rolledBack(
	work: (
		tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
	) => Promise<void>
) {
	await prisma
		.$transaction(async (tx) => {
			await work(tx);
			throw new RolledBack();
		})
		.catch((error: unknown) => {
			if (!(error instanceof RolledBack)) {
				throw error;
			}
		});
}

async function world() {
	const owner = await createTestUser();
	const kase = await createTestCase(owner.id);
	const goal = await createTestElement(kase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	const claim = await createTestElement(kase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: goal.id,
	});
	return { owner, kase, goal, claim };
}

function evidenceInput(
	w: Awaited<ReturnType<typeof world>>,
	description = "x"
) {
	return {
		caseId: w.kase.id,
		elementType: "EVIDENCE",
		description,
		parentId: w.claim.id,
	} as never;
}

describe("creating an element inside the caller's transaction", () => {
	it("counts the case's evidence through the transaction, so two creates in one transaction are E1 and E2", async () => {
		const w = await world();
		const names: string[] = [];
		await prisma.$transaction(async (tx) => {
			for (const description of ["a", "b"]) {
				const made = await createElementWithin(
					tx,
					w.owner.id,
					evidenceInput(w, description)
				);
				if ("error" in made) {
					throw new Error(made.error);
				}
				names.push(made.data.name ?? "");
			}
		});
		expect(names).toEqual(["E1", "E2"]);
	});

	it("leaves nothing behind when the caller's transaction is rolled back", async () => {
		const w = await world();
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: w.kase.id },
		});
		await rolledBack(async (tx) => {
			const made = await createElementWithin(tx, w.owner.id, evidenceInput(w));
			expect("data" in made).toBe(true);
		});
		expect(
			await prisma.assuranceElement.count({
				where: { caseId: w.kase.id, elementType: "EVIDENCE" },
			})
		).toBe(0);
		expect(
			await prisma.evidenceLink.count({ where: { claimId: w.claim.id } })
		).toBe(0);
		const after = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: w.kase.id },
		});
		expect(after.updatedAt).toEqual(before.updatedAt);
	});

	it("bumps the case's last-changed time when the transaction commits", async () => {
		const w = await world();
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: w.kase.id },
		});
		await new Promise((resolve) => setTimeout(resolve, 15));
		await prisma.$transaction((tx) =>
			createElementWithin(tx, w.owner.id, evidenceInput(w))
		);
		const after = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: w.kase.id },
		});
		expect(after.updatedAt.getTime()).toBeGreaterThan(
			before.updatedAt.getTime()
		);
	});

	it("gives the same answer as createElement for input the rules refuse", async () => {
		const w = await world();
		const other = await world();
		const refused = [
			{ caseId: w.kase.id, elementType: "NOT_A_TYPE", description: "x" },
			{
				caseId: w.kase.id,
				elementType: "EVIDENCE",
				description: "x",
				parentId: other.claim.id,
			},
			{
				caseId: w.kase.id,
				elementType: "EVIDENCE",
				description: "x",
				name: "X9",
				parentId: w.claim.id,
			},
			{
				caseId: w.kase.id,
				elementType: "GOAL",
				description: "a second goal",
			},
			{
				caseId: w.kase.id,
				elementType: "PROPERTY_CLAIM",
				description: "x",
				parentId: "00000000-0000-4000-8000-000000000001",
			},
			{
				caseId: w.kase.id,
				elementType: "EVIDENCE",
				description: "x",
				defeatsElementId: other.goal.id,
				isDefeater: true,
				parentId: w.claim.id,
			},
		] as never[];
		for (const input of refused) {
			const through = await createElement(w.owner.id, input);
			const within = await prisma.$transaction((tx) =>
				createElementWithin(tx, w.owner.id, input)
			);
			expect("error" in through).toBe(true);
			expect(within).toEqual(through);
		}
	});

	it("gives an accepted element the same stored shape as createElement", async () => {
		const w = await world();
		const through = await createElement(w.owner.id, evidenceInput(w, "one"));
		const within = await prisma.$transaction((tx) =>
			createElementWithin(tx, w.owner.id, evidenceInput(w, "two"))
		);
		if (!("data" in through && "data" in within)) {
			throw new Error("a create failed");
		}
		const strip = (data: Record<string, unknown>) => {
			const { id, name, description, createdDate, ...rest } = data;
			return rest;
		};
		expect(strip(within.data as never)).toEqual(strip(through.data as never));
		expect(through.data.name).toBe("E1");
		expect(within.data.name).toBe("E2");
	});
});

describe("changing and deleting inside the caller's transaction", () => {
	it("a rewritten description is rolled back with the transaction", async () => {
		const w = await world();
		const evidence = await createTestElement(w.kase.id, w.owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
			description: "before",
		});
		await rolledBack(async (tx) => {
			await updateElementWithin(tx, evidence.id, w.kase.id, {
				description: "after",
			});
		});
		const stored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: evidence.id },
		});
		expect(stored.description).toBe("before");
	});

	it("a rewritten description is stored, and the case's last-changed time moves, when it commits", async () => {
		const w = await world();
		const evidence = await createTestElement(w.kase.id, w.owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
			description: "before",
		});
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: w.kase.id },
		});
		await new Promise((resolve) => setTimeout(resolve, 15));
		await prisma.$transaction((tx) =>
			updateElementWithin(tx, evidence.id, w.kase.id, { description: "after" })
		);
		expect(
			(
				await prisma.assuranceElement.findUniqueOrThrow({
					where: { id: evidence.id },
				})
			).description
		).toBe("after");
		expect(
			(
				await prisma.assuranceCase.findUniqueOrThrow({
					where: { id: w.kase.id },
				})
			).updatedAt.getTime()
		).toBeGreaterThan(before.updatedAt.getTime());
	});

	it("an evidence link taken away is put back when the transaction is rolled back, and the node itself is untouched either way", async () => {
		const w = await world();
		const evidence = await createTestElement(w.kase.id, w.owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
			description: "kept",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: evidence.id, claimId: w.claim.id },
		});
		await rolledBack(async (tx) => {
			await unlinkEvidenceWithin(tx, evidence.id, w.claim.id, w.kase.id);
		});
		expect(
			await prisma.evidenceLink.count({ where: { evidenceId: evidence.id } })
		).toBe(1);

		await prisma.$transaction((tx) =>
			unlinkEvidenceWithin(tx, evidence.id, w.claim.id, w.kase.id)
		);
		expect(
			await prisma.evidenceLink.count({ where: { evidenceId: evidence.id } })
		).toBe(0);
		const stored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: evidence.id },
		});
		expect(stored.deletedAt).toBeNull();
		expect(stored.description).toBe("kept");
	});

	it("a deletion is rolled back with the transaction, descendants included", async () => {
		const w = await world();
		const child = await createTestElement(w.kase.id, w.owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1.1",
			parentId: w.claim.id,
		});
		await rolledBack(async (tx) => {
			await deleteElementWithin(tx, w.owner.id, w.claim.id, w.kase.id);
		});
		for (const id of [w.claim.id, child.id]) {
			expect(
				(await prisma.assuranceElement.findUniqueOrThrow({ where: { id } }))
					.deletedAt
			).toBeNull();
		}
	});

	it("a committed deletion trashes the element and its descendants, naming who deleted them, as deleteElement does", async () => {
		const w = await world();
		const child = await createTestElement(w.kase.id, w.owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1.1",
			parentId: w.claim.id,
		});
		const sibling = await createTestElement(w.kase.id, w.owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: w.goal.id,
		});
		const siblingChild = await createTestElement(w.kase.id, w.owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P2.1",
			parentId: sibling.id,
		});
		await prisma.$transaction((tx) =>
			deleteElementWithin(tx, w.owner.id, w.claim.id, w.kase.id)
		);
		const through = await deleteElement(w.owner.id, sibling.id);
		expect("data" in through).toBe(true);
		for (const id of [w.claim.id, child.id, sibling.id, siblingChild.id]) {
			const row = await prisma.assuranceElement.findUniqueOrThrow({
				where: { id },
			});
			expect(row.deletedAt).not.toBeNull();
			expect(row.deletedById).toBe(w.owner.id);
		}
	});
});

describe("the ordinary callers behave as before", () => {
	it("createElement still refuses a person without EDIT and writes nothing", async () => {
		const w = await world();
		const stranger = await createTestUser();
		const result = await createElement(stranger.id, evidenceInput(w));
		expect(result).toEqual({ error: "Permission denied" });
		expect(
			await prisma.assuranceElement.count({
				where: { caseId: w.kase.id, elementType: "EVIDENCE" },
			})
		).toBe(0);
	});

	it("deleteElement still answers 'Element not found' to a person without EDIT and deletes nothing", async () => {
		const w = await world();
		const stranger = await createTestUser();
		expect(await deleteElement(stranger.id, w.claim.id)).toEqual({
			error: "Element not found",
		});
		expect(
			(
				await prisma.assuranceElement.findUniqueOrThrow({
					where: { id: w.claim.id },
				})
			).deletedAt
		).toBeNull();
	});

	it("updateElement still rewrites a description for a person with EDIT", async () => {
		const w = await world();
		const result = await updateElement(w.owner.id, w.claim.id, {
			description: "A new text",
		} as never);
		expect("data" in result).toBe(true);
		expect(
			(
				await prisma.assuranceElement.findUniqueOrThrow({
					where: { id: w.claim.id },
				})
			).description
		).toBe("A new text");
	});
});
