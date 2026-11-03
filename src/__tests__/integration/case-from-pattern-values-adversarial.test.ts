import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import type { PatternSource } from "@/lib/schemas/case-from-pattern";
import { createCaseFromPattern as startViaService } from "@/lib/services/case-from-pattern-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase } from "../utils/case-kind-kit";
import { flagsOf, worldCounts } from "../utils/pattern-start-kit";
import {
	DESCRIPTION,
	NAME,
	STARTERS,
	type Starter,
	viaAction,
} from "../utils/pattern-starters";
import {
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import {
	addSandboxVariables,
	DEFAULT_OWNER,
	expectedTexts,
	ID,
	makeOtherPattern,
	NOT_A_PATTERN,
	NOT_A_VARIABLE,
	NOT_FOUND,
	patternCaseScenario,
	publishedScenario,
	SANDBOX_IDS,
	SCENARIOS,
	type Scenario,
	shownTexts,
	sourceState,
	storedContextOf,
	storedEntries,
	storedTexts,
	VARIABLE_IDS,
} from "../utils/variable-values-kit";

/**
 * Giving values to a pattern's variables when a case is started from it,
 * through the service and through the server action, from a pattern case the
 * user can view and from a pattern published on Discover. The pattern has five
 * variables at four depths, a named entry that is not a variable, and text on
 * every element that mentions them. What is checked is what the new case
 * holds, what is refused, and that the pattern is left alone.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

/** Starts a case with the values given, whatever shape they are in. */
function startWith(starter: Starter, scenario: Scenario, values?: unknown) {
	return starter.start(
		scenario.user,
		scenario.source,
		undefined,
		undefined,
		values as Record<string, string> | undefined
	);
}

/** Starts a case and returns its id, failing the test if the start was refused. */
async function startOkWith(
	starter: Starter,
	scenario: Scenario,
	values?: unknown
) {
	const outcome = await startWith(starter, scenario, values);
	if (!outcome.ok) {
		throw new Error(`start refused: ${outcome.error}`);
	}
	return outcome.id;
}

/** Runs a start that must be refused and shows nothing was created or changed. */
async function expectRefused(
	starter: Starter,
	scenario: Scenario,
	values: unknown,
	message?: string
) {
	const before = await worldCounts();
	const state = await sourceState(scenario.patternId);

	const outcome = await startWith(starter, scenario, values);

	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(outcome.ok).toBe(false);
	if (!outcome.ok) {
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(outcome.error.length).toBeGreaterThan(0);
		if (message) {
			// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
			expect(outcome.error).toBe(message);
		}
	}
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(await worldCounts()).toEqual(before);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(await sourceState(scenario.patternId)).toEqual(state);
}

/**
 * Starts one case per set of values, all at once, and returns the new ids. The
 * action is imported and the session set once beforehand, as the starter
 * would do on each call, so that the starts overlap in the code under test and
 * not in the test's own set-up.
 */
async function startTogether(
	starter: Starter,
	scenario: Scenario,
	valueSets: Record<string, string>[]
) {
	const started: { error?: string; id?: string }[] =
		starter === viaAction
			? await startTogetherViaAction(scenario, valueSets)
			: (
					await Promise.all(
						valueSets.map((values) =>
							startViaService(
								scenario.user.id,
								scenario.source as PatternSource,
								NAME,
								DESCRIPTION,
								values
							)
						)
					)
				).map((result) =>
					"data" in result ? { id: result.data.id } : { error: result.error }
				);
	return started.map((result) => {
		if (result.id === undefined) {
			throw new Error(`start refused: ${result.error}`);
		}
		return result.id;
	});
}

async function startTogetherViaAction(
	scenario: Scenario,
	valueSets: Record<string, string>[]
) {
	await mockAuth(
		scenario.user.id,
		scenario.user.username,
		scenario.user.email ?? undefined
	);
	const { createCaseFromPattern } = await import("@/actions/case-from-pattern");
	const results = await Promise.all(
		valueSets.map((values) =>
			createCaseFromPattern(
				scenario.source as PatternSource,
				NAME,
				DESCRIPTION,
				values
			)
		)
	);
	return results.map((result) =>
		result.success ? { id: result.data.id } : { error: result.error }
	);
}

const BRACKETED_NAME = /\[[a-z]+\]/;
const EVERY_ELEMENT = ["E1", "G1", "P1", "P1.1", "S1"];

/** Shows what every element of the new case says, with the variables as `shown`. */
async function expectShown(
	scenario: Scenario,
	caseId: string,
	shown: Parameters<typeof expectedTexts>[0]
) {
	const texts = await shownTexts(scenario.user.id, caseId);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(Object.keys(texts).sort()).toEqual(EVERY_ELEMENT);
	for (const [name, expected] of Object.entries(expectedTexts(shown))) {
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(texts[name], name).toMatchObject(expected);
	}
}

describe.each(
	STARTERS
)("giving variables values when starting through %s", (_label, starter) => {
	describe.each(SCENARIOS)("from %s", (_source, makeScenario) => {
		describe("what the new case holds", () => {
			it("fills a variable everywhere it is mentioned and shows the others as [name]", async () => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: "AcmeBot",
				});

				await expectShown(scenario, id, {
					system: "AcmeBot",
					owner: DEFAULT_OWNER,
				});
				const entries = await storedEntries(id);
				expect(entries[ID.system]).toEqual({
					element: "G1",
					name: "system",
					variable: true,
					value: "AcmeBot",
				});
				for (const unfilled of [ID.scope, ID.nested, ID.dataset]) {
					expect(entries[unfilled]?.variable).toBe(true);
					expect(entries[unfilled]).not.toHaveProperty("value");
				}
			});

			it("fills all five variables, at every depth of the argument", async () => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: "AcmeBot",
					[ID.owner]: "Alice",
					[ID.scope]: "the whole fleet",
					[ID.nested]: "the planner",
					[ID.dataset]: "flight logs",
				});

				await expectShown(scenario, id, {
					system: "AcmeBot",
					owner: "Alice",
					scope: "the whole fleet",
					nested: "the planner",
					dataset: "flight logs",
				});
				const texts = await shownTexts(scenario.user.id, id);
				expect(JSON.stringify(texts)).not.toMatch(BRACKETED_NAME);
			});

			it("shows the value in the definition line of the variable's own entry", async () => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: "AcmeBot",
					[ID.owner]: "",
				});

				const texts = await shownTexts(scenario.user.id, id);
				expect(texts.G1?.context).toEqual([
					"A plain note",
					"system: the system under test (variable: AcmeBot)",
					"owner: who answers for it (variable, not set)",
					"window: the moving interval (value: 5 minutes)",
				]);
			});

			it.each([
				["no values at all", undefined],
				["an empty set of values", {}],
			])("keeps the pattern's own values when given %s", async (_label, values) => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, values);

				await expectShown(scenario, id, { owner: DEFAULT_OWNER });
				const entries = await storedEntries(id);
				expect(entries[ID.owner]?.value).toBe(DEFAULT_OWNER);
				expect(entries[ID.system]).not.toHaveProperty("value");
				expect(entries[ID.window]).toEqual({
					element: "G1",
					name: "window",
					variable: false,
					value: "5 minutes",
				});
			});

			it.each([
				["overridden by a value", "Alice", "Alice"],
				["cleared by an empty value", "", undefined],
				["cleared by a value of spaces", "   ", undefined],
				["cleared by a value of tabs and line breaks", "\t\n \r\n", undefined],
				["cleared by a value of non-breaking spaces", " 　", undefined],
			])("a default that is %s", async (_label, given, stored) => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, { [ID.owner]: given });

				const entries = await storedEntries(id);
				expect(entries[ID.owner]?.variable).toBe(true);
				if (stored === undefined) {
					expect(entries[ID.owner]).not.toHaveProperty("value");
				} else {
					expect(entries[ID.owner]?.value).toBe(stored);
				}
				await expectShown(scenario, id, { owner: stored });
			});

			it("leaves a default alone when only another variable is given a value", async () => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, { [ID.scope]: "all" });

				const entries = await storedEntries(id);
				expect(entries[ID.owner]?.value).toBe(DEFAULT_OWNER);
				expect(entries[ID.scope]?.value).toBe("all");
			});

			it.each([
				["spaces on both sides", "  AcmeBot  ", "AcmeBot"],
				["tabs and line breaks around it", "\t\nAcmeBot\r\n", "AcmeBot"],
				["spaces inside, which stay", " Acme   Bot ", "Acme   Bot"],
				["a line break inside, which stays", "Acme\nBot", "Acme\nBot"],
			])("trims a value with %s", async (_label, given, stored) => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: given,
				});

				expect((await storedEntries(id))[ID.system]?.value).toBe(stored);
			});

			it("marks every element as from the pattern and none as changed from it, whatever the values", async () => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: "AcmeBot",
					[ID.owner]: "",
					[ID.dataset]: "logs",
				});

				const flags = await flagsOf(id);
				expect(flags.map((flag) => flag.name)).toEqual([
					"E1",
					"G1",
					"P1",
					"P1.1",
					"S1",
				]);
				for (const flag of flags) {
					expect(flag).toMatchObject({
						fromPattern: true,
						modifiedFromPattern: false,
					});
				}
			});

			it("rewrites no text: every description, assumption and justification is the pattern's own", async () => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: "AcmeBot",
					[ID.owner]: "Alice",
					[ID.scope]: "{system#sysaaaaaa1}",
					[ID.nested]: "$& $1 \\1",
					[ID.dataset]: "<b>logs</b>",
				});

				expect(await storedTexts(id)).toEqual(
					await storedTexts(scenario.patternId)
				);
			});

			it("keeps the entry ids, so the references in the text still point at the entries", async () => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: "AcmeBot",
				});

				expect(Object.keys(await storedEntries(id)).sort()).toEqual(
					Object.keys(await storedEntries(scenario.patternId)).sort()
				);
			});
		});

		describe("lengths", () => {
			it.each([
				["500 letters", "x".repeat(500)],
				["500 accented letters", "é".repeat(500)],
				["500 characters of another script", "日".repeat(500)],
				["500 characters with spaces around them", `  ${"y".repeat(500)}\t `],
				["a single character", "z"],
			])("accepts %s and stores it whole", async (_label, given) => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: given,
				});

				expect((await storedEntries(id))[ID.system]?.value).toBe(given.trim());
			});

			it.each([
				["501 letters", "x".repeat(501)],
				["501 characters with spaces around them", ` ${"x".repeat(501)} `],
				["501 accented letters", "é".repeat(501)],
				["a very long value", "x".repeat(200_000)],
			])("refuses %s, naming the limit, and creates nothing", async (_label, given) => {
				const scenario = await makeScenario();

				await expectRefused(starter, scenario, { [ID.system]: given });
				const outcome = await startWith(starter, scenario, {
					[ID.system]: given,
				});
				expect(outcome).toMatchObject({
					ok: false,
					error: expect.stringContaining("500"),
				});
			});

			it("refuses the whole request when one value is too long, so no other value is applied", async () => {
				const scenario = await makeScenario();

				await expectRefused(starter, scenario, {
					[ID.system]: "AcmeBot",
					[ID.owner]: "x".repeat(501),
					[ID.scope]: "all",
				});
			});
		});

		describe("values that look like something else", () => {
			it.each([
				["markup", "<script>alert(1)</script>"],
				["an image that runs code", "<img src=x onerror=alert(1)>"],
				["a reference to a name in reach", "{window#winaaaaaa3}"],
				["a reference to the variable itself", "{system#sysaaaaaa1}"],
				["a reference to another variable", "{owner#ownaaaaaa2}"],
				["text in square brackets", "[system]"],
				["replacement patterns", "$& $1 $` $' $$"],
				["a quoted marker", '{system = "x"}'],
				["a JSON string", '{"a":"\\u0000"}'],
				["a database command", "'; DROP TABLE assurance_elements; --"],
				["a long run of braces", "{".repeat(400)],
				["a name", "__proto__"],
			])("stores %s exactly as given and shows it as text", async (_label, given) => {
				const scenario = await makeScenario();

				const id = await startOkWith(starter, scenario, {
					[ID.system]: given,
				});

				expect((await storedEntries(id))[ID.system]?.value).toBe(given);
				const texts = await shownTexts(scenario.user.id, id);
				expect(texts.G1?.description).toBe(
					`Goal: ${given} run by ${DEFAULT_OWNER}`
				);
				expect(texts.S1?.justification).toBe(`Because ${given} matters`);
			});
		});

		describe("what is refused", () => {
			it("refuses an id that is not on the pattern, naming no id, and creates nothing", async () => {
				const scenario = await makeScenario();

				await expectRefused(
					starter,
					scenario,
					{ zzzzzzzzzz: "x" },
					NOT_A_VARIABLE
				);
			});

			it("refuses the whole request when one id is wrong, so the right ones are not applied", async () => {
				const scenario = await makeScenario();

				await expectRefused(
					starter,
					scenario,
					{ [ID.system]: "AcmeBot", [ID.scope]: "all", zzzzzzzzzz: "x" },
					NOT_A_VARIABLE
				);
				const id = await startOkWith(starter, scenario, {});
				expect((await storedEntries(id))[ID.system]).not.toHaveProperty(
					"value"
				);
			});

			it("refuses the id of a named entry that is not a variable, and the entry keeps its value", async () => {
				const scenario = await makeScenario();

				await expectRefused(
					starter,
					scenario,
					{ [ID.window]: "7 minutes" },
					NOT_A_VARIABLE
				);
				const id = await startOkWith(starter, scenario, {});
				expect((await storedEntries(id))[ID.window]?.value).toBe("5 minutes");
			});

			it("refuses the id of an element of the pattern", async () => {
				const scenario = await makeScenario();
				const elementIds = Object.values(scenario.pattern.byName);
				expect(elementIds).toHaveLength(5);

				for (const elementId of elementIds) {
					await expectRefused(
						starter,
						scenario,
						{ [elementId]: "x" },
						NOT_A_VARIABLE
					);
				}
			});

			it("refuses a plain line of context, a name and a meaning used as ids", async () => {
				const scenario = await makeScenario();

				for (const key of [
					"A plain note",
					"system",
					"owner",
					"the system under test",
					"",
					" ",
					ID.system.toUpperCase(),
					` ${ID.system}`,
					`${ID.system} `,
					`${ID.system}\n`,
					`${ID.system}#`,
					`{system#${ID.system}}`,
				]) {
					await expectRefused(starter, scenario, { [key]: "x" });
				}
			});

			it("refuses a variable id from another pattern", async () => {
				const scenario = await makeScenario();
				const other = await makeOtherPattern(scenario.owner);

				await expectRefused(
					starter,
					scenario,
					{ [other.variableId]: "x" },
					NOT_A_VARIABLE
				);
				await expectRefused(
					starter,
					scenario,
					{ [ID.system]: "ok", [other.variableId]: "x" },
					NOT_A_VARIABLE
				);
			});

			it.each([
				"__proto__",
				"constructor",
				"prototype",
				"toString",
				"valueOf",
				"hasOwnProperty",
				"__defineGetter__",
				"isPrototypeOf",
			])("refuses the key %s and creates nothing", async (key) => {
				const scenario = await makeScenario();
				// Parsed from text, so that `__proto__` is a key like any other.
				const values = JSON.parse(`{${JSON.stringify(key)}: "x"}`);

				await expectRefused(starter, scenario, values);
				expect(Object.keys(values)).toEqual([key]);
			});

			it("refuses a request that carries `__proto__` beside valid ids, and pollutes nothing", async () => {
				const scenario = await makeScenario();
				const values = JSON.parse(
					`{"__proto__": "x", "${ID.system}": "AcmeBot"}`
				);

				await expectRefused(starter, scenario, values);
				expect(({} as Record<string, unknown>).system).toBeUndefined();
				expect(Object.getPrototypeOf({})).toBe(Object.prototype);
			});

			it("never lets a `__proto__` key with an object under it reach Object.prototype or the stored entries", async () => {
				const scenario = await makeScenario();
				const before = await storedEntries(scenario.patternId);
				const values = JSON.parse(
					'{"__proto__": {"polluted": "yes"}, "constructor": {"prototype": {"polluted": "yes"}}}'
				);

				await startWith(starter, scenario, values);

				expect(({} as Record<string, unknown>).polluted).toBeUndefined();
				expect(Object.getPrototypeOf({})).toBe(Object.prototype);
				expect(await storedEntries(scenario.patternId)).toEqual(before);
			});

			it("refuses a prototype-shaped object as the values", async () => {
				const scenario = await makeScenario();

				await expectRefused(starter, scenario, {
					constructor: { prototype: { polluted: "yes" } },
				});
				expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			});

			it.each([
				["a number", 5],
				["a boolean", true],
				["null", null],
				["undefined", undefined],
				["an empty object", {}],
				["an object with a toString", { toString: () => "x" }],
				["an array", ["x"]],
				["an empty array", []],
				["a nested object of the right shape", { [ID.system]: "x" }],
				["a bigint", BigInt(5)],
			])("refuses %s as a value", async (_label, given) => {
				const scenario = await makeScenario();

				await expectRefused(starter, scenario, { [ID.system]: given });
			});

			it("refuses the whole request when one value is not text, though the others are", async () => {
				const scenario = await makeScenario();

				await expectRefused(starter, scenario, {
					[ID.system]: "AcmeBot",
					[ID.owner]: 5,
				});
			});

			it.each([
				["null", null],
				["a string", "AcmeBot"],
				["a number", 5],
				["a boolean", true],
				["an array of values", ["AcmeBot"]],
				["an array of pairs", [[ID.system, "AcmeBot"]]],
			])("refuses %s in place of the values", async (_label, given) => {
				const scenario = await makeScenario();

				await expectRefused(starter, scenario, given);
			});

			it("refuses an object with a huge number of keys without writing anything", async () => {
				const scenario = await makeScenario();
				const many: Record<string, string> = {};
				for (let index = 0; index < 20_000; index++) {
					many[`k${String(index).padStart(9, "0")}`] = "x";
				}

				await expectRefused(starter, scenario, many, NOT_A_VARIABLE);
			});

			it.each([
				["a NUL character", "a\u0000b"],
				["a lone high surrogate", "\ud800"],
				["a lone low surrogate", "x\udc00y"],
			])("refuses a value with %s, which the database cannot hold, and creates nothing", async (_label, given) => {
				const scenario = await makeScenario();

				await expectRefused(starter, scenario, { [ID.system]: given });
			});

			it("refuses a huge object that holds every valid id as well", async () => {
				const scenario = await makeScenario();
				const many: Record<string, string> = {};
				for (let index = 0; index < 20_000; index++) {
					many[`k${String(index).padStart(9, "0")}`] = "x";
				}
				for (const id of VARIABLE_IDS) {
					many[id] = "AcmeBot";
				}

				await expectRefused(starter, scenario, many);
			});

			it("refuses a key of a million characters", async () => {
				const scenario = await makeScenario();

				await expectRefused(starter, scenario, {
					["k".repeat(1_000_000)]: "x",
				});
			});
		});

		describe("the pattern and what is published of it", () => {
			it("are left exactly as they were after several starts with different values", async () => {
				const scenario = await makeScenario();
				const before = await sourceState(scenario.patternId);
				const entriesBefore = await storedEntries(scenario.patternId);

				await startOkWith(starter, scenario, {
					[ID.system]: "One",
					[ID.owner]: "",
				});
				await startOkWith(starter, scenario, {
					[ID.system]: "Two",
					[ID.dataset]: "x".repeat(500),
				});
				await startOkWith(starter, scenario);
				await startOkWith(starter, scenario, {
					[ID.scope]: "   ",
				});
				await startWith(starter, scenario, { zzzzzzzzzz: "x" });
				await startWith(starter, scenario, { [ID.system]: "x".repeat(501) });

				expect(await sourceState(scenario.patternId)).toEqual(before);
				expect(await storedEntries(scenario.patternId)).toEqual(entriesBefore);
				expect(await storedContextOf(scenario.patternId, "G1")).toEqual(
					before.pattern.elements.find((element) => element.name === "G1")
						?.context
				);
			});

			it("give a later start nothing from an earlier one", async () => {
				const scenario = await makeScenario();
				const first = await startOkWith(starter, scenario, {
					[ID.system]: "One",
					[ID.owner]: "",
					[ID.scope]: "first scope",
				});
				const second = await startOkWith(starter, scenario, {
					[ID.system]: "Two",
				});
				const third = await startOkWith(starter, scenario);

				const [one, two, three] = await Promise.all(
					[first, second, third].map((id) => storedEntries(id))
				);
				expect(one?.[ID.system]?.value).toBe("One");
				expect(one?.[ID.owner]).not.toHaveProperty("value");
				expect(one?.[ID.scope]?.value).toBe("first scope");
				expect(two?.[ID.system]?.value).toBe("Two");
				expect(two?.[ID.owner]?.value).toBe(DEFAULT_OWNER);
				expect(two?.[ID.scope]).not.toHaveProperty("value");
				expect(three?.[ID.system]).not.toHaveProperty("value");
				expect(three?.[ID.owner]?.value).toBe(DEFAULT_OWNER);
				expect(three?.[ID.scope]).not.toHaveProperty("value");
			});

			it("give each of several simultaneous starts its own values", async () => {
				const scenario = await makeScenario();
				const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

				const ids = await startTogether(
					starter,
					scenario,
					names.map((name) => ({
						[ID.system]: name,
						[ID.dataset]: `${name} data`,
					}))
				);

				expect(new Set(ids).size).toBe(names.length);
				for (const [index, id] of ids.entries()) {
					const entries = await storedEntries(id);
					expect(entries[ID.system]?.value).toBe(names[index]);
					expect(entries[ID.dataset]?.value).toBe(`${names[index]} data`);
				}
			});
		});
	});
});

