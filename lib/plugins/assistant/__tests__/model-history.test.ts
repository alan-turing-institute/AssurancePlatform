import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	modelHistory,
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
	tool: "read_case" | "read_claim_health",
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

	it("leaves the result of another tool as it was", async () => {
		const sent = await modelHistory([
			asked("one"),
			reply(
				{ type: "step-start" },
				finishedCall("read_case", { output: { found: true } })
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
});
