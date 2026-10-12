import type { UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import {
	LENGTH_NOTICE_DATA,
	noticeWhenCutShort,
} from "@/lib/plugins/assistant/length-notice";

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
	for await (const chunk of source.pipeThrough(noticeWhenCutShort())) {
		out.push(chunk);
	}
	return out;
}

const text: UIMessageChunk = { type: "text-delta", id: "t", delta: "Hel" };

describe("noticeWhenCutShort", () => {
	it("adds a notice part just before the finish chunk when the model ran out of room", async () => {
		const out = await through([
			text,
			{ type: "finish-step" },
			{ type: "finish", finishReason: "length" },
		]);

		expect(out.map((chunk) => chunk.type)).toEqual([
			"text-delta",
			"finish-step",
			"data-notice",
			"finish",
		]);
		expect(out[2]).toEqual({ type: "data-notice", data: LENGTH_NOTICE_DATA });
		expect(LENGTH_NOTICE_DATA).toBe("length");
	});

	it.each([
		["stop"],
		["tool-calls"],
		["error"],
		[undefined],
	] as const)("passes the stream through unchanged when it finishes with %s", async (finishReason) => {
		const chunks: UIMessageChunk[] = [text, { type: "finish", finishReason }];

		expect(await through(chunks)).toEqual(chunks);
	});
});
