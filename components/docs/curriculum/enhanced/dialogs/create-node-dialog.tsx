"use client";

/**
 * Create Node Dialog Component
 *
 * Simplified dialog for quick node creation from handle interactions.
 * Filters node types based on parent node's valid children.
 *
 * @component
 * @example
 * <CreateNodeDialog
 *   open={dialogOpen}
 *   onClose={() => setDialogOpen(false)}
 *   onConfirm={handleCreateNode}
 *   parentNode={parentNode}
 *   position={{ x: 100, y: 100 }}
 * />
 */

import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	CheckCircle,
	FileText,
	GitBranch,
	Target,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Node } from "reactflow";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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

// Use NodeTypeId for proper typing of validChildTypes
const DEFAULT_CHILD_TYPES: NodeTypeId[] = [
	"goal",
	"strategy",
	"propertyClaim",
	"evidence",
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

type Position = {
	x: number;
	y: number;
};

type ConfirmData = {
	nodeType: string;
	name: string;
	description: string;
	position: Position | null;
	parentNode: Node | null;
};

type NodeTypeCardProps = {
	metadata: NodeMetadata;
	isSelected: boolean;
	onClick: () => void;
};

/**
 * Node Type Card for quick selection
 */
const NodeTypeCard = ({ metadata, isSelected, onClick }: NodeTypeCardProps) => {
	const Icon = iconMap[metadata.icon] || Target;

	// Color mapping for visual consistency
	const colorMap: Record<string, string> = {
		green: "border-green-500/30 bg-green-500/10 hover:bg-green-500/20",
		purple: "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20",
		orange: "border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20",
		cyan: "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20",
		gray: "border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20",
	};

	return (
		<motion.button
			className={cn(
				"relative w-full rounded-lg p-4",
				"border-2 transition-all duration-200",
				"group text-left",
				isSelected
					? "border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/50"
					: colorMap[metadata.color] || "border-gray-500/30 bg-gray-500/10"
			)}
			onClick={onClick}
			type="button"
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
		>
			<div className="flex items-start gap-3">
				<Icon className="mt-1 h-5 w-5 shrink-0 text-text-light" />
				<div className="min-w-0 flex-1">
					<div className="mb-1 font-semibold text-text-light">
						{metadata.name}
					</div>
					<div className="text-text-light/60 text-xs">
						{metadata.description}
					</div>
				</div>
			</div>

			{/* Keyboard shortcut hint */}
			{metadata.shortcut && (
				<div className="absolute top-2 right-2 font-mono text-text-light/40 text-xs">
					{metadata.shortcut}
				</div>
			)}
		</motion.button>
	);
};

type CreateNodeDialogProps = {
	open?: boolean;
	onClose: () => void;
	onConfirm: (data: ConfirmData) => void;
	parentNode?: Node | null;
	position?: Position | null;
};

/**
 * CreateNodeDialog Component
 */
const CreateNodeDialog = ({
	open = false,
	onClose,
	onConfirm,
	parentNode = null,
	position = null,
}: CreateNodeDialogProps) => {
	const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
	const [nodeName, setNodeName] = useState("");
	const [nodeDescription, setNodeDescription] = useState("");

	// Get valid child types for the parent node
	const validChildTypes: NodeTypeId[] = parentNode
		? getValidChildren(parentNode.type)
		: DEFAULT_CHILD_TYPES;

	// Filter node type metadata to only show valid children
	const availableNodeTypes = validChildTypes
		.map((typeId: NodeTypeId) => nodeTypeMetadata[typeId])
		.filter(Boolean);

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			setSelectedNodeType(null);
			setNodeName("");
			setNodeDescription("");
		}
	}, [open]);

	// Handle node creation
	const handleConfirm = useCallback(() => {
		if (!selectedNodeType) {
			return;
		}

		// Generate default name if not provided
		const metadata = nodeTypeMetadata[selectedNodeType as NodeTypeId];
		const finalName = nodeName.trim() || `New ${metadata.name}`;
		const finalDescription =
			nodeDescription.trim() || `${metadata.description}`;

		onConfirm({
			nodeType: selectedNodeType,
			name: finalName,
			description: finalDescription,
			position,
			parentNode,
		});

		// Reset state
		setSelectedNodeType(null);
		setNodeName("");
		setNodeDescription("");
		onClose();
	}, [
		selectedNodeType,
		nodeName,
		nodeDescription,
		position,
		parentNode,
		onConfirm,
		onClose,
	]);

	// Handle keyboard shortcuts
	useEffect(() => {
		if (!open) {
			return;
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			// Type selection shortcuts (G, S, C, E)
			const shortcutMap: Record<string, NodeTypeId> = {
				g: "goal",
				s: "strategy",
				c: "propertyClaim",
				e: "evidence",
			};

			const key = e.key.toLowerCase();
			const nodeType = shortcutMap[key];
			if (nodeType && validChildTypes.includes(nodeType)) {
				e.preventDefault();
				setSelectedNodeType(nodeType);
			}

			// Enter to confirm (if node type selected)
			if (e.key === "Enter" && selectedNodeType) {
				e.preventDefault();
				handleConfirm();
			}

			// Escape to cancel
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, selectedNodeType, validChildTypes, onClose, handleConfirm]);

	return (
		<Dialog onOpenChange={onClose} open={open}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						Create New Node
						{parentNode && (
							<span className="font-normal text-sm text-text-light/60">
								as child of "{parentNode.data?.name || parentNode.id}"
							</span>
						)}
					</DialogTitle>
					<DialogDescription>
						Select a node type to create.
						{parentNode &&
							` Only types valid for ${parentNode.type} nodes are shown.`}
					</DialogDescription>
				</DialogHeader>

				{/* Node Type Selection */}
				<div className="space-y-3 py-4">
					<div className="mb-2 font-medium text-sm text-text-light/80">
						Select Node Type
					</div>

					<div className="grid grid-cols-1 gap-2">
						{availableNodeTypes.map((metadata) => (
							<NodeTypeCard
								isSelected={selectedNodeType === metadata.id}
								key={metadata.id}
								metadata={metadata}
								onClick={() => setSelectedNodeType(metadata.id)}
							/>
						))}
					</div>

					{/* Quick form for name (optional) */}
					<AnimatePresence>
						{selectedNodeType && (
							<motion.div
								animate={{ opacity: 1, height: "auto" }}
								className="mt-4 space-y-3"
								exit={{ opacity: 0, height: 0 }}
								initial={{ opacity: 0, height: 0 }}
							>
								<div>
									<label
										className="mb-1 block font-medium text-sm text-text-light/80"
										htmlFor="node-name"
									>
										Name (optional)
									</label>
									<input
										className={cn(
											"w-full rounded-md px-3 py-2",
											"bg-background-transparent-white-hover",
											"border border-transparent",
											"text-text-light",
											"focus:outline-hidden focus:ring-2 focus:ring-blue-500/50"
										)}
										id="node-name"
										onChange={(e) => setNodeName(e.target.value)}
										placeholder={`New ${nodeTypeMetadata[selectedNodeType as NodeTypeId].name}`}
										type="text"
										value={nodeName}
									/>
								</div>

								<div>
									<label
										className="mb-1 block font-medium text-sm text-text-light/80"
										htmlFor="node-description"
									>
										Description (optional)
									</label>
									<textarea
										className={cn(
											"w-full rounded-md px-3 py-2",
											"bg-background-transparent-white-hover",
											"border border-transparent",
											"text-text-light",
											"focus:outline-hidden focus:ring-2 focus:ring-blue-500/50",
											"resize-none"
										)}
										id="node-description"
										onChange={(e) => setNodeDescription(e.target.value)}
										placeholder="Enter a description..."
										rows={2}
										value={nodeDescription}
									/>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				<DialogFooter>
					<Button className="text-text-light" onClick={onClose} variant="ghost">
						<X className="mr-2 h-4 w-4" />
						Cancel
					</Button>
					<Button
						className={cn(
							"bg-blue-500 hover:bg-blue-600",
							"text-white",
							!selectedNodeType && "cursor-not-allowed opacity-50"
						)}
						disabled={!selectedNodeType}
						onClick={handleConfirm}
					>
						<CheckCircle className="mr-2 h-4 w-4" />
						Create Node
					</Button>
				</DialogFooter>

				{/* Keyboard hints */}
				<div className="pb-2 text-center text-text-light/40 text-xs">
					Press keyboard shortcuts (G, S, C, E, X) to select type | Enter to
					create | Esc to cancel
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default CreateNodeDialog;
