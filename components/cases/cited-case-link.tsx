"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";

export interface CitedCaseLinkProps {
	/** The cited/referenced case's id — the link target. */
	caseId: string;
	/** Whether the viewer can access the cited/referenced case. */
	isAccessible: boolean;
	/** "View cited case" for an away goal, "View referenced case" for a module. */
	label: string;
}

/**
 * The "View cited case" / "View referenced case" link shared by
 * `away-goal-node.tsx` and `module-node.tsx` (ADR 0005 D3) — shown only
 * when the viewer can access the case it points to.
 */
export default function CitedCaseLink({
	caseId,
	isAccessible,
	label,
}: CitedCaseLinkProps) {
	if (!isAccessible) {
		return null;
	}
	return (
		<Link
			className="flex items-center gap-1.5 text-info text-sm hover:text-info/80 hover:underline"
			href={`/case/${caseId}`}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		>
			<ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
			<span>{label}</span>
		</Link>
	);
}
