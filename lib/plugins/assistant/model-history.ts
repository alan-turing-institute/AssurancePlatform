import {
	type AssistantModelMessage,
	convertToModelMessages,
	type ModelMessage,
	type UIMessage,
} from "ai";

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
 * The conversation as the model is sent it. A tool call that never got a
 * result, because the user stopped the reply or its time ran out inside the
 * tool, is left out, since the model server would refuse a call with no result
 * after it. An assistant message that the cut leaves with only thinking, or
 * with nothing to say, is left out too, because some providers refuse an empty
 * assistant message and the rest ignore thinking they are sent back.
 */
export async function modelHistory(
	messages: UIMessage[]
): Promise<ModelMessage[]> {
	const converted = await convertToModelMessages(messages, {
		ignoreIncompleteToolCalls: true,
	});
	return converted.filter(
		(message) => message.role !== "assistant" || holdsTextOrToolCall(message)
	);
}
