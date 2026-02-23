"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Minus, Plus, PlusIcon, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { type UseFormReturn, useFieldArray, useForm } from "react-hook-form";
import type { Node } from "reactflow";
import { z } from "zod";
import type { NodeType } from "@/components/shared/nodes/node-config";
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
import { Textarea } from "@/components/ui/textarea";
import useStore from "@/data/store";
import {
	type ReactFlowNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case";
import { recordUpdate } from "@/lib/services/history-service";

const formSchema = z.object({
	description: z.string().min(2, {
		message: "Description must be at least 2 characters",
	}),
	assumption: z.string().optional(),
	justification: z.string().optional(),
	context: z.array(z.string()).optional(),
	urls: z.array(z.object({ value: z.string() })),
});

type FormValues = z.infer<typeof formSchema>;

// Helper to check if element type supports attributes
const supportsAttributes = (nodeType: NodeType): boolean =>
	["goal", "strategy", "property"].includes(nodeType);

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
	nodeType: NodeType
): Record<string, unknown> {
	const updateItem: Record<string, unknown> = {
		short_description: values.description,
	};

	if (supportsAttributes(nodeType)) {
		updateItem.assumption = values.assumption || "";
		updateItem.justification = values.justification || "";
		updateItem.context = values.context || [];
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

type TextFieldProps = {
	form: UseFormReturn<FormValues>;
	name: "description" | "assumption" | "justification";
	label: string;
	placeholder: string;
	readOnly: boolean;
};

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

type ContextSectionProps = {
	contextItems: Array<{ id: string; value: string }>;
	readOnly: boolean;
	newContextValue: string;
	onNewContextChange: (value: string) => void;
	onAddContext: () => void;
	onRemoveContext: (idx: number) => void;
};

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
					</Button>
				</div>
			)}
		</div>
	);
}

type UrlsSectionProps = {
	form: UseFormReturn<FormValues>;
	fields: Array<{ id: string; value: string }>;
	readOnly: boolean;
	onAppend: () => void;
	onRemove: (idx: number) => void;
};

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
								{!readOnly && fields.length > 1 && (
									<Button
										onClick={() => onRemove(index)}
										size="icon"
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

// --- Main component ---

type NodeEditDialogProps = {
	node: Node;
	nodeType: NodeType;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	readOnly?: boolean;
};

export default function NodeEditDialog({
	node,
	nodeType,
	open,
	onOpenChange,
	readOnly = false,
}: NodeEditDialogProps) {
	const { assuranceCase, setAssuranceCase } = useStore();
	const [loading, setLoading] = useState(false);
	const [newContextValue, setNewContextValue] = useState("");
	const componentId = useId();
	const [idCounter, setIdCounter] = useState(0);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			description: (node.data?.short_description as string) ?? "",
			assumption: (node.data?.assumption as string) ?? "",
			justification: (node.data?.justification as string) ?? "",
			context: (node.data?.context as string[]) ?? [],
			urls: getInitialUrls(node.data as Record<string, unknown>),
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "urls",
	});

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

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			const contextData = (node.data?.context as string[]) ?? [];
			form.reset({
				description: (node.data?.short_description as string) ?? "",
				assumption: (node.data?.assumption as string) ?? "",
				justification: (node.data?.justification as string) ?? "",
				context: contextData,
				urls: getInitialUrls(node.data as Record<string, unknown>),
			});
			setItemIds(contextData.map((_, i) => `${componentId}-reset-${i}`));
			setNewContextValue("");
		}
	}, [open, node, form, componentId]);

	const handleClose = () => onOpenChange(false);

	const handleSubmit = async (values: FormValues) => {
		setLoading(true);
		const beforeData = { ...node.data } as Record<string, unknown>;
		const updateItem = buildUpdatePayload(values, nodeType);

		const updated = await updateAssuranceCaseNode(
			node.type || "unknown",
			node.data.id,
			"",
			updateItem
		);

		if (updated && assuranceCase) {
			recordUpdate(node.data.id as number, node.type || "unknown", beforeData, {
				...beforeData,
				...updateItem,
			});

			const updatedCase = await updateAssuranceCase(
				node.type || "unknown",
				assuranceCase,
				updateItem,
				node.data.id,
				{ ...node, type: node.type || "" } as ReactFlowNode
			);

			if (updatedCase) {
				setAssuranceCase(updatedCase);
				setLoading(false);
				handleClose();
				return;
			}
		}
		setLoading(false);
	};

	const nodeName = (node.data?.name as string) || "Element";
	const nodeTypeLabel = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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

				<Form {...form}>
					<form
						className="space-y-4"
						onSubmit={form.handleSubmit(handleSubmit)}
					>
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
			</DialogContent>
		</Dialog>
	);
}
