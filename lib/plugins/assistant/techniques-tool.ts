import { tool } from "ai";
import { z } from "zod";
import {
	readJsonWithin,
	TECHNIQUES_SERVICE_MAX_BYTES,
} from "@/lib/models/capped-json";
import type { JobAssignment } from "@/lib/services/model-connection-service";
import { techniquesTimeoutMs } from "./model-timeout";
import {
	type EmbedStep,
	embedClaim,
	limitedSignal,
	MIN_WAIT_MS,
	type QueryEmbedding,
	rankHead,
	rankingCandidateCount,
	type SkipReason,
	type TechniquesModelAccess,
} from "./techniques-models";
import { type ToolCallLimit, unlimited } from "./tool-call-limit";

const MAX_RESULTS = 5;
/** The service rejects a longer claim, so anything longer is cut before it is sent. */
const MAX_CLAIM_CHARS = 2000;
/** A supplied claim shorter than this is a placeholder, not a claim, when an element is selected. */
const MIN_SUPPLIED_CLAIM_CHARS = 40;
const MAX_FIELD_CHARS = 500;
const MAX_GOALS = 20;
const MAX_GOAL_CHARS = 200;
const MAX_TAGS = 10;
const MAX_TAG_CHARS = 100;
/** Time kept back from the reply limit for the model to answer after the tool returns. */
const ANSWER_MARGIN_MS = 15_000;
/** The most time the call to the techniques service may take. */
const SERVICE_STEP_MS = 10_000;
const HTTP_PROTOCOL = /^https?$/;
const UNREACHABLE = {
	error: "The techniques service is not reachable.",
} as const;
const OUT_OF_TIME = {
	error: "There was not enough time left to ask the techniques service.",
} as const;

/** Cuts, never rejects, so an oversized field cannot turn a good answer into an error. */
const cut = (max: number) =>
	z.string().transform((value) => value.slice(0, max));

/** A field the service may leave out or get wrong: it is dropped rather than failing the whole answer. */
const loosely = <T extends z.ZodType>(schema: T) =>
	schema.optional().catch(undefined);

const resultSchema = z.looseObject({
	slug: z.string(),
	name: cut(MAX_FIELD_CHARS),
	score: z.number(),
	retrievalScore: z.number(),
	goals: z
		.array(cut(MAX_GOAL_CHARS))
		.transform((goals) => goals.slice(0, MAX_GOALS)),
	url: cut(MAX_FIELD_CHARS),
	summary: loosely(cut(MAX_FIELD_CHARS)),
	tags: loosely(
		z.array(cut(MAX_TAG_CHARS)).transform((tags) => tags.slice(0, MAX_TAGS))
	),
});

const responseSchema = z.looseObject({
	result: z.looseObject({
		structuredContent: z.looseObject({
			semanticUsed: loosely(z.boolean()),
			results: z.array(resultSchema),
		}),
	}),
});

type ServiceResult = z.infer<typeof resultSchema>;

interface ServiceAnswer {
	results: ServiceResult[];
	semanticUsed: boolean;
}

export interface SelectedElement {
	/** The element's id in the case, which `read_element` takes; absent when not known. */
	id?: string;
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

/** The error for an empty claim: the selected element has no text, or nothing was given at all. */
function noClaimError(selection: SelectedElement | null) {
	return {
		error: selection
			? "The selected element has no text."
			: "No claim text was given and no element is selected.",
	};
}

/** Used when the tool is given no models: both jobs read as not set up. */
const NO_MODELS: TechniquesModelAccess = {
	connection: () => Promise.resolve(null),
	roles: () =>
		Promise.resolve({
			chat: null,
			ranking: null,
			search: null,
			searchCheck: null,
		}),
};

/** The request to the service: the claim, and its vector when one was made. */
function serviceRequestBody(
	claim: string,
	embedding: QueryEmbedding | null
): string {
	return JSON.stringify({
		jsonrpc: "2.0",
		id: crypto.randomUUID(),
		method: "tools/call",
		params: {
			name: "suggest_techniques_for_claim",
			arguments: embedding ? { claim, queryEmbedding: embedding } : { claim },
		},
	});
}

/**
 * Asks the service for candidates. It has at most ten seconds, and at least
 * one even when the lookup is nearly out of time, because the earlier step
 * leaves that second for it. Null when the service cannot be used, which
 * includes an answer larger than 1 MiB.
 */
async function askService({
	abortSignal,
	claim,
	deadline,
	embedding,
	url,
}: {
	abortSignal: AbortSignal | undefined;
	claim: string;
	deadline: number;
	embedding: QueryEmbedding | null;
	url: string;
}): Promise<ServiceAnswer | null> {
	const limit = limitedSignal(
		Math.max(MIN_WAIT_MS, Math.min(SERVICE_STEP_MS, deadline - Date.now())),
		abortSignal
	);
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: serviceRequestBody(claim, embedding),
			redirect: "error",
			signal: limit.signal,
		});
		if (!response.ok) {
			return null;
		}
		const parsed = responseSchema.safeParse(
			await readJsonWithin(response, TECHNIQUES_SERVICE_MAX_BYTES)
		);
		if (!parsed.success) {
			return null;
		}
		const { results, semanticUsed } = parsed.data.result.structuredContent;
		return { results, semanticUsed: semanticUsed === true };
	} catch {
		return null;
	} finally {
		limit.release();
	}
}

