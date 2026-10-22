import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashApiTokenSecret } from "@/lib/auth/api-token-service";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { isPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import {
	DEMO_CASE_ID,
	DEMO_FIXTURES,
	DEMO_USERNAME,
	type DemoFixture,
	DemoSeedError,
	seedDemoAccount,
} from "../../../prisma/seed/demo-account-seed";
import {
	findLeak,
	makeSecrets,
	snapshotDatabase,
} from "../utils/demo-account-kit";
import {
	caseNameIn,
	committedFixturePath,
	committedFixtureText,
	copyWithFreshIds,
	elementIdsIn,
	makeDirectoryNamed,
	makeTempDir,
	type TempFixture,
	writeShowcase,
	writeText,
} from "../utils/demo-fixture-files";

/**
 * The demo account's case list: every listed file is imported under its own
 * fixed case id with the element ids it holds, the pipeline integration
 * stays tied to the Bluebird case, a list without it is refused, and a broken
 * file fails the seed by name.
 */

const SECRETS = makeSecrets();
const BLUEBIRD_FILE = "bluebird-demo-case.json";
const CANARY = "Qv7xK2pL-not-for-output";
/** The start of the note; a parser error quotes only a few characters of the text it rejects. */
const CANARY_START = CANARY.slice(0, 8);
const TURING_PROJECT = /bluebird|darter|fastnet/i;

let dir = "";

beforeEach(() => {
	dir = makeTempDir();
	vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
});

afterEach(() => {
	resetLogSink();
	rmSync(dir, { recursive: true, force: true });
	vi.unstubAllEnvs();
});

const bluebird = (): DemoFixture => ({
	file: committedFixturePath(BLUEBIRD_FILE),
	caseId: DEMO_CASE_ID,
});

function textOf(fixture: DemoFixture): string {
	return readFileSync(resolve(committedFixturePath(""), fixture.file), "utf-8");
}

async function wipe(): Promise<void> {
	await prisma.$executeRawUnsafe("TRUNCATE TABLE users CASCADE");
}

interface CaseState {
	elementIds: string[];
	id: string;
	name: string;
	ownerId: string;
}

/** Every case in the database, with its owner and its element ids, by case id. */
async function casesInDatabase(): Promise<CaseState[]> {
	const cases = await prisma.assuranceCase.findMany({
		include: { elements: { select: { id: true } } },
		orderBy: { id: "asc" },
	});
	return cases.map((row) => ({
		id: row.id,
		name: row.name,
		ownerId: row.createdById,
		elementIds: row.elements.map((element) => element.id).sort(),
	}));
}

/** The cases `fixtures` should have produced for `ownerId`, by case id. */
function casesExpectedFrom(
	fixtures: readonly DemoFixture[],
	ownerId: string
): CaseState[] {
	return fixtures
		.map((fixture) => ({
			id: fixture.caseId,
			name: caseNameIn(textOf(fixture)),
			ownerId,
			elementIds: elementIdsIn(textOf(fixture)),
		}))
		.sort((a, b) => a.id.localeCompare(b.id));
}

async function demoUserId(): Promise<string> {
	const user = await prisma.user.findUniqueOrThrow({
		where: { username: DEMO_USERNAME },
	});
	return user.id;
}

/** The error the seed rejects with; fails if it does not reject. */
async function failureOf(fixtures: readonly DemoFixture[]): Promise<unknown> {
	return await seedDemoAccount(SECRETS, fixtures).then(
		() => {
			throw new Error("the seed was expected to fail and did not");
		},
		(error: unknown) => error
	);
}

/** A copy of the Bluebird file whose element ids are `ids`, so it collides with the file they came from. */
function copyWithIds(ids: string[]): string {
	let text = copyWithFreshIds("Clashing case");
	for (const [index, id] of elementIdsIn(text).entries()) {
		text = text.replaceAll(id, ids[index] ?? id);
	}
	return text;
}

/** `text` with a case description that must never be printed. */
function withCanary(text: string): string {
	const parsed = JSON.parse(text) as { case: { description: string } };
	parsed.case.description = CANARY;
	return JSON.stringify(parsed);
}

/** A copy that holds the canary and an element type the import schema does not know. */
function refusedCopy(): string {
	const parsed = JSON.parse(withCanary(copyWithFreshIds("Refused case"))) as {
		tree: { children: { type: string }[] };
	};
	for (const child of parsed.tree.children) {
		child.type = "NOT_AN_ELEMENT_TYPE";
	}
	return JSON.stringify(parsed);
}

/** The pipeline's rows: the connections and integrations, every token hash, and every case grant. */
async function pipelineRows() {
	const integrations = await prisma.integration.findMany();
	const tokens = await prisma.apiToken.findMany();
	const grants = await prisma.casePermission.findMany();
	return {
		connections: await prisma.userModelConnection.count(),
		integrations: integrations.length,
		tokenHashes: tokens.map((token) => token.tokenHash),
		grants: grants.map((grant) => ({
			caseId: grant.caseId,
			permission: grant.permission,
			toIntegration: grant.userId === integrations[0]?.systemUserId,
		})),
	};
}

function filesNamingATuringProject(fixtures: readonly DemoFixture[]): string[] {
	return fixtures
		.filter((fixture) => TURING_PROJECT.test(textOf(fixture)))
		.map((fixture) => fixture.file);
}

describe("importing the listed cases", () => {
	const lists: [string, () => readonly DemoFixture[] | undefined][] = [
		["the committed list", () => undefined],
		[
			"a list of three cases, Bluebird last",
			() => [
				writeShowcase(dir, "first"),
				writeShowcase(dir, "second"),
				bluebird(),
			],
		],
	];

	it.each(lists)(
		"imports every case under its fixed id with the element ids of its file, and again after the data is wiped: %s",
		async (_name, makeList) => {
			const list = makeList();
			for (const _round of [1, 2]) {
				const result = await seedDemoAccount(SECRETS, list);
				expect(result).toMatchObject({
					status: "created",
					caseId: DEMO_CASE_ID,
				});
				expect(await casesInDatabase()).toEqual(
					casesExpectedFrom(list ?? DEMO_FIXTURES, await demoUserId())
				);
				await wipe();
			}
		},
		60_000
	);
});

describe("the pipeline integration", () => {
	it("is granted the Bluebird case and no other, wherever Bluebird sits in the list", async () => {
		const first = writeShowcase(dir, "first");
		const second = writeShowcase(dir, "second");

		const list = [first, bluebird(), second];

		await seedDemoAccount(SECRETS, list);

		expect(await casesInDatabase()).toEqual(
			casesExpectedFrom(list, await demoUserId())
		);
		const integration = await prisma.integration.findFirstOrThrow({
			include: { tokens: true },
		});
		expect(await prisma.integration.count()).toBe(1);
		expect(integration.tokens).toHaveLength(1);
		expect(await prisma.userModelConnection.count()).toBe(1);
		const grants = await prisma.casePermission.findMany({
			where: { userId: integration.systemUserId },
		});
		expect(grants.map((grant) => [grant.caseId, grant.permission])).toEqual([
			[DEMO_CASE_ID, "EDIT"],
		]);
		const system = integration.systemUserId;
		expect(
			await canAccessCase({ userId: system, caseId: DEMO_CASE_ID }, "EDIT")
		).toBe(true);
		for (const other of [first, second]) {
			expect(
				await canAccessCase({ userId: system, caseId: other.caseId })
			).toBe(false);
		}
	}, 60_000);
});

const brokenFiles: [string, (good: TempFixture) => DemoFixture][] = [
	[
		"is missing",
		() => ({ file: join(dir, "missing.json"), caseId: randomUUID() }),
	],
	[
		"is a directory",
		() => ({
			file: makeDirectoryNamed(dir, "folder.json"),
			caseId: randomUUID(),
		}),
	],
	[
		"is not JSON",
		() => ({
			file: writeText(dir, "garbled.json", `${CANARY} is not JSON`),
			caseId: randomUUID(),
		}),
	],
	[
		"is refused by the import schema",
		() => ({
			file: writeText(dir, "refused.json", refusedCopy()),
			caseId: randomUUID(),
		}),
	],
	[
		"holds an element id another case already has",
		(good) => ({
			file: writeText(
				dir,
				"clash.json",
				withCanary(copyWithIds(good.elementIds))
			),
			caseId: randomUUID(),
		}),
	],
	[
		"is listed under a case id another case already has",
		(good) => ({
			file: writeText(
				dir,
				"shared.json",
				withCanary(copyWithFreshIds("Shared id"))
			),
			caseId: good.caseId,
		}),
	],
];

describe("a broken case file", () => {
	it.each(brokenFiles)(
		"fails the seed naming the file, with neither its contents nor a secret in the message: it %s",
		async (_name, makeBroken) => {
			const good = writeShowcase(dir, "good");
			const broken = makeBroken(good);
			const logged: LogEntry[] = [];
			setLogSink((entry) => logged.push(entry));

			const error = await failureOf([bluebird(), good, broken]);

			expect(error).toBeInstanceOf(DemoSeedError);
			const message = (error as Error).message;
			expect(message).toContain(basename(broken.file));
			expect(message).not.toContain(CANARY_START);
			expect(findLeak(message, Object.values(SECRETS))).toBeNull();
			const log = JSON.stringify(logged);
			expect(log).not.toContain(CANARY_START);
			for (const secret of Object.values(SECRETS)) {
				expect(log).not.toContain(secret);
			}
		},
		60_000
	);
});

describe("a case file that cannot be used", () => {
	it.each([
		[
			"is not valid JSON",
			() => writeText(dir, "garbled.json", "{ not json"),
			"it is not valid JSON",
		],
		[
			"is refused by the import schema",
			() =>
				writeText(
					dir,
					"refused.json",
					JSON.stringify({ version: "1.0", case: {}, tree: {} })
				),
			"Invalid import data",
		],
		["is not there", () => join(dir, "missing.json"), "it could not be read"],
	])(
		"fails the seed with the file's path and the reason: it %s",
		async (_name, makeFile, reason) => {
			const file = makeFile();

			const error = await failureOf([
				bluebird(),
				{ file, caseId: randomUUID() },
			]);

			expect(error).toBeInstanceOf(DemoSeedError);
			expect((error as Error).message).toContain(
				`Could not import ${file}: ${reason}`
			);
		},
		60_000
	);
});

describe("a list without the Bluebird case", () => {
	it("is refused with an error saying the Bluebird case is missing, and nothing is written", async () => {
		const before = await snapshotDatabase();

		const error = await failureOf([
			writeShowcase(dir, "first"),
			writeShowcase(dir, "second"),
		]);

		expect(error).toBeInstanceOf(DemoSeedError);
		expect((error as Error).message).toContain("Bluebird case is missing");
		expect(await snapshotDatabase()).toEqual(before);
	}, 60_000);
});

describe("a list with the Bluebird case twice", () => {
	it("is refused with an error saying the Bluebird case is listed more than once, naming both files, and nothing is written", async () => {
		const before = await snapshotDatabase();
		const again: DemoFixture = {
			file: writeShowcase(dir, "again").file,
			caseId: DEMO_CASE_ID,
		};

		const error = await failureOf([
			bluebird(),
			writeShowcase(dir, "other"),
			again,
		]);

		expect(error).toBeInstanceOf(DemoSeedError);
		const message = (error as Error).message;
		expect(message).toContain("more than once");
		expect(message).toContain(BLUEBIRD_FILE);
		expect(message).toContain(again.file);
		expect(await snapshotDatabase()).toEqual(before);
	}, 60_000);
});

describe("a failure part-way through the list", () => {
	it("leaves the user, the plugins, Bluebird, the pipeline wiring and the cases before the broken file, and nothing after it; a retry changes nothing and a wipe clears it", async () => {
		const good = writeShowcase(dir, "good");
		const late = writeShowcase(dir, "late");
		const clash: DemoFixture = {
			file: writeText(dir, "clash.json", copyWithIds(good.elementIds)),
			caseId: randomUUID(),
		};

		await failureOf([bluebird(), good, clash, late]);

		const userId = await demoUserId();
		expect(await isPluginEnabledForUser("tea.health", userId)).toBe(true);
		expect(await isPluginEnabledForUser("tea.assistant", userId)).toBe(true);
		expect(await casesInDatabase()).toEqual(
			casesExpectedFrom([bluebird(), good], userId)
		);
		expect(await pipelineRows()).toEqual({
			connections: 1,
			integrations: 1,
			tokenHashes: [hashApiTokenSecret(SECRETS.pipelineToken)],
			grants: [
				{ caseId: DEMO_CASE_ID, permission: "EDIT", toIntegration: true },
			],
		});

		const before = await snapshotDatabase();
		const retry = await seedDemoAccount(SECRETS, [bluebird(), good, late]);
		expect(retry).toEqual({ status: "exists" });
		expect(await snapshotDatabase()).toEqual(before);

		await wipe();
		const complete = [bluebird(), good, late];
		await seedDemoAccount(SECRETS, complete);
		expect(await casesInDatabase()).toEqual(
			casesExpectedFrom(complete, await demoUserId())
		);
		expect(await prisma.integration.count()).toBe(1);
	}, 90_000);
});

describe("the committed fixture list", () => {
	it("lists Bluebird once under its fixed id, and every case under a case id, file and element ids of its own", () => {
		const bluebirds = DEMO_FIXTURES.filter(
			(fixture) => fixture.caseId === DEMO_CASE_ID
		);
		expect(bluebirds.map((fixture) => basename(fixture.file))).toEqual([
			BLUEBIRD_FILE,
		]);
		const files = DEMO_FIXTURES.map((fixture) =>
			resolve(committedFixturePath(""), fixture.file)
		);
		expect(new Set(files).size).toBe(files.length);
		const caseIds = DEMO_FIXTURES.map((fixture) => fixture.caseId);
		expect(new Set(caseIds).size).toBe(caseIds.length);
		const elementIds = DEMO_FIXTURES.flatMap((fixture) =>
			elementIdsIn(textOf(fixture))
		);
		expect(new Set(elementIds).size).toBe(elementIds.length);
	});

	it("names no Turing project in any showcase file", () => {
		const showcases = DEMO_FIXTURES.filter(
			(fixture) => basename(fixture.file) !== BLUEBIRD_FILE
		);

		expect(filesNamingATuringProject(showcases)).toEqual([]);
	});

	it("notices each project name in any letter case, anywhere in a file", () => {
		const withoutBluebird = committedFixtureText(BLUEBIRD_FILE).replace(
			/bluebird(atc)?/gi,
			"Kestrel"
		);
		const flagged = [
			"Bluebird",
			"BLUEBIRDATC",
			"darter",
			"DARTER",
			"fastNET",
		].map((name) =>
			writeText(
				dir,
				`${name}.json`,
				withoutBluebird.replace(
					"Argument over data quality",
					`Argument over ${name}`
				)
			)
		);
		const clean = writeText(dir, "clean.json", withoutBluebird);
		const all = [...flagged, clean].map((file) => ({ file, caseId: file }));

		expect(filesNamingATuringProject(all)).toEqual(flagged);
	});
});
