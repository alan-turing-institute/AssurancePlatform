"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Minus, Plus } from "lucide-react";
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
import {
	findDraftContextProblem,
	useContextNaming,
} from "@/hooks/use-context-naming";
import { useElementPanelSlot } from "@/hooks/use-element-panel-slot";
import { useSelectDismissGuard } from "@/hooks/use-select-dismiss-guard";
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
	parseContextEntries,
	plainReferenceText,
} from "@/lib/case/defined-terms";
import type { ElementPanelRegistration } from "@/lib/plugins/slots";
import {
	type NodeEditFormInput,
	nodeEditFormSchema,
} from "@/lib/schemas/element";
import { recordUpdate } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import useStore from "@/store/store";
import ContextEntriesSection from "./context-entries-section";
import { finaliseContextEntries } from "./context-entry-form";
import DescriptionField from "./description-field";
import TermsInReachList from "./terms-in-reach-list";

type FormValues = NodeEditFormInput;

const DETAILS_TAB = "details";

// Helper to check if element type supports attributes
const supportsAttributes = (nodeType: DiagramNodeType): boolean =>
	["goal", "strategy", "property"].includes(nodeType);

/**
 * Whether the description editor takes the caret when the dialog opens. It
 * does where the description is the first field, as it was when it was a text
 * box: with no tab strip above it. The editor loads a moment after the dialog,
 * so the dialog's own focus step is skipped in that case and the editor
 * takes focus once it is there.
 */
const focusesDescriptionOnOpen = (
	nodeType: DiagramNodeType,
	readOnly: boolean,
	hasTabs: boolean
): boolean => supportsAttributes(nodeType) && !(readOnly || hasTabs);

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
 * The name of the element a defeater challenges (ADR 0005 D2), for the
 * edit dialog's read-only "Challenges" line. `null` when the target isn't
 * (or is no longer) present on the canvas.
 */
