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

/** What the model is sent in place of an earlier `read_claim_health` result. */
export const OUT_OF_DATE_CLAIM_HEALTH_RESULT = {
	outOfDate: true,
	message:
		"This result is from earlier in the conversation and is out of date. Call read_claim_health again for the current results; if that tool is not available, say that current results are not available.",
} as const;

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
 *
 * Every such call in the history counts as cut off. That holds because each
 * tool runs on the server within the reply and none waits for an approval, so
 * a call with its input and no result cannot still be pending when the next
 * question arrives. A tool that ran in the browser, or that needed an approval,
 * would leave such calls legitimately pending and would need another rule.
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
 * The messages with the output of each `read_claim_health` call that has a
 * result replaced by `OUT_OF_DATE_CLAIM_HEALTH_RESULT`. Automated check
 * results change while the user talks, and a model that is shown an earlier
 * result in the conversation repeats it instead of calling the tool again,
 * including after the plugin has been switched off.
 *
 * Every such call in the history is out of date. That holds because the
 * history is the earlier replies the browser sends back, and the current
 * reply's own calls are made by the SDK inside that reply and never pass
 * through here. A call that ended in an error keeps its error result, and
 * other tools' results are left as they are.
 */
function withClaimHealthResultsOutOfDate(messages: UIMessage[]): UIMessage[] {
	return messages.map((message) => ({
		...message,
		parts: message.parts.map((part) =>
			part.type === "tool-read_claim_health" &&
			part.state === "output-available"
				? { ...part, output: OUT_OF_DATE_CLAIM_HEALTH_RESULT }
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
 * out too, because some providers refuse an empty assistant message. The
 * output of an earlier `read_claim_health` call is replaced by a notice that it
 * is out of date, so that the model calls the tool again.
 */
export async function modelHistory(
	messages: UIMessage[]
): Promise<ModelMessage[]> {
	const converted = await convertToModelMessages(
		withClaimHealthResultsOutOfDate(withUnfinishedCallsReported(messages)),
		{ ignoreIncompleteToolCalls: true }
	);
	return converted.filter(
		(message) => message.role !== "assistant" || holdsTextOrToolCall(message)
	);
}
