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
 * Gets all descendant element IDs for MULTIPLE roots at once, using a single
 * breadth-first sweep shared across all of them. O(depth) queries total
 * instead of O(roots * depth) — the multi-root generalisation of
 * `getDescendantIds`, for callers (e.g. batch circular-reference validation)
 * that would otherwise call it once per element in a loop.
 *
 * Elements form a tree (single parent), so each visited node belongs to
 * exactly one root's subtree; ownership is tracked as the frontier expands.
 */
export async function getDescendantIdsForRoots(
	rootIds: string[],
	tx?: TxClient,
	options?: { includeDeleted?: boolean }
): Promise<Map<string, Set<string>>> {
	const db = tx ?? prisma;
	const result = new Map<string, Set<string>>(
		rootIds.map((id) => [id, new Set<string>()])
	);
	let frontierOwners = new Map<string, string>(rootIds.map((id) => [id, id]));

	while (frontierOwners.size > 0) {
		const frontierIds = [...frontierOwners.keys()];
		const children = await db.assuranceElement.findMany({
			where: {
				parentId: { in: frontierIds },
				...(options?.includeDeleted ? {} : { deletedAt: null }),
			},
			select: { id: true, parentId: true },
		});

		const nextFrontierOwners = new Map<string, string>();
		for (const child of children) {
			const owner = frontierOwners.get(child.parentId as string);
			if (!owner) {
				continue;
			}
			result.get(owner)?.add(child.id);
			nextFrontierOwners.set(child.id, owner);
		}
		frontierOwners = nextFrontierOwners;
	}

	return result;
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
