"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/ui/error-card";
import useStore from "@/store/store";

/**
 * What the editor shows in place of the canvas once the server has ended the
 * live stream because the viewer can no longer see the case. The case is also
 * dropped from the store, so nothing drawn from it stays on screen.
 */
export function CaseAccessRemoved() {
	const setAssuranceCase = useStore((state) => state.setAssuranceCase);

	useEffect(() => {
		setAssuranceCase(null);
	}, [setAssuranceCase]);

	return (
		<div
			className="flex min-h-[60vh] items-center justify-center px-4"
			role="alert"
		>
			<ErrorCard
				focusTitle
				message="Your access to this case was removed. It may have been deleted, or the owner may have stopped sharing it with you."
				showDashboardLink
				title="Access removed"
			/>
		</div>
	);
}