function findChallengedElementName(
	defeatsElementId: string | null | undefined,
	allNodes: Node[]
): string | null {
	if (!defeatsElementId) {
		return null;
	}
	const challengedNode = allNodes.find((n) => n.data?.id === defeatsElementId);
	return (challengedNode?.data?.name as string | undefined) || null;
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

/**
 * Build update payload from form values. The description is left out when it
 * is the text the element already has, so opening and saving an untouched
 * description changes nothing.
 */
function buildUpdatePayload(
	values: FormValues,
	nodeType: DiagramNodeType,
	storedDescription: string
): Record<string, unknown> {
	const updateItem: Record<string, unknown> = {};

	if (values.description !== storedDescription) {
		updateItem.description = values.description;
	}

	if (supportsAttributes(nodeType)) {
		updateItem.assumption = values.assumption || "";
		updateItem.justification = values.justification || "";
		updateItem.context = finaliseContextEntries(values.context || []);
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

/**
 * The tab showing in the dialog, so the dialog can be wider while a tab that
 * asks for it is showing. It goes back to Details each time the dialog closes.
 * It also remembers which tabs have been shown, so a tab keeps its state when
 * the person moves to another one; the memory is cleared with the dialog.
 */
function useActiveTab(
	open: boolean,
	registrations: readonly ElementPanelRegistration[]
) {
	const [activeTab, setActiveTabState] = useState(DETAILS_TAB);
	const [shownTabs, setShownTabs] = useState<ReadonlySet<string>>(new Set());
	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (!open) {
			setActiveTabState(DETAILS_TAB);
			setShownTabs(new Set());
		}
	}
	const setActiveTab = (tab: string) => {
		setActiveTabState(tab);
		setShownTabs((current) =>
			current.has(tab) ? current : new Set(current).add(tab)
		);
	};
	const wideTab = registrations.some(
		(registration) => registration.tabId === activeTab && registration.wide
	);
	return { activeTab, setActiveTab, shownTabs, wideTab };
}

// --- Main component ---

interface NodeEditDialogProps {
	node: Node;
	nodeType: DiagramNodeType;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export default function NodeEditDialog({
	node,
	nodeType,
	open,
	onOpenChange,
}: NodeEditDialogProps) {
	const [loading, setLoading] = useState(false);
	const [newContextValue, setNewContextValue] = useState("");
	const componentId = useId();
	const [idCounter, setIdCounter] = useState(0);
	const { assuranceCase, nodes: allNodes } = useStore();
	const panelSlot = useElementPanelSlot();
	const { activeTab, setActiveTab, shownTabs, wideTab } = useActiveTab(
		open,
		panelSlot.registrations
	);
	// Dialogical reasoning (defeaters, ADR 0005 D2): a read-only "Challenges"
	// line naming the target — changing the target is out of scope for 1.0.
	const isDefeater = !!node.data?.isDefeater;
	const challengedName = findChallengedElementName(
		node.data?.defeatsElementId as string | null | undefined,
		allNodes
	);
	// Fail-closed, positive rule: editable only when the case permission is
	// explicitly "edit" or "manage". Any other value — "view", "comment",
	// or unset/unknown while the case is still loading — renders read-only.
	const readOnly = !(
		assuranceCase?.permissions === "edit" ||
		assuranceCase?.permissions === "manage"
	);
	const focusDescriptionOnOpen = focusesDescriptionOnOpen(
		nodeType,
		readOnly,
		panelSlot.registrations.length > 0
	);

	const form = useForm<FormValues>({
		resolver: zodResolver(nodeEditFormSchema),
		defaultValues: {
			description: (node.data?.description as string) ?? "",
			assumption: (node.data?.assumption as string) ?? "",
			justification: (node.data?.justification as string) ?? "",
			context: parseContextEntries(node.data?.context),
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
			form.setValue("context", [...currentContext, newContextValue.trim()], {
				shouldDirty: true,
			});
			setNewContextValue("");
		}
	};

	const removeContext = (indexToRemove: number) => {
		const currentContext = form.getValues("context") || [];
		setItemIds(itemIds.filter((_, i) => i !== indexToRemove));
		form.setValue(
			"context",
			currentContext.filter((_, i) => i !== indexToRemove),
			{ shouldDirty: true }
		);
	};

	// Naming entries, and the terms the description can refer to: the entries
	// as they stand in the form, then those on the elements above.
	const { contextProblem, nameContext, terms, unnameContext } =
		useContextNaming(form, node.data, contextValues);

	// The id of the node whose data is currently loaded into the form. Used
	// (not `node` object identity — host node components rebuild that object
	// inline on every render, e.g. `goal-node.tsx`) to tell a genuine element
	// change apart from an unrelated re-render of the currently-open node.
	const loadedNodeIdRef = useRef(node.data?.id);

	const resetFormToNode = useCallback(
		(n: Node) => {
			const contextData = parseContextEntries(n.data?.context);
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
	} = useSelectDismissGuard();

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
		// A single-line `readOnly` input still submits its form implicitly on
		// Enter per the HTML spec (unlike `disabled`, which suppresses that).
		// Guard here so that keystroke can never reach the update request.
		if (readOnly) {
			return;
		}
		// Auto-add any unsaved draft context text
		if (newContextValue.trim()) {
			values.context = [...(values.context || []), newContextValue.trim()];
			setNewContextValue("");
		}
		const listProblem = supportsAttributes(nodeType)
			? findDraftContextProblem(values.context || [])
			: undefined;
		if (listProblem) {
			toast({
				variant: "destructive",
				title: "Check the context entries",
				description: listProblem,
			});
			return;
		}
		setLoading(true);
		const beforeData = { ...node.data } as Record<string, unknown>;
		const updateItem = buildUpdatePayload(
			values,
			nodeType,
			(node.data?.description as string | undefined) ?? ""
		);

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
				{isDefeater && (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
						<span className="font-medium text-muted-foreground">
							Challenges:{" "}
						</span>
						<span>{challengedName ?? "an element outside this case"}</span>
					</div>
				)}
				{supportsAttributes(nodeType) ? (
					<>
						<DescriptionField
							autoFocus={focusDescriptionOnOpen}
							form={form}
							placeholder="Type your description here."
							readOnly={readOnly}
							terms={terms}
						/>
						<TermsInReachList terms={terms} />
					</>
				) : (
					<TextFieldSection
						form={form}
						label="Description"
						name="description"
						placeholder="Type your description here."
						readOnly={readOnly}
					/>
				)}

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
						<ContextEntriesSection
							contextItems={contextItems}
							form={form}
							newContextValue={newContextValue}
							onAddContext={addContext}
							onNameContext={nameContext}
							onNewContextChange={setNewContextValue}
							onRemoveContext={removeContext}
							onUnnameContext={unnameContext}
							problem={contextProblem}
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
		canEdit: !readOnly,
		caseId: assuranceCase?.id?.toString() ?? "",
		elementId: String(node.data?.id ?? ""),
		elementText: plainReferenceText(form.watch("description"), terms),
		elementType: nodeType,
	};

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent
				className={cn(
					"max-h-9/10 overflow-y-auto",
					wideTab ? "sm:max-w-2xl" : "sm:max-w-lg"
				)}
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
				onOpenAutoFocus={(event) => {
					if (focusDescriptionOnOpen) {
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
					<Tabs
						// A grid item of the dialog: without `min-w-0`, a tab's unbreakable content sets the dialog's width.
						className="min-w-0"
						onValueChange={setActiveTab}
						value={activeTab}
					>
						<TabsList>
							<TabsTrigger value={DETAILS_TAB}>Details</TabsTrigger>
							{panelSlot.registrations.map(
								({ pluginId, tabId, label, icon: Icon }) => (
									<TabsTrigger key={pluginId} value={tabId}>
										{Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
										{label}
									</TabsTrigger>
								)
							)}
						</TabsList>
						<TabsContent value={DETAILS_TAB}>{detailsForm}</TabsContent>
						{panelSlot.registrations.map(({ pluginId, tabId, Component }) => (
							<TabsContent
								className="data-[state=inactive]:hidden"
								forceMount
								key={pluginId}
								value={tabId}
							>
								{shownTabs.has(tabId) && <Component {...panelContext} />}
							</TabsContent>
						))}
					</Tabs>
				)}
			</DialogContent>
		</Dialog>
	);
}
