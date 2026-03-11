"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

type ErrorCardProps = {
	title?: string;
	message?: string;
	onRetry?: () => void;
	showDashboardLink?: boolean;
};

export function ErrorCard({
	title = "Something went wrong",
	message = "An unexpected error occurred. Please try again.",
	onRetry,
	showDashboardLink = true,
}: ErrorCardProps) {
	return (
		<div className="text-center">
			<AlertTriangle
				aria-hidden="true"
				className="mx-auto h-12 w-12 text-muted-foreground/50"
			/>
			<h2 className="mt-4 font-semibold text-foreground text-lg">{title}</h2>
			<p className="mt-2 text-muted-foreground text-sm">{message}</p>
			<div className="mt-6 flex items-center justify-center gap-x-4">
				{onRetry && (
					<Button onClick={onRetry} variant="default">
						Try again
					</Button>
				)}
				{showDashboardLink && (
					<Button asChild variant="outline">
						<Link href="/dashboard">Go to dashboard</Link>
					</Button>
				)}
			</div>
		</div>
	);
}
