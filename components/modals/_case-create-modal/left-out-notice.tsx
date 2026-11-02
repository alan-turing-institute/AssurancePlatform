"use client";

import { Button } from "@/components/ui/button";

interface LeftOutNoticeProps {
	onContinue: () => void;
	warnings: string[];
}

/**
 * Shown after a case was started from a pattern and the copy differs from it,
 * so the user reads every warning the import gave (a cleared reference is one
 * kind) before opening the case. Announced to assistive technology as it
 * appears.
 */
export function LeftOutNotice({ onContinue, warnings }: LeftOutNoticeProps) {
	return (
		<div className="space-y-4 py-2 pb-4">
			<output className="block rounded-md border border-warning/30 bg-warning/10 p-2 text-sm text-warning-foreground">
				<p className="font-semibold">Some things were changed in the copy:</p>
				<ul className="list-inside list-disc">
					{warnings.map((warning) => (
						<li key={warning}>{warning}</li>
					))}
				</ul>
			</output>
			<div className="flex w-full justify-end">
				<Button onClick={onContinue}>Continue to case</Button>
			</div>
		</div>
	);
}
