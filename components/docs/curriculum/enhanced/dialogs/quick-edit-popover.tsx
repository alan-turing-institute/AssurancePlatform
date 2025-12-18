"use client";

/**
 * Quick Edit Popover Component
 *
 * A lightweight popover for quickly editing a node's description.
 * Triggered by the pencil icon in the NodeActionToolbar.
 *
 * @module quick-edit-popover
 */

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ========================================================================
// Types
// ========================================================================

type QuickEditPopoverProps = {
	description: string;
	isDarkMode: boolean;
	onSave: (description: string) => void;
};

// ========================================================================
// Component
// ========================================================================

export const QuickEditPopover = ({
	description,
	isDarkMode,
	onSave,
}: QuickEditPopoverProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [editValue, setEditValue] = useState(description);

	// Sync edit value when description prop changes or popover opens
	useEffect(() => {
		if (isOpen) {
			setEditValue(description);
		}
	}, [isOpen, description]);

	const handleSave = () => {
		onSave(editValue);
		setIsOpen(false);
	};

	const handleCancel = () => {
		setEditValue(description);
		setIsOpen(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			handleCancel();
		}
		// Cmd/Ctrl + Enter to save
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSave();
		}
	};

	return (
		<Popover onOpenChange={setIsOpen} open={isOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							className={cn(
								"h-8 w-8",
								isDarkMode
									? "text-gray-300 hover:bg-white/10 hover:text-white"
									: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
							)}
							onClick={(e) => e.stopPropagation()}
							size="icon"
							variant="ghost"
						>
							<Pencil className="h-4 w-4" />
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>Quick edit description</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="start"
				className={cn(
					"w-80",
					isDarkMode
						? "border-white/10 bg-gray-900 text-white"
						: "border-gray-200 bg-white text-gray-900"
				)}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={handleKeyDown}
				side="bottom"
			>
				<div className="space-y-3">
					<div className="space-y-1">
						<Label
							className={cn(
								"font-medium text-sm",
								isDarkMode ? "text-gray-300" : "text-gray-700"
							)}
							htmlFor="description"
						>
							Description
						</Label>
						<Textarea
							autoFocus
							className={cn(
								"min-h-[100px] resize-none",
								isDarkMode
									? "border-white/10 bg-gray-800 text-white placeholder:text-gray-500"
									: "border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
							)}
							id="description"
							onChange={(e) => setEditValue(e.target.value)}
							placeholder="Enter description..."
							value={editValue}
						/>
						<p
							className={cn(
								"text-xs",
								isDarkMode ? "text-gray-500" : "text-gray-400"
							)}
						>
							Press Cmd+Enter to save, Escape to cancel
						</p>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							className={cn(
								isDarkMode
									? "text-gray-300 hover:bg-white/10 hover:text-white"
									: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
							)}
							onClick={handleCancel}
							size="sm"
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
							size="sm"
						>
							Save
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default QuickEditPopover;
