"use client";

/**
 * Create Node Popover Component
 *
 * Compact popover for quick node creation from handle interactions.
 * Filters node types based on parent node's valid children.
 * Uses shadcn Popover for a clean, non-intrusive UI.
 *
 * @component
 * @example
 * <CreateNodePopover
 *   open={popoverOpen}
 *   onOpenChange={setPopoverOpen}
 *   onSelect={handleCreateNode}
 *   parentNode={parentNode}
 *   position={{ x: 100, y: 100 }}
 * />
 */

import {
	AlertCircle,
	CheckCircle,
	FileText,
	GitBranch,
	Target,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Node } from "reactflow";
import { cn } from "@/lib/utils";

import {
	getValidChildren,
	type NodeTypeId,
	nodeTypeMetadata,
} from "../nodes/node-types";

type IconType =
	| typeof Target
	| typeof GitBranch
	| typeof FileText
	| typeof CheckCircle
	| typeof AlertCircle;

// Default child types for when no parent is specified
const DEFAULT_CHILD_TYPES: NodeTypeId[] = [
	"goal",
	"strategy",
	"propertyClaim",
	"evidence",
	"context",
];

/**
 * Icon mapping for node types
 */
const iconMap: Record<string, IconType> = {
	Target,
	GitBranch,
	FileText,
	CheckCircle,
	AlertCircle,
};

type NodeMetadata = {
	id: string;
	name: string;
	description: string;
	icon: string;
	color: string;
	shortcut?: string;
};

type NodeTypeButtonProps = {
	metadata: NodeMetadata;
	onClick: () => void;
};

/**
 * Node Type Button for selection
 */
const NodeTypeButton = ({ metadata, onClick }: NodeTypeButtonProps) => {
	const Icon = iconMap[metadata.icon] || Target;

	// Color mapping for visual consistency
	const colorMap: Record<string, string> = {
		green: "hover:bg-green-500/20 hover:border-green-500/50",
		purple: "hover:bg-purple-500/20 hover:border-purple-500/50",
		orange: "hover:bg-orange-500/20 hover:border-orange-500/50",
		cyan: "hover:bg-cyan-500/20 hover:border-cyan-500/50",
		gray: "hover:bg-gray-500/20 hover:border-gray-500/50",
	};

	return (
		<button
			className={cn(
				"w-full rounded-md px-3 py-2",
				"flex items-center gap-3",
				"border border-transparent",
				"transition-all duration-200",
				"text-left",
				"bg-white/5 dark:bg-white/5",
				"hover:bg-white/10 dark:hover:bg-white/10",
				colorMap[metadata.color] || "hover:bg-gray-500/20"
			)}
			onClick={onClick}
			type="button"
		>
			<Icon className="h-4 w-4 shrink-0 text-gray-700 dark:text-gray-200" />
			<div className="min-w-0 flex-1">
				<div className="font-medium text-gray-900 text-sm dark:text-gray-100">
					{metadata.name}
				</div>
			</div>
			{metadata.shortcut && (
				<div className="font-mono text-gray-500 text-xs dark:text-gray-400">
					{metadata.shortcut}
				</div>
			)}
		</button>
	);
};

type Position = {
	x: number;
	y: number;
};

type SelectionData = {
	nodeType: string;
	name: string;
	description: string;
	parentNode: Node | null;
};

type CreateNodePopoverProps = {
	open?: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (data: SelectionData) => void;
	parentNode?: Node | null;
	position?: Position | null;
};

/**
 * CreateNodePopover Component
 */
const CreateNodePopover = ({
	open = false,
	onOpenChange,
	onSelect,
	parentNode = null,
	position = null,
}: CreateNodePopoverProps) => {
	const popoverRef = useRef<HTMLDivElement>(null);

	// Get valid child types for the parent node
	const validChildTypes: NodeTypeId[] = parentNode
		? getValidChildren(parentNode.type)
		: DEFAULT_CHILD_TYPES;

	// Filter node type metadata to only show valid children
	const availableNodeTypes = validChildTypes
		.map((typeId: NodeTypeId) => nodeTypeMetadata[typeId])
		.filter(Boolean);

	const handleSelect = (nodeType: NodeTypeId) => {
		const metadata = nodeTypeMetadata[nodeType];
		onSelect({
			nodeType,
			name: `New ${metadata.name}`,
			description: metadata.description,
			parentNode,
		});
		onOpenChange(false);
	};

	// Handle click outside to close
	useEffect(() => {
		if (!open) {
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(event.target as HTMLElement)
			) {
				onOpenChange(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onOpenChange(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [open, onOpenChange]);

	if (!open) {
		return null;
	}

	// Calculate position (default to center of screen if no position provided)
	const popoverStyle = position
		? {
				position: "fixed" as const,
				left: `${position.x}px`,
				top: `${position.y}px`,
				transform: "translate(0, 10px)", // offset slightly below cursor
			}
		: {
				position: "fixed" as const,
				left: "50%",
				top: "50%",
				transform: "translate(-50%, -50%)",
			};

	const popoverContent = (
		<div
			className={cn(
				"z-9999 w-64 p-2",
				"bg-white dark:bg-gray-800",
				"border border-gray-300 dark:border-gray-600",
				"rounded-lg shadow-xl",
				"backdrop-blur-lg"
			)}
			ref={popoverRef}
			style={popoverStyle}
		>
			<div className="space-y-1">
				<div className="px-2 py-1.5">
					<div className="font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-200">
						Create Node
					</div>
					{parentNode && (
						<div className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
							as child of "{parentNode.data?.name || parentNode.id}"
						</div>
					)}
				</div>

				<div className="space-y-1">
					{availableNodeTypes.map((metadata) => (
						<NodeTypeButton
							key={metadata.id}
							metadata={metadata}
							onClick={() => handleSelect(metadata.id)}
						/>
					))}
				</div>
			</div>
		</div>
	);

	// Render into document.body using portal
	return createPortal(popoverContent, document.body);
};

export default CreateNodePopover;
