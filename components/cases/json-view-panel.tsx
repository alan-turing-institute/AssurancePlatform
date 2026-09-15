"use client";

import { json, jsonLanguage } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, hoverTooltip } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import {
	handleRefresh,
	jsonCompletion,
	jsonSchemaHover,
	jsonSchemaLinter,
	stateExtensions as jsonSchemaStateExtensions,
	type stateExtensions,
} from "codemirror-json-schema";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exportCase } from "@/actions/export-case";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useJsonValidation } from "@/hooks/use-json-validation";
import { fetchAndRefreshCase } from "@/lib/case";
import {
	computeTreeDiff,
	type ElementChange,
	type TreeDiffResult,
} from "@/lib/case/tree-diff";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
// The generated build artefact (ADR 0004 D1) — imported by path, not content:
// a parallel change regenerates this file from CaseExportNestedSchema via
// zod's z.toJSONSchema(). codemirror-json-schema drives inline hints only;
// Apply always re-validates with the Zod schema above, unchanged.
import rawCaseExportJsonSchema from "@/lib/schemas/json-schema-v1.0.json";
import { createSnapshot } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import type { HistoryCommand, HistoryEntry } from "@/types/history";
import { JsonEditorToolbar } from "./json-editor-toolbar";

// TS widens JSON module imports to generic `string`/`object` types, so the
// literal doesn't structurally satisfy codemirror-json-schema's JSONSchema7
// param without re-asserting it as the type its own API expects.
type CaseExportJsonSchema = NonNullable<Parameters<typeof stateExtensions>[0]>;
const caseExportJsonSchema =
	rawCaseExportJsonSchema as unknown as CaseExportJsonSchema;

// Schema-aware editing extensions (inline errors, autocomplete, hover docs),
// plus overscroll containment on CodeMirror's own scroller so a horizontal
// swipe never reaches the browser's back-navigation gesture. These don't
// depend on component state, so they're built once at module scope; Apply's
// validity gate is untouched — it stays on the Zod hook below.
const schemaAwareExtensions = [
	linter(jsonSchemaLinter(), { needsRefresh: handleRefresh }),
	jsonLanguage.data.of({ autocomplete: jsonCompletion() }),
	hoverTooltip(jsonSchemaHover()),
	...jsonSchemaStateExtensions(caseExportJsonSchema),
	EditorView.theme({
		".cm-scroller": { overscrollBehaviorX: "contain" },
	}),
];

interface JsonViewPanelProps {
	isOpen: boolean;
	onClose: () => void;
}

type BatchUpdateResult =
	| {
			data: {
				summary: { created: number; updated: number; deleted: number };
			};
	  }
	| { error: string; conflictDetected?: boolean };

/**
 * Formats JSON with 2-space indentation for readability.
 */
function formatJson(data: unknown): string {
	return JSON.stringify(data, null, 2);
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
			error: result.error || "An error occurred",
			conflictDetected: result.conflictDetected,
		};
	}

	return { data: { summary: result.summary } };
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
	if ("error" in result) {
		const isConflict = "conflictDetected" in result && result.conflictDetected;
		if (isConflict) {
			callbacks.onConflict();
		}
		const title = isConflict ? "Conflict detected" : "Failed to apply changes";
		const description = isConflict
			? "The case was modified by another user. Refresh to see the latest changes."
			: result.error;
		callbacks.showToast({ variant: "destructive", title, description });
		return false;
	}

	callbacks.onSuccess(result.data.summary);
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
		description: node.description,
		assumption: node.assumption,
		justification: node.justification,
		context: node.context,
		URL: node.url,
		inSandbox: node.inSandbox,
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
/** Handle post-apply sync: record history and refetch case data */
async function syncAfterApply(opts: {
	result: BatchUpdateResult;
	changes: ElementChange[];
	serverData: CaseExportNested | null;
	parsedData: CaseExportNested | null;
	isUndoRedo: boolean;
	recordOperation: (entry: HistoryEntry) => void;
	caseId: string;
	setAssuranceCase: (
		c: ReturnType<typeof fetchAndRefreshCase> extends Promise<infer T>
			? T
			: never
	) => void;
	fetchJson: () => Promise<void>;
}): Promise<void> {
	const {
		result,
		changes,
		serverData,
		parsedData,
		isUndoRedo,
		recordOperation,
		caseId,
		setAssuranceCase,
		fetchJson,
	} = opts;

	if (!isUndoRedo && serverData && parsedData && "data" in result) {
		recordJsonEditorHistory(
			changes,
			serverData,
			parsedData,
			result.data.summary,
			recordOperation
		);
	}

	const updatedCase = await fetchAndRefreshCase(caseId);
	if (updatedCase) {
		setAssuranceCase(updatedCase);
	}

	await fetchJson();
}

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

