import prisma from "@/lib/prisma";
import {
	createTestCase,
	createTestCaseInformation,
	createTestElement,
	createTestUser,
} from "./prisma-factories";
import { holdRowLock } from "./row-lock-test-utils";

/**
 * Fixtures for the tests of what type a published row takes: a case or a
 * pattern with something to publish, the stored state of the case and every
 * row published from it, and the rules those two must obey together.
 */

export const KINDS = ["CASE", "PATTERN"] as const;
export type Kind = (typeof KINDS)[number];

/** The type a published row has for each kind of case it came from. */
export const TYPE_FOR_KIND = {
	CASE: "ASSURANCE_CASE",
	PATTERN: "ARGUMENT_PATTERN",
} as const;

export function otherKind(kind: Kind): Kind {
	return kind === "PATTERN" ? "CASE" : "PATTERN";
}

export interface OpenCase {
	caseId: string;
	name: string;
	ownerId: string;
}

let counter = 0;

/** A case or pattern with a top goal, owned by a new user, ready to publish. */
export async function openCase(
	kind: Kind,
	options: { withInformation?: boolean } = {}
): Promise<OpenCase> {
	counter += 1;
	const owner = await createTestUser();
	const name = `Type probe ${kind.toLowerCase()} ${counter}`;
	const testCase = await createTestCase(owner.id, { kind, name });
	await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	if (options.withInformation) {
		await createTestCaseInformation(testCase.id);
	}
	return { caseId: testCase.id, name, ownerId: owner.id };
}

/** What a stored snapshot says it was composed from. */
export function snapshotKind(content: unknown): Kind {
	const caseBlock = (content as { case?: { kind?: string } } | null)?.case;
	return caseBlock?.kind === "PATTERN" ? "PATTERN" : "CASE";
}

/** Every row published from a case, oldest first. */
export function publishedRows(caseId: string) {
	return prisma.publishedAssuranceCase.findMany({
		where: { assuranceCaseId: caseId },
		orderBy: { createdAt: "asc" },
	});
}

export type PublishedRows = Awaited<ReturnType<typeof publishedRows>>;

export async function storedState(caseId: string) {
	const stored = await prisma.assuranceCase.findUniqueOrThrow({
		where: { id: caseId },
		select: {
			deletedAt: true,
			kind: true,
			publishStatus: true,
			published: true,
			publishedAt: true,
		},
	});
	return { stored, rows: await publishedRows(caseId) };
}

export type StoredState = Awaited<ReturnType<typeof storedState>>;

/**
 * What is wrong with a case and its published rows taken together; an empty
 * list when they agree. A published case has exactly one current row, and that
 * row is typed for the case's kind. A case that is not published holds no
 * rows. Whatever else is true, no row is typed differently from the snapshot
 * it holds.
 */
export function inconsistencies(state: StoredState): string[] {
	const { stored, rows } = state;
	const problems: string[] = [];
	const current = rows.filter((row) => row.isCurrent);

	if (stored.published) {
		if (current.length !== 1) {
			problems.push(`published with ${current.length} current rows`);
		}
		const [only] = current;
		if (only && only.type !== TYPE_FOR_KIND[stored.kind]) {
			problems.push(
				`a ${stored.kind} is listed with type ${only.type}, not ${TYPE_FOR_KIND[stored.kind]}`
			);
		}
		if (stored.publishStatus !== "PUBLISHED") {
			problems.push(`published but ${stored.publishStatus}`);
		}
		if (!stored.publishedAt) {
			problems.push("published with no publishedAt");
		}
	} else {
		if (rows.length > 0) {
			problems.push(`not published but holds ${rows.length} rows`);
		}
		if (stored.publishStatus !== "DRAFT") {
			problems.push(`not published but ${stored.publishStatus}`);
		}
		if (stored.publishedAt) {
			problems.push("not published but has a publishedAt");
		}
	}

	for (const row of rows) {
		const composedFrom = snapshotKind(row.content);
		if (row.type !== TYPE_FOR_KIND[composedFrom]) {
			problems.push(
				`row ${row.slug} is typed ${row.type} but its snapshot is of a ${composedFrom}`
			);
		}
	}
	return problems;
}

/**
 * A transaction that touches the case row and changes nothing that matters.
 * Finish it with `rollback()`: writers queued behind a rolled-back lock take
 * the row strictly in the order they queued.
 */
export function holdCaseRow(caseId: string) {
	return holdRowLock(async (tx) => {
		await tx.assuranceCase.update({
			where: { id: caseId },
			data: { updatedAt: new Date() },
		});
	});
}

/** A row's stored columns that a later write must not disturb. */
export function rowIdentity(row: PublishedRows[number]) {
	return {
		id: row.id,
		type: row.type,
		slug: row.slug,
		isCurrent: row.isCurrent,
		archivedAt: row.archivedAt,
	};
}
