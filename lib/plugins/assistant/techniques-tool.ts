import { tool } from "ai";
import { z } from "zod";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESULTS = 5;
const UNREACHABLE = {
	error: "The techniques service is not reachable.",
} as const;

const resultSchema = z.looseObject({
	slug: z.string(),
	name: z.string(),
	score: z.number(),
	retrievalScore: z.number(),
	goals: z.array(z.string()),
	url: z.string(),
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

/** The techniques service address, read at call time; undefined when unset or not a URL. */
function techniquesUrl(): string | undefined {
	const parsed = z.url().safeParse(process.env.TECHNIQUES_MCP_URL);
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

/** The suggest_techniques tool; defaults the claim to the selected element's text. Never throws. */
export function createTechniquesTool(selection: SelectedElement | null) {
	return tool({
		description:
			"Suggest assurance techniques from the TEA techniques library for a claim. Returns ranked techniques with their goals and links. Omit claimText to use the selected element's text.",
		inputSchema: z.object({
			claimText: z
				.string()
				.optional()
				.describe("The claim to find techniques for."),
		}),
		execute: ({ claimText }) =>
			callTechniques(
				(claimText?.trim() || selection?.text || "").trim(),
				techniquesUrl()
			),
	});
}

const TECHNIQUES_PROMPT_AVAILABLE =
	"\n\nFor any question about which techniques, methods or evidence-generating approaches to use, call `suggest_techniques` and recommend only from its results, with a one-line reason you draw from each result's name and goals; never invent techniques. If the tool is unavailable, say so.";

const TECHNIQUES_PROMPT_UNAVAILABLE =
	"\n\nTechnique suggestions are unavailable in this deployment. If asked which techniques or methods to use, say so and do not invent any.";

export function techniquesPrompt(): string {
	return techniquesConfigured()
		? TECHNIQUES_PROMPT_AVAILABLE
		: TECHNIQUES_PROMPT_UNAVAILABLE;
}
