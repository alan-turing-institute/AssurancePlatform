"use client";

import { ErrorCard } from "@/components/ui/error-card";

export default function AuthenticatedError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4">
			<ErrorCard
				message="Something went wrong. Please try again."
				onRetry={reset}
			/>
		</div>
	);
}