const JsonViewPanel = ({ isOpen, onClose }: JsonViewPanelProps) => {
	const { assuranceCase, setAssuranceCase } = useStore();
	const { recordOperation, isApplying: isUndoRedoApplying } = useHistoryStore();
	const { resolvedTheme } = useTheme();
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

	// Layout state
	const [isFullScreen, setIsFullScreen] = useState(false);
	const [wrapEnabled, setWrapEnabled] = useState(false);
	const fullScreenButtonRef = useRef<HTMLButtonElement>(null);

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

	// Whether the buffer can be pretty-printed (Format needs parseable JSON)
	const canFormat = useMemo(() => {
		if (!draftContent.trim()) {
			return false;
		}
		try {
			JSON.parse(draftContent);
			return true;
		} catch {
			return false;
		}
	}, [draftContent]);

	// Combined CodeMirror extensions: JSON mode, our Zod-driven lint (gates
	// Apply, unchanged), schema-aware hints (inline only), and line wrap.
	const editorExtensions = useMemo(
		() => [
			json(),
			lintExtension,
			...schemaAwareExtensions,
			...(wrapEnabled ? [EditorView.lineWrapping] : []),
		],
		[lintExtension, wrapEnabled]
	);

	const fetchJson = useCallback(async () => {
		if (!assuranceCase?.id) {
			return;
		}

		setLoading(true);

		try {
			const result = await exportCase(assuranceCase.id, {
				includeComments: true,
			});

			if ("error" in result) {
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
	}, [assuranceCase?.id]);

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

	const exitFullScreen = useCallback(() => {
		setIsFullScreen(false);
		fullScreenButtonRef.current?.focus();
	}, []);

	// Esc exits full-screen rather than closing the panel. Radix's Sheet
	// registers its own Escape-to-close as a native document-level capture
	// listener — it reaches the DOM before React's synthetic event system
	// gets a chance to run anything of ours (a React onKeyDownCapture handler
	// cannot stopPropagation() ahead of it; that only looked like it worked
	// under jsdom, whose listener ordering differs from a real browser).
	// Radix's own onEscapeKeyDown is the actual extension point: preventing
	// its default here stops Radix's own close from running at all.
	const handleEscapeKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (!isFullScreen) {
				return;
			}
			event.preventDefault();
			exitFullScreen();
		},
		[isFullScreen, exitFullScreen]
	);

	// Full screen doesn't persist across a close/reopen — reset it here,
	// directly in the event that closes the panel, rather than in an effect
	// that watches `isOpen` and adjusts state in response.
	const handleSheetOpenChange = useCallback(
		(open: boolean) => {
			if (open) {
				return;
			}
			setIsFullScreen(false);
			onClose();
		},
		[onClose]
	);

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
	}, [draftContent]);

	const handleDiscard = useCallback(() => {
		setDraftContent(server.content);
		setHasConflict(false);
	}, [server.content]);

	const handleRefresh = useCallback(() => {
		fetchJson();
	}, [fetchJson]);

	const handleToggleFullScreen = useCallback(() => {
		setIsFullScreen((prev) => !prev);
	}, []);

	const handleToggleWrap = useCallback(() => {
		setWrapEnabled((prev) => !prev);
	}, []);

	const handleFormat = useCallback(() => {
		try {
			const parsed = JSON.parse(draftContent);
			setDraftContent(formatJson(parsed));
		} catch {
			// canFormat gates the button; this guards a race with fast typing.
		}
	}, [draftContent]);

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

			await syncAfterApply({
				result,
				changes: diffResult.changes,
				serverData: server.data,
				parsedData: validation.parsedData,
				isUndoRedo: isUndoRedoApplying,
				recordOperation,
				caseId,
				setAssuranceCase,
				fetchJson,
			});
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
		<Sheet onOpenChange={handleSheetOpenChange} open={isOpen}>
			<SheetContent
				className={cn(
					"flex w-full flex-col transition-[max-width] duration-200 motion-reduce:transition-none",
					// The sheet primitive's own base sets `sm:max-w-sm` (side="left"
					// in sheetVariants); twMerge only dedupes classes that share
					// the exact same prefix, so a bare "max-w-none" here would
					// leave "sm:max-w-sm" in the merged list to win the cascade at
					// >=640px. Every breakpoint tier in play (the primitive's own
					// sm:, and this component's own sm:/md:/lg: below) needs its
					// own max-w-none to actually be neutralised.
					isFullScreen
						? "max-w-none sm:max-w-none md:max-w-none lg:max-w-none"
						: "sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
				)}
				onEscapeKeyDown={handleEscapeKeyDown}
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
						formatVersion={server.data?.version ?? null}
						hasConflict={hasConflict}
						isApplying={isApplying}
						isDirty={isDirty}
						isValid={validation.isValid}
						layout={{
							formatDisabled: loading || !canFormat,
							fullScreenButtonRef,
							isFullScreen,
							onFormat: handleFormat,
							onToggleFullScreen: handleToggleFullScreen,
							onToggleWrap: handleToggleWrap,
							wrapEnabled,
						}}
						onApply={handleApply}
						onCopy={handleCopy}
						onDiscard={handleDiscard}
						onRefresh={handleRefresh}
					/>
				</div>

				{/* overscroll-behavior-x: contain lives on the .cm-scroller theme
				rule above — that's CodeMirror's actual scrolling element, not
				this wrapper. */}
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
							extensions={editorExtensions}
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
