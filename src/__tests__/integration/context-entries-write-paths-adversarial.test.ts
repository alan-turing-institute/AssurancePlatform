// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
/**
 * The rules for a named context entry, sent through every way a case can be
 * written: a single edit, a create, the JSON editor's batch (an update and a
 * create), an uploaded import file, and the GitHub and Google Drive imports.
 * Each rule is checked on each path with the same entries, so a path that
 * skips a rule shows up as one failing row.
 *
 * Every rejection row is paired with a control in the same test that sends a
 * valid entry down the same path and expects it to be stored, so a path that
 * refuses everything cannot pass.
 */
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

// The two remote sources are the network boundary; everything after the file
// has been fetched is the real import.
const remote = vi.hoisted(() => ({ content: "" }));

vi.mock("@/lib/services/github-api-service", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("@/lib/services/github-api-service")
	>()),
	hasGitHubToken: vi.fn().mockResolvedValue(true),
	fetchFileFromGitHub: vi.fn(() =>
		Promise.resolve({
			data: {
				content: remote.content,
				path: "case.json",
				sha: "sha",
				size: remote.content.length,
			},
		})
	),
}));

vi.mock("@/lib/services/google-drive-service", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("@/lib/services/google-drive-service")
	>()),
	hasGoogleToken: vi.fn().mockResolvedValue(true),
	downloadFileFromDrive: vi.fn(() =>
		Promise.resolve({ data: { content: remote.content, name: "case.json" } })
	),
}));

beforeEach(async () => {
	await mockNoAuth();
	remote.content = "";
});

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";
const ID_C = "cccccccccc";
const SEED_TEXT = "existing plain entry";

function named(overrides: Record<string, unknown> = {}) {
	return {
		id: ID_A,
		name: "window",
		text: "the interval",
		value: "5 minutes",
		...overrides,
	};
}

interface World {
	caseId: string;
	goalId: string;
	userId: string;
}

interface Elsewhere {
	entries: unknown[];
	inBin?: boolean;
}

interface Outcome {
	message: string;
	/** The context stored on the element the request tried to write, or undefined when there is no such element. */
	persisted: () => Promise<unknown[] | undefined>;
	status: number;
}

interface WritePath {
	/** Paths that can place an entry on an element in the bin. */
	hasBin: boolean;
	label: string;
	/** A path whose target already exists, so a failed write leaves its seed text behind. */
	targetExists: boolean;
	write: (
		world: World,
		entries: unknown[],
		elsewhere?: Elsewhere
	) => Promise<Outcome>;
}

