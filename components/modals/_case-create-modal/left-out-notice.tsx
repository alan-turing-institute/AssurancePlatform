"use client";

import { Button } from "@/components/ui/button";

interface LeftOutNoticeProps {
	onContinue: () => void;
	warnings: string[];
}

/**
 * Shown after a case was started from a pattern that held references the new
 * case could not keep, so the user reads what was left out before opening it.
 */
export function LeftOutNotice({ onContinue, warnings }: LeftOutNoticeProps) {
	return (
		<div className="space-y-4 py-2 pb-4">
			<div className="rounded-md border border-warning/30 bg-warning/10 p-2 text-sm text-warning-foreground">
				<p className="font-semibold">Some references were left out:</p>
				<ul className="list-inside list-disc">
					{warnings.map((warning) => (
						<li key={warning}>{warning}</li>
					))}
				</ul>
			</div>
			<div className="flex w-full justify-end">
				<Button onClick={onContinue}>Continue to case</Button>
			</div>
		</div>
	);
}
