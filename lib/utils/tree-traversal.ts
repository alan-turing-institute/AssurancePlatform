import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = logger.child({ component: "tree-traversal" });

const LOOP_WARNING = "Element tree loop met";

/** Prisma transaction client type for passing to helpers */
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Gets all descendant element IDs for a given parent using breadth-first batching.
 * O(depth) queries instead of O(n). By default excludes deleted elements.
 * Each element is returned once and the parent is never returned, so a stored
 * parent loop ends the walk instead of repeating it.
 */
export async function getDescendantIds(
	parentId: string,
	tx?: TxClient,
	options?: { includeDeleted?: boolean }
): Promise<string[]> {
	const db = tx ?? prisma;
	const allIds: string[] = [];
	const seen = new Set<string>([parentId]);
	let loopMet = false;
	let frontier = [parentId];

	while (frontier.length > 0) {
		const children = await db.assuranceElement.findMany({
			where: {
				parentId: { in: frontier },
				...(options?.includeDeleted ? {} : { deletedAt: null }),
			},
			select: { id: true },
		});
		const childIds: string[] = [];
		for (const child of children) {
			if (seen.has(child.id)) {
				loopMet = true;
				continue;
			}
			seen.add(child.id);
			childIds.push(child.id);
		}
		allIds.push(...childIds);
		frontier = childIds;
	}

	if (loopMet) {
		log.warn(LOOP_WARNING, { rootId: parentId });
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
 * A child that is its owner root, or already in the owner's set, ends that
 * branch of the walk.
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
	const loopRoots = new Set<string>();
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
			const owned = result.get(owner);
			if (child.id === owner || owned?.has(child.id)) {
				loopRoots.add(owner);
				continue;
			}
			owned?.add(child.id);
			nextFrontierOwners.set(child.id, owner);
		}
		frontierOwners = nextFrontierOwners;
	}

	if (loopRoots.size > 0) {
		log.warn(LOOP_WARNING, { rootIds: [...loopRoots] });
	}
	return result;
}

/**
 * Gets all soft-deleted descendant element IDs for restore operation using breadth-first batching.
 * O(depth) queries instead of O(n). Each element is returned once and the
 * parent is never returned.
 */
export async function getDeletedDescendantIds(
	parentId: string,
	tx?: TxClient
): Promise<string[]> {
	const db = tx ?? prisma;
	const allIds: string[] = [];
	const seen = new Set<string>([parentId]);
	let loopMet = false;
	let frontier = [parentId];

	while (frontier.length > 0) {
		const children = await db.assuranceElement.findMany({
			where: { parentId: { in: frontier }, deletedAt: { not: null } },
			select: { id: true },
		});
		const childIds: string[] = [];
		for (const child of children) {
			if (seen.has(child.id)) {
				loopMet = true;
				continue;
			}
			seen.add(child.id);
			childIds.push(child.id);
		}
		allIds.push(...childIds);
		frontier = childIds;
	}

	if (loopMet) {
		log.warn(LOOP_WARNING, { rootId: parentId });
	}
	return allIds;
}

/**
 * Finds a start element that sits beneath itself. Each start walks up its
 * `parentId` chain with its own seen set; all live walks share one query per
 * round, and deleted elements count. A walk that comes back to its start
 * returns that start; a walk that reaches an element with no parent, or one it
 * has already passed, ends. Returns the first such start, or undefined.
 */
export async function findParentLoopStart(
	startIds: string[],
	tx: TxClient
): Promise<string | undefined> {
	const walks = new Map<string, { current: string; seen: Set<string> }>(
		[...new Set(startIds)].map((id) => [
			id,
			{ current: id, seen: new Set<string>([id]) },
		])
	);

	while (walks.size > 0) {
		const rows = await tx.assuranceElement.findMany({
			where: {
				id: { in: [...new Set([...walks.values()].map((w) => w.current))] },
			},
			select: { id: true, parentId: true },
		});
		const parentById = new Map(rows.map((row) => [row.id, row.parentId]));

		for (const [start, walk] of [...walks]) {
			const parent = parentById.get(walk.current);
			if (!parent) {
				walks.delete(start);
			} else if (parent === start) {
				return start;
			} else if (walk.seen.has(parent)) {
				walks.delete(start);
			} else {
				walk.seen.add(parent);
				walk.current = parent;
			}
		}
	}

	return;
}
