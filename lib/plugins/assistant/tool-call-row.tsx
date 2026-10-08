"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";

type MessagePart = UIMessage["parts"][number];

const MAX_SHOWN_CHARS = 4000;

function pretty(value: unknown): string {
	const text = JSON.stringify(value, null, 2) ?? "";
	return text.length > MAX_SHOWN_CHARS
		? `${text.slice(0, MAX_SHOWN_CHARS)}\n… (${text.length - MAX_SHOWN_CHARS} more characters)`
		: text;
}

const STATE_WORDS: Record<string, string> = {
	"input-streaming": "preparing",
	"input-available": "running",
	"output-available": "done",
	"output-error": "failed",
};

/** One tool call as a collapsed row that opens to its input and result. Renders nothing for parts that are not tool calls. */
export function ToolCallRow({ part }: { part: MessagePart }) {
	if (!isToolUIPart(part)) {
		return null;
	}
	const name = getToolName(part);
	return (
		<details
			className="rounded-md border bg-muted/40 px-2 py-1 text-xs"
			data-testid="assistant-tool-call"
		>
			<summary className="cursor-pointer select-none font-mono">
				{name}{" "}
				<span className="text-muted-foreground">
					({STATE_WORDS[part.state] ?? part.state})
				</span>
			</summary>
			<pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words">
				{pretty(part.input)}
			</pre>
			{part.state === "output-available" && (
				<pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words">
					{pretty(part.output)}
				</pre>
			)}
			{part.state === "output-error" && (
				<p className="mt-1 text-destructive">{part.errorText}</p>
			)}
		</details>
	);
}
