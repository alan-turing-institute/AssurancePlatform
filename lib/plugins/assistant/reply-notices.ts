import type { FinishReason, UIMessageChunk } from "ai";
import {
	NOTICE_PART,
	NOTICE_REASON,
} from "@/lib/plugins/assistant/abort-notice";

/** Whether a chunk puts something in the reply for the user to see: text, thinking, a tool call or a data part. */
function carriesContent(chunk: UIMessageChunk): boolean {
	switch (chunk.type) {
		case "text-delta":
		case "reasoning-delta":
			return chunk.delta !== "";
		case "tool-input-start":
		case "tool-input-available":
		case "tool-input-error":
			return true;
		default:
			return chunk.type.startsWith("data-");
	}
}

/** The notice a reply needs when its model call finishes for this reason, or null when it needs none. */
function noticeAtFinish(
	finishReason: FinishReason | undefined,
	hasContent: boolean
): string | null {
	switch (finishReason) {
		case "length":
			return NOTICE_REASON.length;
		// The last step of a reply ends on tool calls only when the step limit stopped it.
		case "tool-calls":
			return NOTICE_REASON.steps;
		default:
			return hasContent ? null : NOTICE_REASON.empty;
	}
}

/**
 * A stream stage that adds a `data-notice` part to the reply when it ended in
 * a way that would otherwise look like a fault or like silence: the model ran
 * out of output room (`NOTICE_REASON.length`), the step limit stopped it while
 * it was still calling tools (`NOTICE_REASON.steps`), or it finished having
 * sent no text, thinking or tool call at all (`NOTICE_REASON.empty`). Writing
 * the part is what creates the assistant's message, so the notice belongs to
 * that reply. The part goes in just before the stream's `finish` chunk; every
 * other chunk passes through as it came.
 */
export function replyNotices(): TransformStream<
	UIMessageChunk,
	UIMessageChunk
> {
	let hasContent = false;
	return new TransformStream({
		transform(chunk, controller) {
			hasContent ||= carriesContent(chunk);
			if (chunk.type === "finish") {
				const reason = noticeAtFinish(chunk.finishReason, hasContent);
				if (reason) {
					controller.enqueue({ type: NOTICE_PART, data: reason });
				}
			}
			controller.enqueue(chunk);
		},
	});
}
