import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	imageCopyProblems,
	publishedFileKeys,
} from "../utils/publish-race-kit";
import {
	completeScene,
	currentRows,
	publishingFingerprint,
	renameCase,
	signInAs,
} from "../utils/publish-refusal-kit";
import {
	holdCaseRow,
	inconsistencies,
	KINDS,
	storedState,
} from "../utils/publish-type-kit";
import { waitForLockWait } from "../utils/row-lock-test-utils";
import { publishCase } from "../utils/variables-kit";

/**
 * First publishes that choose the same address, and first publishes of a case
 * that is already published.
 */

type SlugPlan = (name: string, call: number) => Promise<string | undefined>;

const hooks = vi.hoisted(() => ({
	calls: 0,
	// Returns a slug to hand out in place of the real one, or undefined to use the real one.
	plan: null as
		| null
		| ((name: string, call: number) => Promise<string | undefined>),
}));

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/slug-service", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("@/lib/services/slug-service")>();
	return {
		...original,
		generateUniqueSlug: async (
			...args: Parameters<typeof original.generateUniqueSlug>
		) => {
			hooks.calls += 1;
			const planned = await hooks.plan?.(args[0], hooks.calls);
			return planned ?? (await original.generateUniqueSlug(...args));
		},
	};
});

vi.setConfig({ testTimeout: 90_000 });

const WAIT_MS = 20_000;

beforeEach(async () => {
	hooks.calls = 0;
	hooks.plan = null;
	await mockNoAuth();
});

/** Makes the first `count` slug choices wait for each other, then answer with the real slug. */
function meetAtBarrier(count: number): SlugPlan {
	let arrived = 0;
	let release: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	return async (name, call) => {
		if (call > count) {
			return undefined;
		}
		const { generateUniqueSlug } = await vi.importActual<
			typeof import("@/lib/services/slug-service")
		>("@/lib/services/slug-service");
		const real = await generateUniqueSlug(name);
		arrived += 1;
		if (arrived === count) {
			release();
		}
		await gate;
		return real;
	};
}

async function sameNamedScenes(kind: "CASE" | "PATTERN") {
	const first = await completeScene(kind);
	const second = await completeScene(kind);
	await renameCase(first.caseId, "Shared Name Probe");
	await renameCase(second.caseId, "Shared Name Probe");
	return [first, second] as const;
}

async function slugOf(caseId: string): Promise<string> {
	const [row] = await currentRows(caseId);
	if (!row) {
		throw new Error("no current row");
	}
	return row.slug;
}

describe("two first publishes that choose the same address at once", () => {
	it.each(
		KINDS
	)("give one the address and the other its -2, for two %s of the same name", async (kind) => {
		const [a, b] = await sameNamedScenes(kind);
		hooks.plan = meetAtBarrier(2);

		const results = await Promise.all([
			publishAssuranceCase(a.ownerId, a.caseId),
			publishAssuranceCase(b.ownerId, b.caseId),
		]);

		for (const result of results) {
			expectSuccess(result);
		}
		const slugs = [await slugOf(a.caseId), await slugOf(b.caseId)].sort();
		expect(slugs).toEqual(["shared-name-probe", "shared-name-probe-2"]);
		for (const scene of [a, b]) {
			expect(inconsistencies(await storedState(scene.caseId))).toEqual([]);
		}
	});

	it("takes a third attempt when the first two collide", async () => {
		const [a, b] = await sameNamedScenes("CASE");
		expectSuccess(await publishAssuranceCase(a.ownerId, a.caseId));
		hooks.calls = 0;
		hooks.plan = async (_name, call) =>
			call <= 2 ? "shared-name-probe" : undefined;

		expectSuccess(await publishAssuranceCase(b.ownerId, b.caseId));

		expect(await slugOf(b.caseId)).toBe("shared-name-probe-2");
		expect(hooks.calls).toBe(3);
	});
});

describe("a first publish that collides on every attempt", () => {
	it("answers 409 try again, writes nothing and cleans the copied image", async () => {
		const [a, b] = await sameNamedScenes("CASE");
		expectSuccess(await publishAssuranceCase(a.ownerId, a.caseId));
		hooks.calls = 0;
		const files = await publishedFileKeys();
		const before = await publishingFingerprint(b.caseId);
		hooks.plan = async () => "shared-name-probe";
		await signInAs(b.ownerId);

		const response = await publishCase(b.caseId);

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: "The case changed while it was being published. Try again.",
		});
		expect(hooks.calls).toBe(3);
		expect(await publishingFingerprint(b.caseId)).toEqual(before);
		expect(await imageCopyProblems(files)).toEqual([]);
		expect(await publishedFileKeys()).toEqual(files);
	});

	it("does not retry a failure that is not a slug collision", async () => {
		const scene = await completeScene("CASE");
		hooks.plan = () => Promise.reject(new Error("boom"));

		const result = await publishAssuranceCase(scene.ownerId, scene.caseId);

		expect(result).toEqual({ error: "Failed to publish case" });
		expect(hooks.calls).toBe(1);
		expect((await publishingFingerprint(scene.caseId)).rows).toEqual([]);
	});
});

