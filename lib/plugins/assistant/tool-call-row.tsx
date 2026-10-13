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

/** A flag the tool may leave out or get wrong is dropped rather than turning the whole list into raw text. */
const loosely = <T extends z.ZodType>(schema: T) =>
	schema.optional().catch(undefined);

const techniquesOutput = z.object({
	searchUsed: loosely(z.boolean()),
	searchReason: loosely(z.string()),
	rankingUsed: loosely(z.boolean()),
	rankingReason: loosely(z.string()),
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

type TechniquesOutput = z.infer<typeof techniquesOutput>;

/** Whether a step of the lookup ran, and why not when it did not. Null when the tool did not say. */
function stepLine(
	name: string,
	used: boolean | undefined,
	reason: string | undefined
): string | null {
	if (used === undefined) {
		return null;
	}
	if (used) {
		return `${name}: used.`;
	}
	return reason ? `${name}: not used (${reason}).` : `${name}: not used.`;
}

/** The suggest_techniques result as a list, under a line for each step of the lookup that the tool reported on. */
function TechniquesList({ output }: { output: TechniquesOutput }) {
	const steps = [
		stepLine("Semantic search", output.searchUsed, output.searchReason),
		stepLine("Ranking", output.rankingUsed, output.rankingReason),
	].filter((line) => line !== null);
	return (
		<>
			{steps.length > 0 && (
				<div
					className="space-y-1 px-3 pt-3 text-muted-foreground"
					data-testid="assistant-technique-steps"
				>
					{steps.map((line) => (
						<p key={line}>{line}</p>
					))}
				</div>
			)}
			<ul className="space-y-1 p-3" data-testid="assistant-techniques">
				{output.results.map((r, index) => (
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
		</>
	);
}

/** The technique list or lint view for those two tools when the result has the expected shape, otherwise the result as text. */
function resultView(name: string, output: unknown): ReactNode {
	if (name === "suggest_techniques") {
		const parsed = techniquesOutput.safeParse(output);
		if (parsed.success) {
			return <TechniquesList output={parsed.data} />;
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

/** What a call that never got a result says once its reply has ended. */
const DID_NOT_FINISH = "Did not finish.";

export interface ToolCallRowProps {
	part: MessagePart;
	/** The reply the call belongs to is over. A call with no result by then was cut off, and is shown as an error, not as running. */
	replyEnded?: boolean;
}

/** One tool call as a collapsed row that opens to its input and result. Renders nothing for parts that are not tool calls. */
export function ToolCallRow({ part, replyEnded = false }: ToolCallRowProps) {
	if (!isToolUIPart(part)) {
		return null;
	}
	const name = getToolName(part);
	const title = TOOL_TITLES[name] ?? name;
	const cutOff =
		replyEnded &&
		(part.state === "input-streaming" || part.state === "input-available");
	const state = cutOff ? "output-error" : part.state;
	const failure = part.state === "output-error" ? part.errorText : undefined;
	return (
		<Tool data-testid="assistant-tool-call">
			{part.type === "dynamic-tool" ? (
				<ToolHeader
					state={state}
					title={title}
					toolName={part.toolName}
					type={part.type}
				/>
			) : (
				<ToolHeader state={state} title={title} type={part.type} />
			)}
			<ToolContent>
				{hasInput(part.input) && <ToolInput input={part.input} />}
				<ToolOutput
					errorText={cutOff ? DID_NOT_FINISH : failure}
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
