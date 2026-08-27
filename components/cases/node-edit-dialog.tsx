"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Minus, Plus, PlusIcon, Trash2 } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { type UseFormReturn, useFieldArray, useForm } from "react-hook-form";
import type { Node } from "reactflow";
import type { DiagramNodeType } from "@/components/shared/nodes/node-config";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useElementPanelSlot } from "@/hooks/use-element-panel-slot";
import {
	ASSERTION_STATUS_LABELS,
	AUTHOR_ASSERTION_STATUS_VALUES,
	type AuthorAssertionStatusValue,
	isAuthorAssertionStatusValue,
} from "@/lib/assertion-status";
import {
	getNodeMutationErrorMessage,
	updateAssuranceCaseNode,
} from "@/lib/case";
import {
	type NodeEditFormInput,
	nodeEditFormSchema,
} from "@/lib/schemas/element";
import { recordUpdate } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import useStore from "@/store/store";

type FormValues = NodeEditFormInput;

// Helper to check if element type supports attributes
const supportsAttributes = (nodeType: DiagramNodeType): boolean =>
	["goal", "strategy", "property"].includes(nodeType);

/**
 * Resolves a node's current `assertionStatus` to one of the five
 * author-declarable values for the Select's initial value. Falls back to
 * "ASSERTED" for `null`/`undefined` (unset means ASSERTED) and for
 * `AS_CITED` (derived-only — never offered as a choice here, so a node that
 * currently carries it shows the default rather than an invalid selection).
 */
export function getInitialAssertionStatus(
	nodeData: Record<string, unknown>
): AuthorAssertionStatusValue {
	const value = nodeData?.assertionStatus;
	return isAuthorAssertionStatusValue(value) ? value : "ASSERTED";
}

/**
 * Converts node data URLs to field array format.
 */
function getInitialUrls(
	nodeData: Record<string, unknown>
): Array<{ value: string }> {
	const urls = nodeData?.urls as string[] | undefined;
	const legacyUrl = nodeData?.URL as string | undefined;
	if (urls && urls.length > 0) {
		return urls.map((url) => ({ value: url }));
	}
	if (legacyUrl) {
		return [{ value: legacyUrl }];
	}
	return [{ value: "" }];
}

/** Build update payload from form values */
function buildUpdatePayload(
	values: FormValues,
	nodeType: DiagramNodeType
): Record<string, unknown> {
	const updateItem: Record<string, unknown> = {
		description: values.description,
	};

	if (supportsAttributes(nodeType)) {
		updateItem.assumption = values.assumption || "";
		updateItem.justification = values.justification || "";
		updateItem.context = values.context || [];
		// Per-assertion status (ADR 0004 D3) — always one of the five
		// author-declarable values; the Select never offers AS_CITED.
		updateItem.assertionStatus = values.assertionStatus || "ASSERTED";
	}

	if (nodeType === "evidence") {
		const urlValues = values.urls
			.map((u) => u.value.trim())
			.filter((url) => url.length > 0);
		updateItem.urls = urlValues;
		updateItem.URL = urlValues[0] || "";
	}

	return updateItem;
}

// --- Sub-components to reduce complexity ---

interface TextFieldProps {
	form: UseFormReturn<FormValues>;
	label: string;
	name: "description" | "assumption" | "justification";
	placeholder: string;
	readOnly: boolean;
}

