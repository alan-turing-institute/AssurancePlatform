import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PatternVariable } from "@/lib/case/pattern-variables";
import prisma from "@/lib/prisma";
import { readPatternVariables } from "@/lib/services/case-from-pattern-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase } from "../utils/case-kind-kit";
import { createPublishedRow, worldCounts } from "../utils/pattern-start-kit";
import { STARTERS } from "../utils/pattern-starters";
import {
	addTeamMember,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";
import {
	addSandboxVariables,
	DEFAULT_OWNER,
	ID,
	makePatternWithVariables,
	NOT_A_PATTERN,
	NOT_FOUND,
	patternCaseScenario,
	publishedScenario,
	SANDBOX_IDS,
	type Scenario,
	snapshotOf,
	sourceState,
	storedContextOf,
	VARIABLE_IDS,
} from "../utils/variable-values-kit";

/**
 * The read of a pattern's variables that fills the new-case dialog, through
 * the service and through the server action. It must find a pattern the way
 * starting a case does, refuse in the same words, and reveal nothing about a
 * pattern the user cannot view.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

type User = Awaited<ReturnType<typeof createTestUser>>;

type Read =
	| { ok: true; variables: PatternVariable[] }
	| { error?: string; ok: false };

interface Reader {
	label: string;
	read: (user: User, source: unknown) => Promise<Read>;
}

const viaService: Reader = {
	label: "the service",
	read: async (user, source) => {
		const result = await readPatternVariables(
			user.id,
			source as Parameters<typeof readPatternVariables>[1]
		);
		return "data" in result
			? { ok: true, variables: result.data }
			: { ok: false, error: result.error };
	},
};

const viaAction: Reader = {
	label: "the action",
	read: async (user, source) => {
		await mockAuth(user.id, user.username, user.email ?? undefined);
		const { fetchPatternVariables } = await import(
			"@/actions/case-from-pattern"
		);
		const variables = await fetchPatternVariables(
			source as Parameters<typeof fetchPatternVariables>[0]
		);
		return variables ? { ok: true, variables } : { ok: false };
	},
};

const READERS: [string, Reader][] = [
	[viaService.label, viaService],
	[viaAction.label, viaAction],
];

/** What a read of the standard pattern returns, in tree order. */
const STANDARD_LIST = [
	{ id: ID.system, name: "system", meaning: "the system under test" },
	{
		id: ID.owner,
		name: "owner",
		meaning: "who answers for it",
		value: DEFAULT_OWNER,
	},
	{ id: ID.scope, name: "scope", meaning: "what the strategy covers" },
	{ id: ID.nested, name: "system", meaning: "the nested system" },
	{ id: ID.dataset, name: "dataset", meaning: "the data used" },
];

const trash = (caseId: string) =>
	prisma.assuranceCase.update({
		where: { id: caseId },
		data: { deletedAt: new Date() },
	});

/** A read that fails the test unless it succeeded. */
async function readOk(reader: Reader, user: User, source: unknown) {
	const outcome = await reader.read(user, source);
	if (!outcome.ok) {
		throw new Error(`read refused: ${outcome.error}`);
	}
	return outcome.variables;
}

describe.each(
	READERS
)("reading a pattern's variables through %s", (_label, reader) => {
	describe("who may read a pattern case's variables", () => {
		interface Allowed {
			actor: (scenario: Scenario) => Promise<User>;
			label: string;
		}

		const ALLOWED: Allowed[] = [
			{ label: "its owner", actor: async (scenario) => scenario.owner },
			...(["VIEW", "COMMENT", "EDIT", "ADMIN"] as const).map(
				(level): Allowed => ({
					label: `a user it is shared with at ${level}`,
					actor: async (scenario) => {
						const user = await createTestUser();
						await createTestPermission(
							scenario.patternId,
							user.id,
							scenario.owner.id,
							level
						);
						return user;
					},
				})
			),
			...(["OWNER", "ADMIN", "MEMBER"] as const).flatMap((role) =>
				(["VIEW", "ADMIN"] as const).map(
					(level): Allowed => ({
						label: `a team ${role} of a team it is shared with at ${level}`,
						actor: async (scenario) => {
							const lead = await createTestUser();
							const team = await createTestTeam(lead.id);
							let member = lead;
							if (role !== "OWNER") {
								member = await createTestUser();
								await addTeamMember(team.id, member.id, role);
							}
							await createTestTeamPermission(
								scenario.patternId,
								team.id,
								scenario.owner.id,
								level
							);
							return member;
						},
					})
				)
			),
		];

		it.each(ALLOWED)("lists the variables for $label", async ({ actor }) => {
			const scenario = await patternCaseScenario();
			const user = await actor(scenario);

			const variables = await readOk(reader, user, scenario.source);

			expect(variables).toEqual(STANDARD_LIST);
		});

		interface Refused {
			actor: (scenario: Scenario) => Promise<User>;
			/** What the service says; the action says nothing for any of them. */
			error: string;
			label: string;
			prepare?: (
				scenario: Scenario,
				actor: User,
				ordinaryId: string
			) => Promise<void>;
			source?: (scenario: Scenario, ordinaryId: string) => unknown;
		}

		const stranger = async () => createTestUser();

		const REFUSED: Refused[] = [
			{ label: "a stranger", actor: stranger, error: NOT_FOUND },
			{
				label: "a draft pattern the user cannot view",
				actor: stranger,
				error: NOT_FOUND,
				prepare: async (scenario) => {
					await prisma.assuranceCase.update({
						where: { id: scenario.patternId },
						data: { publishStatus: "DRAFT", published: false },
					});
				},
			},
			{
				label: "a pattern case marked published that the user cannot view",
				actor: stranger,
				error: NOT_FOUND,
				prepare: async (scenario) => {
					await prisma.assuranceCase.update({
						where: { id: scenario.patternId },
						data: { publishStatus: "PUBLISHED", published: true },
					});
				},
			},
			{
				label: "a case that does not exist",
				actor: async (scenario) => scenario.owner,
				error: NOT_FOUND,
				source: () => ({ patternCaseId: randomUUID() }),
			},
			{
				label: "a member of a team that has no access",
				actor: async () => {
					const lead = await createTestUser();
					await createTestTeam(lead.id);
					return lead;
				},
				error: NOT_FOUND,
			},
			{
				label: "a user outside the team the pattern is shared with",
				actor: stranger,
				error: NOT_FOUND,
				prepare: async (scenario) => {
					const team = await createTestTeam(scenario.owner.id);
					await createTestTeamPermission(
						scenario.patternId,
						team.id,
						scenario.owner.id,
						"ADMIN"
					);
				},
			},
			{
				label: "a trashed pattern, for its owner",
				actor: async (scenario) => scenario.owner,
				error: NOT_FOUND,
				prepare: async (scenario) => {
					await trash(scenario.patternId);
				},
			},
			{
				label: "a trashed pattern, for a user it is shared with at ADMIN",
				actor: stranger,
				error: NOT_FOUND,
				prepare: async (scenario, actor) => {
					await createTestPermission(
						scenario.patternId,
						actor.id,
						scenario.owner.id,
						"ADMIN"
					);
					await trash(scenario.patternId);
				},
			},
			{
				label: "a trashed pattern, for a member of a team it is shared with",
				actor: stranger,
				error: NOT_FOUND,
				prepare: async (scenario, actor) => {
					const team = await createTestTeam(scenario.owner.id);
					await addTeamMember(team.id, actor.id, "MEMBER");
					await createTestTeamPermission(
						scenario.patternId,
						team.id,
						scenario.owner.id,
						"VIEW"
					);
					await trash(scenario.patternId);
				},
			},
			{
				label: "an ordinary case, for a stranger",
				actor: stranger,
				error: NOT_FOUND,
				source: (_scenario, ordinaryId) => ({ patternCaseId: ordinaryId }),
			},
			{
				label: "a trashed ordinary case, for its owner",
				actor: async (scenario) => scenario.owner,
				error: NOT_FOUND,
				source: (_scenario, ordinaryId) => ({ patternCaseId: ordinaryId }),
				prepare: async (_scenario, _actor, ordinaryId) => {
					await trash(ordinaryId);
				},
			},
			{
				label: "an ordinary case, for its owner",
				actor: async (scenario) => scenario.owner,
				error: NOT_A_PATTERN,
				source: (_scenario, ordinaryId) => ({ patternCaseId: ordinaryId }),
			},
			{
				label: "an ordinary case shared at VIEW",
				actor: stranger,
				error: NOT_A_PATTERN,
				source: (_scenario, ordinaryId) => ({ patternCaseId: ordinaryId }),
				prepare: async (scenario, actor, ordinaryId) => {
					await createTestPermission(
						ordinaryId,
						actor.id,
						scenario.owner.id,
						"VIEW"
					);
				},
			},
		];

		it.each(
			REFUSED
		)("refuses $label, and the action answers nothing at all", async ({
			actor,
			error,
			prepare,
			source,
		}) => {
			const scenario = await patternCaseScenario();
			const ordinary = await createStoredCase(scenario.owner.id);
			const user = await actor(scenario);
			await prepare?.(scenario, user, ordinary.id);
			const before = await worldCounts();
			const state = await sourceState(scenario.patternId);

			const outcome = await reader.read(
				user,
				source ? source(scenario, ordinary.id) : scenario.source
			);

			expect(outcome.ok).toBe(false);
			if (reader === viaService) {
				expect(outcome).toEqual({ ok: false, error });
			} else {
				expect(outcome).toEqual({ ok: false });
			}
			expect(await worldCounts()).toEqual(before);
			expect(await sourceState(scenario.patternId)).toEqual(state);
		});

		it("gives a stranger the same answer for a pattern as for a case that does not exist", async () => {
			const scenario = await patternCaseScenario();
			const user = await createTestUser();

			const existing = await reader.read(user, scenario.source);
			const missing = await reader.read(user, { patternCaseId: randomUUID() });

			expect(existing).toEqual(missing);
			expect(existing.ok).toBe(false);
		});

		it("gives a stranger the same answer for a published-status pattern as for one that does not exist", async () => {
			const scenario = await patternCaseScenario();
			await prisma.assuranceCase.update({
				where: { id: scenario.patternId },
				data: { publishStatus: "PUBLISHED", published: true },
			});
			const user = await createTestUser();

			const existing = await reader.read(user, scenario.source);
			const missing = await reader.read(user, { patternCaseId: randomUUID() });

			expect(existing).toEqual(missing);
		});

		it("gives a user who cannot view an ordinary case the answer for a case that does not exist, not 'not a pattern'", async () => {
			const scenario = await patternCaseScenario();
			const ordinary = await createStoredCase(scenario.owner.id);
			const user = await createTestUser();

			const existing = await reader.read(user, {
				patternCaseId: ordinary.id,
			});
			const missing = await reader.read(user, { patternCaseId: randomUUID() });

			expect(existing).toEqual(missing);
		});
	});

	describe("a published pattern's variables", () => {
		it("lists them for a user with no access to the pattern case", async () => {
			const scenario = await publishedScenario();
			const stranger = await createTestUser();

			expect(await readOk(reader, stranger, scenario.source)).toEqual(
				STANDARD_LIST
			);
		});

		it("lists them for an archived current row", async () => {
			const scenario = await publishedScenario({ archived: true });

			expect(
				await readOk(reader, await createTestUser(), scenario.source)
			).toEqual(STANDARD_LIST);
		});

		it("lists them when the pattern case has since been trashed", async () => {
			const scenario = await publishedScenario();
			await trash(scenario.patternId);

			expect(
				await readOk(reader, await createTestUser(), scenario.source)
			).toEqual(STANDARD_LIST);
		});

		it("lists them from the snapshot, not from the pattern case as it is now", async () => {
			const scenario = await publishedScenario();
			await prisma.assuranceElement.update({
				where: { id: scenario.pattern.byName.G1 as string },
				data: { context: [] },
			});

			expect(
				await readOk(reader, await createTestUser(), scenario.source)
			).toEqual(STANDARD_LIST);
		});

		it.each([
			["a row that is no longer current", { isCurrent: false }],
			["a published ordinary case", { type: "ASSURANCE_CASE" as const }],
		])("refuses %s, as for a slug that does not exist", async (_label, change) => {
			const scenario = await publishedScenario();
			await prisma.publishedAssuranceCase.updateMany({
				where: { slug: scenario.slug },
				data: change,
			});
			const user = await createTestUser();

			const existing = await reader.read(user, scenario.source);
			const missing = await reader.read(user, {
				publishedSlug: "no-such-pattern",
			});

			expect(existing.ok).toBe(false);
			expect(existing).toEqual(missing);
			if (reader === viaService) {
				expect(existing).toEqual({ ok: false, error: NOT_FOUND });
			}
		});

		it("lists the variables of the current row, not of an older one with the same slug", async () => {
			const scenario = await publishedScenario();
			const owner = scenario.owner;
			const second = await makePatternWithVariables(owner, {
				ownerDefault: null,
			});
			await prisma.publishedAssuranceCase.updateMany({
				where: { slug: scenario.slug },
				data: { isCurrent: false },
			});
			await createPublishedRow({
				slug: scenario.slug as string,
				assuranceCaseId: second.id,
				content: await snapshotOf(owner, second.id),
			});

			const variables = await readOk(
				reader,
				await createTestUser(),
				scenario.source
			);

			expect(variables.find((item) => item.id === ID.owner)).not.toHaveProperty(
				"value"
			);
		});

		it.each([
			["an empty object", {}],
			["an array", []],
			["a string", "not a case"],
			["a tree that is text", { tree: "x" }],
			[
				"a tree with no children and a context that is text",
				{ tree: { context: "x", children: "y" } },
			],
			[
				"a tree of junk",
				{
					tree: {
						context: [null, 5, "plain", { id: 1 }, { id: "a", name: "b" }, []],
						children: [null, "x", [], {}, { context: [{ id: "k" }] }],
					},
				},
			],
			["a tree that is an array", { tree: [] }],
		])("lists no variables, and does not fail, for a snapshot holding %s", async (_label, content) => {
			await createPublishedRow({ slug: "junk-pattern", content });

			const outcome = await reader.read(await createTestUser(), {
				publishedSlug: "junk-pattern",
			});

			expect(outcome).toEqual({ ok: true, variables: [] });
		});
	});

	describe("what is listed", () => {
		it("lists each variable once, in tree order, with its meaning and only a default the pattern really gives", async () => {
			const scenario = await patternCaseScenario();

			const variables = await readOk(reader, scenario.user, scenario.source);

			expect(variables.map((item) => item.id)).toEqual([...VARIABLE_IDS]);
			expect(
				variables.find((item) => item.id === ID.system)
			).not.toHaveProperty("value");
		});

		it("leaves out a named entry that is not a variable, and plain lines of context", async () => {
			const scenario = await patternCaseScenario();

			const variables = await readOk(reader, scenario.user, scenario.source);

			expect(variables.map((item) => item.id)).not.toContain(ID.window);
			expect(JSON.stringify(variables)).not.toContain("A plain note");
		});

		it("shows a default without the spaces around it, and none for a default of only spaces", async () => {
			const spaced = await patternCaseScenario();
			const blank = await patternCaseScenario();
			const setOwnerValue = async (scenario: Scenario, value: string) => {
				const context = (await storedContextOf(scenario.patternId, "G1")) as {
					id?: string;
				}[];
				await prisma.assuranceElement.update({
					where: { id: scenario.pattern.byName.G1 as string },
					data: {
						context: context.map((entry) =>
							entry.id === ID.owner ? { ...entry, value } : entry
						),
					},
				});
			};
			await setOwnerValue(spaced, "  Padded  ");
			await setOwnerValue(blank, " \t\n ");

			const withSpaces = await readOk(reader, spaced.user, spaced.source);
			const withBlank = await readOk(reader, blank.user, blank.source);

			expect(withSpaces.find((item) => item.id === ID.owner)?.value).toBe(
				"Padded"
			);
			expect(withBlank.find((item) => item.id === ID.owner)).not.toHaveProperty(
				"value"
			);
		});

		it("writes a meaning with other variables as they would show, and other names in braces", async () => {
			const withOwner = await patternCaseScenario({
				prepare: async (_owner, pattern) => {
					await prisma.assuranceElement.update({
						where: { id: pattern.byName.G1 as string },
						data: {
							context: [
								{
									id: ID.system,
									name: "system",
									text: `run by {owner#${ID.owner}} within {window#${ID.window}}`,
									variable: true,
								},
								{
									id: ID.owner,
									name: "owner",
									text: "who answers",
									value: "Alice",
									variable: true,
								},
								{
									id: ID.window,
									name: "window",
									text: "an interval",
								},
							],
						},
					});
				},
			});
			const withoutOwnerValue = await patternCaseScenario({
				prepare: async (_owner, pattern) => {
					await prisma.assuranceElement.update({
						where: { id: pattern.byName.G1 as string },
						data: {
							context: [
								{
									id: ID.system,
									name: "system",
									text: `run by {owner#${ID.owner}}`,
									variable: true,
								},
								{
									id: ID.owner,
									name: "owner",
									text: "who answers",
									variable: true,
								},
							],
						},
					});
				},
			});

			const first = await readOk(reader, withOwner.user, withOwner.source);
			const second = await readOk(
				reader,
				withoutOwnerValue.user,
				withoutOwnerValue.source
			);

			expect(first[0]?.meaning).toBe("run by Alice within {window}");
			expect(second[0]?.meaning).toBe("run by [owner]");
		});

		it("lists no variable of an element in the pattern's trash", async () => {
			const scenario = await patternCaseScenario();
			await prisma.assuranceElement.update({
				where: { id: scenario.pattern.byName["P1.1"] as string },
				data: { deletedAt: new Date(), deletedById: scenario.owner.id },
			});

			const variables = await readOk(reader, scenario.user, scenario.source);

			expect(variables.map((item) => item.id)).toEqual([
				ID.system,
				ID.owner,
				ID.scope,
				ID.nested,
			]);
		});

		it.each([
			["a pattern case", patternCaseScenario],
			["a published pattern", publishedScenario],
		])("leaves out the variables of detached claims in %s, and lists a claim that only carries the sandbox mark", async (_label, build) => {
			const scenario = await build({
				prepare: async (owner, pattern) => {
					await addSandboxVariables(owner, pattern);
				},
			});

			const variables = await readOk(reader, scenario.user, scenario.source);

			const ids = variables.map((item) => item.id);
			expect(ids).not.toContain(SANDBOX_IDS.detached);
			expect(ids).not.toContain(SANDBOX_IDS.beneathDetached);
			expect([...ids].sort()).toEqual(
				[...VARIABLE_IDS, SANDBOX_IDS.flagged].sort()
			);
		});

		it("lists none for a pattern whose elements hold no variables", async () => {
			const scenario = await patternCaseScenario();
			await prisma.assuranceElement.updateMany({
				where: { caseId: scenario.patternId },
				data: { context: [] },
			});

			expect(await readOk(reader, scenario.user, scenario.source)).toEqual([]);
		});

		it("changes nothing in the pattern, the published rows or the world", async () => {
			const scenario = await patternCaseScenario();
			const published = await publishedScenario();
			const before = await worldCounts();
			const state = await sourceState(scenario.patternId);

			await reader.read(scenario.user, scenario.source);
			await reader.read(scenario.user, published.source);
			await reader.read(scenario.user, { patternCaseId: randomUUID() });

			expect(await worldCounts()).toEqual(before);
			expect(await sourceState(scenario.patternId)).toEqual(state);
		});
	});

	describe("the source it is asked about", () => {
		const SOURCES: [string, (scenario: Scenario) => unknown][] = [
			["nothing", () => undefined],
			["null", () => null],
			["text", () => "a pattern"],
			["a number", () => 5],
			["an array", (scenario) => [scenario.source]],
			["an empty object", () => ({})],
			[
				"both a case and a slug, each valid",
				(scenario) => ({
					patternCaseId: scenario.patternId,
					publishedSlug: "published-pattern",
				}),
			],
			[
				"a case and an extra key",
				(scenario) => ({ patternCaseId: scenario.patternId, extra: true }),
			],
			["a case id that is not an id", () => ({ patternCaseId: "not-an-id" })],
			["a case id that is a number", () => ({ patternCaseId: 5 })],
			["a case id that is null", () => ({ patternCaseId: null })],
			["an empty slug", () => ({ publishedSlug: "" })],
			["a slug of spaces", () => ({ publishedSlug: "   " })],
			[
				"a slug that is very long",
				() => ({ publishedSlug: "a".repeat(10_000) }),
			],
			[
				"a slug with markup and quotes",
				() => ({ publishedSlug: `"><img src=x onerror=alert(1)>'; --` }),
			],
			["a slug that is an object", () => ({ publishedSlug: { $ne: "x" } })],
			[
				"the key of a pattern in the wrong field",
				(scenario) => ({ publishedSlug: scenario.patternId }),
			],
		];

		it.each(
			SOURCES
		)("refuses %s, and lists nothing", async (_label, source) => {
			const scenario = await patternCaseScenario();
			await publishedScenario();
			await createPublishedRow({ slug: "published-pattern" });
			const before = await worldCounts();

			const outcome = await reader.read(scenario.user, source(scenario));

			expect(outcome.ok).toBe(false);
			expect(await worldCounts()).toEqual(before);
		});
	});

	describe("agreeing with what a start accepts", () => {
		it.each(
			STARTERS
		)("accepts a value for each listed variable, and for no other named entry, when starting through %s", async (_label, starter) => {
			const scenario = await patternCaseScenario();
			const listed = await readOk(reader, scenario.user, scenario.source);

			for (const variable of listed) {
				const outcome = await starter.start(
					scenario.user,
					scenario.source,
					undefined,
					undefined,
					{ [variable.id]: "checked" }
				);
				expect(outcome.ok, variable.id).toBe(true);
			}
			const refused = await starter.start(
				scenario.user,
				scenario.source,
				undefined,
				undefined,
				{ [ID.window]: "checked" }
			);
			expect(refused.ok).toBe(false);
		});
	});
});

describe("reading a pattern's variables without a session", () => {
	it("answers nothing for a pattern case, a published pattern or a missing one", async () => {
		const scenario = await patternCaseScenario();
		const published = await publishedScenario();
		await mockNoAuth();
		const { fetchPatternVariables } = await import(
			"@/actions/case-from-pattern"
		);

		expect(await fetchPatternVariables(scenario.source as never)).toBeNull();
		expect(await fetchPatternVariables(published.source as never)).toBeNull();
		expect(
			await fetchPatternVariables({ patternCaseId: randomUUID() })
		).toBeNull();
	});
});
