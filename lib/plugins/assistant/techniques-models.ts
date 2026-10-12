import { embed } from "ai";
import { embeddingModelFor } from "@/lib/models/adapters";
import {
	type RankableCandidate,
	type RankedCandidate,
	rankCandidates,
} from "@/lib/models/clef";
import {
	type EmbeddingSpec,
	embeddingCheckId,
	fetchEmbeddingSpec,
} from "@/lib/models/embedding-check";
import { rankingTimeoutMs } from "@/lib/plugins/assistant/model-timeout";
import type {
	ConnectionForUse,
	JobAssignment,
	ModelRoles,
} from "@/lib/services/model-connection-service";

/**
 * The two steps of a technique lookup that use the user's models: embedding
 * the claim through the search job, and ranking the candidates through the
 * ranking job. Neither throws. A step that cannot run reports one of four
 * fixed reasons, so the lookup can carry on without it and say what was left
 * out.
 */

export type SkipReason =
	| "not set up"
	| "check not passed"
	| "timed out"
	| "unavailable";

/** What the techniques tool reads of a user's stored models, when it runs. */
export interface TechniquesModelAccess {
	/** The connection with its key, or null when it cannot be read. */
	connection(connectionId: string): Promise<ConnectionForUse | null>;
	/** The user's three jobs, or null when they cannot be read. */
	roles(): Promise<ModelRoles | null>;
}

/** The vector sent to the techniques service, with the model that made it. */
export interface QueryEmbedding {
	model: string;
	vector: number[];
}

export type EmbedStep = { embedding: QueryEmbedding } | { reason: SkipReason };

/** A wait shorter than this is not worth a request. */
export const MIN_WAIT_MS = 1000;
/** The most time the claim's embedding, including reading the catalogue spec, may take. */
const EMBEDDING_STEP_MS = 10_000;

const SPEC_CACHE_MS = 10 * 60_000;
const DEFAULT_RANKING_CANDIDATES = 8;
const MIN_RANKING_CANDIDATES = 1;
const MAX_RANKING_CANDIDATES = 20;
const INTEGER = /^\d+$/;

/**
 * How many of the service's results go to the ranking model, read from
 * ASSISTANT_RANKING_CANDIDATES on every call. An integer clamped to 1-20; an
 * unset, empty or non-numeric value means 8.
 */
export function rankingCandidateCount(
	raw: string | undefined = process.env.ASSISTANT_RANKING_CANDIDATES
): number {
	const text = raw?.trim() ?? "";
	if (!INTEGER.test(text)) {
		return DEFAULT_RANKING_CANDIDATES;
	}
	return Math.min(
		MAX_RANKING_CANDIDATES,
		Math.max(MIN_RANKING_CANDIDATES, Number(text))
	);
}

/** A signal that aborts after `ms` or when `parent` does. Call `release` once the step is over. */
export function limitedSignal(ms: number, parent: AbortSignal | undefined) {
	const limit = new AbortController();
	const timer = setTimeout(() => limit.abort(), ms);
	return {
		signal: parent ? AbortSignal.any([limit.signal, parent]) : limit.signal,
		/** Whether the time limit, rather than the parent, ended the step. */
		timedOut: () => limit.signal.aborted,
		release: () => clearTimeout(timer),
	};
}

let cachedSpec: { expiresAt: number; spec: EmbeddingSpec; url: string } | null =
	null;

/** The catalogue's embedding spec, kept for ten minutes; null when the service cannot give one. */
async function catalogueSpec(
	signal: AbortSignal
): Promise<EmbeddingSpec | null> {
	const url = process.env.TECHNIQUES_MCP_URL ?? "";
	if (cachedSpec?.url === url && cachedSpec.expiresAt > Date.now()) {
		return cachedSpec.spec;
	}
	const spec = await fetchEmbeddingSpec(signal);
	cachedSpec = spec
		? { spec, url, expiresAt: Date.now() + SPEC_CACHE_MS }
		: null;
	return spec;
}