describe.each(
	STARTERS
)("giving values from a pattern case through %s", (_label, starter) => {
	it("tells a stranger the pattern is not found, whatever ids and values they send, as for a case that does not exist", async () => {
		const scenario = await patternCaseScenario();
		const stranger = await createTestUser();
		const before = await worldCounts();

		const attempts: Record<string, string>[] = [
			{ [ID.system]: "AcmeBot" },
			{ zzzzzzzzzz: "x" },
			{ [ID.window]: "x" },
			{ [ID.system]: "AcmeBot", [ID.owner]: "" },
			{},
		];
		for (const values of attempts) {
			const real = await starter.start(
				stranger,
				scenario.source,
				undefined,
				undefined,
				values
			);
			const missing = await starter.start(
				stranger,
				{ patternCaseId: "00000000-0000-4000-8000-00000000dead" },
				undefined,
				undefined,
				values
			);
			expect(real).toEqual({ ok: false, error: NOT_FOUND });
			expect(missing).toEqual(real);
		}
		expect(await worldCounts()).toEqual(before);
	});

	it("tells a user who lost access the pattern is not found, even with ids that were valid", async () => {
		const scenario = await patternCaseScenario();
		await prisma.casePermission.deleteMany({
			where: { caseId: scenario.patternId, userId: scenario.user.id },
		});

		await expectRefused(
			starter,
			scenario,
			{ [ID.system]: "AcmeBot" },
			NOT_FOUND
		);
	});

	it("tells the owner of a trashed pattern it is not found", async () => {
		const scenario = await patternCaseScenario();
		await prisma.assuranceCase.update({
			where: { id: scenario.patternId },
			data: { deletedAt: new Date() },
		});

		await expectRefused(
			starter,
			{ ...scenario, user: scenario.owner },
			{ [ID.system]: "AcmeBot" },
			NOT_FOUND
		);
	});

	it("refuses an ordinary case the user can view, as not a pattern, with or without values", async () => {
		const scenario = await patternCaseScenario();
		const ordinary = await prisma.assuranceCase.update({
			where: { id: scenario.patternId },
			data: { kind: "CASE" },
		});
		expect(ordinary.kind).toBe("CASE");

		await expectRefused(starter, scenario, { [ID.system]: "x" }, NOT_A_PATTERN);
		await expectRefused(starter, scenario, undefined, NOT_A_PATTERN);
	});

	it("tells a user who cannot view an ordinary case it is not found, not that it is not a pattern", async () => {
		const scenario = await patternCaseScenario();
		const ordinary = await createStoredCase(scenario.owner.id);

		await expectRefused(
			starter,
			{ ...scenario, source: { patternCaseId: ordinary.id } },
			{ [ID.system]: "x" },
			NOT_FOUND
		);
	});

	it("starts for a user who can view the pattern at every level of sharing", async () => {
		for (const level of ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const) {
			const scenario = await patternCaseScenario();
			const user = await createTestUser();
			await createTestPermission(
				scenario.patternId,
				user.id,
				scenario.owner.id,
				level
			);

			const outcome = await starter.start(
				user,
				scenario.source,
				undefined,
				undefined,
				{ [ID.system]: level }
			);

			expect(outcome.ok, level).toBe(true);
			if (outcome.ok) {
				expect((await storedEntries(outcome.id))[ID.system]?.value).toBe(level);
			}
		}
	});

	it("reads the pattern as it is now, so a variable removed since is refused", async () => {
		const scenario = await patternCaseScenario();
		const goal = scenario.pattern.byName.G1;
		await prisma.assuranceElement.update({
			where: { id: goal },
			data: {
				context: (
					(await storedContextOf(scenario.patternId, "G1")) as {
						id?: string;
					}[]
				).filter((entry) => entry.id !== ID.system),
			},
		});

		await expectRefused(
			starter,
			scenario,
			{ [ID.system]: "x" },
			NOT_A_VARIABLE
		);
	});

	it("makes an ordinary case owned by the user and linked to the pattern, whatever the values", async () => {
		const scenario = await patternCaseScenario();

		const id = await startOkWith(starter, scenario, { [ID.system]: "AcmeBot" });

		const created = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id },
		});
		expect(created).toMatchObject({
			kind: "CASE",
			sourcePatternId: scenario.patternId,
			createdById: scenario.user.id,
		});
	});
});

