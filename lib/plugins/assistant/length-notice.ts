import type { UIMessageChunk } from "ai";

/** The message part type shared with the timeout notice, which the panel renders. */
const NOTICE_PART = "data-notice";

/** The value of the notice part that says the model ran out of output room before it had finished. */
export const LENGTH_NOTICE_DATA = "length";

/**
 * A stream stage that adds a `data-notice` part with `LENGTH_NOTICE_DATA` to
 * the reply when the model call finished because it ran out of output room: a
 * reply that stops with no text, or with half an answer, would otherwise look
 * like a fault. The part goes in just before the stream's `finish` chunk;
 * every other chunk passes through as it came.
 */
export function noticeWhenCutShort(): TransformStream<
	UIMessageChunk,
	UIMessageChunk
> {
	return new TransformStream({
		transform(chunk, controller) {
			if (chunk.type === "finish" && chunk.finishReason === "length") {
				controller.enqueue({
					type: NOTICE_PART,
					data: LENGTH_NOTICE_DATA,
				} as UIMessageChunk);
			}
			controller.enqueue(chunk);
		},
	});
}
