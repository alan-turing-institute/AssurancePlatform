"use client";

/**
 * Add Block Dialog Component
 *
 * Full-screen modal dialog for creating new nodes in React Flow.
 * Inspired by FloraFauna.ai with modern glassmorphism design.
 *
 * @component
 */

import { motion } from "framer-motion";
import {
	AlertCircle,
	ArrowRight,
	Check,
	CheckCircle,
	Clock,
	FileText,
	GitBranch,
	HelpCircle,
	Layers,
	type LucideIcon,
	Search,
	Sparkles,
	Star,
	Target,
	Zap,
} from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
	calculateConnectionHints,
	createNodeObject,
	loadRecentTypes,
	saveRecentTypes,
} from "../interactions/creation-utils";
import { getNodeTypesByCategory, nodeTypeMetadata } from "../nodes/node-types";
import BlockForm from "./block-form";
import BlockPreview from "./block-preview";
import BlockTemplates, { type Template } from "./block-templates";
import {
	clearDraft,
	getDialogMode,
	loadDraft,
	saveDraft,
	setDialogMode,
} from "./dialog-utils";

/**
 * Icon map for dynamic icon lookup
 */
const iconMap: Record<string, LucideIcon> = {
	Target,
	GitBranch,
	FileText,
	CheckCircle,
	AlertCircle,
};

/**
 * Position type
 */
type Position = {
	x: number;
	y: number;
};

/**
 * Form data type
 */
type FormData = {
	name?: string;
	description?: string;
	[key: string]: unknown;
};

/**
 * Node type metadata type
 */
type NodeTypeMetadata = {
	id: string;
	name: string;
	description: string;
	icon: string;
	color: string;
	category: string;
	shortcut: string;
};

/**
 * Node data type for adding
 */
type AddNodeData = {
	type: string;
	template?: Template;
	position?: Position | null;
	id?: string;
	data?: Record<string, unknown>;
};

/**
 * Node Type Card Component Props
 */
type NodeTypeCardProps = {
	metadata: NodeTypeMetadata;
	isSelected: boolean;
	onClick: () => void;
	isRecent: boolean;
	isFavorite: boolean;
};

/**
 * Node Type Card Component
 */
const NodeTypeCard = ({
	metadata,
	isSelected,
	onClick,
	isRecent,
	isFavorite,
}: NodeTypeCardProps): ReactNode => {
	const Icon = iconMap[metadata.icon];

	return (
		<motion.button
			className={cn(
				"relative w-full rounded-lg p-4",
				"bg-background-transparent-white-hover",
				"hover:bg-background-transparent-white-secondaryHover",
				"border transition-all duration-200",
				"group text-left",
				isSelected
					? "border-blue-500/50 bg-background-transparent-white-secondaryHover ring-2 ring-blue-500/50"
					: "border-transparent"
			)}
			onClick={onClick}
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
		>
			{/* Badges */}
			<div className="absolute top-2 right-2 flex gap-1">
				{isRecent && (
					<div className="rounded bg-blue-500/20 p-1">
						<Clock className="h-3 w-3 text-blue-400" />
					</div>
				)}
				{isFavorite && (
					<div className="rounded bg-yellow-500/20 p-1">
						<Star className="h-3 w-3 text-yellow-400" />
					</div>
				)}
			</div>

			<div className="flex items-start gap-3">
				{/* Icon */}
				<div
					className={cn(
						"shrink-0 rounded-lg p-2.5",
						`bg-${metadata.color}-500/10`,
						"transition-transform duration-200 group-hover:scale-110"
					)}
				>
					{Icon && (
						<Icon className={cn("h-5 w-5", `text-${metadata.color}-400`)} />
					)}
				</div>

				{/* Content */}
				<div className="min-w-0 flex-1 pr-8">
					<div className="mb-1 font-semibold text-sm text-text-light">
						{metadata.name}
					</div>
					<p className="line-clamp-2 text-text-light/70 text-xs">
						{metadata.description}
					</p>
				</div>
			</div>

			{/* Shortcut */}
			<div className="mt-2 flex justify-end">
				<kbd
					className={cn(
						"px-2 py-1 font-mono text-xs",
						"bg-background-transparent-white-hover",
						"border border-transparent",
						"rounded",
						"text-text-light/60"
					)}
				>
					{metadata.shortcut}
				</kbd>
			</div>
		</motion.button>
	);
};

/**
 * AddBlockDialog Component Props
 */
