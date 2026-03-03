import { prisma } from "@/lib/prisma";

/** Prisma transaction client type for passing to helpers */
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Recursively gets all descendant element IDs for a given parent (excludes deleted)
 */
export async function getDescendantIds(
	parentId: string,
	tx?: TxClient
): Promise<string[]> {
	const db = tx ?? prisma;
	const children = await db.assuranceElement.findMany({
		where: { parentId, deletedAt: null },
		select: { id: true },
	});

	const descendantIds: string[] = [];
	for (const child of children) {
		descendantIds.push(child.id);
		const grandchildren = await getDescendantIds(child.id, tx);
		descendantIds.push(...grandchildren);
	}

	return descendantIds;
}

/**
 * Recursively gets all soft-deleted descendant element IDs for restore operation
 */
export async function getDeletedDescendantIds(
	parentId: string,
	tx?: TxClient
): Promise<string[]> {
	const db = tx ?? prisma;
	const children = await db.assuranceElement.findMany({
		where: { parentId, deletedAt: { not: null } },
		select: { id: true },
	});

	const descendantIds: string[] = [];
	for (const child of children) {
		descendantIds.push(child.id);
		const grandchildren = await getDeletedDescendantIds(child.id, tx);
		descendantIds.push(...grandchildren);
	}

	return descendantIds;
}
