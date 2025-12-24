"use client";

/**
 * Node Action Toolbar Component
 *
 * Floating toolbar that appears above nodes when hovered/selected in edit mode.
 * Provides quick actions: edit description, toggle children visibility, and more menu.
 *
 * @module node-action-toolbar
 */

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, FileEdit, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NodeDataUpdate } from "../utils/theme-config";
import { EditNodeModal } from "./edit-node-modal";
import { QuickEditPopover } from "./quick-edit-popover";

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

type NodeActionToolbarProps = {
	nodeType: string;
	nodeData: NodeData;
	visible: boolean;
	isDarkMode: boolean;
	isRootNode: boolean;
	hasChildren: boolean;
	hasHiddenChildren: boolean;
	onDescriptionChange: (description: string) => void;
	onDataChange: (data: NodeDataUpdate) => void;
	onDelete: () => void;
	onToggleChildren: () => void;
};

// ========================================================================
// Animation Variants
// ========================================================================

const toolbarVariants = {
	hidden: {
		opacity: 0,
		y: 10,
		scale: 0.95,
	},
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: {
			type: "spring" as const,
			stiffness: 400,
			damping: 25,
		},
	},
	exit: {
		opacity: 0,
		y: 5,
		scale: 0.95,
		transition: {
			duration: 0.15,
		},
	},
};

// ========================================================================
// Component
// ========================================================================

export const NodeActionToolbar = ({
	nodeType,
	nodeData,
	visible,
	isDarkMode,
	isRootNode,
	hasChildren,
	hasHiddenChildren,
	onDescriptionChange,
	onDataChange,
	onDelete,
	onToggleChildren,
}: NodeActionToolbarProps) => {
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);

	const handleDelete = () => {
		onDelete();
		setShowDeleteDialog(false);
	};

	const handleEditSave = (data: NodeDataUpdate) => {
		onDataChange(data);
		setShowEditModal(false);
	};

	return (
		<>
			<AnimatePresence>
				{visible && (
					<motion.div
						animate="visible"
						className={cn(
							"-top-12 -translate-x-1/2 absolute left-1/2",
							"flex items-center gap-1",
							"rounded-lg border p-1",
							"shadow-lg",
							"z-50",
							isDarkMode
								? "border-white/10 bg-gray-900/95 backdrop-blur-sm"
								: "border-gray-200 bg-white/95 backdrop-blur-sm"
						)}
						exit="exit"
						initial="hidden"
						variants={toolbarVariants}
					>
						<TooltipProvider delayDuration={300}>
							{/* Quick Edit Description */}
							<QuickEditPopover
								description={nodeData.description || ""}
								isDarkMode={isDarkMode}
								onSave={onDescriptionChange}
							/>

							{/* Toggle Children Visibility */}
							{hasChildren && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											className={cn(
												"h-8 w-8",
												isDarkMode
													? "text-gray-300 hover:bg-white/10 hover:text-white"
													: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
											)}
											onClick={(e) => {
												e.stopPropagation();
												onToggleChildren();
											}}
											size="icon"
											variant="ghost"
										>
											{hasHiddenChildren ? (
												<Eye className="h-4 w-4" />
											) : (
												<EyeOff className="h-4 w-4" />
											)}
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{hasHiddenChildren ? "Show children" : "Hide children"}
									</TooltipContent>
								</Tooltip>
							)}

							{/* More Menu */}
							<DropdownMenu>
								<Tooltip>
									<TooltipTrigger asChild>
										<DropdownMenuTrigger asChild>
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
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
									</TooltipTrigger>
									<TooltipContent>More options</TooltipContent>
								</Tooltip>
								<DropdownMenuContent
									align="end"
									className={cn(
										isDarkMode
											? "border-white/10 bg-gray-900"
											: "border-gray-200 bg-white"
									)}
								>
									<DropdownMenuItem
										className={cn(
											"cursor-pointer",
											isDarkMode
												? "text-gray-300 focus:bg-white/10 focus:text-white"
												: "text-gray-700 focus:bg-gray-100 focus:text-gray-900"
										)}
										onClick={(e) => {
											e.stopPropagation();
											setShowEditModal(true);
										}}
									>
										<FileEdit className="mr-2 h-4 w-4" />
										Edit Text
									</DropdownMenuItem>
									<DropdownMenuSeparator
										className={isDarkMode ? "bg-white/10" : "bg-gray-200"}
									/>
									<DropdownMenuItem
										className={cn(
											"cursor-pointer",
											isRootNode
												? "cursor-not-allowed opacity-50"
												: "text-red-500 focus:bg-red-500/10 focus:text-red-500"
										)}
										disabled={isRootNode}
										onClick={(e) => {
											e.stopPropagation();
											if (!isRootNode) {
												setShowDeleteDialog(true);
											}
										}}
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</TooltipProvider>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Delete Confirmation Dialog */}
			<AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
				<AlertDialogContent
					className={cn(
						isDarkMode
							? "border-white/10 bg-gray-900 text-white"
							: "border-gray-200 bg-white text-gray-900"
					)}
				>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this node?</AlertDialogTitle>
						<AlertDialogDescription
							className={isDarkMode ? "text-gray-400" : "text-gray-500"}
						>
							This will delete the node and all its children. This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							className={cn(
								isDarkMode
									? "border-white/10 bg-transparent text-white hover:bg-white/10"
									: "border-gray-200 bg-transparent text-gray-900 hover:bg-gray-100"
							)}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-red-500 text-white hover:bg-red-600"
							onClick={handleDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Full Edit Modal */}
			<EditNodeModal
				isDarkMode={isDarkMode}
				nodeData={nodeData}
				nodeType={nodeType}
				onClose={() => setShowEditModal(false)}
				onSave={handleEditSave}
				open={showEditModal}
			/>
		</>
	);
};

export default NodeActionToolbar;
