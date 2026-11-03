import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { readPatternVariables } from "@/lib/services/case-from-pattern-service";
import { expectError, expectSameError } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase, NODE } from "../utils/case-kind-kit";
import {
	createPublishedRow,
	fullStateOf,
	makePattern,
	snapshotWithComments,
	worldCounts,
} from "../utils/pattern-start-kit";
import {
	NAME,
	type Source,
	STARTERS,
	type Starter,
} from "../utils/pattern-starters";
import {
	addTeamMember,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";
import {
	MORE,
	OTHER,
	ordinaryEntry,
	ref,
	SYS,
	setContext,
	setText,
	variableEntry,
} from "../utils/variables-kit";

/**
 * Giving values to a pattern's variables when a case is started from it,
 * through the service and the server action, from a pattern case and from a
 * published pattern; and the read of a pattern's variables that fills the
 * new-case dialog.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

type User = Awaited<ReturnType<typeof createTestUser>>;

const NOT_A_VARIABLE = "That pattern has no variable to give that value to";
const TOO_LONG = "Variable values must be at most 500 characters";
const NOT_FOUND = "Pattern not found";
const NOT_A_PATTERN = "That case is not a pattern";

async function elementIdByName(caseId: string, name: string) {
	const row = await prisma.assuranceElement.findFirstOrThrow({
		where: { caseId, name },
		select: { id: true },
	});
	return row.id;
}

/**
 * A pattern whose goal defines the variable `system` (no value) and an
 * ordinary name `window`, whose claim defines the variable `owner` with the
 * value Dana, and whose goal mentions `system` in its description.
 */
async function variablePattern(owner: User) {
	const pattern = await makePattern(owner);
	const goal = await elementIdByName(pattern.id, "G1");
	await setContext(goal, [variableEntry(), ordinaryEntry("5 minutes")]);
	await setContext(await elementIdByName(pattern.id, "P1"), [
		variableEntry("Dana", "owner", MORE, "Who is responsible"),
	]);
	await setText(goal, { description: `The ${ref("system", SYS)} is safe` });
	return pattern.id;
}

/** A source naming the pattern case itself. */
function caseSource(_owner: User, patternId: string): Source {
	return { patternCaseId: patternId };
}

/** A source naming a snapshot of the pattern published on Discover. */
async function publishedSource(
	owner: User,
	patternId: string
): Promise<Source> {
	const slug = `variables-${randomUUID().slice(0, 8)}`;
	await createPublishedRow({
		slug,
		assuranceCaseId: patternId,
		content: await snapshotWithComments(owner, patternId),
	});
	return { publishedSlug: slug };
}

type SourceFor = (owner: User, patternId: string) => Promise<Source> | Source;

/** Where a pattern can be read from. */
const SOURCES: [string, SourceFor][] = [
	["a pattern case", caseSource],
	["a published pattern", publishedSource],
];

async function entriesOf(caseId: string, elementName: string) {
	const row = await prisma.assuranceElement.findFirstOrThrow({
		where: { caseId, name: elementName },
		select: { context: true, description: true },
	});
	return { ...row, context: row.context as Record<string, unknown>[] };
}

async function startWith(
	starter: Starter,
	user: User,
	source: Source,
	values?: Record<string, string>
) {
	return await starter.start(user, source, NAME, "About it", values);
}

describe.each(
	STARTERS
)("starting a case with values for variables through %s", (_label, starter) => {
	describe.each(SOURCES)("from %s", (_source, sourceFor) => {
		async function world() {
			const owner = await createTestUser();
			const patternId = await variablePattern(owner);
			return { owner, patternId, source: await sourceFor(owner, patternId) };
		}

		it("gives each value to its variable, trimmed, and rewrites no text", async () => {
			const { owner, source } = await world();

			const outcome = await startWith(starter, owner, source, {
				[SYS]: "  AcmeBot  ",
			});

			if (!outcome.ok) {
				throw new Error(outcome.error);
			}
			const goal = await entriesOf(outcome.id, "G1");
			expect(goal.context).toEqual([
				variableEntry("AcmeBot"),
				ordinaryEntry("5 minutes"),
			]);
			expect(goal.description).toBe(`The ${ref("system", SYS)} is safe`);
			expect((await entriesOf(outcome.id, "P1")).context).toEqual([
				variableEntry("Dana", "owner", MORE, "Who is responsible"),
			]);
		});

		it("leaves a variable unset when its value is empty or blank, even one the pattern gave a value", async () => {
			const { owner, source } = await world();

			const outcome = await startWith(starter, owner, source, {
				[SYS]: "",
				[MORE]: "   ",
			});

			if (!outcome.ok) {
				throw new Error(outcome.error);
			}
			expect((await entriesOf(outcome.id, "G1")).context[0]).toEqual(
				variableEntry()
			);
			expect((await entriesOf(outcome.id, "P1")).context).toEqual([
				variableEntry(undefined, "owner", MORE, "Who is responsible"),
			]);
		});

		it("stores a value as entered, never as a reference or markup", async () => {
			const { owner, source } = await world();
			const entered = `${ref("window", OTHER)} <img src=x onerror=alert(1)> [system]`;

			const outcome = await startWith(starter, owner, source, {
				[SYS]: entered,
			});

			if (!outcome.ok) {
				throw new Error(outcome.error);
			}
			expect((await entriesOf(outcome.id, "G1")).context[0]).toEqual(
				variableEntry(entered)
			);
		});

		it("starts with no values and keeps what the pattern gives", async () => {
			const { owner, source } = await world();

			const outcome = await startWith(starter, owner, source);

			if (!outcome.ok) {
				throw new Error(outcome.error);
			}
			expect((await entriesOf(outcome.id, "G1")).context[0]).toEqual(
				variableEntry()
			);
			expect((await entriesOf(outcome.id, "P1")).context[0]).toMatchObject({
				value: "Dana",
			});
		});

		it("leaves the pattern as it was", async () => {
			const { owner, patternId, source } = await world();
			const before = await fullStateOf(patternId);
			const rows = await prisma.publishedAssuranceCase.findMany({
				orderBy: { slug: "asc" },
			});

			const outcome = await startWith(starter, owner, source, {
				[SYS]: "AcmeBot",
				[MORE]: "",
			});

			expect(outcome.ok).toBe(true);
			expect(await fullStateOf(patternId)).toEqual(before);
			expect(
				await prisma.publishedAssuranceCase.findMany({
					orderBy: { slug: "asc" },
				})
			).toEqual(rows);
		});

		it.each([
			["an id that matches nothing", "zzzzzzzzzz"],
			["the id of a named entry that is not a variable", OTHER],
			["the id of an element", NODE.goal],
		])("refuses a value for %s, creating nothing", async (_label, id) => {
			const { owner, source } = await world();
			const before = await worldCounts();

			const outcome = await startWith(starter, owner, source, {
				[SYS]: "AcmeBot",
				[id]: "A value",
			});

			expect(outcome).toEqual({ ok: false, error: NOT_A_VARIABLE });
			expect(await worldCounts()).toEqual(before);
		});

		it("refuses a value over 500 characters, creating nothing, and takes one of exactly 500", async () => {
			const { owner, source } = await world();
			const before = await worldCounts();

			const refused = await startWith(starter, owner, source, {
				[SYS]: "x".repeat(501),
			});
			expect(refused).toEqual({ ok: false, error: TOO_LONG });
			expect(await worldCounts()).toEqual(before);

			const padded = `  ${"x".repeat(500)}  `;
			const accepted = await startWith(starter, owner, source, {
				[SYS]: padded,
			});
			if (!accepted.ok) {
				throw new Error(accepted.error);
			}
			expect((await entriesOf(accepted.id, "G1")).context[0]).toEqual(
				variableEntry("x".repeat(500))
			);
		});
	});

	it("takes the variables of a published pattern from its snapshot, not from the pattern as it is now", async () => {
		const owner = await createTestUser();
		const patternId = await variablePattern(owner);
		const source = await publishedSource(owner, patternId);
		await setContext(await elementIdByName(patternId, "P1"), [
			variableEntry("Changed", "owner", MORE, "Who is responsible"),
		]);

		const outcome = await startWith(starter, owner, source, {
			[SYS]: "AcmeBot",
		});

		if (!outcome.ok) {
			throw new Error(outcome.error);
		}
		expect((await entriesOf(outcome.id, "P1")).context[0]).toMatchObject({
			value: "Dana",
		});
	});
});

describe("reading a pattern's variables", () => {
	it("lists them in tree order with name, meaning and any value, leaving out other entries", async () => {
		const owner = await createTestUser();
		const patternId = await variablePattern(owner);

		const result = await readPatternVariables(owner.id, {
			patternCaseId: patternId,
		});

		expect("data" in result && result.data).toEqual([
			{ id: SYS, name: "system", meaning: "the system under test" },
			{ id: MORE, name: "owner", meaning: "Who is responsible", value: "Dana" },
		]);
	});

	it.each([
		["a pattern shared with them directly", "direct"],
		["a pattern shared with their team", "team"],
	])("lets a user read %s", async (_label, route) => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const patternId = await variablePattern(owner);
		if (route === "direct") {
			await createTestPermission(patternId, user.id, owner.id, "VIEW");
		} else {
			const team = await createTestTeam(owner.id);
			await addTeamMember(team.id, user.id);
			await createTestTeamPermission(patternId, team.id, owner.id, "VIEW");
		}

		const result = await readPatternVariables(user.id, {
			patternCaseId: patternId,
		});

		expect("data" in result && result.data.map((v) => v.name)).toEqual([
			"system",
			"owner",
		]);
	});

	it("answers a user with no access as it answers a missing pattern", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const patternId = await variablePattern(owner);

		const noAccess = await readPatternVariables(stranger.id, {
			patternCaseId: patternId,
		});
		const missing = await readPatternVariables(stranger.id, {
			patternCaseId: randomUUID(),
		});

		expectError(noAccess, NOT_FOUND);
		expectSameError(noAccess, missing);
	});

	it("refuses a case that is not a pattern, a published case and a source that names nothing", async () => {
		const owner = await createTestUser();
		const ordinary = await createStoredCase(owner.id);
		await createPublishedRow({
			slug: "a-published-case",
			type: "ASSURANCE_CASE",
			assuranceCaseId: ordinary.id,
		});

		expectError(
			await readPatternVariables(owner.id, { patternCaseId: ordinary.id }),
			NOT_A_PATTERN
		);
		expectError(
			await readPatternVariables(owner.id, {
				publishedSlug: "a-published-case",
			}),
			NOT_FOUND
		);
		expectError(
			await readPatternVariables(
				owner.id,
				{} as Parameters<typeof readPatternVariables>[1]
			)
		);
	});

	it("reads a published pattern without any case access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const patternId = await variablePattern(owner);
		const source = await publishedSource(owner, patternId);

		const result = await readPatternVariables(
			stranger.id,
			source as Parameters<typeof readPatternVariables>[1]
		);

		expect("data" in result && result.data).toHaveLength(2);
	});
});

describe("the fetchPatternVariables action", () => {
	it("returns the variables to the signed-in user who may read the pattern", async () => {
		const owner = await createTestUser();
		const patternId = await variablePattern(owner);
		await mockAuth(owner.id, owner.username, owner.email);
		const { fetchPatternVariables } = await import(
			"@/actions/case-from-pattern"
		);

		const variables = await fetchPatternVariables({ patternCaseId: patternId });

		expect(variables?.map((variable) => variable.name)).toEqual([
			"system",
			"owner",
		]);
	});

	it("returns nothing with no session, for a user with no access, and for a bad source", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const patternId = await variablePattern(owner);
		const { fetchPatternVariables } = await import(
			"@/actions/case-from-pattern"
		);

		expect(
			await fetchPatternVariables({ patternCaseId: patternId })
		).toBeNull();
		await mockAuth(stranger.id, stranger.username, stranger.email);
		expect(
			await fetchPatternVariables({ patternCaseId: patternId })
		).toBeNull();
		await mockAuth(owner.id, owner.username, owner.email);
		expect(
			await fetchPatternVariables({ patternCaseId: "not-a-uuid" })
		).toBeNull();
	});
});