describe.each(
	STARTERS
)("giving values from a published pattern through %s", (_label, starter) => {
	it("takes the defaults and the ids from the snapshot, not from the pattern case as it is now", async () => {
		const scenario = await publishedScenario();
		const goal = scenario.pattern.byName.G1 as string;
		// After publishing, the case loses `system` and changes `owner`'s default.
		const context = (await storedContextOf(scenario.patternId, "G1")) as {
			id?: string;
			value?: string;
		}[];
		await prisma.assuranceElement.update({
			where: { id: goal },
			data: {
				context: context
					.filter((entry) => entry.id !== ID.system)
					.map((entry) =>
						entry.id === ID.owner ? { ...entry, value: "Changed later" } : entry
					),
			},
		});

		const id = await startOkWith(starter, scenario, { [ID.system]: "AcmeBot" });

		const entries = await storedEntries(id);
		expect(entries[ID.system]?.value).toBe("AcmeBot");
		expect(entries[ID.owner]?.value).toBe(DEFAULT_OWNER);
	});

	it("starts from an archived current row with values, and the row stays as it was", async () => {
		const scenario = await publishedScenario({ archived: true });
		const before = await sourceState(scenario.patternId);

		const id = await startOkWith(starter, scenario, {
			[ID.system]: "AcmeBot",
			[ID.owner]: "",
		});

		const entries = await storedEntries(id);
		expect(entries[ID.system]?.value).toBe("AcmeBot");
		expect(entries[ID.owner]).not.toHaveProperty("value");
		expect(await sourceState(scenario.patternId)).toEqual(before);
	});

	it("starts from a row whose pattern case is in the trash, since the snapshot is what is read", async () => {
		const scenario = await publishedScenario();
		await prisma.assuranceCase.update({
			where: { id: scenario.patternId },
			data: { deletedAt: new Date() },
		});

		const id = await startOkWith(starter, scenario, { [ID.system]: "Kept" });

		expect((await storedEntries(id))[ID.system]?.value).toBe("Kept");
	});

	it("refuses the slug of a row that has been superseded, even with valid ids", async () => {
		const scenario = await publishedScenario();
		await prisma.publishedAssuranceCase.updateMany({
			where: { slug: scenario.slug },
			data: { isCurrent: false },
		});

		await expectRefused(
			starter,
			scenario,
			{ [ID.system]: "AcmeBot" },
			NOT_FOUND
		);
	});

	it("refuses the slug of a published ordinary case, even with valid ids", async () => {
		const scenario = await publishedScenario();
		await prisma.publishedAssuranceCase.updateMany({
			where: { slug: scenario.slug },
			data: { type: "ASSURANCE_CASE" },
		});

		await expectRefused(
			starter,
			scenario,
			{ [ID.system]: "AcmeBot" },
			NOT_FOUND
		);
	});

	it("refuses a slug that does not exist, whatever the values", async () => {
		const scenario = await publishedScenario();

		await expectRefused(
			starter,
			{ ...scenario, source: { publishedSlug: "no-such-pattern" } },
			{ [ID.system]: "AcmeBot" },
			NOT_FOUND
		);
	});

	it("takes each of two published patterns' variables from its own snapshot", async () => {
		const first = await publishedScenario();
		const second = await publishedScenario({ ownerDefault: "Second owner" });

		const one = await startOkWith(starter, first, { [ID.system]: "One" });
		const two = await startOkWith(
			starter,
			{ ...second, user: first.user },
			{
				[ID.system]: "Two",
			}
		);

		const [oneEntries, twoEntries] = await Promise.all([
			storedEntries(one),
			storedEntries(two),
		]);
		expect(oneEntries[ID.owner]?.value).toBe(DEFAULT_OWNER);
		expect(twoEntries[ID.owner]?.value).toBe("Second owner");
		expect(oneEntries[ID.system]?.value).toBe("One");
		expect(twoEntries[ID.system]?.value).toBe("Two");
	});
});

