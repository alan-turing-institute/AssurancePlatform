import { tool } from "ai";
import { z } from "zod";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESULTS = 5;
/** The service rejects a longer claim, so anything longer is cut before it is sent. */
const MAX_CLAIM_CHARS = 2000;
/** A supplied claim shorter than this is a placeholder, not a claim, when an element is selected. */
const MIN_SUPPLIED_CLAIM_CHARS = 40;
const MAX_FIELD_CHARS = 500;
const MAX_GOALS = 20;
const MAX_GOAL_CHARS = 200;
const HTTP_PROTOCOL = /^https?$/;
const UNREACHABLE = {
	error: "The techniques service is not reachable.",
} as const;

/** Cuts, never rejects, so an oversized field cannot turn a good answer into an error. */
const cut = (max: number) =>
	z.string().transform((value) => value.slice(0, max));

const resultSchema = z.looseObject({
	slug: z.string(),
	name: cut(MAX_FIELD_CHARS),
	score: z.number(),
	retrievalScore: z.number(),
	goals: z
		.array(cut(MAX_GOAL_CHARS))
		.transform((goals) => goals.slice(0, MAX_GOALS)),
	url: cut(MAX_FIELD_CHARS),
});

const responseSchema = z.looseObject({
	result: z.looseObject({
		structuredContent: z.looseObject({
			rankingAvailable: z.boolean(),
			results: z.array(resultSchema),
		}),
	}),
});

export interface SelectedElement {
	label: string;
	text: string;
	type: string;
}

/** The techniques service address, read at call time; undefined when unset or not an http(s) URL. */
function techniquesUrl(): string | undefined {
	const parsed = z
		.url({ protocol: HTTP_PROTOCOL })
		.safeParse(process.env.TECHNIQUES_MCP_URL);
	return parsed.success ? parsed.data : undefined;
}

export function techniquesConfigured(): boolean {
	return techniquesUrl() !== undefined;
}

async function callTechniques(claim: string, url: string | undefined) {
	if (!url) {
		return UNREACHABLE;
	}
	if (!claim) {
		return {
			error: "No claim text was given and no element is selected.",
		};
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: crypto.randomUUID(),
				method: "tools/call",
				params: {
					name: "suggest_techniques_for_claim",
					arguments: { claim },
				},
			}),
			redirect: "error",
			signal: controller.signal,
		});
		if (!response.ok) {
			return UNREACHABLE;
		}
		const parsed = responseSchema.safeParse(await response.json());
		if (!parsed.success) {
			return UNREACHABLE;
		}
		const { rankingAvailable, results } = parsed.data.result.structuredContent;
		return {
			rankingAvailable,
			results: results.slice(0, MAX_RESULTS).map((r) => ({
				slug: r.slug,
				name: r.name,
				score: r.score,
				retrievalScore: r.retrievalScore,
				goals: r.goals,
				url: r.url,
			})),
		};
	} catch {
		return UNREACHABLE;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * The claim to send. With an element selected, a supplied claim under 40
 * characters is a placeholder and the element's own text is used instead.
 * With an element selected whose text is empty, a supplied claim under 40
 * characters is still a placeholder, and no claim is sent.
 * Cut to what the service accepts.
 */
function chooseClaim(
	supplied: string | undefined,
	selection: SelectedElement | null
): string {
	const given = (supplied ?? "").trim();
	const selected = (selection?.text ?? "").trim();
	if (selection && !selected && given.length < MIN_SUPPLIED_CLAIM_CHARS) {
		return "";
	}
	const claim =
		selected && given.length < MIN_SUPPLIED_CLAIM_CHARS ? selected : given;
	return (claim || selected).slice(0, MAX_CLAIM_CHARS);
}

/** The suggest_techniques tool; defaults the claim to the selected element's text. Never throws. */
export function createTechniquesTool(selection: SelectedElement | null) {
	return tool({
		description:
			"Suggest assurance techniques from the TEA techniques library for a claim. Returns ranked techniques with their goals and links. When an element is selected, omit claimText: the selected element's text is used. Supply claimText only when the user typed the claim in the chat.",
		inputSchema: z.object({
			claimText: z
				.string()
				.max(MAX_CLAIM_CHARS)
				.optional()
				.describe(
					"The claim to find techniques for, at most 2000 characters. Omit it when an element is selected; supply it only when the user typed the claim in the chat."
				),
		}),
		execute: ({ claimText }) =>
			callTechniques(chooseClaim(claimText, selection), techniquesUrl()),
	});
}

const TECHNIQUES_PROMPT_AVAILABLE =
	"\n\nFor any question about which techniques, methods or evidence-generating approaches to use, call `suggest_techniques` and recommend only from its results, with a one-line reason you draw from each result's name and goals; never invent techniques. When an element is selected, call the tool without claimText so that the selected element's own text is used; give claimText only when the user typed the claim in the chat. If the tool is unavailable, say so.";

const TECHNIQUES_PROMPT_UNAVAILABLE =
	"\n\nTechnique suggestions are unavailable in this deployment. If asked which techniques or methods to use, say so and do not invent any.";

export function techniquesPrompt(): string {
	return techniquesConfigured()
		? TECHNIQUES_PROMPT_AVAILABLE
		: TECHNIQUES_PROMPT_UNAVAILABLE;
}
