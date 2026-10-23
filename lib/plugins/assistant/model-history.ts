import {
	type AssistantModelMessage,
	convertToModelMessages,
	isToolUIPart,
	type ModelMessage,
	type UIMessage,
} from "ai";
import {
	SUGGEST_EDIT,
	SUGGEST_NEW_ELEMENT,
	type SuggestionOutcome,
} from "./suggestion";

/** What the model is told a call's result was when the call never finished. */
export const UNFINISHED_CALL_RESULT =
	"This call did not finish: the user stopped the reply, or its time ran out. Do not repeat it unless the user asks again.";

/** What the model is sent in place of an earlier `read_claim_health` result. */
export const OUT_OF_DATE_CLAIM_HEALTH_RESULT = {
	outOfDate: true,
	message:
		"This result is from earlier in the conversation and is out of date. Call read_claim_health again for the current results; if that tool is not available, say that current results are not available.",
} as const;

/** What the model is sent in place of an earlier `read_case`, `read_element` or `lint_case` result. */
export const OUT_OF_DATE_CASE_RESULT = {
	outOfDate: true,
	message:
		"This is a read of the case from earlier in the conversation. It was correct when it was made, and what you said from it was accurate then. The case may have changed since, by the user or by an applied suggestion, so call the tool again before you quote the case's current text or findings. Do not take back or apologise for earlier answers because of this notice.",
} as const;

/** What the model is told about a suggestion the user has not applied or dismissed. */
const UNDECIDED_SUGGESTION =
	"The user has not applied or dismissed this suggestion. The case has not been changed by it.";

/** What the model is told about a suggestion, by what the user did with its card. */
const SUGGESTION_DECISIONS: Record<SuggestionOutcome, string> = {
	applied:
		"The user applied this suggestion, so the case now has the suggested change.",
	dismissed:
		"The user dismissed this suggestion. The case was not changed by it.",
	changed:
		"The user tried to apply this suggestion, but the element had changed since it was made, so nothing was saved. The user needs to ask again.",
};

/** The notice that stands in for an earlier result of each tool whose results go out of date. */
const OUT_OF_DATE_RESULTS = new Map<string, unknown>([
	["tool-read_case", OUT_OF_DATE_CASE_RESULT],
	["tool-read_element", OUT_OF_DATE_CASE_RESULT],
	["tool-lint_case", OUT_OF_DATE_CASE_RESULT],
	["tool-read_claim_health", OUT_OF_DATE_CLAIM_HEALTH_RESULT],
]);

/** What each suggestion tool's part type is. */
const SUGGESTION_PART_TYPES = new Set([
	`tool-${SUGGEST_EDIT}`,
	`tool-${SUGGEST_NEW_ELEMENT}`,
]);

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
 * The messages with the output of each earlier `read_case`, `read_element`,
 * `lint_case` and `read_claim_health` call that has a result replaced by a
 * notice that it is out of date. The case changes while the user talks, by an
 * applied suggestion or by hand, and automated check results change too. A
 * model that is shown an earlier result repeats it instead of calling the tool
 * again, including after the plugin has been switched off.
 *
 * Every such call in the history is out of date, whether or not anything has
 * been applied since: a suggestion's card can be applied after later reads, and
 * the user can edit by hand. That holds because the history is the earlier
 * replies the browser sends back, and the current reply's own calls are made by
 * the SDK inside that reply and never pass through here. A call that ended in
 * an error keeps its error result, and other tools' results are left as they
 * are.
 */
function withResultsOutOfDate(messages: UIMessage[]): UIMessage[] {
	return messages.map((message) => ({
		...message,
		parts: message.parts.map((part) =>
			OUT_OF_DATE_RESULTS.has(part.type) &&
			"state" in part &&
			part.state === "output-available"
				? { ...part, output: OUT_OF_DATE_RESULTS.get(part.type) }
				: part
		),
	}));
}

/**
 * A suggestion's output with what the user did with its card added, and the
 * tool's own note that the suggestion is not yet applied taken out, because
 * the decision replaces it and the two would contradict each other. Anything
 * that is not a suggestion is left as it was.
 */
function withDecision(output: unknown, decision: string): unknown {
	if (
		typeof output !== "object" ||
		output === null ||
		!("suggested" in output) ||
		output.suggested !== true
	) {
		return output;
	}
	return {
		...Object.fromEntries(
			Object.entries(output).filter(([key]) => key !== "note")
		),
		userDecision: decision,
	};
}

/**
 * The messages with what the user did with each earlier suggestion added to
 * its output, so that the model knows which were applied and which were
 * dismissed. The browser keeps that outside the messages, and sends it with
 * each request.
 */
function withSuggestionOutcomes(
	messages: UIMessage[],
	outcomes: ReadonlyMap<string, SuggestionOutcome>
): UIMessage[] {
	return messages.map((message) => ({
		...message,
		parts: message.parts.map((part) => {
			if (
				!(SUGGESTION_PART_TYPES.has(part.type) && "toolCallId" in part) ||
				part.state !== "output-available"
			) {
				return part;
			}
			const outcome = outcomes.get(part.toolCallId);
			const decision = outcome
				? SUGGESTION_DECISIONS[outcome]
				: UNDECIDED_SUGGESTION;
			return { ...part, output: withDecision(part.output, decision) };
		}),
	}));
}

/**
 * The conversation as the model is sent it. A tool call cut off before it had
 * a result is sent with an error result saying so, because a model server
 * refuses a call with no result after it. A call cut off while its arguments
 * were still arriving cannot be sent as a call and is left out. An assistant
 * message that this leaves with only thinking, or with nothing to say, is left
 * out too, because some providers refuse an empty assistant message. The
 * output of an earlier case read or claim health call is replaced by a notice
 * that it is out of date, so that the model calls the tool again, and each
 * earlier suggestion carries what the user did with it (`outcomes`, by tool
 * call id).
 */
export async function modelHistory(
	messages: UIMessage[],
	outcomes: Readonly<Record<string, SuggestionOutcome>> = {}
): Promise<ModelMessage[]> {
	const converted = await convertToModelMessages(
		withSuggestionOutcomes(
			withResultsOutOfDate(withUnfinishedCallsReported(messages)),
			new Map(Object.entries(outcomes))
		),
		{ ignoreIncompleteToolCalls: true }
	);
	return converted.filter(
		(message) => message.role !== "assistant" || holdsTextOrToolCall(message)
	);
}
