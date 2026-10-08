"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { z } from "zod";

const HTTP_URL = /^https?:\/\//i;

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

const techniquesOutput = z.object({
	results: z.array(
		z.object({
			name: z.string(),
			url: z.string(),
			score: z.number(),
			goals: z.array(z.string()),
		})
	),
});

/** The suggest_techniques result as a list; null when the output is an error or malformed. */
function TechniquesList({ output }: { output: unknown }) {
	const parsed = techniquesOutput.safeParse(output);
	if (!parsed.success) {
		return null;
	}
	return (
		<ul className="mt-1 space-y-1" data-testid="assistant-techniques">
			{parsed.data.results.map((r) => (
				<li key={r.url}>
					{HTTP_URL.test(r.url) ? (
						<a
							className="underline"
							href={r.url}
							rel="noopener noreferrer"
							target="_blank"
						>
							{r.name}
						</a>
					) : (
						r.name
					)}{" "}
					<span className="text-muted-foreground">
						({r.score.toFixed(2)})
						{r.goals.length > 0 && `: ${r.goals.join(", ")}`}
					</span>
				</li>
			))}
		</ul>
	);
}

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
			{part.state === "output-available" && name === "suggest_techniques" && (
				<TechniquesList output={part.output} />
			)}
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
