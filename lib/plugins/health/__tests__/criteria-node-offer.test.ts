import { describe, expect, it } from "vitest";
import { evidenceNodeText } from "@/lib/health-evidence-node-text";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	buildHealthCheckList,
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { type NodeEvidence, nodeOfferFor } from "../criteria-node-offer";
import type { HealthNodeTextCheck } from "../health-types";

const CHECK = buildHealthCheckList().checks.find(
	(check) => check.name === ITEM_CHECK_NAME
) as HealthCheck;
const CURRENT_TEXT = evidenceNodeText(CHECK, HEALTH_CHECK_PIPELINE);

interface EvidenceOptions {
	description?: string | null;
	nodeState?: "live" | "missing" | "moved" | "trashed";
	/** Leave the text record out altogether. */
	noText?: boolean;
	writtenFor?: HealthNodeTextCheck | null;
}

function evidence({
	description = "Older words for the node.",
	nodeState = "live",
	writtenFor = null,
	noText = false,
}: EvidenceOptions = {}): NodeEvidence {
	return {
		evidence_node: { id: "node-1", name: "E4", state: nodeState },
		evidence_node_text: noText
			? null
			: { description, written_for: writtenFor },
	};
}

function offer(
	state: "accepted" | "new" | "suggested",
	input: NodeEvidence,
	checkChanged = false
) {
	return nodeOfferFor({
		check: CHECK,
		checkChanged,
		evidence: input,
		pipeline: HEALTH_CHECK_PIPELINE,
		state,
	});
}

const NO_NODE: NodeEvidence = { evidence_node: null, evidence_node_text: null };

describe("nodeOfferFor for settings about to be accepted", () => {
	it.each([
		"new",
		"suggested",
	] as const)("offers to add a node, with the words the server writes, when %s settings have none", (state) => {
		expect(offer(state, NO_NODE)).toStrictEqual({
			add: { text: CURRENT_TEXT },
			node: null,
			update: null,
		});
	});

	it.each([
		"missing",
		"moved",
		"trashed",
	] as const)("offers to add a node when the existing one is %s", (nodeState) => {
		const result = offer("new", evidence({ nodeState }));
		expect(result?.add).toStrictEqual({ text: CURRENT_TEXT });
		expect(result?.node).toBeNull();
		expect(result?.update).toBeNull();
	});

	it("reuses a live node and names it, with no rewrite when the record of what the text was written for is absent", () => {
		expect(offer("new", evidence({ noText: true }))).toStrictEqual({
			add: null,
			node: { name: "E4" },
			update: null,
		});
	});

	it("reuses a live node with no rewrite when no earlier acceptance is recorded", () => {
		expect(offer("new", evidence({ writtenFor: null }))?.update).toBeNull();
	});

	it("offers a rewrite when the text names another check", () => {
		const result = offer(
			"new",
			evidence({ writtenFor: { check: "Other Check", pipeline: null } })
		);
		expect(result).toStrictEqual({
			add: null,
			node: { name: "E4" },
			update: {
				name: "E4",
				before: "Older words for the node.",
				after: CURRENT_TEXT,
			},
		});
	});

	it("offers a rewrite with no earlier words when the node's text cannot be read", () => {
		const result = offer(
			"suggested",
			evidence({
				description: null,
				writtenFor: { check: "Other Check", pipeline: null },
			})
		);
		expect(result?.update).toStrictEqual({
			name: "E4",
			before: null,
			after: CURRENT_TEXT,
		});
	});

	it("offers a rewrite when the same check is now run by another pipeline", () => {
		const result = offer(
			"new",
			evidence({
				writtenFor: { check: CHECK.name, pipeline: "Earlier pipeline" },
			})
		);
		expect(result?.update?.after).toBe(CURRENT_TEXT);
	});

	it("offers no rewrite when the same check is run by the same pipeline, even if the words differ", () => {
		const result = offer(
			"new",
			evidence({
				writtenFor: { check: CHECK.name, pipeline: HEALTH_CHECK_PIPELINE },
			})
		);
		expect(result?.update).toBeNull();
		expect(result?.node).toStrictEqual({ name: "E4" });
	});

	it("offers no rewrite when the same check was written with no pipeline recorded", () => {
		const result = offer(
			"new",
			evidence({ writtenFor: { check: CHECK.name, pipeline: null } })
		);
		expect(result?.update).toBeNull();
	});

	it("offers no rewrite when the node already has the words it would get", () => {
		const result = offer(
			"new",
			evidence({
				description: CURRENT_TEXT,
				writtenFor: { check: "Other Check", pipeline: null },
			})
		);
		expect(result?.update).toBeNull();
	});
});

describe("nodeOfferFor for accepted settings", () => {
	it("offers a rewrite when the check has changed and a live node holds other words", () => {
		expect(offer("accepted", evidence(), true)).toStrictEqual({
			add: null,
			node: null,
			update: {
				name: "E4",
				before: "Older words for the node.",
				after: CURRENT_TEXT,
			},
		});
	});

	it("offers nothing when the check has not changed", () => {
		expect(offer("accepted", evidence(), false)).toBeNull();
	});

	it("offers nothing when the node already has the words it would get", () => {
		expect(
			offer("accepted", evidence({ description: CURRENT_TEXT }), true)
		).toBeNull();
	});

	it.each([
		"missing",
		"moved",
		"trashed",
	] as const)("offers nothing when the node is %s", (nodeState) => {
		expect(offer("accepted", evidence({ nodeState }), true)).toBeNull();
	});

	it("offers nothing when there is no node", () => {
		expect(offer("accepted", NO_NODE, true)).toBeNull();
	});
});
