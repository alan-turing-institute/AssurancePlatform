"use client";

import { json } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import CodeMirror from "@uiw/react-codemirror";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import useHistoryStore from "@/data/history-store";
import useStore from "@/data/store";
import { useJsonValidation } from "@/hooks/use-json-validation";
import { addHiddenProp } from "@/lib/case";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import { createSnapshot } from "@/lib/services/history-service";
import {
	computeTreeDiff,
	type ElementChange,
	type TreeDiffResult,
} from "@/lib/services/json-diff-service";
import { useToast } from "@/lib/toast";
import type { AssuranceCase } from "@/types";
import type { HistoryCommand, HistoryEntry } from "@/types/history";
import { JsonEditorToolbar } from "./json-editor-toolbar";

type JsonViewPanelProps = {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
};

type BatchUpdateResult =
	| {
			success: true;
			summary: { created: number; updated: number; deleted: number };
	  }
	| { success: false; error: string; conflictDetected?: boolean };

/**
 * Formats JSON with 2-space indentation for readability.
 */
function formatJson(data: unknown): string {
	return JSON.stringify(data, null, 2);
}

/**
 * Fetches the updated case data and transforms it for the Zustand store.
 */
async function fetchAndTransformCase(
	caseId: string
): Promise<AssuranceCase | null> {
	const response = await fetch(`/api/cases/${caseId}`);
	if (!response.ok) {
		return null;
	}
	const caseData = await response.json();
	return (await addHiddenProp(caseData)) as AssuranceCase;
}

/**
 * Sends batch update to the API.
 */
async function sendBatchUpdate(
	caseId: string,
	changes: ElementChange[],
	expectedVersion: string
): Promise<BatchUpdateResult> {
	const response = await fetch(`/api/cases/${caseId}/batch`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ changes, expectedVersion }),
	});

	const result = await response.json();

	if (!response.ok) {
		return {
			success: false,
			error: result.error || "An error occurred",
			conflictDetected: result.conflictDetected,
		};
	}

	return { success: true, summary: result.summary };
}

/**
 * Refreshes the case data in the store after batch update.
 */
async function refreshCaseData(
	caseId: string,
	setAssuranceCase: (c: AssuranceCase) => void
): Promise<void> {
	const updatedCase = await fetchAndTransformCase(caseId);
	if (updatedCase) {
		setAssuranceCase(updatedCase);
	}
}

/**
 * Handles the result of a batch update - shows toast and updates state.
 */
function handleBatchResult(
	result: BatchUpdateResult,
	callbacks: {
		onConflict: () => void;
		onSuccess: (summary: {
			created: number;
			updated: number;
			deleted: number;
		}) => void;
		showToast: (opts: {
			variant?: "destructive";
			title: string;
			description: string;
		}) => void;
	}
): boolean {
	if (!result.success) {
		if (result.conflictDetected) {
			callbacks.onConflict();
		}
		const title = result.conflictDetected
			? "Conflict detected"
			: "Failed to apply changes";
		const description = result.conflictDetected
			? "The case was modified by another user. Refresh to see the latest changes."
			: result.error;
		callbacks.showToast({ variant: "destructive", title, description });
		return false;
	}

	callbacks.onSuccess(result.summary);
	return true;
}

/**
 * Flattens a tree structure into a map of id -> node for lookup
 */
function flattenTree(node: TreeNode, map: Map<string, TreeNode>): void {
	map.set(node.id, node);
	for (const child of node.children) {
		flattenTree(child, map);
	}
}

/**
 * Creates a snapshot from a TreeNode for history recording
 */
function snapshotFromNode(node: TreeNode): ReturnType<typeof createSnapshot> {
	return createSnapshot({
		id: node.id,
		type: node.type,
		name: node.name,
		short_description: node.description,
		assumption: node.assumption,
		justification: node.justification,
		context: node.context,
		URL: node.url,
		in_sandbox: node.inSandbox,
	});
}

/**
 * Processes a single change into a history command
 */