/** One technique as the model sees it. `score` is the ranking model's probability when `ranked` is true, otherwise the service's own score. */
function listed(result: ServiceResult, ranked: boolean, score = result.score) {
	return {
		slug: result.slug,
		name: result.name,
		score,
		retrievalScore: result.retrievalScore,
		ranked,
		goals: result.goals,
		url: result.url,
		summary: result.summary,
		tags: result.tags,
	};
}

type Listed = ReturnType<typeof listed>;

interface Ordering {
	rankingReason?: SkipReason;
	rankingUsed: boolean;
	results: Listed[];
}

/** The results in the service's order, with the reason they were not ranked. */
function searchOrder(
	results: ServiceResult[],
	rankingReason: SkipReason
): Ordering {
	return {
		rankingUsed: false,
		rankingReason,
		results: results.map((result) => listed(result, false)),
	};
}

/**
 * Sends the first results to the ranking model. A ranking re-orders those;
 * the rest follow in the service's order, unranked. Without one, every result
 * stays in the service's order.
 */
async function orderResults({
	results,
	...step
}: {
	access: TechniquesModelAccess;
	claim: string;
	deadline: number;
	job: JobAssignment | null;
	results: ServiceResult[];
	signal: AbortSignal | undefined;
}): Promise<Ordering> {
	const head = results.slice(0, rankingCandidateCount());
	const outcome = await rankHead({
		...step,
		candidates: head.map((result) => ({
			id: result.slug,
			name: result.name,
			summary: result.summary ?? "",
			goals: result.goals,
			result,
		})),
	});
	if ("reason" in outcome) {
		return searchOrder(results, outcome.reason);
	}
	return {
		rankingUsed: true,
		results: [
			...outcome.ranked.map(({ candidate, score }) =>
				listed(candidate.result, true, score)
			),
			...results.slice(head.length).map((result) => listed(result, false)),
		],
	};
}

/** Whether the vector was used, and if not why not. The service says whether it used the vector it was sent. */
function searchOutcome(step: EmbedStep, semanticUsed: boolean) {
	if ("reason" in step) {
		return { searchUsed: false, searchReason: step.reason };
	}
	return semanticUsed
		? { searchUsed: true }
		: { searchUsed: false, searchReason: "unavailable" as const };
}

/** The three steps of one lookup: embed the claim, ask the service, rank what it returns. */
async function lookUp({
	abortSignal,
	claim,
	deadline,
	models,
	url,
}: {
	abortSignal: AbortSignal | undefined;
	claim: string;
	deadline: number;
	models: TechniquesModelAccess;
	url: string;
}) {
	const roles = await models.roles();
	const step = { access: models, claim, deadline, signal: abortSignal };
	const search: EmbedStep = roles
		? await embedClaim({
				...step,
				check: roles.searchCheck,
				job: roles.search,
			})
		: { reason: "unavailable" };
	if (abortSignal?.aborted) {
		return UNREACHABLE;
	}
	const answer = await askService({
		abortSignal,
		claim,
		deadline,
		embedding: "embedding" in search ? search.embedding : null,
		url,
	});
	if (!answer) {
		return UNREACHABLE;
	}
	const ordering = roles
		? await orderResults({
				...step,
				job: roles.ranking,
				results: answer.results,
			})
		: searchOrder(answer.results, "unavailable");
	return {
		...searchOutcome(search, answer.semanticUsed),
		...ordering,
		results: ordering.results.slice(0, MAX_RESULTS),
	};
}

