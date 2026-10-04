"use client";

import type { RefObject } from "react";
import { HealthActionDialog } from "./health-action-dialog";

interface RetireCriteriaDialogProps {
	claimId: string;
	onDone: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	returnFocusTo?: RefObject<HTMLElement | null>;
}

/** Stops the use of a claim's accepted settings, with a required reason. */
export function RetireCriteriaDialog({
	claimId,
	onDone,
	onOpenChange,
	open,
	returnFocusTo,
}: RetireCriteriaDialogProps) {
	return (
		<HealthActionDialog
			buildRequest={(reason) => ({
				method: "POST",
				url: `/api/elements/${claimId}/health/criteria/retirement`,
				body: { reason },
			})}
			description="The pipeline will no longer find these settings, and results that arrive afterwards are shown as having no accepted settings. The settings stay in the claim's history."
			failureTitle="Could not stop using the settings"
			onDone={onDone}
			onOpenChange={onOpenChange}
			open={open}
			returnFocusTo={returnFocusTo}
			submitLabel="Stop using these settings"
			submitVariant="destructive"
			title="Stop using these settings"
		/>
	);
}
