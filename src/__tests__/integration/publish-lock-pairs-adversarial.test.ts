import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	purgeCase,
	removeArchivedCopy,
	restoreCase,
	softDeleteCase,
} from "@/lib/services/case-trash-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { deleteAccountForRetention } from "@/lib/services/user-management-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	archivedScene,
	collectErrorLogs,
	deadlocksIn,
	disagreements,
	discoverProblems,
	errorOf,
	imageCopyProblems,
	type Observed,
	type Operation,
	observe,
	type PublishedScene,
	publishedFileKeys,
	publishedScene,
	runInSequence,
	runQueued,
} from "../utils/publish-race-kit";

/**
 * Every writer of a case and its published rows, queued behind the case row
 * two and three at a time in each order. The holder is rolled back, so the
 * queue takes the row in the order it formed. The same operations run one
 * after another on a second, identical case must leave the same stored state:
 * whichever order two writers meet in, nobody waits on a lock in reverse, no
 * writer fails with a generic error, and nothing a later writer decided on
 * was already out of date. With three writers the database fixes only which
 * goes first, so the second and third may run in either order and the result
 * may match either.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.setConfig({ testTimeout: 90_000 });

const GENERIC_FAILURE = /^Failed to/;

let errorLogs: ReturnType<typeof collectErrorLogs>;

beforeEach(async () => {
	await mockNoAuth();
	errorLogs = collectErrorLogs();
});

afterEach(() => {
	errorLogs.stop();
});

const LIVE: Record<string, Operation> = {
	"a direct publish of the published case": (scene) =>
		publishAssuranceCase(scene.ownerId, scene.caseId),
	"a republish": (scene) => updatePublishedCase(scene.ownerId, scene.caseId),
	"an unpublish": (scene) =>
		unpublishAssuranceCase(scene.ownerId, scene.caseId),
	"a bin that removes the copy": (scene) =>
		softDeleteCase(scene.ownerId, scene.caseId, { publishedCopy: "remove" }),
	"a bin that archives the copy": (scene) =>
		softDeleteCase(scene.ownerId, scene.caseId, { publishedCopy: "archive" }),
	"an account deletion": (scene) => deleteAccountForRetention(scene.ownerId),
};

const ARCHIVED: Record<string, Operation> = {
	"a restore": (scene) => restoreCase(scene.ownerId, scene.caseId),
	"a permanent delete": (scene) => purgeCase(scene.ownerId, scene.caseId),
	"the removal of the archived copy": (scene) =>
		removeArchivedCopy(scene.ownerId, scene.publishedId),
	"an account deletion": (scene) => deleteAccountForRetention(scene.ownerId),
};

/**
 * Pairs in Trash whose second writer decided before it reached the row, on
 * something the first writer then changes: a permanent delete is allowed on
 * any case, so one queued behind a restore still deletes the restored case,
 * and after an account deletion the former owner is no longer the owner.
 */
const DECIDED_BEFORE_THE_ROW = new Set([
	"a restore|a permanent delete",
	"a permanent delete|a restore",
	"an account deletion|a restore",
	"an account deletion|a permanent delete",
	"an account deletion|the removal of the archived copy",
]);

/** Every two different operations in each order, and the operations that can safely meet themselves. */
function orderedPairs(
	operations: Record<string, Operation>,
	repeatable: string[]
): [string, string][] {
	const names = Object.keys(operations);
	return [
		...names.flatMap((first) =>
			names
				.filter((second) => second !== first)
				.map((second): [string, string] => [first, second])
		),
		...repeatable.map((name): [string, string] => [name, name]),
	];
}

function permutations<T>(items: T[]): T[][] {
	if (items.length <= 1) {
		return [items];
	}
	return items.flatMap((item, index) =>
		permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
			(rest) => [item, ...rest]
		)
	);
}

const IMAGE_KEY = /published\/\S+/;

/** Problems with the image copies, with the key itself left out so two cases can be compared. */
function imageKinds(problems: string[]): string[] {
	return problems.map((problem) => problem.replace(IMAGE_KEY, "<key>")).sort();
}

/** What a run leaves: the stored case and rows, and the problems with the image copies. */
interface Outcome {
	images: string[];
	state: Observed;
}

/**
 * Runs the operations one after another, on a new case, and reports what that
 * leaves.
 */