function TextFieldSection({
	form,
	name,
	label,
	placeholder,
	readOnly,
}: TextFieldProps) {
	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<FormLabel className="flex items-center gap-2">
						{label}
						{readOnly && (
							<span className="text-muted-foreground" title="Read Only">
								<Lock className="h-3 w-3" />
							</span>
						)}
					</FormLabel>
					<FormControl>
						<Textarea
							placeholder={placeholder}
							readOnly={readOnly}
							{...field}
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

interface AssertionStatusSectionProps {
	form: UseFormReturn<FormValues>;
	onSelectOpenChange: (open: boolean) => void;
	readOnly: boolean;
}

/**
 * The assertion-status setter (ADR 0004 D3). Offers exactly the five
 * author-declarable values — `AS_CITED` is derived-only (computed by the
 * server from a cited element's own status) and must never appear as a
 * choice here, so `AUTHOR_ASSERTION_STATUS_VALUES` (not the full six-value
 * enum) drives this list.
 */
function AssertionStatusSection({
	form,
	onSelectOpenChange,
	readOnly,
}: AssertionStatusSectionProps) {
	return (
		<FormField
			control={form.control}
			name="assertionStatus"
			render={({ field }) => (
				<FormItem>
					<FormLabel className="flex items-center gap-2">
						Assertion status
						{readOnly && (
							<span className="text-muted-foreground" title="Read Only">
								<Lock className="h-3 w-3" />
							</span>
						)}
					</FormLabel>
					<Select
						disabled={readOnly}
						onOpenChange={onSelectOpenChange}
						onValueChange={field.onChange}
						value={field.value}
					>
						<FormControl>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
						</FormControl>
						<SelectContent>
							{AUTHOR_ASSERTION_STATUS_VALUES.map((value) => (
								<SelectItem key={value} value={value}>
									{ASSERTION_STATUS_LABELS[value]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

interface ContextSectionProps {
	contextItems: Array<{ id: string; value: string }>;
	newContextValue: string;
	onAddContext: () => void;
	onNewContextChange: (value: string) => void;
	onRemoveContext: (idx: number) => void;
	readOnly: boolean;
}

function ContextSection({
	contextItems,
	readOnly,
	newContextValue,
	onNewContextChange,
	onAddContext,
	onRemoveContext,
}: ContextSectionProps) {
	return (
		<div className="space-y-3">
			<FormLabel className="flex items-center gap-2">
				Context
				{readOnly && (
					<span className="text-muted-foreground" title="Read Only">
						<Lock className="h-3 w-3" />
					</span>
				)}
			</FormLabel>
			{contextItems.length > 0 && (
				<div className="space-y-2">
					{contextItems.map((item, idx) => (
						<div
							className="flex items-start gap-2 rounded border bg-muted/50 p-2"
							key={item.id}
						>
							<span className="flex-1 text-sm">{item.value}</span>
							{!readOnly && (
								<button
									className="rounded p-1 text-destructive hover:bg-destructive/10"
									onClick={() => onRemoveContext(idx)}
									title="Remove context"
									type="button"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							)}
						</div>
					))}
				</div>
			)}
			{!readOnly && (
				<div className="flex gap-2">
					<Input
						onChange={(e) => onNewContextChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								onAddContext();
							}
						}}
						placeholder="Add new context..."
						value={newContextValue}
					/>
					<Button
						disabled={!newContextValue.trim()}
						onClick={onAddContext}
						size="sm"
						type="button"
						variant="outline"
					>
						<PlusIcon className="size-4" />
						Add
					</Button>
				</div>
			)}
		</div>
	);
}

interface UrlsSectionProps {
	fields: Array<{ id: string; value: string }>;
	form: UseFormReturn<FormValues>;
	onAppend: () => void;
	onRemove: (idx: number) => void;
	readOnly: boolean;
}

function UrlsSection({
	form,
	fields,
	readOnly,
	onAppend,
	onRemove,
}: UrlsSectionProps) {
	return (
		<div className="space-y-3">
			<FormLabel className="flex items-center gap-2">
				Evidence URLs
				{readOnly && (
					<span className="text-muted-foreground" title="Read Only">
						<Lock className="h-3 w-3" />
					</span>
				)}
			</FormLabel>
			{fields.map((field, index) => (
				<FormField
					control={form.control}
					key={field.id}
					name={`urls.${index}.value`}
					render={({ field: inputField }) => (
						<FormItem>
							<div className="flex gap-2">
								<FormControl>
									<Input
										placeholder="https://example.com/evidence"
										readOnly={readOnly}
										{...inputField}
									/>
								</FormControl>
								{!readOnly && (
									<Button
										aria-label="Remove URL"
										onClick={() => onRemove(index)}
										size="icon"
										title="Remove URL"
										type="button"
										variant="outline"
									>
										<Minus className="h-4 w-4" />
									</Button>
								)}
							</div>
							<FormMessage />
						</FormItem>
					)}
				/>
			))}
			{!readOnly && (
				<Button
					className="w-full"
					onClick={onAppend}
					type="button"
					variant="outline"
				>
					<Plus className="mr-2 h-4 w-4" />
					Add URL
				</Button>
			)}
		</div>
	);
}

// Radix's Select and Dialog each open a DismissableLayer with
// disableOutsidePointerEvents: true. While the assertion-status Select is
// open, Radix sets pointer-events: none on the Dialog's own content (the
// lower-priority layer), so a click anywhere in the dialog body falls
// through to the Dialog's own overlay — which the Dialog's own outside-click
// detection then reads as a genuine outside click and closes on.
//
// The dismissing click is a single pointerdown event. Both DismissableLayers
// (Select's and Dialog's) react to it through their own document-level
// listeners registered in the bubbling phase: the Select's runs first and
// calls its onOpenChange(false), then the Dialog's runs and fires
// onPointerDownOutside/onInteractOutside. A document listener registered in
// the capture phase always runs before any bubbling-phase listener for the
// same event, so it can snapshot whether the Select was open at the start of
// this specific pointerdown — before either DismissableLayer has reacted to
// it — with no timer and no assumption about which bubble listener runs
// first.
function useAssertionSelectDismissGuard() {
	const isOpenRef = useRef(false);
	const selectOpenAtPointerDownRef = useRef(false);

	const onSelectOpenChange = useCallback((nextOpen: boolean) => {
		isOpenRef.current = nextOpen;
	}, []);

	useEffect(() => {
		const handlePointerDownCapture = () => {
			selectOpenAtPointerDownRef.current = isOpenRef.current;
		};
		document.addEventListener("pointerdown", handlePointerDownCapture, {
			capture: true,
		});
		return () => {
			document.removeEventListener("pointerdown", handlePointerDownCapture, {
				capture: true,
			});
		};
	}, []);

	// Pointer dismissal: guard only on the per-event snapshot, so a click
	// that lands after the Select has genuinely closed is never swallowed.
	const shouldGuardPointerDismiss = useCallback(
		() => selectOpenAtPointerDownRef.current,
		[]
	);

	// Focus dismissal (e.g. Tab out of the Select) has no pointerdown to
	// snapshot, so it falls back to the Select's live open state. In
	// practice Radix already blocks focus-outside dismissal on a modal
	// DialogContent, so this branch is not known to be exercised — it's
	// kept for consistency with the pointer guard above.
	const shouldGuardFocusDismiss = useCallback(
		() => selectOpenAtPointerDownRef.current || isOpenRef.current,
		[]
	);

	return {
		onSelectOpenChange,
		shouldGuardFocusDismiss,
		shouldGuardPointerDismiss,
	};
}

// --- Main component ---

interface NodeEditDialogProps {
	node: Node;
	nodeType: DiagramNodeType;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	readOnly?: boolean;
}

export default function NodeEditDialog({
	node,
	nodeType,
	open,
	onOpenChange,
	readOnly = false,
}: NodeEditDialogProps) {
	const [loading, setLoading] = useState(false);
	const [newContextValue, setNewContextValue] = useState("");
	const componentId = useId();
	const [idCounter, setIdCounter] = useState(0);
	const { assuranceCase } = useStore();
	const panelSlot = useElementPanelSlot();

	const form = useForm<FormValues>({
		resolver: zodResolver(nodeEditFormSchema),
		defaultValues: {
			description: (node.data?.description as string) ?? "",
			assumption: (node.data?.assumption as string) ?? "",
			justification: (node.data?.justification as string) ?? "",
			context: (node.data?.context as string[]) ?? [],
			urls: getInitialUrls(node.data as Record<string, unknown>),
			assertionStatus: getInitialAssertionStatus(
				node.data as Record<string, unknown>
			),
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "urls",
	});

	// Subscribing to `isDirty` here (rather than only inside the effect below)
	// makes react-hook-form's formState Proxy track it, so the effect sees
	// up-to-date values as the user types.
	const { isDirty } = form.formState;

	// Context management
	const contextValues = form.watch("context") || [];
	const [itemIds, setItemIds] = useState<string[]>(() =>
		contextValues.map((_, i) => `${componentId}-init-${i}`)
	);

	const contextItems = useMemo(() => {
		const ids = [...itemIds];
		while (ids.length < contextValues.length) {
			ids.push(`${componentId}-${idCounter + ids.length}`);
		}
		return contextValues.map((value, i) => ({
			id: ids[i] || `${componentId}-fallback-${i}`,
			value,
		}));
	}, [contextValues, itemIds, componentId, idCounter]);

	const addContext = () => {
		if (newContextValue.trim()) {
			const currentContext = form.getValues("context") || [];
			const newId = `${componentId}-${idCounter}`;
			setIdCounter((c) => c + 1);
			setItemIds([...itemIds, newId]);
			form.setValue("context", [...currentContext, newContextValue.trim()]);
			setNewContextValue("");
		}
	};

	const removeContext = (indexToRemove: number) => {
		const currentContext = form.getValues("context") || [];
		setItemIds(itemIds.filter((_, i) => i !== indexToRemove));
		form.setValue(
			"context",
			currentContext.filter((_, i) => i !== indexToRemove)
		);
	};

	// The id of the node whose data is currently loaded into the form. Used
	// (not `node` object identity — host node components rebuild that object
	// inline on every render, e.g. `goal-node.tsx`) to tell a genuine element
	// change apart from an unrelated re-render of the currently-open node.
	const loadedNodeIdRef = useRef(node.data?.id);

	const resetFormToNode = useCallback(
		(n: Node) => {
			const contextData = (n.data?.context as string[]) ?? [];
			form.reset({
				description: (n.data?.description as string) ?? "",
				assumption: (n.data?.assumption as string) ?? "",
				justification: (n.data?.justification as string) ?? "",
				context: contextData,
				urls: getInitialUrls(n.data as Record<string, unknown>),
				assertionStatus: getInitialAssertionStatus(
					n.data as Record<string, unknown>
				),
			});
			setItemIds(contextData.map((_, i) => `${componentId}-reset-${i}`));
			setNewContextValue("");
			loadedNodeIdRef.current = n.data?.id;
		},
		[form, componentId]
	);

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			resetFormToNode(node);
		}
		onOpenChange(nextOpen);
	};

	const {
		onSelectOpenChange,
		shouldGuardFocusDismiss,
		shouldGuardPointerDismiss,
	} = useAssertionSelectDismissGuard();

	// Tracks whether the dialog was open on the previous render, so a
	// closed→open transition (reopen) can be told apart from staying open
	// across re-renders.
	const wasOpenRef = useRef(open);

	// Re-reset when the dialog is reopened, or a genuine element change
	// arrives while it stays open (a different `node.data.id`) — both always
	// reload, even over an unsaved draft, since that draft either belongs to
	// a stale close/reopen cycle or to a *different* element entirely. Only a
	// same-element re-render while the dialog stays open and the user is
	// actively editing is guarded by `isDirty`, so an in-flight change is
	// never silently discarded by unrelated identity churn.
	useEffect(() => {
		const justOpened = open && !wasOpenRef.current;
		wasOpenRef.current = open;

		if (!open) {
			return;
		}
		const currentNodeId = node.data?.id;
		// Currently unreachable in production: each dialog instance mounts
		// 1:1 with a single node id (`${nodeType}-${item.id}` in
		// convert-case.ts), so `node.data.id` never changes under a live
		// dialog. Kept as defensive correctness in case that mounting
		// invariant ever changes.
		const isGenuineElementChange = currentNodeId !== loadedNodeIdRef.current;
		if (!(justOpened || isGenuineElementChange) && isDirty) {
			return;
		}
		resetFormToNode(node);
	}, [node, open, resetFormToNode, isDirty]);

	const handleClose = () => handleOpenChange(false);

	// Trade-off (accepted): `buildUpdatePayload` sends a full snapshot of the
	// form's attribute fields, not a diff. Now that a dirty draft can survive
	// longer (reopen no longer discards it — see the effect above), the
	// window in which a field the user never touched could have been changed
	// concurrently elsewhere and then get overwritten by this stale snapshot
	// on save is correspondingly longer too. Accepted because the
	// alternative — silently discarding the user's in-flight edit, which is
	// the bug this fix addresses — is worse.
	const handleSubmit = async (values: FormValues) => {
		// Auto-add any unsaved draft context text
		if (newContextValue.trim()) {
			values.context = [...(values.context || []), newContextValue.trim()];
			setNewContextValue("");
		}
		setLoading(true);
		const beforeData = { ...node.data } as Record<string, unknown>;
		const updateItem = buildUpdatePayload(values, nodeType);

		const updated = await updateAssuranceCaseNode(
			node.type || "unknown",
			node.data.id,
			"",
			updateItem
		);

		if (updated === true) {
			recordUpdate(node.data.id as number, node.type || "unknown", beforeData, {
				...beforeData,
				...updateItem,
			});
			setLoading(false);
			handleClose();
			return;
		}
		toast({
			variant: "destructive",
			title: `Failed to update ${nodeTypeLabel.toLowerCase()}`,
			description: getNodeMutationErrorMessage(
				updated,
				"Something went wrong trying to update this element."
			),
		});
		setLoading(false);
	};

	const nodeName = (node.data?.name as string) || "Element";
	const nodeTypeLabel = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);

	// The `element-panel` slot (ADR 0002 v2 §2.3): when no enabled plugin has
	// registered a panel, `detailsForm` renders directly with no `Tabs`
	// wrapper at all — the DOM stays identical to the pre-slot dialog (no
	// ghost tab, no extra strip). Only once a registration exists does the
	// dialog grow a "Details" tab alongside the plugin's own.
	const detailsForm = (
		<Form {...form}>
			<form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
				<TextFieldSection
					form={form}
					label="Description"
					name="description"
					placeholder="Type your description here."
					readOnly={readOnly}
				/>

				{supportsAttributes(nodeType) && (
					<>
						<TextFieldSection
							form={form}
							label="Assumption"
							name="assumption"
							placeholder="Type your assumption here (optional)."
							readOnly={readOnly}
						/>
						<TextFieldSection
							form={form}
							label="Justification"
							name="justification"
							placeholder="Type your justification here (optional)."
							readOnly={readOnly}
						/>
						<AssertionStatusSection
							form={form}
							onSelectOpenChange={onSelectOpenChange}
							readOnly={readOnly}
						/>
						<ContextSection
							contextItems={contextItems}
							newContextValue={newContextValue}
							onAddContext={addContext}
							onNewContextChange={setNewContextValue}
							onRemoveContext={removeContext}
							readOnly={readOnly}
						/>
					</>
				)}

				{nodeType === "evidence" && (
					<UrlsSection
						fields={fields}
						form={form}
						onAppend={() => append({ value: "" })}
						onRemove={remove}
						readOnly={readOnly}
					/>
				)}

				<DialogFooter className="pt-4">
					<Button onClick={handleClose} type="button" variant="outline">
						{readOnly ? "Close" : "Cancel"}
					</Button>
					{!readOnly && (
						<Button
							className="bg-primary text-primary-foreground hover:bg-primary/90"
							disabled={loading}
							type="submit"
						>
							{loading ? (
								<span className="flex items-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									Updating...
								</span>
							) : (
								<span>Update {nodeTypeLabel}</span>
							)}
						</Button>
					)}
				</DialogFooter>
			</form>
		</Form>
	);

	const panelContext = {
		caseId: assuranceCase?.id?.toString() ?? "",
		elementId: String(node.data?.id ?? ""),
		elementType: nodeType,
	};

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent
				className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
				// `onPointerDownOutside` is the path this fix targets: it's
				// the click-through case where a click inside the dialog
				// falls through to the Dialog's own overlay while the
				// Select is open. `onInteractOutside` is guarded too, for
				// consistency, but Radix's own DialogContentModal already
				// calls event.preventDefault() on every focus-outside event
				// for a modal DialogContent (react-dialog dist
				// index.mjs, ~L157-160), so that branch never actually runs
				// against a live dismissal — it's defensive only.
				onInteractOutside={(event) => {
					if (shouldGuardFocusDismiss()) {
						event.preventDefault();
					}
				}}
				onPointerDownOutside={(event) => {
					if (shouldGuardPointerDismiss()) {
						event.preventDefault();
					}
				}}
			>
				<DialogHeader>
					<DialogTitle>
						{readOnly ? "Viewing" : "Editing"} {nodeName}
					</DialogTitle>
					<DialogDescription>
						{readOnly
							? `You are viewing this ${nodeTypeLabel}.`
							: `Update the details for this ${nodeTypeLabel}.`}
					</DialogDescription>
				</DialogHeader>

				{panelSlot.registrations.length === 0 ? (
					detailsForm
				) : (
					<Tabs defaultValue="details">
						<TabsList>
							<TabsTrigger value="details">Details</TabsTrigger>
							{panelSlot.registrations.map(
								({ pluginId, tabId, label, icon: Icon }) => (
									<TabsTrigger key={pluginId} value={tabId}>
										{Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
										{label}
									</TabsTrigger>
								)
							)}
						</TabsList>
						<TabsContent value="details">{detailsForm}</TabsContent>
						{panelSlot.registrations.map(({ pluginId, tabId, Component }) => (
							<TabsContent key={pluginId} value={tabId}>
								<Component {...panelContext} />
							</TabsContent>
						))}
					</Tabs>
				)}
			</DialogContent>
		</Dialog>
	);
}
