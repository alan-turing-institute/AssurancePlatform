"use client";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { CaseKind } from "@/lib/schemas/case-export";
import type { ConversionConsequences } from "@/lib/services/case-kind-service";

interface ConvertCaseKindDialogProps {
	/** What the conversion affects; null while it is being read. */
	consequences: ConversionConsequences | null;
	/** The reason the last read or conversion failed. */
	error: string | null;
	isOpen: boolean;
	/** Whether the conversion itself is running. */
	loading: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	/** The kind the case would become. */
	targetKind: CaseKind;
}

function noun(kind: CaseKind): string {
	return kind === "PATTERN" ? "pattern" : "case";
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

function sharingSentence(
	consequences: ConversionConsequences,
	targetKind: CaseKind
): string {
	const parts: string[] = [];
	if (consequences.people > 0) {
		parts.push(plural(consequences.people, "person", "people"));
	}
	if (consequences.teams > 0) {
		parts.push(plural(consequences.teams, "team", "teams"));
	}
	if (parts.length === 0) {
		return "It is not shared with anyone else.";
	}
	return `Everyone it is shared with (${parts.join(" and ")}) will see a ${noun(targetKind)}.`;
}

function citationSentence(count: number): string {
	if (count === 0) {
		return "No other case cites it through an away goal or a module.";
	}
	return `${plural(count, "other case cites", "other cases cite")} it through away goals or modules.`;
}

/**
 * The confirmation shown before a case becomes a pattern or a pattern becomes
 * a case: who will see the change, what stays attached, how many cases cite
 * it, and that no copy is kept. The confirm button stays disabled until the
 * consequences have been read, so nobody confirms without seeing them.
 */
export function ConvertCaseKindDialog({
	consequences,
	error,
	isOpen,
	loading,
	onCancel,
	onConfirm,
	targetKind,
}: ConvertCaseKindDialogProps) {
	const currentNoun = noun(targetKind === "PATTERN" ? "CASE" : "PATTERN");
	const targetNoun = noun(targetKind);

	return (
		<AlertDialog
			onOpenChange={(open) => {
				if (!open) {
					onCancel();
				}
			}}
			open={isOpen}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Convert this {currentNoun} to a {targetNoun}?
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-3 text-left">
							{consequences ? (
								<>
									<p>{sharingSentence(consequences, targetKind)}</p>
									<p>
										Health plugin checks and integration access grants stay
										attached to it.
									</p>
									<p>{citationSentence(consequences.citingCases)}</p>
									<p>
										<strong className="text-foreground">
											No copy is kept.
										</strong>{" "}
										Converting changes it in place. To keep both a {currentNoun}{" "}
										and a {targetNoun}, export it first.
									</p>
								</>
							) : (
								!error && <p>Checking who this affects...</p>
							)}
							{error && (
								<p className="font-medium text-destructive" role="alert">
									{error}
								</p>
							)}
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<Button disabled={loading || !consequences} onClick={onConfirm}>
						{loading ? "Converting..." : `Convert to ${targetNoun}`}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