function processChangeToCommand(
	change: ElementChange,
	beforeMap: Map<string, TreeNode>,
	afterMap: Map<string, TreeNode>
): HistoryCommand | null {
	// Skip evidence link/unlink operations for history
	if (change.type === "link_evidence" || change.type === "unlink_evidence") {
		return null;
	}

	if (change.type === "create") {
		const afterNode = afterMap.get(change.elementId);
		if (!afterNode) {
			return null;
		}
		return {
			type: "create",
			elementId: change.elementId,
			elementType: change.data.type,
			before: null,
			after: snapshotFromNode(afterNode),
		};
	}

	if (change.type === "update") {
		const beforeNode = beforeMap.get(change.elementId);
		const afterNode = afterMap.get(change.elementId);
		if (!(beforeNode && afterNode)) {
			return null;
		}
		return {
			type: "update",
			elementId: change.elementId,
			elementType: beforeNode.type,
			before: snapshotFromNode(beforeNode),
			after: snapshotFromNode(afterNode),
		};
	}

	if (change.type === "delete") {
		const beforeNode = beforeMap.get(change.elementId);
		if (!beforeNode) {
			return null;
		}
		return {
			type: "delete",
			elementId: change.elementId,
			elementType: beforeNode.type,
			before: snapshotFromNode(beforeNode),
			after: null,
		};
	}

	return null;
}

/**
 * Converts JSON editor changes to history commands for undo/redo
 */
function convertChangesToHistoryCommands(
	changes: ElementChange[],
	serverData: CaseExportNested,
	editedData: CaseExportNested
): HistoryCommand[] {
	// Build lookup maps for before and after states
	const beforeMap = new Map<string, TreeNode>();
	const afterMap = new Map<string, TreeNode>();
	flattenTree(serverData.tree, beforeMap);
	flattenTree(editedData.tree, afterMap);

	return changes
		.map((change) => processChangeToCommand(change, beforeMap, afterMap))
		.filter((cmd): cmd is HistoryCommand => cmd !== null);
}

/**
 * Records history entry from JSON editor changes
 */
function recordJsonEditorHistory(
	changes: ElementChange[],
	serverData: CaseExportNested,
	editedData: CaseExportNested,
	summary: { created: number; updated: number; deleted: number },
	recordOperation: (entry: HistoryEntry) => void
): void {
	const commands = convertChangesToHistoryCommands(
		changes,
		serverData,
		editedData
	);
	if (commands.length > 0) {
		recordOperation({
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			description: `JSON editor: ${summary.created} created, ${summary.updated} updated, ${summary.deleted} deleted`,
			commands,
		});
	}
}

/**
 * Loading skeleton for the JSON content area.
 */
function JsonLoadingSkeleton() {
	return (
		<div className="space-y-2 p-4">
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
			<Skeleton className="h-4 w-5/6" />
			<Skeleton className="h-4 w-2/3" />
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
			<Skeleton className="h-4 w-5/6" />
			<Skeleton className="h-4 w-2/3" />
		</div>
	);
}

