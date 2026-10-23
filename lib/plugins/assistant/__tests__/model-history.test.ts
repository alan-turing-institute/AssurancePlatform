import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	modelHistory,
	OUT_OF_DATE_CASE_RESULT,
	OUT_OF_DATE_CLAIM_HEALTH_RESULT,
	UNFINISHED_CALL_RESULT,
} from "@/lib/plugins/assistant/model-history";

const asked = (text: string): UIMessage => ({
	id: `u-${text}`,
	role: "user",
	parts: [{ type: "text", text }],
});

const reply = (...parts: UIMessage["parts"]): UIMessage => ({
	id: "a1",
	role: "assistant",
	parts,
});

const call = (state: "input-available" | "input-streaming") =>
	({
		type: "tool-read_case",
		toolCallId: "c1",
		state,
		input: state === "input-available" ? {} : undefined,
	}) as UIMessage["parts"][number];

const finishedCall = (
	tool:
		| "read_case"
		| "read_element"
		| "lint_case"
		| "read_claim_health"
		| "suggest_techniques",
	outcome: { output: unknown } | { errorText: string }
) =>
	({
		type: `tool-${tool}`,
		toolCallId: "c2",
		input: {},
		...("output" in outcome
			? { state: "output-available", output: outcome.output }
			: { state: "output-error", errorText: outcome.errorText }),
	}) as UIMessage["parts"][number];

describe("modelHistory", () => {
	it("sends a call that never got a result with an error result right after it, saying it did not finish", async () => {
		const sent = await modelHistory([
			asked("one"),
			reply({ type: "step-start" }, call("input-available")),
			asked("two"),
		]);

		expect(sent.map((message) => message.role)).toEqual([
			"user",
			"assistant",
			"tool",
			"user",
		]);
		expect(sent[1]).toMatchObject({
			content: [{ type: "tool-call", toolCallId: "c1", toolName: "read_case" }],
		});
		expect(sent[2]).toMatchObject({
			content: [
				{
					type: "tool-result",
					toolCallId: "c1",
					output: { type: "error-text", value: UNFINISHED_CALL_RESULT },
				},
			],
		});
	});

	it("leaves out a call whose arguments never arrived, and an assistant message left with nothing to say", async () => {
		const sent = await modelHistory([
			asked("one"),
			reply(
				{ type: "step-start" },
				{ type: "reasoning", text: "Thinking.", state: "done" },
				call("input-streaming")
			),
			asked("two"),
		]);

		expect(sent.map((message) => message.role)).toEqual(["user", "user"]);
	});

	it("changes only what is sent: the messages it was given keep their state", async () => {
		const messages = [
			asked("one"),
			reply({ type: "step-start" }, call("input-available")),
			asked("two"),
		];

		await modelHistory(messages);

		expect(messages[1]?.parts[1]).toMatchObject({ state: "input-available" });
	});

	it("replaces the result of an earlier read_claim_health call with a notice that it is out of date", async () => {
		const sent = await modelHistory([
			asked("one"),
			reply(
				{ type: "step-start" },
				finishedCall("read_claim_health", { output: { found: true } })
			),
			asked("two"),
		]);

		expect(sent[2]).toMatchObject({
			content: [
				{
					type: "tool-result",
					toolCallId: "c2",
					toolName: "read_claim_health",
					output: { type: "json", value: OUT_OF_DATE_CLAIM_HEALTH_RESULT },
				},
			],
		});
	});

	it("leaves the result of a tool that does not read the case as it was", async () => {
		const sent = await modelHistory([
			asked("one"),
			reply(
				{ type: "step-start" },
				finishedCall("suggest_techniques", { output: { found: true } })
			),
			asked("two"),
		]);

		expect(sent[2]).toMatchObject({
			content: [
				{
					type: "tool-result",
					output: { type: "json", value: { found: true } },
				},
			],
		});
	});

	it("leaves an error result of a read_claim_health call as it was", async () => {
		const sent = await modelHistory([
			asked("one"),
			reply(
				{ type: "step-start" },
				finishedCall("read_claim_health", { errorText: "The read failed." })
			),
			asked("two"),
		]);

		expect(sent[2]).toMatchObject({
			content: [
				{
					type: "tool-result",
					output: { type: "error-text", value: "The read failed." },
				},
			],
		});
	});
	it.each([
		"read_case",
		"read_element",
		"lint_case",
	] as const)("replaces the result of an earlier %s call with a notice that it is out of date, whatever has happened since", async (tool) => {
		const sent = await modelHistory([
			asked("one"),
			reply(
				{ type: "step-start" },
				finishedCall(tool, { output: { found: true } })
			),
			asked("two"),
		]);

		expect(sent[2]).toMatchObject({
			content: [
				{
					type: "tool-result",
					toolName: tool,
					output: { type: "json", value: OUT_OF_DATE_CASE_RESULT },
				},
			],
		});
	});

	it("tells the model that an earlier case read was correct when it was made, and that it must not take back earlier answers", async () => {
		const sent = await modelHistory([
			asked("one"),
			reply(
				{ type: "step-start" },
				finishedCall("read_case", { output: { found: true } })
			),
			asked("two"),
		]);
		const notice = JSON.stringify(sent[2]);

		expect(notice).toContain('"outOfDate":true');
		expect(notice).toContain("It was correct when it was made");
		expect(notice).toContain("call the tool again before you quote");
		expect(notice).toContain(
			"Do not take back or apologise for earlier answers"
		);
	});
});

describe("modelHistory — suggestions", () => {
	const suggestion = (toolCallId: string, output: unknown) =>
		({
			type: "tool-suggest_edit",
			toolCallId,
			input: {},
			state: "output-available",
			output,
		}) as UIMessage["parts"][number];

	const SUGGESTED = { suggested: true, kind: "edit", elementId: "p1" };

	const decisionsSentFor = async (
		outcomes: Record<string, "applied" | "dismissed" | "changed">
	) => {
		const sent = await modelHistory(
			[
				asked("one"),
				reply(
					{ type: "step-start" },
					suggestion("a", SUGGESTED),
					suggestion("b", SUGGESTED),
					suggestion("c", SUGGESTED),
					suggestion("d", SUGGESTED)
				),
				asked("two"),
			],
			outcomes
		);
		return sent
			.filter((message) => message.role === "tool")
			.flatMap((message) => message.content)
			.map((part) =>
				part.type === "tool-result" && part.output.type === "json"
					? (part.output.value as { userDecision: string }).userDecision
					: null
			);
	};

	it("tells the model what the user did with each earlier suggestion, and that one with no decision is not applied", async () => {
		const decisions = await decisionsSentFor({
			a: "applied",
			b: "dismissed",
			c: "changed",
		});

		expect(decisions[0]).toContain("applied this suggestion");
		expect(decisions[1]).toContain("dismissed this suggestion");
		expect(decisions[2]).toContain("had changed since");
		expect(decisions[3]).toContain("has not applied or dismissed");
	});

	it("keeps the rest of the suggestion as it was, and leaves a refusal alone", async () => {
		const refusal = { suggested: false, reason: "No." };
		const sent = await modelHistory(
			[
				asked("one"),
				reply(
					{ type: "step-start" },
					suggestion("a", SUGGESTED),
					suggestion("b", refusal)
				),
				asked("two"),
			],
			{ a: "applied", b: "applied" }
		);

		const results = sent
			.filter((message) => message.role === "tool")
			.flatMap((message) => message.content);
		expect(results[0]).toMatchObject({
			output: { value: { ...SUGGESTED, userDecision: expect.any(String) } },
		});
		expect(results[1]).toMatchObject({ output: { value: refusal } });
	});
});
