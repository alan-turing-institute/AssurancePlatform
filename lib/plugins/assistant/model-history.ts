import {
	type AssistantModelMessage,
	convertToModelMessages,
	isToolUIPart,
	type ModelMessage,
	type UIMessage,
} from "ai";

/** What the model is told a call's result was when the call never finished. */
export const UNFINISHED_CALL_RESULT =
	"This call did not finish: the user stopped the reply, or its time ran out. Do not repeat it unless the user asks again.";

/** Whether an assistant message in the model's history says or does anything: it has text, or a call of a tool. */
function holdsTextOrToolCall(message: AssistantModelMessage): boolean {
	if (typeof message.content === "string") {
		return message.content.trim() !== "";
	}
	return message.content.some(
		(part) =>
			part.type === "tool-call" ||
			(part.type === "text" && part.text.trim() !== "")
	);
}

/**
 * The messages with each tool call that has its whole input but no result
 * given an error result that says it did not finish. Such a call was cut off
 * by Stop or by the time limit while it ran. A model that is sent nothing in
 * its place takes the question that began that reply as still pending and
 * answers it, calling the tool again.
 */
function withUnfinishedCallsReported(messages: UIMessage[]): UIMessage[] {
	return messages.map((message) => ({
		...message,
		parts: message.parts.map((part) =>
			isToolUIPart(part) && part.state === "input-available"
				? { ...part, state: "output-error", errorText: UNFINISHED_CALL_RESULT }
				: part
		),
	}));
}

/**
 * The conversation as the model is sent it. A tool call cut off before it had
 * a result is sent with an error result saying so, because a model server
 * refuses a call with no result after it. A call cut off while its arguments
 * were still arriving cannot be sent as a call and is left out. An assistant
 * message that this leaves with only thinking, or with nothing to say, is left
 * out too, because some providers refuse an empty assistant message.
 */
export async function modelHistory(
	messages: UIMessage[]
): Promise<ModelMessage[]> {
	const converted = await convertToModelMessages(
		withUnfinishedCallsReported(messages),
		{ ignoreIncompleteToolCalls: true }
	);
	return converted.filter(
		(message) => message.role !== "assistant" || holdsTextOrToolCall(message)
	);
}