const JsonViewPanel = ({ isOpen, onClose, userId }: JsonViewPanelProps) => {
	const { assuranceCase, setAssuranceCase } = useStore();
	const { recordOperation, isApplying: isUndoRedoApplying } = useHistoryStore();
	const { resolvedTheme } = useTheme();
	const { toast } = useToast();

	// Server state (original from database)
	const [server, setServer] = useState<{
		content: string;
		data: CaseExportNested | null;
		version: string;
	}>({ content: "", data: null, version: "" });

	// Draft content (user's edits)
	const [draftContent, setDraftContent] = useState<string>("");

	// UI state
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [hasConflict, setHasConflict] = useState(false);

	// Track if panel was just opened
	const justOpenedRef = useRef(false);

	// Validation
	const validation = useJsonValidation(draftContent);

	// Compute diff when validation passes
	const diffResult: TreeDiffResult | null = useMemo(() => {
		if (!(validation.isValid && validation.parsedData && server.data)) {
			return null;
		}
		return computeTreeDiff(server.data, validation.parsedData);
	}, [validation.isValid, validation.parsedData, server.data]);

	// Is the content different from server?
	const isDirty = draftContent !== server.content;

	// Create lint extension from validation diagnostics
	const lintExtension = useMemo(
		() => linter(() => validation.diagnostics),
		[validation.diagnostics]
	);

	const fetchJson = useCallback(async () => {
		if (!assuranceCase?.id) {
			return;
		}

		setLoading(true);

		try {
			const result = await exportCase(userId, assuranceCase.id, {
				includeComments: true,
			});

			if (!result.success) {
				toast({
					variant: "destructive",
					title: "Failed to load JSON",
					description: result.error,
				});
				return;
			}

			const formatted = formatJson(result.data);
			setServer({
				content: formatted,
				data: result.data,
				version: result.data.exportedAt,
			});
			setDraftContent(formatted);
			setHasConflict(false);
		} catch (error) {
			toast({
				variant: "destructive",
				title: "Failed to load JSON",
				description:
					error instanceof Error ? error.message : "An error occurred",
			});
		} finally {
			setLoading(false);
		}
	}, [assuranceCase?.id, userId, toast]);

	// Fetch JSON when panel opens
	useEffect(() => {
		if (isOpen) {
			justOpenedRef.current = true;
			fetchJson();
		}
	}, [isOpen, fetchJson]);

	// Handle external case updates (SSE events)
	useEffect(() => {
		if (!isOpen || justOpenedRef.current) {
			justOpenedRef.current = false;
			return;
		}

		// If case is updated externally and we have dirty changes, show conflict
		if (isDirty && assuranceCase?.updatedOn) {
			setHasConflict(true);
		}
	}, [isOpen, isDirty, assuranceCase?.updatedOn]);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(draftContent);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast({
				variant: "destructive",
				title: "Copy failed",
				description: "Could not copy to clipboard",
			});
		}
	}, [draftContent, toast]);

	const handleDiscard = useCallback(() => {
		setDraftContent(server.content);
		setHasConflict(false);
	}, [server.content]);

	const handleRefresh = useCallback(() => {
		fetchJson();
	}, [fetchJson]);

	const handleApply = useCallback(async () => {
		const caseId = assuranceCase?.id;
		const hasChanges = diffResult && diffResult.changes.length > 0;

		if (!(caseId && hasChanges)) {
			return;
		}

		setIsApplying(true);

		try {
			const result = await sendBatchUpdate(
				caseId,
				diffResult.changes,
				server.version
			);

			const success = handleBatchResult(result, {
				onConflict: () => setHasConflict(true),
				onSuccess: ({ created, updated, deleted }) => {
					toast({
						title: "Changes applied",
						description: `${created} created, ${updated} updated, ${deleted} deleted`,
					});
				},
				showToast: toast,
			});

			if (!success) {
				return;
			}

			// Record history for undo/redo (only if not applying undo/redo operation)
			if (
				!isUndoRedoApplying &&
				server.data &&
				validation.parsedData &&
				result.success
			) {
				recordJsonEditorHistory(
					diffResult.changes,
					server.data,
					validation.parsedData,
					result.summary,
					recordOperation
				);
			}

			// Refetch the case data to update the diagram immediately
			await refreshCaseData(caseId, setAssuranceCase);

			// Refresh JSON editor to sync with server state
			await fetchJson();
		} catch (error) {
			toast({
				variant: "destructive",
				title: "Failed to apply changes",
				description:
					error instanceof Error ? error.message : "An error occurred",
			});
		} finally {
			setIsApplying(false);
		}
	}, [
		assuranceCase?.id,
		diffResult,
		server.version,
		server.data,
		toast,
		fetchJson,
		setAssuranceCase,
		isUndoRedoApplying,
		recordOperation,
		validation.parsedData,
	]);

	const handleContentChange = useCallback((value: string) => {
		setDraftContent(value);
	}, []);

	const editorTheme = resolvedTheme === "dark" ? "dark" : "light";

	return (
		<Sheet onOpenChange={(open) => !open && onClose()} open={isOpen}>
			<SheetContent
				className="flex w-full flex-col sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
				side="left"
			>
				<SheetHeader>
					<SheetTitle>JSON Editor</SheetTitle>
					<SheetDescription>
						Edit the assurance case data as JSON. Changes are validated in
						real-time and can be applied to update the diagram.
					</SheetDescription>
				</SheetHeader>

				{/* Editor toolbar */}
				<div className="mt-4">
					<JsonEditorToolbar
						copied={copied}
						copyDisabled={loading || !draftContent}
						diffResult={diffResult}
						errorCount={validation.errors.length}
						hasConflict={hasConflict}
						isApplying={isApplying}
						isDirty={isDirty}
						isValid={validation.isValid}
						onApply={handleApply}
						onCopy={handleCopy}
						onDiscard={handleDiscard}
						onRefresh={handleRefresh}
					/>
				</div>

				<div className="mt-4 flex-1 overflow-auto rounded-md border bg-muted/30">
					{loading ? (
						<JsonLoadingSkeleton />
					) : (
						<CodeMirror
							basicSetup={{
								lineNumbers: true,
								foldGutter: true,
								highlightActiveLine: true,
							}}
							extensions={[json(), lintExtension]}
							height="100%"
							onChange={handleContentChange}
							theme={editorTheme}
							value={draftContent || "No data available"}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};

export default JsonViewPanel;
