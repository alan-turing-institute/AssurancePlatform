import {
	convertToModelMessages,
	type FinishReason,
	readUIMessageStream,
	type UIMessage,
	type UIMessageChunk,
} from "ai";
import { describe, expect, it } from "vitest";
import { NOTICE_REASON } from "@/lib/plugins/assistant/abort-notice";
import { replyNotices } from "@/lib/plugins/assistant/reply-notices";

async function through(chunks: UIMessageChunk[]): Promise<UIMessageChunk[]> {
	const out: UIMessageChunk[] = [];
	const source = new ReadableStream<UIMessageChunk>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(chunk);
			}
			controller.close();
		},
	});
	for await (const chunk of source.pipeThrough(replyNotices())) {
		out.push(chunk);
	}
	return out;
}

const text: UIMessageChunk = { type: "text-delta", id: "t", delta: "Hel" };
const finish = (finishReason?: FinishReason): UIMessageChunk => ({
	type: "finish",
	finishReason,
});
const notice = (data: string): UIMessageChunk => ({
	type: "data-notice",
	data,
});

describe("replyNotices", () => {
	it("adds a notice part just before the finish chunk when the model ran out of room", async () => {
		const out = await through([
			text,
			{ type: "finish-step" },
			finish("length"),
		]);

		expect(out.map((chunk) => chunk.type)).toEqual([
			"text-delta",
			"finish-step",
			"data-notice",
			"finish",
		]);
		expect(out[2]).toEqual(notice(NOTICE_REASON.length));
		expect(NOTICE_REASON.length).toBe("length");
	});

	it("adds the step-limit notice when the reply ends on tool calls", async () => {
		const out = await through([
			{ type: "tool-input-start", toolCallId: "c1", toolName: "read_case" },
			{ type: "finish-step" },
			finish("tool-calls"),
		]);

		expect(out.map((chunk) => chunk.type)).toEqual([
			"tool-input-start",
			"finish-step",
			"data-notice",
			"finish",
		]);
		expect(out[2]).toEqual(notice(NOTICE_REASON.steps));
	});

	it.each([
		["an empty completion that ends stop", finish("stop")],
		["a content filter with nothing sent", finish("content-filter")],
		["a finish with no reason", finish()],
	] as const)("adds the empty notice for %s when no text, thinking or tool call came", async (_name, end) => {
		const steps: UIMessageChunk[] = [
			{ type: "start" },
			{ type: "start-step" },
			{ type: "text-delta", id: "t", delta: "" },
			{ type: "finish-step" },
		];

		const out = await through([...steps, end]);

		expect(out).toEqual([...steps, notice(NOTICE_REASON.empty), end]);
	});

	it.each([
		["text", text],
		["thinking", { type: "reasoning-delta", id: "r", delta: "Hm" }],
		[
			"a tool call",
			{ type: "tool-input-start", toolCallId: "c1", toolName: "read_case" },
		],
		[
			"a tool call that came whole",
			{
				type: "tool-input-available",
				toolCallId: "c1",
				toolName: "read_case",
				input: {},
			},
		],
		["a data part", { type: "data-other", data: 1 }],
	] as const)("adds no notice when the reply had %s and finished", async (_name, content) => {
		const chunks: UIMessageChunk[] = [content, finish("stop")];

		expect(await through(chunks)).toEqual(chunks);
	});

	it("counts content from an earlier step", async () => {
		const chunks: UIMessageChunk[] = [
			text,
			{ type: "finish-step" },
			{ type: "start-step" },
			{ type: "finish-step" },
			finish("content-filter"),
		];

		expect(await through(chunks)).toEqual(chunks);
	});

	it("is what gives an empty reply a message to hold the notice", async () => {
		const empty: UIMessageChunk[] = [
			{ type: "start" },
			{ type: "start-step" },
			{ type: "finish-step" },
			finish("stop"),
		];
		const messagesOf = async (chunks: UIMessageChunk[]) => {
			const messages: unknown[] = [];
			const stream = new ReadableStream<UIMessageChunk>({
				start(controller) {
					for (const chunk of chunks) {
						controller.enqueue(chunk);
					}
					controller.close();
				},
			});
			for await (const message of readUIMessageStream({ stream })) {
				messages.push(message);
			}
			return messages;
		};

		expect(await messagesOf(empty)).toEqual([]);
		const withNotice = await messagesOf(await through(empty));
		expect(withNotice.at(-1)).toMatchObject({
			role: "assistant",
			parts: expect.arrayContaining([notice(NOTICE_REASON.empty)]),
		});
	});

	it("puts the text of a stream error in a part of the reply just before the error chunk", async () => {
		const started: UIMessageChunk[] = [
			{ type: "start" },
			{ type: "start-step" },
		];
		const error: UIMessageChunk = { type: "error", errorText: "Rate limited." };

		const out = await through([...started, error]);

		expect(out).toEqual([
			...started,
			{ type: "data-error-reason", data: "Rate limited." },
			error,
		]);
	});

	it("adds no empty notice to a reply that failed", async () => {
		const out = await through([
			{ type: "error", errorText: "Rate limited." },
			finish("error"),
		]);

		expect(out.map((chunk) => chunk.type)).toEqual([
			"data-error-reason",
			"error",
			"finish",
		]);
	});

	it("leaves its notices and a failure's reason out of what the model is sent on the next question", async () => {
		const asked = (id: string): UIMessage => ({
			id,
			role: "user",
			parts: [{ type: "text", text: `Question ${id}` }],
		});
		const history: UIMessage[] = [
			asked("1"),
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "text", text: "A partial answer." },
					{ type: "data-notice", data: NOTICE_REASON.steps },
					{ type: "data-error-reason", data: "The provider's reason." },
				],
			},
			asked("2"),
		];

		const sent = JSON.stringify(await convertToModelMessages(history));

		expect(sent).toContain("A partial answer.");
		expect(sent).not.toContain("The provider's reason.");
		expect(sent).not.toContain(NOTICE_REASON.steps);
	});
});
