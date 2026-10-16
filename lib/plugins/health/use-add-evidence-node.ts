"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import type { HealthCriteriaResponse } from "./health-types";
import type { ClaimScopedFetchResult } from "./use-claim-scoped-fetch";
import { addEvidenceNode } from "./use-criteria";

/**
 * Adds the evidence node for a claim whose settings were accepted without one.
 * The server's answer is shown at once; a refusal is shown as the server words
 * it, and a 409 also reads the settings again, because it means the view the
 * person was looking at is out of date.
 */
export function useAddEvidenceNode(
	claimId: string,
	criteria: ClaimScopedFetchResult<HealthCriteriaResponse | null>
) {
	const [pending, setPending] = useState(false);
	const add = async () => {
		setPending(true);
		const outcome = await addEvidenceNode(claimId);
		setPending(false);
		if (outcome.ok) {
			criteria.replace(outcome.view);
			return;
		}
		if (outcome.status === 409) {
			criteria.refetch();
		}
		toast({
			variant: "destructive",
			title: "Could not add the evidence node",
			description: outcome.message,
		});
	};
	return { add, pending };
}