type AddBlockDialogProps = {
	open?: boolean;
	onClose?: () => void;
	onAdd?: (nodeData: AddNodeData) => void;
	onBulkAdd?: (nodes: AddNodeData[]) => void;
	position?: Position | null;
	currentNodes?: Node[];
	suggestedConnections?: unknown[];
	defaultNodeType?: string | null;
	enableTemplates?: boolean;
	enableQuickMode?: boolean;
	enableBulkMode?: boolean;
	showConnectionHints?: boolean;
	className?: string;
};

/**
 * Valid node type ids
 */
type NodeTypeId =
	| "goal"
	| "strategy"
	| "propertyClaim"
	| "evidence"
	| "context";

/**
 * Helper function to handle keyboard shortcuts for node type selection
 */
const findNodeTypeByShortcut = (shortcut: string): string | undefined =>
	(Object.keys(nodeTypeMetadata) as NodeTypeId[]).find(
		(t) => nodeTypeMetadata[t].shortcut === shortcut
	);

/**
 * Keyboard handler context type
 */
type KeyboardHandlerContext = {
	onClose: () => void;
	onAdd: () => void;
	onSelectNodeType: (type: string) => void;
	onSelectTemplatesTab: () => void;
	enableTemplates: boolean;
};

/**
 * Process keyboard event and return true if handled
 */
const processKeyboardEvent = (
	event: KeyboardEvent,
	ctx: KeyboardHandlerContext
): void => {
	const {
		onClose,
		onAdd,
		onSelectNodeType,
		onSelectTemplatesTab,
		enableTemplates,
	} = ctx;

	// Escape key closes the dialog
	if (event.key === "Escape") {
		event.preventDefault();
		onClose();
		return;
	}

	// Enter key adds the node (unless in text input)
	const target = event.target as HTMLElement;
	const isInTextInput =
		target.tagName === "INPUT" || target.tagName === "TEXTAREA";
	if (event.key === "Enter" && !isInTextInput) {
		event.preventDefault();
		onAdd();
		return;
	}

	// Modifier key shortcuts
	const hasModifier = event.ctrlKey || event.metaKey;
	if (hasModifier) {
		if (event.key === "t" && enableTemplates) {
			event.preventDefault();
			onSelectTemplatesTab();
		}
		return;
	}

	// Alt key bypasses shortcuts
	if (event.altKey) {
		return;
	}

	// Node type shortcuts
	const type = findNodeTypeByShortcut(event.key.toUpperCase());
	if (type) {
		event.preventDefault();
		onSelectNodeType(type);
	}
};

/**
 * AddBlockDialog Component
 */
