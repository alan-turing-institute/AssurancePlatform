"use client";

import { XMarkIcon } from "@heroicons/react/20/solid";
import { MessageSquareMore } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISSED_STORAGE_KEY = "tea.feedback-banner.dismissed";

function readDismissed(): boolean {
	try {
		return localStorage.getItem(DISMISSED_STORAGE_KEY) === "true";
	} catch {
		// Storage can throw (private browsing, disabled storage, quota) — treat
		// as not dismissed rather than breaking the banner.
		return false;
	}
}

function persistDismissed(): void {
	try {
		localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
	} catch {
		// Best-effort only — the banner still dismisses for this session even
		// if it can't be remembered for the next one.
	}
}

export default function FeedbackBanner() {
	// Render nothing until mounted so the server-rendered markup (which can't
	// read localStorage) matches the client's first render, then swap in the
	// real dismissed state — avoids a hydration mismatch.
	const [mounted, setMounted] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		setDismissed(readDismissed());
		setMounted(true);
	}, []);

	if (!mounted || dismissed) {
		return null;
	}

	const handleDismiss = () => {
		setDismissed(true);
		persistDismissed();
	};

	return (
		<div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-x-6 bg-primary px-6 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:px-3.5 sm:before:flex-1">
			<div className="w-full text-primary-foreground text-sm leading-6">
				<Link
					className="flex w-full flex-col items-center justify-center gap-2 py-3 md:flex-row md:py-0"
					href="/docs/community/community-support"
				>
					<div className="flex items-center justify-start gap-2">
						<MessageSquareMore className="h-4 w-4" />
						<strong className="font-semibold">Feedback</strong>
					</div>
					<svg
						aria-hidden="true"
						className="mx-2 hidden h-0.5 w-0.5 fill-current md:block"
						viewBox="0 0 2 2"
					>
						<circle cx={1} cy={1} r={1} />
					</svg>
					We would love to hear your feedback! &nbsp;
					<span aria-hidden="true" className="hidden md:block">
						&rarr;
					</span>
				</Link>
			</div>
			<div className="flex flex-1 justify-end">
				<button
					className="-m-3 p-3 focus-visible:-outline-offset-4"
					onClick={handleDismiss}
					type="button"
				>
					<span className="sr-only">Dismiss</span>
					<XMarkIcon
						aria-hidden="true"
						className="h-5 w-5 text-primary-foreground"
					/>
				</button>
			</div>
		</div>
	);
}