function isUsableVector(vector: number[], dimensions: number): boolean {
	return vector.length === dimensions && vector.every(Number.isFinite);
}

interface EmbedClaimInput {
	access: TechniquesModelAccess;
	/** The recorded search check; null when none has passed. */
	check: ModelRoles["searchCheck"];
	claim: string;
	/** When the whole lookup must be over, in epoch milliseconds. */
	deadline: number;
	/** The search job; null when it is off. */
	job: JobAssignment | null;
	/** Cancels the step when the reply is stopped. */
	signal: AbortSignal | undefined;
}

/**
 * Embeds the claim, with the catalogue's query prefix, through the search job.
 * It runs only when the search check recorded for the user was passed against
 * the catalogue's current model and test sentences; a stale or absent check
 * makes no embedding call. The step has at most ten seconds, and always leaves
 * a second of the lookup for the techniques service.
 */
export async function embedClaim({
	access,
	check,
	claim,
	deadline,
	job,
	signal,
}: EmbedClaimInput): Promise<EmbedStep> {
	if (!job) {
		return { reason: "not set up" };
	}
	if (!check) {
		return { reason: "check not passed" };
	}
	const ms = Math.min(EMBEDDING_STEP_MS, deadline - Date.now() - MIN_WAIT_MS);
	if (ms < MIN_WAIT_MS) {
		return { reason: "timed out" };
	}
	const limit = limitedSignal(ms, signal);
	const failed = (): EmbedStep => ({
		reason: limit.timedOut() ? "timed out" : "unavailable",
	});
	try {
		const spec = await catalogueSpec(limit.signal);
		if (!spec) {
			return failed();
		}
		if (check.verifiedFor !== embeddingCheckId(spec)) {
			return { reason: "check not passed" };
		}
		const connection = await access.connection(job.connectionId);
		if (!connection) {
			return failed();
		}
		const { embedding } = await embed({
			model: embeddingModelFor(connection, job.model),
			value: `${spec.queryPrefix}${claim}`,
			abortSignal: limit.signal,
			maxRetries: 0,
		});
		return isUsableVector(embedding, spec.dimensions)
			? { embedding: { model: spec.modelId, vector: embedding } }
			: { reason: "check not passed" };
	} catch {
		return failed();
	} finally {
		limit.release();
	}
}

interface RankInput<T extends RankableCandidate> {
	access: TechniquesModelAccess;
	candidates: readonly T[];
	claim: string;
	/** When the whole lookup must be over, in epoch milliseconds. */
	deadline: number;
	/** The ranking job; null when it is off. */
	job: JobAssignment | null;
	/** Cancels the step when the reply is stopped. */
	signal: AbortSignal | undefined;
}

type RankStep<T extends RankableCandidate> =
	| { ranked: RankedCandidate<T>[] }
	| { reason: SkipReason };

/**
 * Ranks the candidates through the ranking job. The step has what remains of
 * the lookup, up to ASSISTANT_RANKING_TIMEOUT_MS. A ranking that fails for
 * any reason other than running out of time is reported as unavailable.
 */
export async function rankHead<T extends RankableCandidate>({
	access,
	candidates,
	claim,
	deadline,
	job,
	signal,
}: RankInput<T>): Promise<RankStep<T>> {
	if (!job) {
		return { reason: "not set up" };
	}
	const ms = Math.min(rankingTimeoutMs(), deadline - Date.now());
	if (ms < MIN_WAIT_MS) {
		return { reason: "timed out" };
	}
	const end = Date.now() + ms;
	const limit = limitedSignal(ms, signal);
	try {
		const connection = await access.connection(job.connectionId);
		if (!connection) {
			return { reason: "unavailable" };
		}
		const ranked = await rankCandidates({
			candidates,
			claim,
			connection,
			deadline: end,
			model: job.model,
			signal: limit.signal,
		});
		if (ranked) {
			return { ranked };
		}
		return {
			reason:
				limit.timedOut() || Date.now() >= end ? "timed out" : "unavailable",
		};
	} catch {
		return { reason: "unavailable" };
	} finally {
		limit.release();
	}
}
