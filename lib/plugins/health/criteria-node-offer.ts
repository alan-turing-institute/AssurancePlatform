import { evidenceNodeText } from "@/lib/health-evidence-node-text";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import type { HealthCriteriaResponse } from "./health-types";

/** What a form needs to know about the claim's evidence node. */
export type NodeEvidence = Pick<
	HealthCriteriaResponse,
	"evidence_node" | "evidence_node_text"
>;

/** Which stage the settings are at: accepted already, a fresh pick, or a suggestion. */
type OfferState = "accepted" | "new" | "suggested";

export interface NodeOfferInput {
	/** The check chosen in the form. */
	check: HealthCheck;
	/** For accepted settings: the chosen check is not the one stored. */
	checkChanged: boolean;
	evidence: NodeEvidence;
	/** The display name of the pipeline that runs the chosen check, as the check list gives it. */
	pipeline: string;
	state: OfferState;
}

/** The choices the node gives a person at the accept or save step. Absent parts are not offered. */
export interface NodeOffer {
	/** An evidence node can be added; its text is what the server will write. */
	add: { text: string } | null;
	/** The live node results will show on, when settings are about to be accepted and one is in place. */
	node: { name: string | null } | null;
	/** The live node's text can be rewritten to name the chosen check. */
	update: { after: string; before: string | null; name: string | null } | null;
}

/**
 * Whether the chosen check differs from the one the node's text was last
 * written for. The server applies the same rule when it decides whether to
 * accept the update, so the option is shown in exactly the cases it accepts.
 */
function namesAnotherCheck(
	evidence: NodeEvidence,
	check: HealthCheck,
	pipeline: string
): boolean {
	const written = evidence.evidence_node_text?.written_for;
	if (!written) {
		return false;
	}
	return (
		written.check !== check.name ||
		(written.pipeline !== null && written.pipeline !== pipeline)
	);
}

/**
 * What to offer about the claim's evidence node for the form as it stands.
 *
 * - Accepted settings with a live node and a changed check: rewrite the node's
 *   text.
 * - Settings about to be accepted with no node in place (none, moved, in the
 *   trash or gone): add one.
 * - Settings about to be accepted with a live node: it is reused, and its text
 *   can be rewritten when it names another check.
 *
 * Null when there is nothing to offer.
 */
export function nodeOfferFor(input: NodeOfferInput): NodeOffer | null {
	const { check, checkChanged, evidence, pipeline, state } = input;
	const node = evidence.evidence_node;
	const live = node?.state === "live" ? node : null;
	const after = evidenceNodeText(check, pipeline);
	const before = evidence.evidence_node_text?.description ?? null;

	if (state === "accepted") {
		return live && checkChanged
			? { add: null, node: null, update: { name: live.name, before, after } }
			: null;
	}
	if (!live) {
		return { add: { text: after }, node: null, update: null };
	}
	return {
		add: null,
		node: { name: live.name },
		update: namesAnotherCheck(evidence, check, pipeline)
			? { name: live.name, before, after }
			: null,
	};
}
