import type { UIMessageChunk } from "ai";
import {
	NOTICE_PART,
	NOTICE_REASON,
} from "@/lib/plugins/assistant/abort-notice";

/**
 * A stream stage that adds a `data-notice` part with `NOTICE_REASON.length` to
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
					data: NOTICE_REASON.length,
				});
			}
			controller.enqueue(chunk);
		},
	});
}
