import { vi } from "vitest";
import prisma from "@/lib/prisma";
import type { TreeNode } from "@/lib/schemas/case-export";
import { seededShuffle } from "./seeded-shuffle";

/**
 * Tools for tests that must give the same answer whatever order the database
 * returns rows in. The export reads a case's elements and each element's
 * evidence links in one query with no ORDER BY, so a database may return them
 * in any order, and a different one after its statistics change. These tests
 * hand the export the same rows in a chosen order.
 */

export type Arrange = <T>(rows: T[], salt: number) => T[];

export interface RowOrder {
	arrange: Arrange;
	label: string;
}

const SHUFFLES = 10;

/** The rows as stored, reversed, and shuffled ten different ways. */
const ROW_ORDERS: readonly RowOrder[] = [
	{ label: "as returned", arrange: (rows) => rows },
	{ label: "reversed", arrange: (rows) => [...rows].reverse() },
	...Array.from({ length: SHUFFLES }, (_, index): RowOrder => {
		const seed = 1000 + index * 7919;
		return {
			label: `shuffled ${index + 1}`,
			arrange: (rows, salt) => seededShuffle(rows, seed + salt),
		};
	}),
];

interface RowsWithLinks {
	evidenceLinksTo?: unknown[];
}

function arrangeCaseRows(arrange: Arrange) {
	return (result: unknown): unknown => {
		if (
			typeof result !== "object" ||
			result === null ||
			!Array.isArray((result as { elements?: unknown }).elements)
		) {
			return result;
		}
		const caseRow = result as { elements: (RowsWithLinks | null)[] };
		return {
			...caseRow,
			elements: arrange(caseRow.elements, 1).map((element, index) =>
				element && Array.isArray(element.evidenceLinksTo)
					? {
							...element,
							evidenceLinksTo: arrange(element.evidenceLinksTo, 2 + index),
						}
					: element
			),
		};
	};
}

/**
 * Makes the case query behind every export return its elements and evidence
 * links in the order `arrange` gives. Returns the function that puts the
 * database's own order back.
 */
function arrangeExportRows(arrange: Arrange): () => void {
	const real = prisma.assuranceCase.findUnique.bind(
		prisma.assuranceCase
	) as unknown as (args: unknown) => Promise<unknown>;
	const reorder = arrangeCaseRows(arrange);
	const spy = vi
		.spyOn(prisma.assuranceCase, "findUnique")
		.mockImplementation(((args: unknown) =>
			real(args).then(reorder)) as unknown as never);
	return () => spy.mockRestore();
}

/**
 * Runs `read` once for each row order and returns what it gave, labelled. The
 * database order is put back whether or not `read` throws.
 */
export async function readUnderEveryRowOrder<T>(
	read: () => Promise<T>,
	orders: readonly RowOrder[] = ROW_ORDERS
): Promise<{ label: string; value: T }[]> {
	const results: { label: string; value: T }[] = [];
	for (const order of orders) {
		const restore = arrangeExportRows(order.arrange);
		try {
			results.push({ label: order.label, value: await read() });
		} finally {
			restore();
		}
	}
	return results;
}

/** What the first row order gave. */
export function firstOf<T>(readings: { label: string; value: T }[]): T {
	const first = readings[0];
	if (!first) {
		throw new Error("no readings");
	}
	return first.value;
}

/** Every reading the same as the first, reported by row order when one differs. */
export function differingOrders<T>(
	readings: { label: string; value: T }[]
): string[] {
	const [first, ...rest] = readings;
	if (!first) {
		return [];
	}
	const reference = JSON.stringify(first.value);
	return rest
		.filter((reading) => JSON.stringify(reading.value) !== reference)
		.map((reading) => reading.label);
}

/** The names of a node's children, in the order written. */
export function childNames(node: TreeNode | undefined): (string | null)[] {
	return (node?.children ?? []).map((child) => child.name);
}

/** The node at the end of a path of element ids. */
export function nodeAt(root: TreeNode, ...ids: string[]): TreeNode {
	let node = root;
	for (const id of ids) {
		const next = (node.children ?? []).find((child) => child.id === id);
		if (!next) {
			throw new Error(`no ${id} under ${node.id}`);
		}
		node = next;
	}
	return node;
}

/** The descriptions of every node, parents first, children in the order written. */
export function descriptionsInOrder(root: TreeNode): string[] {
	const found: string[] = [];
	const visit = (node: TreeNode): void => {
		found.push(node.description);
		for (const child of node.children ?? []) {
			visit(child);
		}
	};
	visit(root);
	return found;
}
