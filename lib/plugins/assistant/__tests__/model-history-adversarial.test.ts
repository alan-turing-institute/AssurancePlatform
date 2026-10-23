import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { modelHistory } from "@/lib/plugins/assistant/model-history";

const OLD_CASE_TEXT = "STALE-CASE-TEXT";
const OUT_OF_DATE = /may have changed since/i;
const NOT_APPLIED_WORDS = /dismissed|changed since|had changed/i;
const CHANGED_WORDS = /had changed|changed since/i;
const UNDECIDED_WORDS = /not (yet )?(applied|decided)|has not/i;
const USER_APPLIED = /user applied/i;
const DISMISSED = /dismissed/i;
const APPLIED = /applied/i;
const STILL_UNAPPLIED =
	/has not applied this|not been applied|case has not changed|do not say it has been applied/i;
/** The note a suggestion tool adds to every suggestion it returns. */
const TOOL_NOTE =
	"The user has not applied this suggestion, and the case has not changed. Do not say it has been applied. Say briefly what you suggested and that the user can apply or dismiss it on the suggestion card.";

const asked = (text: string, id = `u-${text}`): UIMessage => ({
	id,
	role: "user",
	parts: [{ type: "text", text }],
});

const reply = (id: string, ...parts: UIMessage["parts"]): UIMessage => ({
	id,
	role: "assistant",
	parts: [{ type: "step-start" }, ...parts],
});

function finished(tool: string, toolCallId: string, output: unknown) {
	return {
		type: `tool-${tool}`,
		toolCallId,
		input: {},
		state: "output-available",
		output,
	} as UIMessage["parts"][number];
}

function failed(tool: string, toolCallId: string, errorText: string) {
	return {
		type: `tool-${tool}`,
		toolCallId,
		input: {},
		state: "output-error",
		errorText,
	} as UIMessage["parts"][number];
}

const editSuggestion = (after: string) => ({
	suggested: true,
	kind: "edit",
	elementId: "p1",
	elementType: "property_claim",
	label: "P1",
	changes: { description: { before: "Old", after } },
});

const newSuggestion = {
	suggested: true,
	kind: "new",
	parentId: "p1",
	parentLabel: "P1",
	parentType: "property_claim",
	childType: "evidence",
	description: "A test report",
};

const refusal = {
	suggested: false,
	reason: "Evidence cannot go under a goal.",
};

/** The text of the result the model is sent for one tool call. */
async function resultFor(
	messages: UIMessage[],
	toolCallId: string,
	outcomes?: Record<string, "applied" | "dismissed" | "changed">
): Promise<string> {
	const sent = await modelHistory(messages, outcomes);
	for (const message of sent) {
		if (message.role !== "tool") {
			continue;
		}
		for (const part of message.content) {
			if (part.type === "tool-result" && part.toolCallId === toolCallId) {
				return JSON.stringify(part.output);
			}
		}
	}
	throw new Error(`No result was sent for ${toolCallId}`);
}

describe("modelHistory: earlier reads of the case", () => {
	const readCase = { found: true, case: { name: OLD_CASE_TEXT }, tree: {} };

	it.each([
		"read_case",
		"read_element",
		"lint_case",
	])("replaces an earlier %s result with a notice that it is out of date", async (tool) => {
		const result = await resultFor(
			[asked("one"), reply("a1", finished(tool, "c1", readCase)), asked("two")],
			"c1"
		);

		expect(result).not.toContain(OLD_CASE_TEXT);
		expect(result).toMatch(OUT_OF_DATE);
	});

	it("replaces every one of them, in every earlier reply, not only the latest", async () => {
		const sent = JSON.stringify(
			await modelHistory([
				asked("one"),
				reply(
					"a1",
					finished("read_case", "c1", readCase),
					finished("read_element", "c2", readCase),
					finished("lint_case", "c3", readCase)
				),
				asked("two"),
				reply("a2", finished("read_case", "c4", readCase)),
				asked("three"),
				reply("a3", finished("read_element", "c5", readCase)),
				asked("four"),
			])
		);

		expect(sent).not.toContain(OLD_CASE_TEXT);
		expect(sent.match(/may have changed since/gi)).toHaveLength(5);
	});

	it("keeps the error text of a read that failed, since it says nothing about the case", async () => {
		const result = await resultFor(
			[
				asked("one"),
				reply("a1", failed("read_case", "c1", "The case could not be read.")),
				asked("two"),
			],
			"c1"
		);

		expect(result).toContain("The case could not be read.");
		expect(result).not.toMatch(OUT_OF_DATE);
	});

	it("leaves the result of a tool that does not read the case as it was", async () => {
		const result = await resultFor(
			[
				asked("one"),
				reply(
					"a1",
					finished("suggest_techniques", "c1", { techniques: ["Fuzzing"] })
				),
				asked("two"),
			],
			"c1"
		);

		expect(result).toContain("Fuzzing");
	});

	it("does not change the messages it was given", async () => {
		const messages = [
			asked("one"),
			reply("a1", finished("read_case", "c1", readCase)),
			asked("two"),
		];
		const snapshot = JSON.stringify(messages);

		await modelHistory(messages, { c1: "applied" });

		expect(JSON.stringify(messages)).toBe(snapshot);
	});

	it("still shows the model what an earlier suggestion proposed, once the case reads around it are out of date", async () => {
		const sent = JSON.stringify(
			await modelHistory([
				asked("one"),
				reply(
					"a1",
					finished("read_case", "c1", readCase),
					finished("suggest_edit", "c2", editSuggestion("Reworded claim"))
				),
				asked("two"),
			])
		);

		expect(sent).not.toContain(OLD_CASE_TEXT);
		expect(sent).toContain("Reworded claim");
	});
});

