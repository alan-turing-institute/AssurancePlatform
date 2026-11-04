import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { UPLOADS_DIR } from "@/lib/services/blob-storage-service";
import { softDeleteCase } from "@/lib/services/case-trash-service";
import { getPublishedItems } from "@/lib/services/discover-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { expectSuccess } from "./assertion-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestElement,
	createTestUser,
} from "./prisma-factories";
import { holdCaseRow } from "./publish-type-kit";
import { waitForLockWait } from "./row-lock-test-utils";

/**
 * Fixtures for the tests that queue several writers on one case: a published
 * case with a feature image, what is stored for it afterwards, what Discover
 * shows, which image copies are still on disk, and a way to run operations
 * queued on the case row in a fixed order or one after another.
 */

/** A generous wait for a queued writer to reach its lock, for a loaded machine. */
const QUEUE_WAIT_MS = 20_000;

export interface Scene {
	caseId: string;
	liveKey: string;
	ownerId: string;
}

export interface PublishedScene extends Scene {
	publishedId: string;
}

async function seedLiveFeatureImage(caseId: string): Promise<string> {
	const key = `cases/${caseId}/case-information/original.png`;
	const filePath = join(UPLOADS_DIR, key);
	await mkdir(join(filePath, ".."), { recursive: true });
	await writeFile(filePath, Buffer.from("fake-png-bytes"));
	return key;
}

/** A case with a written top goal, complete information and a live feature image, owned by a new user. */
export async function newScene(
	kind: "CASE" | "PATTERN" = "CASE"
): Promise<Scene> {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id, { kind });
	await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	const liveKey = await seedLiveFeatureImage(testCase.id);
	await createTestCaseInformation(testCase.id, { featureImageUrl: liveKey });
	return { caseId: testCase.id, liveKey, ownerId: owner.id };
}

export async function publishedScene(): Promise<PublishedScene> {
	const scene = await newScene();
	const published = expectSuccess(
		await publishAssuranceCase(scene.ownerId, scene.caseId)
	);
	return { ...scene, publishedId: published.publishedId };
}

/** A published case that was moved to Trash with its copy archived. */
export async function archivedScene(): Promise<PublishedScene> {
	const scene = await publishedScene();
	expectSuccess(
		await softDeleteCase(scene.ownerId, scene.caseId, {
			publishedCopy: "archive",
		})
	);
	return scene;
}

// ============================================
// What is stored
// ============================================

export interface Observed {
	exists: boolean;
	hasPublishedAt: boolean;
	kind: string;
	published: boolean;
	publishStatus: string;
	rows: { archived: boolean; isCurrent: boolean; type: string }[];
	trashed: boolean;
}

/** The stored case and its published rows, reduced to what the tests compare. */
export async function observe(caseId: string): Promise<Observed> {
	const stored = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			deletedAt: true,
			kind: true,
			publishStatus: true,
			published: true,
			publishedAt: true,
		},
	});
	const rows = await prisma.publishedAssuranceCase.findMany({
		where: { assuranceCaseId: caseId },
	});
	return {
		exists: stored !== null,
		trashed: Boolean(stored?.deletedAt),
		published: stored?.published ?? false,
		publishStatus: stored?.publishStatus ?? "none",
		hasPublishedAt: Boolean(stored?.publishedAt),
		kind: stored?.kind ?? "none",
		rows: rows
			.map((row) => ({
				type: row.type,
				isCurrent: row.isCurrent,
				archived: row.archivedAt !== null,
			}))
			.sort((a, b) =>
				`${a.isCurrent}|${a.archived}|${a.type}`.localeCompare(
					`${b.isCurrent}|${b.archived}|${b.type}`
				)
			),
	};
}

type ObservedRow = Observed["rows"][number];

function orphanedRowProblems(state: Observed): string[] {
	return state.rows.length > 0 ? ["published rows outlive their case"] : [];
}

function archivedCopyProblems(state: Observed): string[] {
	return state.rows.some((row) => row.archived)
		? ["a case out of Trash holds an archived copy"]
		: [];
}

