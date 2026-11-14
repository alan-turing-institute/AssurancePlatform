import type { FinishReason, UIMessageChunk } from "ai";
import {
	ERROR_REASON_PART,
	NOTICE_PART,
	NOTICE_REASON,
} from "@/lib/plugins/assistant/abort-notice";

/** Whether a chunk is a tool call arriving, whole or in pieces. */
function isToolInput(chunk: UIMessageChunk): boolean {
	return (
		chunk.type === "tool-input-start" ||
		chunk.type === "tool-input-available" ||
		chunk.type === "tool-input-error"
	);
}

/** Whether a chunk puts something in the reply for the user to see: text, thinking, a tool call or a data part. */
function carriesContent(chunk: UIMessageChunk): boolean {
	switch (chunk.type) {
		case "text-delta":
		case "reasoning-delta":
			return chunk.delta !== "";
		default:
			return isToolInput(chunk) || chunk.type.startsWith("data-");
	}
}

interface ReplyEnd {
	finishReason: FinishReason | undefined;
	hasContent: boolean;
	/** The reply made as many steps as it may, and the last of them called a tool. */
	hitStepLimit: boolean;
}

/** The notice a reply needs when its model call finishes like this, or null when it needs none. */
function noticeAtFinish({
	finishReason,
	hasContent,
	hitStepLimit,
}: ReplyEnd): string | null {
	if (finishReason === "length") {
		return NOTICE_REASON.length;
	}
	if (hitStepLimit) {
		return NOTICE_REASON.steps;
	}
	return hasContent ? null : NOTICE_REASON.empty;
}

/**
 * A stream stage that adds a `data-notice` part to the reply when it ended in
 * a way that would otherwise look like a fault or like silence: the model ran
 * out of output room (`NOTICE_REASON.length`), the step limit stopped it while
 * it was still calling tools (`NOTICE_REASON.steps`), or it finished having
 * sent no text, thinking or tool call at all (`NOTICE_REASON.empty`). The step
 * limit is told from the steps themselves, not from the provider's reason for
 * finishing: the reply hit it when it made `maxSteps` steps and the last one
 * called a tool. Writing the part is what creates the assistant's message, so
 * the notice belongs to that reply. The part goes in just before the stream's
 * `finish` chunk. A stream `error` chunk is preceded by a `data-error-reason`
 * part holding its text, so that the reason stays with the reply that failed;
 * the route has already cleaned that text of the key and the address. Every
 * other chunk passes through as it came.
 */
export function replyNotices(
	maxSteps: number
): TransformStream<UIMessageChunk, UIMessageChunk> {
	let hasContent = false;
	let steps = 0;
	let lastStepCalledTool = false;
	return new TransformStream({
		transform(chunk, controller) {
			if (chunk.type === "start-step") {
				steps += 1;
				lastStepCalledTool = false;
			}
			lastStepCalledTool ||= isToolInput(chunk);
			hasContent ||= carriesContent(chunk);
			if (chunk.type === "error") {
				hasContent = true;
				controller.enqueue({ type: ERROR_REASON_PART, data: chunk.errorText });
			}
			if (chunk.type === "finish") {
				const reason = noticeAtFinish({
					finishReason: chunk.finishReason,
					hasContent,
					hitStepLimit: steps >= maxSteps && lastStepCalledTool,
				});
				if (reason) {
					controller.enqueue({ type: NOTICE_PART, data: reason });
				}
			}
			controller.enqueue(chunk);
		},
	});
}
