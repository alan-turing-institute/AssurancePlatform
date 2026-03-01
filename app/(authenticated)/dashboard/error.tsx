"use client";

import { ErrorCard } from "@/components/ui/error-card";

export default function DashboardError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4">
			<ErrorCard
				message="We couldn't load this page. Please try again."
				onRetry={reset}
			/>
		</div>
	);
}