function trashedPublishedProblems(current: ObservedRow[]): string[] {
	return current.length === 1
		? []
		: [`a published case in Trash holds ${current.length} current rows`];
}

function trashedDraftProblems(state: Observed): string[] {
	return state.rows.length > 0
		? ["a draft in Trash still holds published rows"]
		: [];
}

function trashedCaseProblems(
	state: Observed,
	current: ObservedRow[],
	live: ObservedRow[]
): string[] {
	const problems: string[] = [];
	if (live.length > 0) {
		problems.push("a case in Trash has a live copy");
	}
	problems.push(
		...(state.published
			? trashedPublishedProblems(current)
			: trashedDraftProblems(state))
	);
	return problems;
}

function publishedCaseProblems(state: Observed, live: ObservedRow[]): string[] {
	const problems: string[] = [];
	if (live.length !== 1) {
		problems.push(`published with ${live.length} live copies`);
	}
	if (state.publishStatus !== "PUBLISHED" || !state.hasPublishedAt) {
		problems.push("published but not marked so");
	}
	return problems;
}

function draftCaseProblems(state: Observed): string[] {
	const problems: string[] = [];
	if (state.rows.length > 0) {
		problems.push(`a draft holds ${state.rows.length} published rows`);
	}
	if (state.publishStatus !== "DRAFT" || state.hasPublishedAt) {
		problems.push("not published but marked so");
	}
	return problems;
}

/** What is wrong with a case and its published rows taken together; empty when they agree. */
export function disagreements(state: Observed): string[] {
	if (!state.exists) {
		return orphanedRowProblems(state);
	}
	const current = state.rows.filter((row) => row.isCurrent);
	const live = current.filter((row) => !row.archived);
	if (state.trashed) {
		return trashedCaseProblems(state, current, live);
	}
	return [
		...archivedCopyProblems(state),
		...(state.published
			? publishedCaseProblems(state, live)
			: draftCaseProblems(state)),
	];
}

/**
 * What the public sees through Discover, held against the stored case: a
 * listed copy that is not archived belongs to a published case that is out of
 * Trash, and a published case is listed once. The case's own rows are told
 * apart by id, because the listing carries no case id.
 */
export async function discoverProblems(caseId: string): Promise<string[]> {
	const state = await observe(caseId);
	const ownIds = new Set(
		(
			await prisma.publishedAssuranceCase.findMany({
				where: { assuranceCaseId: caseId },
				select: { id: true },
			})
		).map((row) => row.id)
	);
	const listing = await getPublishedItems();
	if (!("data" in listing) || listing.data === undefined) {
		return ["Discover could not list"];
	}
	const listed = listing.data.filter((item) => ownIds.has(item.id));
	const listedLive = listed.filter((item) => item.archivedAt === null);
	const problems: string[] = [];
	const shouldBePublic = state.exists && state.published && !state.trashed;
	if (listedLive.length > 0 && !shouldBePublic) {
		problems.push("Discover lists a case that is not published");
	}
	if (shouldBePublic && listedLive.length !== 1) {
		problems.push(`Discover lists a published case ${listedLive.length} times`);
	}
	return problems;
}

// ============================================
// Image copies on disk
// ============================================

/** Every `published/<id>/<file>` key that exists on disk now. */
export async function publishedFileKeys(): Promise<Set<string>> {
	const root = join(UPLOADS_DIR, "published");
	const dirs = await readdir(root).catch(() => [] as string[]);
	const keys = new Set<string>();
	for (const dir of dirs) {
		const files = await readdir(join(root, dir)).catch(() => [] as string[]);
		for (const file of files) {
			keys.add(`published/${dir}/${file}`);
		}
	}
	return keys;
}

function snapshotImageKey(content: unknown): string | null {
	const url = (
		content as { caseInformation?: { featureImageUrl?: unknown } } | null
	)?.caseInformation?.featureImageUrl;
	return typeof url === "string" && url.startsWith("published/") ? url : null;
}

