/**
 * A cap on how many tool calls one reply may make. The model behind the
 * assistant is the user's own and can answer with any number of tool calls in
 * one step; the SDK runs them all at once, and each can read a whole case. The
 * counter is made for a reply and shared by every case tool in it.
 */

/** The most tool calls one reply may make, across all tools. */
export const MAX_TOOL_CALLS_PER_REPLY = 24;

/** What a call past the limit returns, in place of doing its work. */
export const TOO_MANY_TOOL_CALLS = {
	error: "Too many tool calls in one reply.",
} as const;

/** Runs `work` while the reply is within its limit, otherwise returns `TOO_MANY_TOOL_CALLS` without running it. */
export type ToolCallLimit = <T>(
	work: () => Promise<T>
) => Promise<T | typeof TOO_MANY_TOOL_CALLS>;

/** A counter for one reply. Every call counts, whether or not it succeeds. */
export function createToolCallLimit(
	max = MAX_TOOL_CALLS_PER_REPLY
): ToolCallLimit {
	let calls = 0;
	return (work) => {
		calls += 1;
		return calls > max ? Promise.resolve(TOO_MANY_TOOL_CALLS) : work();
	};
}

/** No limit: for a tool used on its own, outside a reply. */
export const unlimited: ToolCallLimit = (work) => work();