async function outcomeInSequence(
	makeScene: () => Promise<PublishedScene>,
	operations: Operation[]
): Promise<Outcome> {
	const filesBefore = await publishedFileKeys();
	const scene = await makeScene();
	await runInSequence(scene, operations);
	return {
		state: await observe(scene.caseId),
		images: imageKinds(await imageCopyProblems(filesBefore)),
	};
}

/**
 * The orders a queue can serve the operations in. The first writer always goes
 * first. Once it has changed the row, the rest all move on to its new version,
 * and the database may serve them in any order. With two writers that leaves
 * one order, and with three it leaves two.
 */
function servingOrders(operations: Operation[]): Operation[][] {
	const [first, ...rest] = operations;
	return first
		? permutations(rest).map((order) => [first, ...order])
		: [operations];
}

/**
 * Declares a test that queues the operations on one case and holds it to the
 * rules every case must keep: nobody waits on a lock in reverse, and the case
 * and its published rows, the image copies and Discover all agree afterwards.
 * Unless `sequenceDecides` is false it also runs the operations one after
 * another on a second case and requires the same stored state, no logged
 * error and no generic failure; with three operations it runs them in each
 * order the queue may serve them, on a new case each, and the stored state
 * and the image copies must both match the same order. A pair keeps
 * `sequenceDecides` off when one writer's decision before it reached the row
 * (who owns the case, whether it is still in Trash) is what differs between
 * the two runs, not the lock order.
 */
function itQueuesLikeASequence(
	title: string,
	makeScene: () => Promise<PublishedScene>,
	operations: Operation[],
	{ sequenceDecides = true }: { sequenceDecides?: boolean } = {}
) {
	it(title, async () => {
		const filesBeforeQueued = await publishedFileKeys();
		const queuedScene = await makeScene();
		const queuedResults = await runQueued(
			queuedScene.caseId,
			queuedScene,
			operations
		);
		const queued = await observe(queuedScene.caseId);
		const queuedImages = await imageCopyProblems(filesBeforeQueued);

		expect(deadlocksIn(errorLogs.entries)).toEqual([]);
		expect(disagreements(queued)).toEqual([]);
		expect(await discoverProblems(queuedScene.caseId)).toEqual([]);
		if (!sequenceDecides) {
			return;
		}
		expect(errorLogs.entries.map((entry) => entry.text)).toEqual([]);
		expect(
			queuedResults
				.map((result) => errorOf(result) ?? "")
				.filter((error) => GENERIC_FAILURE.test(error))
		).toEqual([]);

		const sequences: Outcome[] = [];
		for (const order of servingOrders(operations)) {
			sequences.push(await outcomeInSequence(makeScene, order));
		}

		expect(sequences).toContainEqual({
			state: queued,
			images: imageKinds(queuedImages),
		});
	});
}

describe("two writers of a published case, queued behind its row", () => {
	for (const [first, second] of orderedPairs(LIVE, [
		"a direct publish of the published case",
		"a republish",
		"an unpublish",
		"a bin that removes the copy",
		"a bin that archives the copy",
	])) {
		itQueuesLikeASequence(
			`${first}, then ${second}, leaves what running them one after another leaves`,
			publishedScene,
			[LIVE[first] as Operation, LIVE[second] as Operation]
		);
	}
});

describe("two writers of a case in Trash with its copy archived, queued behind its row", () => {
	for (const [first, second] of orderedPairs(ARCHIVED, [
		"a restore",
		"the removal of the archived copy",
	])) {
		itQueuesLikeASequence(
			`${first}, then ${second}, leaves the case and its copy in agreement`,
			archivedScene,
			[ARCHIVED[first] as Operation, ARCHIVED[second] as Operation],
			{ sequenceDecides: !DECIDED_BEFORE_THE_ROW.has(`${first}|${second}`) }
		);
	}
});

describe("a republish, an unpublish and a bin queued together", () => {
	for (const bin of [
		"a bin that removes the copy",
		"a bin that archives the copy",
	]) {
		for (const order of permutations(["a republish", "an unpublish", bin])) {
			itQueuesLikeASequence(
				`with ${bin}: ${order.join(", then ")}`,
				publishedScene,
				order.map((name) => LIVE[name] as Operation)
			);
		}
	}
});

describe("a republish, an unpublish and an account deletion queued together", () => {
	for (const order of permutations([
		"a republish",
		"an unpublish",
		"an account deletion",
	])) {
		itQueuesLikeASequence(
			order.join(", then "),
			publishedScene,
			order.map((name) => LIVE[name] as Operation)
		);
	}
});