async function callTechniques({
	abortSignal,
	claim,
	models,
	replyDeadline,
	selection,
	url,
}: {
	abortSignal: AbortSignal | undefined;
	claim: string;
	models: TechniquesModelAccess;
	replyDeadline: number;
	selection: SelectedElement | null;
	url: string | undefined;
}) {
	if (!url) {
		return UNREACHABLE;
	}
	if (!claim) {
		return noClaimError(selection);
	}
	const waitMs = Math.min(
		techniquesTimeoutMs(),
		replyDeadline - Date.now() - ANSWER_MARGIN_MS
	);
	if (waitMs < MIN_WAIT_MS) {
		return OUT_OF_TIME;
	}
	try {
		return await lookUp({
			abortSignal,
			claim,
			deadline: Date.now() + waitMs,
			models,
			url,
		});
	} catch {
		return UNREACHABLE;
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

/**
 * The suggest_techniques tool; defaults the claim to the selected element's text. Never throws.
 *
 * One lookup has the smaller of ASSISTANT_TECHNIQUES_TIMEOUT_MS and the time
 * left before `replyDeadline` (epoch milliseconds, when the whole reply is cut
 * off) less a margin for the model to answer; with less than a second to
 * spare nothing is called. Without a deadline only the setting applies.
 * Inside that time the claim's embedding gets at most ten seconds, the service
 * at most ten, and the ranking what is left, up to
 * ASSISTANT_RANKING_TIMEOUT_MS. Every step is also cancelled with the reply.
 *
 * `models` supplies the user's search and ranking jobs when the tool runs. A
 * job that is off, unchecked or failing is left out and reported in the
 * result (`searchUsed`, `rankingUsed` and a reason for each step not used);
 * the lookup still answers with what the service found.
 *
 * `limited` is the reply's cap on tool calls, shared with the other tools; on
 * its own the tool is not capped.
 */
export function createTechniquesTool(
	selection: SelectedElement | null,
	replyDeadline = Number.POSITIVE_INFINITY,
	models: TechniquesModelAccess = NO_MODELS,
	limited: ToolCallLimit = unlimited
) {
	return tool({
		description:
			"Suggest assurance techniques from the TEA techniques library for a claim. Returns ranked techniques with their goals and links, and says whether semantic search and ranking were used. When an element is selected, omit claimText: the selected element's text is used. Supply claimText only when the user typed the claim in the chat.",
		inputSchema: z.object({
			claimText: z
				.string()
				.max(MAX_CLAIM_CHARS)
				.optional()
				.describe(
					"The claim to find techniques for, at most 2000 characters. Omit it when an element is selected; supply it only when the user typed the claim in the chat."
				),
		}),
		execute: ({ claimText }, { abortSignal }) =>
			limited(() =>
				callTechniques({
					abortSignal,
					claim: chooseClaim(claimText, selection),
					models,
					replyDeadline,
					selection,
					url: techniquesUrl(),
				})
			),
	});
}

const TECHNIQUES_PROMPT_AVAILABLE =
	"\n\nFor any question about which techniques, methods or evidence-generating approaches to use, call `suggest_techniques` and recommend only from its results, with a one-line reason you draw from each result's name and goals; never invent techniques. When an element is selected, call the tool without claimText so that the selected element's own text is used; give claimText only when the user typed the claim in the chat. If the result has searchUsed or rankingUsed false, tell the user plainly that semantic search or ranking was not used, giving its searchReason or rankingReason, because the results are then less well matched or ordered. If the tool is unavailable, say so.";

const TECHNIQUES_PROMPT_UNAVAILABLE =
	"\n\nTechnique suggestions are unavailable in this deployment. If asked which techniques or methods to use, say so and do not invent any.";

export function techniquesPrompt(): string {
	return techniquesConfigured()
		? TECHNIQUES_PROMPT_AVAILABLE
		: TECHNIQUES_PROMPT_UNAVAILABLE;
}
