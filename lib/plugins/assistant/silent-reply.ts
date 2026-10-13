import type { ChatStatus, UIMessage } from "ai";
import { NOTICE_PART } from "@/lib/plugins/assistant/abort-notice";

/** Replies the user stopped, which are never reported as silent. Held here so closing the panel does not forget them. */
const stoppedReplies = new Set<string>();

/** Remembers that the user stopped the reply with this message id. */
export function markReplyStopped(id: string | undefined): void {
	if (id) {
		stoppedReplies.add(id);
	}
}

/**
 * Whether a reply has nothing to read: no answer text and no notice. Tool
 * calls and thinking do not count as an answer.
 */
function hasNoAnswer(message: UIMessage): boolean {
	return (
		message.role === "assistant" &&
		!message.parts.some(
			(part) =>
				part.type === NOTICE_PART ||
				(part.type === "text" && part.text.trim() !== "")
		)
	);
}

/**
 * The ids of the replies that finished without an answer. The last reply
 * counts only once the chat is idle without an error, since until then it may
 * still be on its way; earlier ones always are finished.
 */
export function silentReplyIds(
	messages: readonly UIMessage[],
	status: ChatStatus,
	error: Error | undefined
): ReadonlySet<string> {
	const lastId = messages.at(-1)?.id;
	const lastFinished = status === "ready" && !error;
	return new Set(
		messages
			.filter(
				(message) =>
					(message.id !== lastId || lastFinished) &&
					hasNoAnswer(message) &&
					!stoppedReplies.has(message.id)
			)
			.map((message) => message.id)
	);
}
