"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ReactNode } from "react";
import { z } from "zod";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import { LintCaseResult, parseLintOutput } from "./lint-case-row";

const HTTP_URL = /^https?:\/\//i;

type MessagePart = UIMessage["parts"][number];

const MAX_SHOWN_CHARS = 4000;

function pretty(value: unknown): string {
	const text = JSON.stringify(value, null, 2) ?? "";
	return text.length > MAX_SHOWN_CHARS
		? `${text.slice(0, MAX_SHOWN_CHARS)}\n… (${text.length - MAX_SHOWN_CHARS} more characters)`
		: text;
}

const TOOL_TITLES: Record<string, string> = {
	read_case: "Read the case",
	read_element: "Read an element",
	lint_case: "Check against the rules",
	suggest_techniques: "Suggest techniques",
};

const techniquesOutput = z.object({
	results: z.array(
		z.object({
			slug: z.string().optional(),
			name: z.string(),
			url: z.string(),
			score: z.number(),
			goals: z.array(z.string()),
		})
	),
});

type Technique = z.infer<typeof techniquesOutput>["results"][number];

/** The suggest_techniques result as a list. */
function TechniquesList({ results }: { results: Technique[] }) {
	return (
		<ul className="space-y-1 p-3" data-testid="assistant-techniques">
			{results.map((r, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: results are a fixed list and two can share a slug
				<li key={`result-${index}`}>
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

/** The technique list or lint view for those two tools when the result has the expected shape, otherwise the result as text. */
function resultView(name: string, output: unknown): ReactNode {
	if (name === "suggest_techniques") {
		const parsed = techniquesOutput.safeParse(output);
		if (parsed.success) {
			return <TechniquesList results={parsed.data.results} />;
		}
	}
	if (name === "lint_case") {
		const lint = parseLintOutput(output);
		if (lint) {
			return <LintCaseResult result={lint} />;
		}
	}
	return pretty(output);
}

function hasInput(input: unknown): boolean {
	return (
		typeof input === "object" && input !== null && Object.keys(input).length > 0
	);
}

/** One tool call as a collapsed row that opens to its input and result. Renders nothing for parts that are not tool calls. */
export function ToolCallRow({ part }: { part: MessagePart }) {
	if (!isToolUIPart(part)) {
		return null;
	}
	const name = getToolName(part);
	const title = TOOL_TITLES[name] ?? name;
	return (
		<Tool data-testid="assistant-tool-call">
			{part.type === "dynamic-tool" ? (
				<ToolHeader
					state={part.state}
					title={title}
					toolName={part.toolName}
					type={part.type}
				/>
			) : (
				<ToolHeader state={part.state} title={title} type={part.type} />
			)}
			<ToolContent>
				{hasInput(part.input) && <ToolInput input={part.input} />}
				<ToolOutput
					errorText={part.state === "output-error" ? part.errorText : undefined}
					output={
						part.state === "output-available"
							? resultView(name, part.output)
							: undefined
					}
				/>
			</ToolContent>
		</Tool>
	);
}
