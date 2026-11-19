"use client";

import {
	AlertTriangle,
	AlignLeft,
	Check,
	CheckCircle2,
	Copy,
	Loader2,
	Maximize2,
	Minimize2,
	RotateCcw,
	Save,
	WrapText,
	XCircle,
} from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TreeDiffResult } from "@/lib/case/tree-diff";

/**
 * Wrap, format, and full-screen controls — grouped into one prop so the
 * toolbar's own prop list doesn't grow by one entry per layout control.
 */
export interface LayoutControlsProps {
	/** Whether Format is disabled (e.g. the buffer isn't valid JSON) */
	formatDisabled: boolean;
	/** Ref for the full-screen toggle button, so focus can return to it on exit */
	fullScreenButtonRef?: Ref<HTMLButtonElement>;
	/** Whether the editor currently fills the viewport */
	isFullScreen: boolean;
	/** Handler for pretty-printing the current buffer */
	onFormat: () => void;
	/** Toggles full-screen mode */
	onToggleFullScreen: () => void;
	/** Toggles line wrapping */
	onToggleWrap: () => void;
	/** Whether line wrapping is enabled */
	wrapEnabled: boolean;
}

interface JsonEditorToolbarProps {
	/** Whether content has been copied */
	copied: boolean;
	/** Whether copy is disabled (loading) */
	copyDisabled: boolean;
	/** Diff result showing pending changes */
	diffResult: TreeDiffResult | null;
	/** Number of validation errors */
	errorCount: number;
	/** Format version from the export envelope (e.g. "1.0"), null while loading */
	formatVersion: string | null;
	/** Whether there's a conflict with server state */
	hasConflict: boolean;
	/** Whether an apply operation is in progress */
	isApplying: boolean;
	/** Whether the editor has unsaved changes */
	isDirty: boolean;
	/** Whether the JSON is currently valid */
	isValid: boolean;
	/** Wrap, format, and full-screen controls */
	layout: LayoutControlsProps;
	/** Handler for applying changes */
	onApply: () => void;
	/** Handler for copying JSON */
	onCopy: () => void;
	/** Handler for discarding changes */
	onDiscard: () => void;
	/** Handler for refreshing from server */
	onRefresh: () => void;
}

/**
 * Formats the change summary for display
 */
function formatChangeSummary(diffResult: TreeDiffResult): string {
	const { summary } = diffResult;
	const linkChanges = diffResult.changes.filter(
		(c) => c.type === "link_evidence" || c.type === "unlink_evidence"
	).length;
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

	if (linkChanges > 0) {
		parts.push(
			`${linkChanges} evidence ${linkChanges === 1 ? "link" : "links"} changed`
		);
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
	hasDiff: boolean,
	changeSummary: string
): { icon: ReactNode; text: string; className: string } {
	if (hasConflict) {
		return {
			icon: <AlertTriangle className="h-4 w-4 text-warning" />,
			text: "Conflict detected. The case changed on the server.",
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

	if (isDirty && !hasDiff) {
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
function getApplyTooltip(
	isDirty: boolean,
	isValid: boolean,
	hasChanges: boolean
): string {
	if (!isDirty) {
		return "No changes to apply";
	}
	if (!isValid) {
		return "Fix validation errors first";
	}
	if (!hasChanges) {
		return "No changes to apply";
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
 * Layout controls: wrap toggle, format, and full-screen toggle.
 */
function LayoutControls({
	formatDisabled,
	fullScreenButtonRef,
	isFullScreen,
	onFormat,
	onToggleFullScreen,
	onToggleWrap,
	wrapEnabled,
}: LayoutControlsProps) {
	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						aria-label="Format JSON"
						disabled={formatDisabled}
						onClick={onFormat}
						size="sm"
						variant="outline"
					>
						<AlignLeft className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Pretty-print the current buffer</p>
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						aria-label={wrapEnabled ? "Disable line wrap" : "Enable line wrap"}
						aria-pressed={wrapEnabled}
						onClick={onToggleWrap}
						size="sm"
						variant={wrapEnabled ? "secondary" : "outline"}
					>
						<WrapText className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{wrapEnabled ? "Disable line wrap" : "Enable line wrap"}</p>
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}
						aria-pressed={isFullScreen}
						onClick={onToggleFullScreen}
						ref={fullScreenButtonRef}
						size="sm"
						variant={isFullScreen ? "secondary" : "outline"}
					>
						{isFullScreen ? (
							<Minimize2 className="h-4 w-4" />
						) : (
							<Maximize2 className="h-4 w-4" />
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{isFullScreen ? "Exit full screen" : "Enter full screen"}</p>
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
	formatVersion,
	layout,
}: JsonEditorToolbarProps) {
	const hasChanges = Boolean(diffResult && diffResult.changes.length > 0);
	const canApply =
		isDirty && isValid && hasChanges && !isApplying && !hasConflict;
	const changeSummary = diffResult ? formatChangeSummary(diffResult) : "";

	const status = getStatusContent(
		hasConflict,
		isApplying,
		isValid,
		errorCount,
		isDirty,
		hasChanges,
		diffResult !== null,
		changeSummary
	);

	const applyTooltip = getApplyTooltip(isDirty, isValid, hasChanges);

	return (
		<TooltipProvider>
			<div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
				<div className="flex items-center gap-2 text-sm">
					<StatusIndicator
						className={status.className}
						icon={status.icon}
						text={status.text}
					/>
					{formatVersion && (
						<Badge className="font-normal" variant="outline">
							v{formatVersion}
						</Badge>
					)}
				</div>

				<div className="flex items-center gap-1">
					<LayoutControls {...layout} />
					<Separator className="mx-1 h-6" orientation="vertical" />
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