const AddBlockDialog = ({
	open = false,
	onClose,
	onAdd,
	onBulkAdd,
	position = null,
	currentNodes = [],
	defaultNodeType = null,
	enableTemplates = true,
	enableQuickMode = true,
	enableBulkMode = false,
	showConnectionHints = true,
	className,
}: AddBlockDialogProps): ReactNode => {
	// State
	const [selectedNodeType, setSelectedNodeType] = useState<string | null>(
		defaultNodeType || "goal"
	);
	const [formData, setFormData] = useState<FormData>({});
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("types");
	const [mode, setMode] = useState("standard");
	const [recentTypes, setRecentTypes] = useState<NodeTypeId[]>([]);
	const [favoriteTypes] = useState<NodeTypeId[]>([]);
	const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
		null
	);
	const [bulkCount] = useState(1);
	const [validationErrors, setValidationErrors] = useState<
		Record<string, string>
	>({});

	// Refs
	const searchInputRef = useRef<HTMLInputElement>(null);
	const formRef = useRef<{
		validate: () => Record<string, string>;
		getData: () => FormData;
	}>(null);

	// Load recent types and favorites on mount
	useEffect(() => {
		const loaded = loadRecentTypes() as NodeTypeId[];
		setRecentTypes(loaded);

		// Load saved dialog mode
		const savedMode = getDialogMode();
		if (savedMode && enableQuickMode) {
			setMode(savedMode);
		}
	}, [enableQuickMode]);

	// Auto-focus search when dialog opens
	useEffect(() => {
		if (open && searchInputRef.current && activeTab === "types") {
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, 100);
		}
	}, [open, activeTab]);

	// Load draft when dialog opens
	useEffect(() => {
		if (open) {
			const draft = loadDraft();
			if (draft?.nodeType) {
				setSelectedNodeType(draft.nodeType);
				setFormData((draft.formData as FormData) || {});
			}
		}
	}, [open]);

	// Auto-save draft
	useEffect(() => {
		if (open && selectedNodeType && Object.keys(formData).length > 0) {
			saveDraft({ nodeType: selectedNodeType, formData });
		}
	}, [open, selectedNodeType, formData]);

	// Calculate connection hints
	const connectionHints =
		position && showConnectionHints
			? calculateConnectionHints(position, currentNodes, 300)
			: [];

	// Filter node types based on search
	const filteredTypes = (Object.keys(nodeTypeMetadata) as NodeTypeId[]).filter(
		(type) => {
			if (!searchQuery) {
				return true;
			}
			const metadata = nodeTypeMetadata[type];
			const query = searchQuery.toLowerCase();
			return (
				metadata.name.toLowerCase().includes(query) ||
				metadata.description.toLowerCase().includes(query) ||
				metadata.category.toLowerCase().includes(query)
			);
		}
	);

	// Handle node type selection
	const handleSelectNodeType = useCallback((nodeType: string): void => {
		setSelectedNodeType(nodeType);
		setSelectedTemplate(null);
		setValidationErrors({});
	}, []);

	// Handle template selection
	const handleSelectTemplate = useCallback((template: Template): void => {
		setSelectedTemplate(template);
		setSelectedNodeType(null);
		setActiveTab("templates");
	}, []);

	// Handle form data change
	const handleFormDataChange = useCallback((data: FormData): void => {
		setFormData(data);
		setValidationErrors({});
	}, []);

	// Validate form
	const validateForm = useCallback((): Record<string, string> => {
		const errors: Record<string, string> = {};

		if (!(selectedNodeType || selectedTemplate)) {
			errors.general = "Please select a node type or template";
			return errors;
		}

		if (selectedNodeType) {
			if (!formData.name || formData.name.trim() === "") {
				errors.name = "Name is required";
			}
			if (!formData.description || formData.description.trim() === "") {
				errors.description = "Description is required";
			}
		}

		return errors;
	}, [selectedNodeType, selectedTemplate, formData]);

	// Handle close
	const handleClose = useCallback((): void => {
		// Reset state
		setSelectedNodeType(defaultNodeType || "goal");
		setFormData({});
		setSearchQuery("");
		setActiveTab("types");
		setSelectedTemplate(null);
		setValidationErrors({});

		onClose?.();
	}, [defaultNodeType, onClose]);

	// Handle add node
	const handleAdd = useCallback((): void => {
		const errors = validateForm();
		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			return;
		}

		if (selectedTemplate) {
			// Add template nodes
			onAdd?.({
				type: "template",
				template: selectedTemplate,
				position,
			});
		} else if (selectedNodeType) {
			// Add single node
			const nodeData = createNodeObject(
				selectedNodeType,
				position || { x: 100, y: 100 },
				formData
			);

			// Cast Node to AddNodeData since createNodeObject always sets type
			onAdd?.(nodeData as AddNodeData);

			// Update recent types
			const updated = [
				selectedNodeType as NodeTypeId,
				...recentTypes.filter((t) => t !== selectedNodeType),
			].slice(0, 5);
			setRecentTypes(updated);
			saveRecentTypes(updated);
		}

		// Clear draft and close
		clearDraft();
		handleClose();
	}, [
		selectedNodeType,
		selectedTemplate,
		formData,
		position,
		recentTypes,
		onAdd,
		validateForm,
		handleClose,
	]);

	// Handle bulk add
	const handleBulkAdd = useCallback((): void => {
		if (!(enableBulkMode && onBulkAdd && selectedNodeType)) {
			return;
		}

		const errors = validateForm();
		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			return;
		}

		const nodes: AddNodeData[] = [];
		for (let i = 0; i < bulkCount; i++) {
			const nodePosition = position
				? { x: position.x + i * 50, y: position.y + i * 50 }
				: { x: 100 + i * 50, y: 100 + i * 50 };

			const nodeData = createNodeObject(selectedNodeType, nodePosition, {
				...formData,
				name: `${formData.name} ${i + 1}`,
			});
			// Cast Node to AddNodeData since createNodeObject always sets type
			nodes.push(nodeData as AddNodeData);
		}

		onBulkAdd(nodes);
		clearDraft();
		handleClose();
	}, [
		enableBulkMode,
		onBulkAdd,
		bulkCount,
		selectedNodeType,
		formData,
		position,
		validateForm,
		handleClose,
	]);

	// Keyboard shortcuts
	useEffect(() => {
		if (!open) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent): void => {
			processKeyboardEvent(event, {
				onClose: handleClose,
				onAdd: handleAdd,
				onSelectNodeType: handleSelectNodeType,
				onSelectTemplatesTab: () => setActiveTab("templates"),
				enableTemplates,
			});
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, handleClose, handleAdd, handleSelectNodeType, enableTemplates]);

	// Get categorized node types
	const categorizedTypes = getNodeTypesByCategory();

	// Render right panel content
	const renderRightPanelContent = (): ReactNode => {
		if (selectedNodeType) {
			return (
				<div className="space-y-6">
					{/* Form */}
					<div>
						<h3 className="mb-4 flex items-center gap-2 font-semibold text-sm text-text-light">
							<ArrowRight className="h-4 w-4" />
							{mode === "quick" ? "Quick Create" : "Configure Node"}
						</h3>
						<BlockForm
							formData={formData}
							nodeType={selectedNodeType}
							onChange={handleFormDataChange}
							quickMode={mode === "quick"}
							ref={formRef}
							validationErrors={validationErrors}
						/>
					</div>

					{/* Preview */}
					<div>
						<h3 className="mb-4 font-semibold text-sm text-text-light">
							Preview
						</h3>
						<BlockPreview
							connectionHints={connectionHints}
							formData={formData}
							nodeType={selectedNodeType}
						/>
					</div>
				</div>
			);
		}

		if (selectedTemplate) {
			return (
				<div className="space-y-6">
					<div>
						<h3 className="mb-4 font-semibold text-sm text-text-light">
							Template Preview
						</h3>
						<BlockPreview
							connectionHints={connectionHints}
							template={selectedTemplate}
						/>
					</div>
				</div>
			);
		}

		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center text-text-light/50">
					<Layers className="mx-auto mb-4 h-12 w-12 opacity-50" />
					<p className="text-sm">Select a node type or template to continue</p>
					<p className="mt-2 text-xs">
						Use keyboard shortcuts for quick selection
					</p>
				</div>
			</div>
		);
	};

	return (
		<Dialog onOpenChange={handleClose} open={open}>
			<DialogContent
				className={cn(
					"h-[85vh] max-w-6xl",
					"bg-background-transparent-black-secondaryAlt",
					"border border-transparent",
					"f-effect-backdrop-blur-lg",
					"text-text-light",
					"shadow-3d",
					"p-0",
					"overflow-hidden",
					className
				)}
			>
				{/* Header */}
				<DialogHeader className="px-6 pt-6 pb-4">
					<div className="flex items-center justify-between">
						<div>
							<DialogTitle className="flex items-center gap-2 text-text-light text-xl">
								<Sparkles className="h-5 w-5 text-blue-400" />
								Add Block
							</DialogTitle>
							<DialogDescription className="mt-1 text-text-light/70">
								Create a new node or use a template to build your assurance case
							</DialogDescription>
						</div>

						{/* Mode Toggles */}
						<div className="flex gap-2">
							{enableQuickMode && (
								<Button
									className="text-xs"
									onClick={() => {
										const newMode = mode === "quick" ? "standard" : "quick";
										setMode(newMode);
										setDialogMode(newMode);
									}}
									size="sm"
									variant={mode === "quick" ? "default" : "ghost"}
								>
									<Zap className="mr-1 h-3 w-3" />
									Quick Mode
								</Button>
							)}
						</div>
					</div>
				</DialogHeader>

				{/* Main Content */}
				<div className="flex flex-1 overflow-hidden">
					{/* Left Panel - Selection */}
					<div className="flex w-[380px] flex-col border-border-transparent border-r">
						{/* Tabs */}
						<Tabs
							className="flex flex-1 flex-col"
							onValueChange={setActiveTab}
							value={activeTab}
						>
							<TabsList className="mx-6 mb-2 bg-background-transparent-white-hover">
								<TabsTrigger className="flex-1" value="types">
									<Layers className="mr-2 h-4 w-4" />
									Node Types
								</TabsTrigger>
								{enableTemplates && (
									<TabsTrigger className="flex-1" value="templates">
										<Star className="mr-2 h-4 w-4" />
										Templates
									</TabsTrigger>
								)}
							</TabsList>

							{/* Node Types Tab */}
							<TabsContent
								className="m-0 flex flex-1 flex-col overflow-hidden px-6"
								value="types"
							>
								{/* Search */}
								<div className="relative mb-4">
									<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-text-light/50" />
									<input
										className={cn(
											"w-full py-2 pr-4 pl-10",
											"bg-background-transparent-white-hover",
											"border border-transparent",
											"rounded-lg",
											"text-sm text-text-light",
											"placeholder:text-text-light/50",
											"focus:outline-hidden focus:ring-2 focus:ring-blue-500/50"
										)}
										onChange={(e) => setSearchQuery(e.target.value)}
										placeholder="Search node types..."
										ref={searchInputRef}
										type="text"
										value={searchQuery}
									/>
								</div>

								{/* Node Type List */}
								<ScrollArea className="flex-1">
									<div className="space-y-4 pr-2 pb-4">
										{/* Recent Types */}
										{recentTypes.length > 0 && !searchQuery && (
											<div>
												<div className="mb-2 flex items-center gap-2 font-semibold text-text-light/50 text-xs uppercase tracking-wider">
													<Clock className="h-3 w-3" />
													Recent
												</div>
												<div className="space-y-2">
													{recentTypes.map((type) => (
														<NodeTypeCard
															isFavorite={false}
															isRecent={true}
															isSelected={selectedNodeType === type}
															key={type}
															metadata={nodeTypeMetadata[type]}
															onClick={() => handleSelectNodeType(type)}
														/>
													))}
												</div>
												<Separator className="my-4 bg-border-transparent" />
											</div>
										)}

										{/* Categorized Types */}
										{Object.entries(categorizedTypes).map(
											([category, types]) => (
												<div key={category}>
													<div className="mb-2 font-semibold text-text-light/50 text-xs uppercase tracking-wider">
														{category}
													</div>
													<div className="space-y-2">
														{types
															.filter((meta) => filteredTypes.includes(meta.id))
															.map((meta) => (
																<NodeTypeCard
																	isFavorite={favoriteTypes.includes(meta.id)}
																	isRecent={recentTypes.includes(meta.id)}
																	isSelected={selectedNodeType === meta.id}
																	key={meta.id}
																	metadata={meta}
																	onClick={() => handleSelectNodeType(meta.id)}
																/>
															))}
													</div>
												</div>
											)
										)}
									</div>
								</ScrollArea>
							</TabsContent>

							{/* Templates Tab */}
							{enableTemplates && (
								<TabsContent
									className="m-0 flex-1 overflow-hidden px-6"
									value="templates"
								>
									<BlockTemplates
										onSelectTemplate={handleSelectTemplate}
										selectedTemplate={selectedTemplate}
									/>
								</TabsContent>
							)}
						</Tabs>
					</div>

					{/* Right Panel - Form & Preview */}
					<div className="flex flex-1 flex-col overflow-hidden">
						<div className="flex-1 overflow-auto px-6 py-4">
							{renderRightPanelContent()}
						</div>
					</div>
				</div>

				{/* Footer */}
				<DialogFooter className="border-border-transparent border-t px-6 py-4">
					<div className="flex w-full items-center justify-between">
						{/* Help Link */}
						<Button
							className="text-text-light/70 hover:text-text-light"
							onClick={() => window.open("/docs/nodes", "_blank")}
							size="sm"
							variant="ghost"
						>
							<HelpCircle className="mr-2 h-4 w-4" />
							Learn about nodes
						</Button>

						{/* Actions */}
						<div className="flex gap-2">
							<Button onClick={handleClose} variant="ghost">
								Cancel
							</Button>
							{enableBulkMode && mode === "bulk" ? (
								<Button
									className="bg-blue-600 hover:bg-blue-700"
									onClick={handleBulkAdd}
								>
									<Check className="mr-2 h-4 w-4" />
									Add {bulkCount} Nodes
								</Button>
							) : (
								<Button
									className="bg-blue-600 hover:bg-blue-700"
									onClick={handleAdd}
								>
									<Check className="mr-2 h-4 w-4" />
									Add Block
								</Button>
							)}
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

/**
 * Compact Add Block Dialog Props
 */
type CompactAddBlockDialogProps = {
	open: boolean;
	onClose: () => void;
	onAdd: (nodeData: AddNodeData) => void;
	position?: Position | null;
};

/**
 * Compact Add Block Dialog (minimal version)
 */
export const CompactAddBlockDialog = ({
	open,
	onClose,
	onAdd,
	position,
}: CompactAddBlockDialogProps): ReactNode => (
	<AddBlockDialog
		className="h-[60vh] max-w-2xl"
		enableBulkMode={false}
		enableQuickMode={true}
		enableTemplates={false}
		onAdd={onAdd}
		onClose={onClose}
		open={open}
		position={position}
	/>
);

export default AddBlockDialog;