async function makeWorld(): Promise<World> {
	const user = await createTestUser();
	const testCase = await createTestCase(user.id);
	const goal = await createTestElement(testCase.id, user.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	await setContext(goal.id, [SEED_TEXT]);
	await mockAuth(user.id, user.username, user.email);
	return { userId: user.id, caseId: testCase.id, goalId: goal.id };
}

async function setContext(elementId: string, context: unknown[]) {
	await prisma.$executeRaw`UPDATE assurance_elements SET context = ${JSON.stringify(context)}::jsonb WHERE id = ${elementId}`;
}

async function storedContext(elementId: string) {
	const [row] = await prisma.$queryRaw<
		{ context: unknown[] }[]
	>`SELECT context FROM assurance_elements WHERE id = ${elementId}`;
	return row?.context;
}

/** Puts an entry list on another element of the case, live or in the bin. */
async function seedElsewhere(world: World, elsewhere: Elsewhere | undefined) {
	if (!elsewhere) {
		return;
	}
	const other = await createTestElement(world.caseId, world.userId, {
		elementType: "STRATEGY",
		name: "S9",
		parentId: world.goalId,
	});
	await setContext(other.id, elsewhere.entries);
	if (elsewhere.inBin) {
		await prisma.$executeRaw`UPDATE assurance_elements SET deleted_at = now() WHERE id = ${other.id}`;
	}
}

async function json(response: Response) {
	const text = await response.text();
	return { text, body: text ? JSON.parse(text) : null };
}

function jsonRequest(url: string, method: string, body: unknown) {
	return new NextRequest(url, {
		method,
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

// ---------------------------------------------------------------------------
// Import files
// ---------------------------------------------------------------------------

function importFile(
	version: string,
	entries: unknown[],
	elsewhere?: Elsewhere
): Record<string, unknown> {
	return {
		version,
		exportedAt: "2026-01-01T00:00:00.000Z",
		case: { name: "Imported", description: "An imported case" },
		tree: {
			id: randomUUID(),
			type: "GOAL",
			name: "G1",
			description: "Goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			context: entries,
			children: elsewhere
				? [
						{
							id: randomUUID(),
							type: "STRATEGY",
							name: "S1",
							description: "Strategy",
							inSandbox: false,
							context: elsewhere.entries,
							children: [],
						},
					]
				: [],
		},
	};
}

async function importedRootContext(body: { id?: string } | null) {
	if (!body?.id) {
		return;
	}
	const root = await prisma.assuranceElement.findFirst({
		where: { caseId: body.id, parentId: null },
		select: { id: true },
	});
	return root ? await storedContext(root.id) : undefined;
}

async function withStatus(
	response: Response,
	build: (body: { id?: string } | null) => Outcome["persisted"]
): Promise<Outcome> {
	const { text, body } = await json(response);
	return { status: response.status, message: text, persisted: build(body) };
}

// ---------------------------------------------------------------------------
// The paths
// ---------------------------------------------------------------------------

const PATHS: WritePath[] = [
	{
		label: "PUT /api/elements/[id] (single edit)",
		hasBin: true,
		targetExists: true,
		write: async (world, entries, elsewhere) => {
			await seedElsewhere(world, elsewhere);
			const { PUT } = await import("@/app/api/elements/[id]/route");
			const response = await PUT(
				jsonRequest(
					`http://localhost:3000/api/elements/${world.goalId}`,
					"PUT",
					{ context: entries }
				),
				{ params: Promise.resolve({ id: world.goalId }) }
			);
			return withStatus(response, () => () => storedContext(world.goalId));
		},
	},
	{
		label: "POST /api/cases/[id]/elements (create)",
		hasBin: true,
		targetExists: false,
		write: async (world, entries, elsewhere) => {
			await seedElsewhere(world, elsewhere);
			const { POST } = await import("@/app/api/cases/[id]/elements/route");
			const response = await POST(
				jsonRequest(
					`http://localhost:3000/api/cases/${world.caseId}/elements`,
					"POST",
					{
						type: "strategy",
						parentId: world.goalId,
						description: "A new strategy",
						context: entries,
					}
				),
				{ params: Promise.resolve({ id: world.caseId }) }
			);
			return withStatus(
				response,
				(body) => async () =>
					body?.id ? await storedContext(body.id) : undefined
			);
		},
	},
	{
		label: "POST /api/cases/[id]/batch (update)",
		hasBin: true,
		targetExists: true,
		write: async (world, entries, elsewhere) => {
			await seedElsewhere(world, elsewhere);
			const { POST } = await import("@/app/api/cases/[id]/batch/route");
			const response = await POST(
				jsonRequest(
					`http://localhost:3000/api/cases/${world.caseId}/batch`,
					"POST",
					{
						changes: [
							{
								type: "update",
								elementId: world.goalId,
								data: { context: entries },
							},
						],
					}
				),
				{ params: Promise.resolve({ id: world.caseId }) }
			);
			return withStatus(response, () => () => storedContext(world.goalId));
		},
	},
	{
		label: "POST /api/cases/[id]/batch (create)",
		hasBin: true,
		targetExists: false,
		write: async (world, entries, elsewhere) => {
			await seedElsewhere(world, elsewhere);
			const newId = randomUUID();
			const { POST } = await import("@/app/api/cases/[id]/batch/route");
			const response = await POST(
				jsonRequest(
					`http://localhost:3000/api/cases/${world.caseId}/batch`,
					"POST",
					{
						changes: [
							{
								type: "create",
								elementId: newId,
								parentId: world.goalId,
								data: {
									id: newId,
									type: "STRATEGY",
									name: "S1",
									description: "A new strategy",
									inSandbox: false,
									context: entries,
								},
							},
						],
					}
				),
				{ params: Promise.resolve({ id: world.caseId }) }
			);
			return withStatus(response, () => () => storedContext(newId));
		},
	},
	{
		label: "POST /api/cases/import (upload)",
		hasBin: false,
		targetExists: false,
		write: async (_world, entries, elsewhere) => {
			const { POST } = await import("@/app/api/cases/import/route");
			const response = await POST(
				jsonRequest(
					"http://localhost:3000/api/cases/import",
					"POST",
					importFile("1.1", entries, elsewhere)
				)
			);
			return withStatus(response, (body) => () => importedRootContext(body));
		},
	},
	{
		label: "POST /api/cases/import/github",
		hasBin: false,
		targetExists: false,
		write: async (_world, entries, elsewhere) => {
			remote.content = JSON.stringify(importFile("1.1", entries, elsewhere));
			const { POST } = await import("@/app/api/cases/import/github/route");
			const response = await POST(
				jsonRequest("http://localhost:3000/api/cases/import/github", "POST", {
					url: "o/r/case.json",
					owner: "o",
					repo: "r",
					path: "case.json",
				})
			);
			return withStatus(response, (body) => () => importedRootContext(body));
		},
	},
	{
		label: "POST /api/cases/import/gdrive",
		hasBin: false,
		targetExists: false,
		write: async (_world, entries, elsewhere) => {
			remote.content = JSON.stringify(importFile("1.1", entries, elsewhere));
			const { POST } = await import("@/app/api/cases/import/gdrive/route");
			const response = await POST(
				jsonRequest("http://localhost:3000/api/cases/import/gdrive", "POST", {
					fileId: "file-1",
				})
			);
			return withStatus(response, (body) => () => importedRootContext(body));
		},
	},
];

const ALL = PATHS.map((path) => [path.label, path] as const);
const WITH_BIN = PATHS.filter((path) => path.hasBin).map(
	(path) => [path.label, path] as const
);

/** Sends a valid entry down the path and checks it is stored as sent. */
async function expectControlAccepted(path: WritePath) {
	const world = await makeWorld();
	const outcome = await path.write(world, [SEED_TEXT, named()]);
	expect(outcome.message).not.toContain('"error"');
	expect(outcome.status).toBeGreaterThanOrEqual(200);
	expect(outcome.status).toBeLessThan(300);
	expect(await outcome.persisted()).toEqual([SEED_TEXT, named()]);
}

/** Sends an invalid list and checks the answer is a 400 naming the problem and nothing was stored. */
async function expectRejected(
	path: WritePath,
	entries: unknown[],
	mentions: string,
	elsewhere?: Elsewhere
) {
	const world = await makeWorld();
	const outcome = await path.write(world, entries, elsewhere);
	expect(outcome.status).toBe(400);
	expect(outcome.message.toLowerCase()).toContain(mentions.toLowerCase());
	expect(outcome.message).not.toContain("Invalid input: expected string");
	const persisted = await outcome.persisted();
	expect(persisted).toEqual(path.targetExists ? [SEED_TEXT] : undefined);
}

describe("a valid named entry", () => {
	it.each(ALL)("is stored exactly as sent by %s", async (_label, path) => {
		await expectControlAccepted(path);
	});

	it.each(
		ALL
	)("is stored with its name trimmed by %s", async (_label, path) => {
		const world = await makeWorld();
		const outcome = await path.write(world, [named({ name: "  window  " })]);
		expect(outcome.status).toBeLessThan(300);
		expect(await outcome.persisted()).toEqual([named({ name: "window" })]);
	});

	it.each(
		ALL
	)("accepts a 40-character name and a 500-character value on %s", async (_label, path) => {
		const world = await makeWorld();
		const entry = named({ name: `a${"b".repeat(39)}`, value: "v".repeat(500) });
		const outcome = await path.write(world, [entry]);
		expect(outcome.status).toBeLessThan(300);
		expect(await outcome.persisted()).toEqual([entry]);
	});
});

describe("a name that breaks the format", () => {
	const BAD_NAMES = [
		"1window",
		"-window",
		"win.dow",
		"win{dow",
		"win#dow",
		"",
		"   ",
		"a".repeat(41),
		"<b>window</b>",
		"window<script>alert(1)</script>",
	];

	it.each(ALL)("is refused with a 400 by %s", async (_label, path) => {
		await expectControlAccepted(path);
		for (const name of BAD_NAMES) {
			await expectRejected(path, [named({ name })], "context entry");
		}
	});
});

describe("a value that is too long", () => {
	it.each(ALL)("is refused with a 400 by %s", async (_label, path) => {
		await expectControlAccepted(path);
		await expectRejected(
			path,
			[named({ value: "v".repeat(501) })],
			"context entry"
		);
	});
});

describe("the message for the rule a named entry breaks", () => {
	const RULES: [string, Record<string, unknown>, string][] = [
		[
			"a name that starts with a digit",
			{ name: "1window" },
			"start with a letter",
		],
		[
			"a name of 41 characters",
			{ name: "a".repeat(41) },
			"at most 40 characters",
		],
		[
			"a value of 501 characters",
			{ value: "v".repeat(501) },
			"at most 500 characters",
		],
		[
			"an id of the wrong form",
			{ id: "ABC" },
			"10 lowercase letters or digits",
		],
	];
	const SHOWN = [
		["a single edit", 0],
		["an uploaded file", 4],
	] as const;

	for (const [where, index] of SHOWN) {
		it.each(
			RULES
		)(`tells the author which rule %s breaks, on ${where}`, async (_label, change, phrase) => {
			const path = PATHS[index];
			if (!path) {
				throw new Error("path missing");
			}
			await expectControlAccepted(path);
			const world = await makeWorld();
			const outcome = await path.write(world, [named(change)]);
			expect(outcome.status).toBe(400);
			expect(outcome.message.toLowerCase()).toContain(phrase.toLowerCase());
		});
	}
});

describe("an entry that is not a string or a complete record", () => {
	const BAD_ENTRIES: [string, unknown][] = [
		["a record without a text", { id: ID_A, name: "window" }],
		["a record with an extra key", named({ hidden: false })],
		["a number", 5],
		["null", null],
		["a nested list", [["x"]]],
	];

	it.each(ALL)("is refused with a 400 by %s", async (_label, path) => {
		await expectControlAccepted(path);
		for (const [, entry] of BAD_ENTRIES) {
			const world = await makeWorld();
			const outcome = await path.write(world, [entry]);
			expect(outcome.status).toBe(400);
			expect(outcome.message).not.toContain("Invalid input: expected string");
			expect(await outcome.persisted()).toEqual(
				path.targetExists ? [SEED_TEXT] : undefined
			);
		}
	});
});

describe("the same name twice on one element", () => {
	it.each(
		ALL
	)("is refused by %s, whatever the case and surrounding space", async (_label, path) => {
		await expectControlAccepted(path);
		await expectRejected(
			path,
			[named({ name: "Window" }), named({ id: ID_B, name: " window " })],
			"unique"
		);
	});

	it.each(
		ALL
	)("is allowed on two different elements by %s", async (_label, path) => {
		const world = await makeWorld();
		const outcome = await path.write(world, [named()], {
			entries: [named({ id: ID_B })],
		});
		expect(outcome.status).toBeLessThan(300);
		expect(await outcome.persisted()).toEqual([named()]);
	});
});

describe("an id that is not ten lowercase letters or digits", () => {
	const BAD_IDS: unknown[] = [
		"ABCDEFGHIJ",
		"abcdefghi",
		"abcdefghijk",
		"abcdefghi-",
		"abcdefghi ",
		"",
		5,
		null,
	];

	it.each(ALL)("is refused with a 400 by %s", async (_label, path) => {
		await expectControlAccepted(path);
		for (const id of BAD_IDS) {
			await expectRejected(path, [named({ id })], "context entry");
		}
	});
});

describe("an id used twice", () => {
	it.each(ALL)("on one element is refused by %s", async (_label, path) => {
		await expectControlAccepted(path);
		await expectRejected(
			path,
			[named(), named({ name: "other" })],
			"more than one entry on the same element"
		);
	});

	it.each(
		ALL
	)("on another live element of the case is refused by %s", async (_label, path) => {
		await expectControlAccepted(path);
		await expectRejected(path, [named()], "more than one entry in this case", {
			entries: [named({ name: "elsewhere" })],
		});
	});

	it.each(
		WITH_BIN
	)("on an element in the bin is refused by %s", async (_label, path) => {
		await expectControlAccepted(path);
		await expectRejected(path, [named()], "more than one entry in this case", {
			entries: [named({ name: "elsewhere" })],
			inBin: true,
		});
	});

	it.each(
		WITH_BIN
	)("in another case is allowed by %s", async (_label, path) => {
		const world = await makeWorld();
		const otherUser = await createTestUser();
		const otherCase = await createTestCase(otherUser.id);
		const otherElement = await createTestElement(otherCase.id, otherUser.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await setContext(otherElement.id, [named()]);
		const outcome = await path.write(world, [named()]);
		expect(outcome.status).toBeLessThan(300);
		expect(await outcome.persisted()).toEqual([named()]);
		expect(await storedContext(otherElement.id)).toEqual([named()]);
	});
});

describe("saving an element again", () => {
	it("keeps its own entry's id without a clash on a single edit and a batch update", async () => {
		for (const path of [PATHS[0], PATHS[2]]) {
			if (!path) {
				throw new Error("path missing");
			}
			const world = await makeWorld();
			await setContext(world.goalId, [SEED_TEXT, named()]);
			const outcome = await path.write(world, [
				SEED_TEXT,
				named({ text: "a better meaning" }),
			]);
			expect(outcome.status).toBeLessThan(300);
			expect(await outcome.persisted()).toEqual([
				SEED_TEXT,
				named({ text: "a better meaning" }),
			]);
		}
	});

	it("leaves the entries alone when a single edit does not mention context", async () => {
		const world = await makeWorld();
		await setContext(world.goalId, [SEED_TEXT, named()]);
		const { PUT } = await import("@/app/api/elements/[id]/route");
		const response = await PUT(
			jsonRequest(`http://localhost:3000/api/elements/${world.goalId}`, "PUT", {
				description: "Only the description changes",
			}),
			{ params: Promise.resolve({ id: world.goalId }) }
		);
		expect(response.status).toBe(200);
		expect(await storedContext(world.goalId)).toEqual([SEED_TEXT, named()]);
	});

	it("turns a named entry back into plain text and lets another element take its id", async () => {
		const world = await makeWorld();
		await setContext(world.goalId, [named()]);
		const first = await PATHS[0]?.write(world, ["now plain text"]);
		expect(first?.status).toBe(200);
		const other = await createTestElement(world.caseId, world.userId, {
			elementType: "STRATEGY",
			name: "S9",
			parentId: world.goalId,
		});
		const { PUT } = await import("@/app/api/elements/[id]/route");
		const response = await PUT(
			jsonRequest(`http://localhost:3000/api/elements/${other.id}`, "PUT", {
				context: [named()],
			}),
			{ params: Promise.resolve({ id: other.id }) }
		);
		expect(response.status).toBe(200);
	});
});

describe("the JSON editor's batch, judged on the case as it will stand afterwards", () => {
	async function batch(world: World, changes: unknown[]) {
		const { POST } = await import("@/app/api/cases/[id]/batch/route");
		const { text, body } = await json(
			await POST(
				jsonRequest(
					`http://localhost:3000/api/cases/${world.caseId}/batch`,
					"POST",
					{ changes }
				),
				{ params: Promise.resolve({ id: world.caseId }) }
			)
		);
		return { text, body };
	}

	function createChange(
		world: World,
		id: string,
		name: string,
		entries: unknown[]
	) {
		return {
			type: "create",
			elementId: id,
			parentId: world.goalId,
			data: {
				id,
				type: "STRATEGY",
				name,
				description: "A strategy",
				inSandbox: false,
				context: entries,
			},
		};
	}

	it("lets a batch delete an element that holds an entry and create the same entry again", async () => {
		const world = await makeWorld();
		const old = await createTestElement(world.caseId, world.userId, {
			elementType: "STRATEGY",
			name: "S1",
			parentId: world.goalId,
		});
		await setContext(old.id, [named()]);
		const newId = randomUUID();
		const response = await batch(world, [
			{ type: "delete", elementId: old.id },
			createChange(world, newId, "S2", [named({ text: "re-created" })]),
		]);
		expect(response.text).not.toContain('"error"');
		expect(await storedContext(newId)).toEqual([named({ text: "re-created" })]);
		expect(await storedContext(old.id)).toBeUndefined();
	});

	it("lets a batch move an entry from one element to another", async () => {
		const world = await makeWorld();
		const from = await createTestElement(world.caseId, world.userId, {
			elementType: "STRATEGY",
			name: "S1",
			parentId: world.goalId,
		});
		await setContext(from.id, [named()]);
		const toId = randomUUID();
		const response = await batch(world, [
			{ type: "update", elementId: from.id, data: { context: [] } },
			createChange(world, toId, "S2", [named()]),
		]);
		expect(response.text).not.toContain('"error"');
		expect(await storedContext(from.id)).toEqual([]);
		expect(await storedContext(toId)).toEqual([named()]);
	});

	it("refuses a batch that creates two elements with the same id and stores neither", async () => {
		const world = await makeWorld();
		const first = randomUUID();
		const second = randomUUID();
		const response = await batch(world, [
			createChange(world, first, "S1", [named()]),
			createChange(world, second, "S2", [named({ name: "other" })]),
		]);
		expect(response.body?.error ?? response.text).toContain("more than one");
		expect(await storedContext(first)).toBeUndefined();
		expect(await storedContext(second)).toBeUndefined();
	});

	it("refuses a batch that deletes one holder of an id but leaves another", async () => {
		const world = await makeWorld();
		const one = await createTestElement(world.caseId, world.userId, {
			elementType: "STRATEGY",
			name: "S1",
			parentId: world.goalId,
		});
		await setContext(one.id, [named()]);
		const three = await createTestElement(world.caseId, world.userId, {
			elementType: "STRATEGY",
			name: "S3",
			parentId: world.goalId,
		});
		await setContext(three.id, [named({ name: "kept" })]);
		const created = randomUUID();
		const response = await batch(world, [
			{ type: "delete", elementId: one.id },
			createChange(world, created, "S2", [named({ name: "again" })]),
		]);
		expect(response.text).toContain("more than one");
		expect(await storedContext(one.id)).toEqual([named()]);
		expect(await storedContext(created)).toBeUndefined();
	});
});

describe("a file that says 1.0 but holds a named entry", () => {
	const IMPORTS: [string, (file: unknown) => Promise<Response>][] = [
		[
			"upload",
			async (file) => {
				const { POST } = await import("@/app/api/cases/import/route");
				return await POST(
					jsonRequest("http://localhost:3000/api/cases/import", "POST", file)
				);
			},
		],
		[
			"github",
			async (file) => {
				remote.content = JSON.stringify(file);
				const { POST } = await import("@/app/api/cases/import/github/route");
				return await POST(
					jsonRequest("http://localhost:3000/api/cases/import/github", "POST", {
						url: "o/r/case.json",
						owner: "o",
						repo: "r",
						path: "case.json",
					})
				);
			},
		],
		[
			"gdrive",
			async (file) => {
				remote.content = JSON.stringify(file);
				const { POST } = await import("@/app/api/cases/import/gdrive/route");
				return await POST(
					jsonRequest("http://localhost:3000/api/cases/import/gdrive", "POST", {
						fileId: "f",
					})
				);
			},
		],
	];

	it.each(
		IMPORTS
	)("is refused by the %s import with a message that names both versions, and creates no case", async (_label, send) => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const accepted = await send(importFile("1.1", [named()]));
		expect(accepted.status).toBe(200);
		const before = await prisma.assuranceCase.count();

		const response = await send(importFile("1.0", [named()]));
		const { text } = await json(response);
		expect(response.status).toBe(400);
		expect(text).toContain("1.0");
		expect(text).toContain("1.1");
		expect(text).not.toContain("Invalid input");
		expect(await prisma.assuranceCase.count()).toBe(before);
	});

	it.each(
		IMPORTS
	)("is not refused by the %s import when it holds only plain text and a reference-shaped token", async (_label, send) => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const file = importFile("1.0", [`plain {w#${ID_C}}`]);
		const response = await send(file);
		expect(response.status).toBe(200);
	});
});