describe.each(
	STARTERS
)("giving values to variables on elements in the sandbox through %s", (_label, starter) => {
	describe.each([
		["a pattern case", patternCaseScenario],
		["a published pattern", publishedScenario],
	])("in %s", (_source, build) => {
		const withSandbox = () =>
			build({
				prepare: async (owner, pattern) => {
					await addSandboxVariables(owner, pattern);
				},
			});

		it("does not copy a detached claim, so a value for a variable on it is refused", async () => {
			const scenario = await withSandbox();

			await expectRefused(
				starter,
				scenario,
				{ [SANDBOX_IDS.detached]: "x" },
				NOT_A_VARIABLE
			);
			await expectRefused(
				starter,
				scenario,
				{ [SANDBOX_IDS.beneathDetached]: "x" },
				NOT_A_VARIABLE
			);
		});

		it("starts a case without the detached claims and their variables", async () => {
			const scenario = await withSandbox();

			const id = await startOkWith(starter, scenario, { [ID.system]: "A" });

			const entries = await storedEntries(id);
			expect(entries).not.toHaveProperty(SANDBOX_IDS.detached);
			expect(entries).not.toHaveProperty(SANDBOX_IDS.beneathDetached);
			const names = await prisma.assuranceElement.findMany({
				where: { caseId: id },
				select: { name: true },
			});
			expect(names.map((row) => row.name)).not.toContain("D1");
			expect(names.map((row) => row.name)).not.toContain("D2");
		});

		it("does not copy an element in the pattern's trash, so a value for a variable on it is refused", async () => {
			const scenario = await build({
				prepare: async (_owner, pattern) => {
					await prisma.assuranceElement.update({
						where: { id: pattern.byName["P1.1"] as string },
						data: { deletedAt: new Date() },
					});
				},
			});

			await expectRefused(
				starter,
				scenario,
				{ [ID.dataset]: "x" },
				NOT_A_VARIABLE
			);
			const id = await startOkWith(starter, scenario, { [ID.system]: "A" });
			expect(await storedEntries(id)).not.toHaveProperty(ID.dataset);
		});

		it("copies a claim that has a parent but is marked as in the sandbox, with its variable settable", async () => {
			const scenario = await withSandbox();

			const id = await startOkWith(starter, scenario, {
				[SANDBOX_IDS.flagged]: "set",
			});

			const entries = await storedEntries(id);
			expect(entries[SANDBOX_IDS.flagged]).toMatchObject({
				element: "F1",
				variable: true,
				value: "set",
			});
			const copied = await prisma.assuranceElement.findFirstOrThrow({
				where: { caseId: id, name: "F1" },
				select: { inSandbox: true, parentId: true },
			});
			expect(copied.parentId).not.toBeNull();
			expect(copied.inSandbox).toBe(true);
		});
	});
});
