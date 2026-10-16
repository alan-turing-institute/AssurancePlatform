"use client";

import { useState } from "react";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { type NodeEvidence, nodeOfferFor } from "./criteria-node-offer";
import { NodeOptions } from "./criteria-node-options";

interface UseNodeChoiceInput {
	/** The check chosen in the form. */
	check: HealthCheck;
	/** For accepted settings: the chosen check is not the one stored. */
	checkChanged: boolean;
	/** True while a request is in flight, which turns the boxes off. */
	disabled: boolean;
	evidence: NodeEvidence;
	/** The display name of the pipeline that runs the chosen check. */
	pipeline: string;
	state: "accepted" | "new" | "suggested";
}

/**
 * What the settings form offers about the claim's evidence node, and what the
 * person chose. Both boxes start ticked. `node` says what to send with an
 * acceptance: a box counts only while its offer is on screen, so a choice the
 * form no longer offers is never sent. `nodeOptions` is the block to show
 * above the buttons, absent when there is nothing to choose.
 */
export function useNodeChoice({
	check,
	checkChanged,
	disabled,
	evidence,
	pipeline,
	state,
}: UseNodeChoiceInput) {
	const [addTicked, setAddTicked] = useState(true);
	const [updateTicked, setUpdateTicked] = useState(true);
	const offer = nodeOfferFor({
		check,
		checkChanged,
		evidence,
		pipeline,
		state,
	});
	const liveNode =
		evidence.evidence_node?.state === "live" ? evidence.evidence_node : null;

	return {
		liveNode,
		node: {
			add: Boolean(offer?.add) && addTicked,
			update: Boolean(offer?.update) && updateTicked,
		},
		nodeOptions: offer && (
			<NodeOptions
				addTicked={addTicked}
				disabled={disabled}
				offer={offer}
				onAddChange={setAddTicked}
				onUpdateChange={setUpdateTicked}
				updateTicked={updateTicked}
			/>
		),
	};
}
