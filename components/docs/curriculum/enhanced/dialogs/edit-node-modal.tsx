"use client";

/**
 * Edit Node Modal Component
 *
 * Full edit modal for editing all editable fields of a node:
 * name, description, context, assumption, and justification.
 *
 * Triggered from "More" menu → "Edit Text" in the NodeActionToolbar.
 *
 * @module edit-node-modal
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { NodeDataUpdate } from "../utils/theme-config";
import { getNodeTypeConfig } from "../utils/theme-config";

// ========================================================================
// Types
// ========================================================================

type NodeData = {
	id?: string;
	name?: string;
	description?: string;
	context?: string[];
	assumption?: string;
	justification?: string;
	[key: string]: unknown;
};

type FormData = {
	name: string;
	description: string;
	context: string;
	assumption: string;
	justification: string;
};

type EditNodeModalProps = {
	open: boolean;
	nodeType: string;
	nodeData: NodeData;
	isDarkMode: boolean;
	onSave: (data: NodeDataUpdate) => void;
	onClose: () => void;
};

// ========================================================================
// Helper Functions
// ========================================================================

const contextToString = (context: string[] | undefined): string => {
	if (!context || context.length === 0) {
		return "";
	}
	return context.join("\n");
};

const stringToContext = (str: string): string[] => {
	if (!str.trim()) {
		return [];
	}
	return str
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
};

// ========================================================================
// Component
// ========================================================================

export const EditNodeModal = ({
	open,
	nodeType,
	nodeData,
	isDarkMode,
	onSave,
	onClose,
}: EditNodeModalProps) => {
	const config = getNodeTypeConfig(nodeType);

	const [formData, setFormData] = useState<FormData>({
		name: nodeData.name || "",
		description: nodeData.description || "",
		context: contextToString(nodeData.context),
		assumption: nodeData.assumption || "",
		justification: nodeData.justification || "",
	});

	// Reset form when modal opens or nodeData changes
	useEffect(() => {
		if (open) {
			setFormData({
				name: nodeData.name || "",
				description: nodeData.description || "",
				context: contextToString(nodeData.context),
				assumption: nodeData.assumption || "",
				justification: nodeData.justification || "",
			});
		}
	}, [open, nodeData]);

	const handleChange = (field: keyof FormData, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSave = () => {
		const updatedData: NodeDataUpdate = {
			name: formData.name,
			description: formData.description,
		};

		// Only include context if it has values
		const contextArray = stringToContext(formData.context);
		if (contextArray.length > 0) {
			updatedData.context = contextArray;
		}

		// Only include assumption if it has a value
		if (formData.assumption.trim()) {
			updatedData.assumption = formData.assumption.trim();
		}

		// Only include justification if it has a value
		if (formData.justification.trim()) {
			updatedData.justification = formData.justification.trim();
		}

		onSave(updatedData);
	};

	const inputClassName = cn(
		isDarkMode
			? "border-white/10 bg-gray-800 text-white placeholder:text-gray-500 focus:border-white/20"
			: "border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-300"
	);

	const labelClassName = cn(
		"font-medium text-sm",
		isDarkMode ? "text-gray-300" : "text-gray-700"
	);

	return (
		<Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
			<DialogContent
				className={cn(
					"sm:max-w-[500px]",
					isDarkMode
						? "border-white/10 bg-gray-900 text-white"
						: "border-gray-200 bg-white text-gray-900"
				)}
				onClick={(e) => e.stopPropagation()}
			>
				<DialogHeader>
					<DialogTitle
						className={cn(
							"flex items-center gap-2",
							isDarkMode ? "text-white" : "text-gray-900"
						)}
					>
						<config.icon
							aria-hidden
							className={cn("h-5 w-5", config.colorScheme.icon)}
						/>
						Edit {config.name}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Name Field */}
					<div className="space-y-2">
						<Label className={labelClassName} htmlFor="name">
							Name
						</Label>
						<Input
							className={inputClassName}
							id="name"
							onChange={(e) => handleChange("name", e.target.value)}
							placeholder="Enter name..."
							value={formData.name}
						/>
					</div>

					{/* Description Field */}
					<div className="space-y-2">
						<Label className={labelClassName} htmlFor="description">
							Description
						</Label>
						<Textarea
							className={cn(inputClassName, "min-h-[100px] resize-none")}
							id="description"
							onChange={(e) => handleChange("description", e.target.value)}
							placeholder="Enter description..."
							value={formData.description}
						/>
					</div>

					{/* Context Field - Multiple lines, one per context item */}
					<div className="space-y-2">
						<Label className={labelClassName} htmlFor="context">
							Context
							<span
								className={cn(
									"ml-2 font-normal text-xs",
									isDarkMode ? "text-gray-500" : "text-gray-400"
								)}
							>
								(one per line)
							</span>
						</Label>
						<Textarea
							className={cn(inputClassName, "min-h-[80px] resize-none")}
							id="context"
							onChange={(e) => handleChange("context", e.target.value)}
							placeholder="Enter context items, one per line..."
							value={formData.context}
						/>
					</div>

					{/* Assumption Field */}
					<div className="space-y-2">
						<Label className={labelClassName} htmlFor="assumption">
							Assumption
						</Label>
						<Textarea
							className={cn(inputClassName, "min-h-[60px] resize-none")}
							id="assumption"
							onChange={(e) => handleChange("assumption", e.target.value)}
							placeholder="Enter assumption..."
							value={formData.assumption}
						/>
					</div>

					{/* Justification Field */}
					<div className="space-y-2">
						<Label className={labelClassName} htmlFor="justification">
							Justification
						</Label>
						<Textarea
							className={cn(inputClassName, "min-h-[60px] resize-none")}
							id="justification"
							onChange={(e) => handleChange("justification", e.target.value)}
							placeholder="Enter justification..."
							value={formData.justification}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						className={cn(
							isDarkMode
								? "text-gray-300 hover:bg-white/10 hover:text-white"
								: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
						)}
						onClick={onClose}
						variant="ghost"
					>
						Cancel
					</Button>
					<Button
						className={cn(
							isDarkMode
								? "bg-white text-gray-900 hover:bg-gray-100"
								: "bg-gray-900 text-white hover:bg-gray-800"
						)}
						onClick={handleSave}
					>
						Save Changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default EditNodeModal;
