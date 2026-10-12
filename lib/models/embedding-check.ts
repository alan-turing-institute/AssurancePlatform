import { createHash } from "node:crypto";
import { embedMany } from "ai";
import { z } from "zod";
import { embeddingModelFor } from "@/lib/models/adapters";
import {
	readJsonWithin,
	TECHNIQUES_SERVICE_MAX_BYTES,
} from "@/lib/models/capped-json";
import type { ModelConnectionAccess } from "@/lib/models/connection-types";

/**
 * The search check. Search only matches the catalogue when the user's
 * embedding model gives the same vectors as the one the catalogue was built
 * with, wherever it runs. The techniques service publishes a few fixed
 * sentences with the vectors it computed for them; the check embeds the same
 * sentences through the user's connection and compares.
 */

/**
 * The lowest cosine similarity between a probe's vector from the user's model
 * and the published one for the check to pass.
 */
export const EMBEDDING_CHECK_THRESHOLD = 0.999;

const SPEC_TIMEOUT_MS = 5000;
const CHECK_TIMEOUT_MS = 30_000;
const MAX_DIMENSIONS = 8192;
const MAX_PROBES = 32;
const HTTP_PROTOCOL = /^https?$/;

const embeddingSpecSchema = z
	.object({
		modelId: z.string().min(1),
		dimensions: z.number().int().positive().max(MAX_DIMENSIONS),
		queryPrefix: z.string(),
		documentFormat: z.string(),
		dataVersion: z.string(),
		probes: z
			.array(z.object({ text: z.string().min(1), vector: z.array(z.number()) }))
			.min(1)
			.max(MAX_PROBES),
	})
	.refine(
		(spec) =>
			spec.probes.every((probe) => probe.vector.length === spec.dimensions),
		{ message: "A probe vector does not have the stated dimensions" }
	);

export type EmbeddingSpec = z.infer<typeof embeddingSpecSchema>;

/**
 * What a passed search check is recorded against: the catalogue's model id and
 * a SHA-256 of its probe sentences, in order, written as a JSON array so that
 * a sentence containing a newline cannot stand in for two. The check is
 * current only while this value equals the one recorded.
 */
export function embeddingCheckId(
	spec: Pick<EmbeddingSpec, "modelId" | "probes">
): string {
	const probeHash = createHash("sha256")
		.update(JSON.stringify(spec.probes.map((probe) => probe.text)))
		.digest("hex");
	return `${spec.modelId}#${probeHash}`;
}

export interface EmbeddingCheckInput {
	connection: ModelConnectionAccess;
	/** The search job's model. */
	model: string;
	signal?: AbortSignal;
	spec: Pick<EmbeddingSpec, "dimensions" | "probes" | "queryPrefix">;
}

export interface EmbeddingCheckResult {
	/** The lowest similarity over the probes, or null when no comparison could be made. */
	lowestCosine: number | null;
	ok: boolean;
}

const NOT_COMPARED: EmbeddingCheckResult = { ok: false, lowestCosine: null };

function cosine(a: readonly number[], b: readonly number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (const [index, x] of a.entries()) {
		const y = b[index] ?? 0;
		dot += x * y;
		normA += x * x;
		normB += y * y;
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Embeds each probe, with the catalogue's query prefix in front, through the
 * connection and compares it with the published vector. It passes when every
 * vector has the published dimensions and every cosine similarity reaches
 * `EMBEDDING_CHECK_THRESHOLD`. A failure to get the vectors at all (the
 * server, the guard, a connection that cannot embed) fails the check with no
 * similarity, and nothing is thrown.
 */
export async function checkEmbedding({
	connection,
	model,
	signal,
	spec,
}: EmbeddingCheckInput): Promise<EmbeddingCheckResult> {
	const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
	try {
		const { embeddings } = await embedMany({
			model: embeddingModelFor(connection, model),
			values: spec.probes.map((probe) => `${spec.queryPrefix}${probe.text}`),
			abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
			maxRetries: 0,
		});
		if (
			embeddings.length !== spec.probes.length ||
			embeddings.some((vector) => vector.length !== spec.dimensions)
		) {
			return NOT_COMPARED;
		}
		const lowest = Math.min(
			...spec.probes.map((probe, index) =>
				cosine(embeddings[index] ?? [], probe.vector)
			)
		);
		return Number.isFinite(lowest)
			? { ok: lowest >= EMBEDDING_CHECK_THRESHOLD, lowestCosine: lowest }
			: NOT_COMPARED;
	} catch {
		return NOT_COMPARED;
	}
}

/** The origin of the techniques service, or null when `TECHNIQUES_MCP_URL` is unset or not an http(s) URL. */
function techniquesOrigin(): string | null {
	const parsed = z
		.url({ protocol: HTTP_PROTOCOL })
		.safeParse(process.env.TECHNIQUES_MCP_URL);
	return parsed.success ? new URL(parsed.data).origin : null;
}

/**
 * Reads the catalogue's embedding spec from the techniques service, at
 * `/embedding-spec` on the origin of `TECHNIQUES_MCP_URL`. That address is the
 * operator's own, so it is fetched directly rather than through the guard that
 * protects user-chosen addresses. Returns null when the service is not
 * configured, does not answer within five seconds, is cancelled through
 * `signal`, redirects, answers with more than 1 MiB, or answers with anything
 * but a valid spec.
 */
export async function fetchEmbeddingSpec(
	signal?: AbortSignal
): Promise<EmbeddingSpec | null> {
	const origin = techniquesOrigin();
	if (!origin) {
		return null;
	}
	const timeout = AbortSignal.timeout(SPEC_TIMEOUT_MS);
	try {
		const response = await fetch(`${origin}/embedding-spec`, {
			redirect: "error",
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
		});
		if (!response.ok) {
			return null;
		}
		const parsed = embeddingSpecSchema.safeParse(
			await readJsonWithin(response, TECHNIQUES_SERVICE_MAX_BYTES)
		);
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}
