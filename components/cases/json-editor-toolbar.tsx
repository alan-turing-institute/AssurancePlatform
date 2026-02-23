"use client";

import {
	AlertTriangle,
	Check,
	CheckCircle2,
	Copy,
	Loader2,
	RotateCcw,
	Save,
	XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TreeDiffResult } from "@/lib/services/json-diff-service";

type JsonEditorToolbarProps = {
	/** Whether the editor has unsaved changes */
	isDirty: boolean;
	/** Whether the JSON is currently valid */
	isValid: boolean;
	/** Whether an apply operation is in progress */
	isApplying: boolean;
	/** Number of validation errors */
	errorCount: number;
	/** Diff result showing pending changes */
	diffResult: TreeDiffResult | null;
	/** Handler for applying changes */
	onApply: () => void;
	/** Handler for discarding changes */
	onDiscard: () => void;
	/** Whether there's a conflict with server state */
	hasConflict: boolean;
	/** Handler for refreshing from server */
	onRefresh: () => void;
	/** Handler for copying JSON */
	onCopy: () => void;
	/** Whether content has been copied */
	copied: boolean;
	/** Whether copy is disabled (loading) */
	copyDisabled: boolean;
};

/**
 * Formats the change summary for display
 */
function formatChangeSummary(summary: TreeDiffResult["summary"]): string {
	const parts: string[] = [];

	if (summary.created > 0) {
		parts.push(`${summary.created} added`);
	}
	if (summary.updated > 0) {
		parts.push(`${summary.updated} modified`);
	}
	if (summary.deleted > 0) {
		parts.push(`${summary.deleted} removed`);
	}
	if (summary.moved > 0) {
		parts.push(`${summary.moved} moved`);
	}

	return parts.length > 0 ? parts.join(", ") : "No changes";
}

/**
 * Status indicator showing the current state of the editor
 */
function StatusIndicator({
	icon,
	text,
	className,
}: {
	icon: ReactNode;
	text: string;
	className?: string;
}) {
	return (
		<>
			{icon}
			<span className={className}>{text}</span>
		</>
	);
}

/**
 * Determines which status to display based on current state
 */
function getStatusContent(
	hasConflict: boolean,
	isApplying: boolean,
	isValid: boolean,
	errorCount: number,
	isDirty: boolean,
	hasChanges: boolean,
	changeSummary: string
): { icon: ReactNode; text: string; className: string } {
	if (hasConflict) {
		return {
			icon: <AlertTriangle className="h-4 w-4 text-warning" />,
			text: "Case modified externally",
			className: "text-warning",
		};
	}

	if (isApplying) {
		return {
			icon: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
			text: "Applying changes...",
			className: "text-muted-foreground",
		};
	}

	if (!isValid && errorCount > 0) {
		return {
			icon: <XCircle className="h-4 w-4 text-destructive" />,
			text: `${errorCount} ${errorCount === 1 ? "error" : "errors"}`,
			className: "text-destructive",
		};
	}

	if (isDirty && hasChanges) {
		return {
			icon: <Check className="h-4 w-4 text-info" />,
			text: changeSummary,
			className: "text-muted-foreground",
		};
	}

	if (isDirty) {
		return {
			icon: <Check className="h-4 w-4 text-muted-foreground" />,
			text: "Validating...",
			className: "text-muted-foreground",
		};
	}

	return {
		icon: <CheckCircle2 className="h-4 w-4 text-success" />,
		text: "No changes",
		className: "text-muted-foreground",
	};
}

/**
 * Gets the tooltip text for the apply button
 */
function getApplyTooltip(isDirty: boolean, isValid: boolean): string {
	if (!isDirty) {
		return "No changes to apply";
	}
	if (!isValid) {
		return "Fix validation errors first";
	}
	return "Apply changes to case";
}

/**
 * Action buttons for the toolbar
 */
function ActionButtons({
	hasConflict,
	isDirty,
	isApplying,
	canApply,
	onRefresh,
	onDiscard,
	onApply,
	onCopy,
	copied,
	copyDisabled,
	applyTooltip,
}: {
	hasConflict: boolean;
	isDirty: boolean;
	isApplying: boolean;
	canApply: boolean;
	onRefresh: () => void;
	onDiscard: () => void;
	onApply: () => void;
	onCopy: () => void;
	copied: boolean;
	copyDisabled: boolean;
	applyTooltip: string;
}) {
	if (hasConflict) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Button onClick={onRefresh} size="sm" variant="outline">
						<RotateCcw className="mr-2 h-4 w-4" />
						Refresh
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Discard changes and refresh from server</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						disabled={copyDisabled}
						onClick={onCopy}
						size="sm"
						variant="outline"
					>
						{copied ? (
							<>
								<Check className="mr-2 h-4 w-4" />
								Copied
							</>
						) : (
							<>
								<Copy className="mr-2 h-4 w-4" />
								Copy JSON
							</>
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Copy JSON to clipboard</p>
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						disabled={!isDirty || isApplying}
						onClick={onDiscard}
						size="sm"
						variant="outline"
					>
						<RotateCcw className="mr-2 h-4 w-4" />
						Discard
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Discard all changes</p>
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						disabled={!canApply}
						onClick={onApply}
						size="sm"
						variant={canApply ? "default" : "outline"}
					>
						{isApplying ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Save className="mr-2 h-4 w-4" />
						)}
						Apply
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{applyTooltip}</p>
				</TooltipContent>
			</Tooltip>
		</>
	);
}

/**
 * Toolbar for the JSON editor with Apply/Discard buttons and status display.
 */
export function JsonEditorToolbar({
	isDirty,
	isValid,
	isApplying,
	errorCount,
	diffResult,
	onApply,
	onDiscard,
	hasConflict,
	onRefresh,
	onCopy,
	copied,
	copyDisabled,
}: JsonEditorToolbarProps) {
	const canApply = isDirty && isValid && !isApplying && !hasConflict;
	const hasChanges = Boolean(
		diffResult &&
			(diffResult.summary.created > 0 ||
				diffResult.summary.updated > 0 ||
				diffResult.summary.deleted > 0 ||
				diffResult.summary.moved > 0)
	);
	const changeSummary = diffResult
		? formatChangeSummary(diffResult.summary)
		: "";

	const status = getStatusContent(
		hasConflict,
		isApplying,
		isValid,
		errorCount,
		isDirty,
		hasChanges,
		changeSummary
	);

	const applyTooltip = getApplyTooltip(isDirty, isValid);

	return (
		<TooltipProvider>
			<div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
				<div className="flex items-center gap-2 text-sm">
					<StatusIndicator
						className={status.className}
						icon={status.icon}
						text={status.text}
					/>
				</div>

				<div className="flex items-center gap-2">
					<ActionButtons
						applyTooltip={applyTooltip}
						canApply={canApply}
						copied={copied}
						copyDisabled={copyDisabled}
						hasConflict={hasConflict}
						isApplying={isApplying}
						isDirty={isDirty}
						onApply={onApply}
						onCopy={onCopy}
						onDiscard={onDiscard}
						onRefresh={onRefresh}
					/>
				</div>
			</div>
		</TooltipProvider>
	);
}
