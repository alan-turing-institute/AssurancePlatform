"use client";

import { PlusIcon, Trash2 } from "lucide-react";
import type React from "react";
import { useId, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormLabel } from "@/components/ui/form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type ContextEditorProps = {
	form: UseFormReturn<{
		assumption?: string;
		justification?: string;
		context?: string[];
	}>;
	readOnly: boolean;
};

type ContextItemWithId = {
	id: string;
	value: string;
};

/**
 * Editor component for managing context array on elements.
 * Supports adding, removing, and displaying context items.
 */
const ContextEditor: React.FC<ContextEditorProps> = ({ form, readOnly }) => {
	const componentId = useId();
	const [newContextValue, setNewContextValue] = useState<string>("");
	const [idCounter, setIdCounter] = useState(0);
	const contextValues = form.watch("context") || [];

	// Track items with stable IDs for React keys
	const [itemIds, setItemIds] = useState<string[]>(() =>
		contextValues.map((_, i) => `${componentId}-init-${i}`)
	);

	// Sync itemIds when contextValues change from external source
	const contextItems: ContextItemWithId[] = useMemo(() => {
		// Ensure we have enough IDs for all values
		while (itemIds.length < contextValues.length) {
			itemIds.push(`${componentId}-${idCounter + itemIds.length}`);
		}
		return contextValues.map((value, i) => ({
			id: itemIds[i],
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

	return (
		<div className="space-y-3">
			<FormLabel>Context</FormLabel>
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
									className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
									onClick={() => removeContext(idx)}
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
						onChange={(e) => setNewContextValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addContext();
							}
						}}
						placeholder="Add new context..."
						value={newContextValue}
					/>
					<Button
						disabled={!newContextValue.trim()}
						onClick={addContext}
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
};

export default ContextEditor;
