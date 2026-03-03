"use client";

import { ErrorCard } from "@/components/ui/error-card";

export default function AuthError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="grid min-h-full place-items-center bg-background px-6 py-24">
			<ErrorCard
				message="We couldn't load this page. Please try again."
				onRetry={reset}
				showDashboardLink={false}
			/>
		</div>
	);
}
