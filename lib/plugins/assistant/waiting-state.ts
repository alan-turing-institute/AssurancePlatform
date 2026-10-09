import { type ChatStatus, isToolUIPart, type UIMessage } from "ai";
import { ABORT_NOTICE_PART } from "@/lib/plugins/assistant/abort-notice";

type MessagePart = UIMessage["parts"][number];

function hasText(part: MessagePart): boolean {
	return (
		(part.type === "text" || part.type === "reasoning") &&
		part.text.trim() !== ""
	);
}

/** A tool call that has not produced a result, or text or thinking that is still arriving. */
function isMoving(part: MessagePart): boolean {
	if (part.type === ABORT_NOTICE_PART) {
		return true;
	}
	if (isToolUIPart(part)) {
		return !part.state.startsWith("output-");
	}
	return hasText(part) && "state" in part && part.state === "streaming";
}

/** Whether the panel shows something for the part. Step markers and empty text show nothing. */
function showsSomething(part: MessagePart): boolean {
	return hasText(part) || isToolUIPart(part);
}

/**
 * Whether the "Thinking…" line should show: the assistant is working and
 * nothing on screen is moving. That is the wait before the first output, and
 * the wait after a tool has finished while the model carries on. A part
 * without a state counts as finished.
 */
export function showWaitingLine(
	status: ChatStatus,
	messages: readonly UIMessage[]
): boolean {
	if (status !== "submitted" && status !== "streaming") {
		return false;
	}
	const last = messages.at(-1);
	if (status === "submitted" || !last || last.role === "user") {
		return true;
	}
	if (last.parts.some(isMoving)) {
		return false;
	}
	const latest = last.parts.findLast(showsSomething);
	return latest === undefined || isToolUIPart(latest);
}