/**
 * Image copies the case's published rows point at that are missing, and copies
 * made since `before` that no row points at. Empty when the files and the rows
 * agree.
 */
export async function imageCopyProblems(
	before: Set<string>
): Promise<string[]> {
	const rows = await prisma.publishedAssuranceCase.findMany({
		select: { content: true },
	});
	const referenced = new Set(
		rows
			.map((row) => snapshotImageKey(row.content))
			.filter((key): key is string => key !== null)
	);
	const now = await publishedFileKeys();
	const problems: string[] = [];
	for (const key of referenced) {
		if (!now.has(key)) {
			problems.push(`a published row points at ${key}, which is gone`);
		}
	}
	for (const key of now) {
		if (!(before.has(key) || referenced.has(key))) {
			problems.push(`${key} was left behind with no row pointing at it`);
		}
	}
	return problems;
}

// ============================================
// Logged failures
// ============================================

/** An error-level log entry, as its message and everything it carries. */
export interface ErrorLog {
	msg: string;
	text: string;
}

/** The value to record for one already-seen object: itself the first time, a marker after. */
function firstSightOf(seen: WeakSet<object>, value: object): unknown {
	if (seen.has(value)) {
		return "[Circular]";
	}
	seen.add(value);
	return value;
}

/** An object as the log text records it: itself the first time it is met, a marker after; anything else as it is. */
function recordedObject(seen: WeakSet<object>, value: unknown): unknown {
	if (typeof value !== "object" || value === null) {
		return value;
	}
	return firstSightOf(seen, value);
}

/** One value as the log text records it: errors as name and message, big integers as strings, repeats of an object as a marker. */
function recordedValue(seen: WeakSet<object>, value: unknown): unknown {
	if (value instanceof Error) {
		return { name: value.name, message: value.message };
	}
	return typeof value === "bigint"
		? value.toString()
		: recordedObject(seen, value);
}

function textOf(entry: LogEntry): string {
	const seen = new WeakSet<object>();
	return JSON.stringify(entry, (_key, value) => recordedValue(seen, value));
}

/** Collects the error-level log entries emitted from now until `stop()`. */
export function collectErrorLogs() {
	const entries: ErrorLog[] = [];
	setLogSink((entry) => {
		if (entry.level === "error") {
			entries.push({ msg: entry.msg, text: textOf(entry) });
		}
	});
	return { entries, stop: resetLogSink };
}

const DEADLOCK_TEXT = /deadlock|40P01|P2034/i;

/** The collected entries that report a deadlock or a write conflict. */
export function deadlocksIn(entries: ErrorLog[]): ErrorLog[] {
	return entries.filter((entry) => DEADLOCK_TEXT.test(entry.text));
}

// ============================================
// Running operations together
// ============================================

export type Operation = (scene: PublishedScene) => Promise<unknown>;

/**
 * Starts the operations in order, each one only after the one before it is
 * blocked behind the case row, then lets them go. The holder is rolled back
 * so the queue takes the row in the order the operations joined it.
 */
export async function runQueued(
	caseId: string,
	scene: PublishedScene,
	operations: Operation[]
): Promise<unknown[]> {
	const holder = await holdCaseRow(caseId);
	const pending: Promise<unknown>[] = [];
	for (const [index, operation] of operations.entries()) {
		pending.push(operation(scene));
		await waitForLockWait(QUEUE_WAIT_MS, index + 1);
	}
	await holder.rollback();
	return await Promise.all(pending);
}

/** Runs the operations one after another, each finishing before the next starts. */
export async function runInSequence(
	scene: PublishedScene,
	operations: Operation[]
): Promise<unknown[]> {
	const results: unknown[] = [];
	for (const operation of operations) {
		results.push(await operation(scene));
	}
	return results;
}

/** The error text of a service result, or null when it succeeded. */
export function errorOf(result: unknown): string | null {
	const error = (result as { error?: unknown } | null)?.error;
	return typeof error === "string" ? error : null;
}
