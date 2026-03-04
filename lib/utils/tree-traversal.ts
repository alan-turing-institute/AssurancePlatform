import { prisma } from "@/lib/prisma";

/** Prisma transaction client type for passing to helpers */
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Gets all descendant element IDs for a given parent using breadth-first batching.
 * O(depth) queries instead of O(n). By default excludes deleted elements.
 */
export async function getDescendantIds(
	parentId: string,
	tx?: TxClient,
	options?: { includeDeleted?: boolean }
): Promise<string[]> {
	const db = tx ?? prisma;
	const allIds: string[] = [];
	let frontier = [parentId];

	while (frontier.length > 0) {
		const children = await db.assuranceElement.findMany({
			where: {
				parentId: { in: frontier },
				...(options?.includeDeleted ? {} : { deletedAt: null }),
			},
			select: { id: true },
		});
		const childIds = children.map((c) => c.id);
		allIds.push(...childIds);
		frontier = childIds;
	}

	return allIds;
}

/**
 * Gets all soft-deleted descendant element IDs for restore operation using breadth-first batching.
 * O(depth) queries instead of O(n).
 */
export async function getDeletedDescendantIds(
	parentId: string,
	tx?: TxClient
): Promise<string[]> {
	const db = tx ?? prisma;
	const allIds: string[] = [];
	let frontier = [parentId];

	while (frontier.length > 0) {
		const children = await db.assuranceElement.findMany({
			where: { parentId: { in: frontier }, deletedAt: { not: null } },
			select: { id: true },
		});
		const childIds = children.map((c) => c.id);
		allIds.push(...childIds);
		frontier = childIds;
	}

	return allIds;
}