async function publishedOnce(kind: "CASE" | "PATTERN" = "CASE") {
	const scene = await completeScene(kind);
	expectSuccess(await publishAssuranceCase(scene.ownerId, scene.caseId));
	return { scene, slug: await slugOf(scene.caseId) };
}

/** The slugs of a case's current rows and whatever is inconsistent in its stored state. */
async function slugState(caseId: string) {
	const rows = await currentRows(caseId);
	return {
		slugs: rows.map((row) => row.slug),
		problems: inconsistencies(await storedState(caseId)),
	};
}

describe("a first publish of a case that is already published", () => {
	it.each(
		KINDS
	)("keeps the slug when it follows straight after, for a %s", async (kind) => {
		const { scene, slug } = await publishedOnce(kind);

		expectSuccess(await publishAssuranceCase(scene.ownerId, scene.caseId));

		expect(await slugState(scene.caseId)).toEqual({
			slugs: [slug],
			problems: [],
		});
	});

	it("keeps the slug when it waits behind a held case row", async () => {
		const { scene, slug } = await publishedOnce();
		const holder = await holdCaseRow(scene.caseId);
		const queued = publishAssuranceCase(scene.ownerId, scene.caseId);
		await waitForLockWait(WAIT_MS, 1);
		await holder.rollback();

		expectSuccess(await queued);

		expect(await slugState(scene.caseId)).toEqual({
			slugs: [slug],
			problems: [],
		});
	});

	it("keeps the slug when two of them wait together behind a held case row", async () => {
		const { scene, slug } = await publishedOnce();
		const holder = await holdCaseRow(scene.caseId);
		const first = publishAssuranceCase(scene.ownerId, scene.caseId);
		await waitForLockWait(WAIT_MS, 1);
		const second = publishAssuranceCase(scene.ownerId, scene.caseId);
		await waitForLockWait(WAIT_MS, 2);
		await holder.rollback();

		expectSuccess(await first);
		expectSuccess(await second);

		expect(await slugState(scene.caseId)).toEqual({
			slugs: [slug],
			problems: [],
		});
	});

	it("keeps the slug when three of them wait together behind a held case row", async () => {
		const { scene, slug } = await publishedOnce();
		const holder = await holdCaseRow(scene.caseId);
		const pending: ReturnType<typeof publishAssuranceCase>[] = [];
		for (const waiters of [1, 2, 3]) {
			pending.push(publishAssuranceCase(scene.ownerId, scene.caseId));
			await waitForLockWait(WAIT_MS, waiters);
		}
		await holder.rollback();

		for (const result of await Promise.all(pending)) {
			expectSuccess(result);
		}

		expect(await slugState(scene.caseId)).toEqual({
			slugs: [slug],
			problems: [],
		});
	});

	it("keeps the slug after a republish", async () => {
		const { scene, slug } = await publishedOnce();
		expectSuccess(await updatePublishedCase(scene.ownerId, scene.caseId));

		expectSuccess(await publishAssuranceCase(scene.ownerId, scene.caseId));

		expect(await slugState(scene.caseId)).toEqual({
			slugs: [slug],
			problems: [],
		});
	});

	it("keeps the original slug when the case was renamed in between", async () => {
		const { scene, slug } = await publishedOnce();
		await renameCase(scene.caseId, "A Different Name Entirely");

		expectSuccess(await publishAssuranceCase(scene.ownerId, scene.caseId));

		expect(await slugState(scene.caseId)).toEqual({
			slugs: [slug],
			problems: [],
		});
	});

	it("publishes again with one current row after an unpublish", async () => {
		const { scene } = await publishedOnce();
		expectSuccess(await unpublishAssuranceCase(scene.ownerId, scene.caseId));

		expectSuccess(await publishAssuranceCase(scene.ownerId, scene.caseId));

		expect(await currentRows(scene.caseId)).toHaveLength(1);
		expect(inconsistencies(await storedState(scene.caseId))).toEqual([]);
	});

	it("does not give a published case another case's slug", async () => {
		const { scene, slug } = await publishedOnce();
		const other = await completeScene("CASE");
		await prisma.assuranceCase.update({
			where: { id: other.caseId },
			data: { name: "Other Case Name" },
		});
		expectSuccess(await publishAssuranceCase(other.ownerId, other.caseId));

		expectSuccess(await publishAssuranceCase(scene.ownerId, scene.caseId));

		expect(await slugOf(scene.caseId)).toBe(slug);
		expect(await slugOf(other.caseId)).not.toBe(slug);
	});
});