describe("modelHistory: what the user did with each suggestion", () => {
	const conversation = (): UIMessage[] => [
		asked("one"),
		reply(
			"a1",
			finished("suggest_edit", "s1", editSuggestion("First wording")),
			finished("suggest_edit", "s2", editSuggestion("Second wording")),
			finished("suggest_new_element", "s3", newSuggestion),
			finished("suggest_new_element", "s4", refusal),
			finished("read_case", "r1", { found: true })
		),
		asked("two"),
	];

	it("adds each decision to the suggestion it belongs to, by tool call id", async () => {
		const outcomes = { s1: "applied", s3: "dismissed", s2: "changed" } as const;

		const [first, second, third] = await Promise.all([
			resultFor(conversation(), "s1", outcomes),
			resultFor(conversation(), "s2", outcomes),
			resultFor(conversation(), "s3", outcomes),
		]);

		expect(first).toContain("First wording");
		expect(first).toMatch(APPLIED);
		expect(first).not.toMatch(NOT_APPLIED_WORDS);
		expect(second).toContain("Second wording");
		expect(second).toMatch(CHANGED_WORDS);
		expect(third).toContain("A test report");
		expect(third).toMatch(DISMISSED);
		expect(new Set([first, second, third]).size).toBe(3);
	});

	it("gives the same decision to the same id however the messages are ordered", async () => {
		const swapped = conversation();
		const parts = swapped[1]?.parts ?? [];
		swapped[1] = {
			...swapped[1],
			parts: [
				parts[0] as never,
				parts[2] as never,
				parts[1] as never,
				...parts.slice(3),
			],
		} as UIMessage;
		const outcomes = { s2: "dismissed" } as const;

		expect(await resultFor(swapped, "s2", outcomes)).toBe(
			await resultFor(conversation(), "s2", outcomes)
		);
	});

	it("says a suggestion with no decision has not been applied or dismissed", async () => {
		const undecided = await resultFor(conversation(), "s1");
		const decided = await resultFor(conversation(), "s1", { s1: "applied" });

		expect(undecided).not.toBe(decided);
		expect(undecided).toMatch(UNDECIDED_WORDS);
		expect(undecided).not.toMatch(USER_APPLIED);
	});

	it("does not decorate a refusal, even if an outcome is sent for its id", async () => {
		const sent = await resultFor(conversation(), "s4", { s4: "applied" });

		expect(JSON.parse(sent).value).toEqual(refusal);
	});

	it("does not decorate a case read, even if an outcome is sent for its id", async () => {
		const sent = await resultFor(conversation(), "r1", { r1: "applied" });

		expect(sent).toMatch(OUT_OF_DATE);
		expect(sent).not.toContain("userDecision");
	});

	it("ignores an outcome for an id that is not in the chat", async () => {
		const withStranger = JSON.stringify(
			await modelHistory(conversation(), { nobody: "applied" })
		);
		const without = JSON.stringify(await modelHistory(conversation()));

		expect(withStranger).toBe(without);
	});

	it("does not add a decision to a suggestion call that never finished", async () => {
		const sent = await modelHistory(
			[
				asked("one"),
				reply("a1", {
					type: "tool-suggest_edit",
					toolCallId: "s9",
					input: { elementId: "p1" },
					state: "input-available",
				} as UIMessage["parts"][number]),
				asked("two"),
			],
			{ s9: "applied" }
		);

		expect(JSON.stringify(sent)).not.toMatch(USER_APPLIED);
		expect(JSON.stringify(sent)).toContain("did not finish");
	});

	it("does not tell the model an applied suggestion is still unapplied, whatever note the tool gave it", async () => {
		const applied = await resultFor(
			[
				asked("one"),
				reply(
					"a1",
					finished("suggest_edit", "s1", {
						...editSuggestion("Reworded"),
						note: TOOL_NOTE,
					})
				),
				asked("two"),
			],
			"s1",
			{ s1: "applied" }
		);

		expect(applied).toMatch(APPLIED);
		expect(applied).not.toMatch(STILL_UNAPPLIED);
	});

	it("tells the model the text it applied, so a later question about that element is not answered from the old read", async () => {
		const sent = JSON.stringify(
			await modelHistory(
				[
					asked("Read P1"),
					reply("a1", finished("read_element", "c1", { text: OLD_CASE_TEXT })),
					asked("Reword it"),
					reply(
						"a2",
						finished("suggest_edit", "s1", editSuggestion("Brand new wording"))
					),
					asked("What does P1 say now?"),
				],
				{ s1: "applied" }
			)
		);

		expect(sent).not.toContain(OLD_CASE_TEXT);
		expect(sent).toContain("Brand new wording");
		expect(sent).toMatch(APPLIED);
	});
});
