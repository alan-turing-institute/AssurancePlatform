import {
	checkEmbedding,
	embeddingCheckId,
	fetchEmbeddingSpec,
} from "@/lib/models/embedding-check";
import {
	getConnectionForUse,
	type JobAssignment,
	recordEmbeddingCheck,
} from "@/lib/services/model-connection-service";

/**
 * What the search check found. `unavailable` means it could not be run
 * because the techniques service did not give the catalogue's spec; the job is
 * left unchecked. Otherwise `ok` is true only when the user's vectors matched
 * the published ones and the result was recorded against the job.
 */
export type SearchCheckOutcome =
	| { lowestCosine: number | null; ok: boolean }
	| { unavailable: true };

/**
 * Runs the search check for `search` and records a pass. The network calls
 * (the spec, then the embedding request) run here, outside any database
 * transaction. The pass is recorded only if the user's search job is still
 * `search` when the comparison finishes; a job changed in the meantime is left
 * unmarked, and `ok` is false.
 */
export async function runSearchCheck(
	userId: string,
	search: JobAssignment
): Promise<SearchCheckOutcome> {
	const spec = await fetchEmbeddingSpec();
	if (!spec) {
		return { unavailable: true };
	}
	const connection = await getConnectionForUse(userId, search.connectionId);
	if ("error" in connection) {
		return { ok: false, lowestCosine: null };
	}
	const result = await checkEmbedding({
		connection: connection.data,
		model: search.model,
		spec,
	});
	if (!result.ok) {
		return { ok: false, lowestCosine: result.lowestCosine };
	}
	const recorded = await recordEmbeddingCheck(
		userId,
		embeddingCheckId(spec),
		search
	);
	return {
		ok: "data" in recorded && recorded.data,
		lowestCosine: result.lowestCosine,
	};
}
