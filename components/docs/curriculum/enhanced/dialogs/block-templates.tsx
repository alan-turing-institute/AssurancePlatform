"use client";

/**
 * Block Templates Component
 *
 * Pre-configured node templates for common assurance case patterns.
 * Provides template library with categories, visual previews, and usage stats.
 *
 * @component
 */

import { motion } from "framer-motion";
import {
	AlertCircle,
	Check,
	CheckCircle,
	Download,
	FileText,
	GitBranch,
	Info,
	Layers,
	type LucideIcon,
	Star,
	Target,
	TrendingUp,
	Upload,
} from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Template categories
 */
const TEMPLATE_CATEGORIES = {
	BASIC: "Basic",
	ADVANCED: "Advanced",
	CUSTOM: "Custom",
} as const;

type TemplateCategory =
	(typeof TEMPLATE_CATEGORIES)[keyof typeof TEMPLATE_CATEGORIES];

/**
 * Template node configuration type
 */
type TemplateNodeConfig = {
	type: string;
	name: string;
	description?: string;
	offsetX?: number;
	offsetY?: number;
};

/**
 * Template type
 */
export type Template = {
	id: string;
	name: string;
	description: string;
	category: TemplateCategory;
	nodes: TemplateNodeConfig[];
	usageCount?: number;
	icon: LucideIcon;
};

/**
 * Extended template library with more patterns
 */
const extendedTemplates: Template[] = [
	// Basic Templates
	{
		id: "simple-goal",
		name: "Simple Goal",
		description: "Single goal with strategy decomposition",
		category: TEMPLATE_CATEGORIES.BASIC,
		nodes: [
			{ type: "goal", name: "Main Goal", offsetY: 0 },
			{ type: "strategy", name: "Decomposition Strategy", offsetY: 150 },
		],
		usageCount: 142,
		icon: Target,
	},
	{
		id: "evidence-chain",
		name: "Evidence Chain",
		description: "Claim with supporting evidence",
		category: TEMPLATE_CATEGORIES.BASIC,
		nodes: [
			{ type: "propertyClaim", name: "Property Claim", offsetY: 0 },
			{ type: "evidence", name: "Supporting Evidence", offsetY: 150 },
		],
		usageCount: 98,
		icon: FileText,
	},
	{
		id: "context-pattern",
		name: "Context Pattern",
		description: "Goal with contextual information",
		category: TEMPLATE_CATEGORIES.BASIC,
		nodes: [
			{ type: "goal", name: "Goal", offsetY: 0 },
			{ type: "context", name: "Context/Assumption", offsetX: 200, offsetY: 0 },
		],
		usageCount: 76,
		icon: AlertCircle,
	},

	// Advanced Templates
	{
		id: "hierarchical-decomposition",
		name: "Hierarchical Decomposition",
		description: "Three-level goal decomposition with evidence",
		category: TEMPLATE_CATEGORIES.ADVANCED,
		nodes: [
			{ type: "goal", name: "Top-Level Goal", offsetY: 0 },
			{ type: "strategy", name: "AND Strategy", offsetY: 150 },
			{ type: "goal", name: "Sub-Goal 1", offsetX: -150, offsetY: 300 },
			{ type: "goal", name: "Sub-Goal 2", offsetX: 150, offsetY: 300 },
		],
		usageCount: 54,
		icon: GitBranch,
	},
	{
		id: "claim-evidence-set",
		name: "Claim-Evidence Set",
		description: "Property claim with multiple evidence items",
		category: TEMPLATE_CATEGORIES.ADVANCED,
		nodes: [
			{ type: "propertyClaim", name: "Main Claim", offsetY: 0 },
			{ type: "evidence", name: "Test Results", offsetX: -150, offsetY: 150 },
			{ type: "evidence", name: "Analysis Report", offsetX: 0, offsetY: 150 },
			{ type: "evidence", name: "Review Document", offsetX: 150, offsetY: 150 },
		],
		usageCount: 45,
		icon: CheckCircle,
	},
	{
		id: "contextualized-argument",
		name: "Contextualized Argument",
		description: "Complete argument with context and evidence",
		category: TEMPLATE_CATEGORIES.ADVANCED,
		nodes: [
			{ type: "goal", name: "System Goal", offsetY: 0 },
			{ type: "context", name: "System Context", offsetX: 250, offsetY: 0 },
			{ type: "strategy", name: "Argument Strategy", offsetY: 150 },
			{ type: "propertyClaim", name: "Property Claim", offsetY: 300 },
			{ type: "evidence", name: "Supporting Evidence", offsetY: 450 },
		],
		usageCount: 38,
		icon: Layers,
	},
];

/**
 * Template Card Component Props
 */
type TemplateCardProps = {
	template: Template;
	isSelected: boolean;
	isFavorite: boolean;
	onSelect: () => void;
	onToggleFavorite: () => void;
};

/**
 * Template Card Component
 */
const TemplateCard = ({
	template,
	isSelected,
	isFavorite,
	onSelect,
	onToggleFavorite,
}: TemplateCardProps): ReactNode => {
	const Icon = template.icon || Layers;

	return (
		<motion.button
			className={cn(
				"relative w-full rounded-lg p-4",
				"bg-background-transparent-white-hover",
				"hover:bg-background-transparent-white-secondaryHover",
				"border transition-all duration-200",
				"group text-left",
				isSelected
					? "border-purple-500/50 bg-background-transparent-white-secondaryHover ring-2 ring-purple-500/50"
					: "border-transparent"
			)}
			onClick={onSelect}
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
		>
			{/* Header */}
			<div className="mb-3 flex items-start justify-between">
				<div className="flex flex-1 items-start gap-3">
					{/* Icon */}
					<div className="flex-shrink-0 rounded-lg bg-purple-500/10 p-2">
						<Icon className="h-5 w-5 text-purple-400" />
					</div>

					{/* Info */}
					<div className="min-w-0 flex-1">
						<div className="mb-1 font-semibold text-sm text-text-light">
							{template.name}
						</div>
						<p className="line-clamp-2 text-text-light/70 text-xs">
							{template.description}
						</p>
					</div>
				</div>

				{/* Favorite Button */}
				<button
					className={cn(
						"flex-shrink-0 rounded p-1.5 transition-colors",
						isFavorite
							? "text-yellow-400 hover:text-yellow-300"
							: "text-text-light/30 hover:text-text-light/60"
					)}
					onClick={(e) => {
						e.stopPropagation();
						onToggleFavorite();
					}}
					type="button"
				>
					<Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
				</button>
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between">
				{/* Category Badge */}
				<Badge
					className={cn(
						"text-xs",
						template.category === TEMPLATE_CATEGORIES.BASIC &&
							"bg-green-500/20 text-green-400",
						template.category === TEMPLATE_CATEGORIES.ADVANCED &&
							"bg-blue-500/20 text-blue-400",
						template.category === TEMPLATE_CATEGORIES.CUSTOM &&
							"bg-purple-500/20 text-purple-400"
					)}
					variant="secondary"
				>
					{template.category}
				</Badge>

				{/* Stats */}
				<div className="flex items-center gap-3 text-text-light/50 text-xs">
					<div className="flex items-center gap-1">
						<Layers className="h-3 w-3" />
						<span>{template.nodes?.length || 0}</span>
					</div>
					{template.usageCount !== undefined && (
						<div className="flex items-center gap-1">
							<TrendingUp className="h-3 w-3" />
							<span>{template.usageCount}</span>
						</div>
					)}
				</div>
			</div>

			{/* Selected Indicator */}
			{isSelected && (
				<motion.div
					animate={{ scale: 1 }}
					className="absolute top-2 right-2 rounded-full bg-purple-500 p-1"
					initial={{ scale: 0 }}
				>
					<Check className="h-3 w-3 text-white" />
				</motion.div>
			)}
		</motion.button>
	);
};

/**
 * BlockTemplates Component Props
 */
type BlockTemplatesProps = {
	selectedTemplate?: Template | null;
	onSelectTemplate: (template: Template) => void;
	enableImportExport?: boolean;
};

/**
 * BlockTemplates Component
 */
const BlockTemplates = ({
	selectedTemplate,
	onSelectTemplate,
	enableImportExport = true,
}: BlockTemplatesProps): ReactNode => {
	const [templates, setTemplates] = useState<Template[]>(extendedTemplates);
	const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
	const [selectedCategory, setSelectedCategory] = useState<string>("all");

	// Load favorites from localStorage
	useEffect(() => {
		try {
			const stored = localStorage.getItem("tea_favorite_templates");
			if (stored) {
				setFavoriteIds(JSON.parse(stored) as string[]);
			}
		} catch (error) {
			console.warn("Failed to load favorite templates:", error);
		}
	}, []);

	// Save favorites to localStorage
	const saveFavorites = (ids: string[]): void => {
		try {
			localStorage.setItem("tea_favorite_templates", JSON.stringify(ids));
		} catch (error) {
			console.warn("Failed to save favorite templates:", error);
		}
	};

	// Toggle favorite
	const handleToggleFavorite = (templateId: string): void => {
		const newFavorites = favoriteIds.includes(templateId)
			? favoriteIds.filter((id) => id !== templateId)
			: [...favoriteIds, templateId];

		setFavoriteIds(newFavorites);
		saveFavorites(newFavorites);
	};

	// Filter templates by category
	const filteredTemplates = templates.filter((template) => {
		if (selectedCategory === "all") {
			return true;
		}
		if (selectedCategory === "favorites") {
			return favoriteIds.includes(template.id);
		}
		return template.category === selectedCategory;
	});

	// Sort templates: favorites first, then by usage
	const sortedTemplates = [...filteredTemplates].sort((a, b) => {
		const aFav = favoriteIds.includes(a.id);
		const bFav = favoriteIds.includes(b.id);
		if (aFav && !bFav) {
			return -1;
		}
		if (!aFav && bFav) {
			return 1;
		}
		return (b.usageCount || 0) - (a.usageCount || 0);
	});

	// Export templates
	const handleExport = (): void => {
		try {
			const data = JSON.stringify(templates, null, 2);
			const blob = new Blob([data], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "tea-templates.json";
			a.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Failed to export templates:", error);
		}
	};

	// Import templates
	const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const result = e.target?.result;
				if (typeof result === "string") {
					const imported = JSON.parse(result) as Template[];
					if (Array.isArray(imported)) {
						setTemplates([...templates, ...imported]);
					}
				}
			} catch (error) {
				console.error("Failed to import templates:", error);
			}
		};
		reader.readAsText(file);
	};

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="mb-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="font-semibold text-sm text-text-light">
						Template Library
					</div>
					{enableImportExport && (
						<div className="flex gap-1">
							<Button
								className="h-7 px-2 text-xs"
								onClick={handleExport}
								size="sm"
								variant="ghost"
							>
								<Download className="h-3 w-3" />
							</Button>
							<Button
								className="h-7 px-2 text-xs"
								onClick={() =>
									document.getElementById("template-import")?.click()
								}
								size="sm"
								variant="ghost"
							>
								<Upload className="h-3 w-3" />
							</Button>
							<input
								accept=".json"
								className="hidden"
								id="template-import"
								onChange={handleImport}
								type="file"
							/>
						</div>
					)}
				</div>

				{/* Category Filter */}
				<div className="flex gap-1 overflow-x-auto pb-2">
					{[
						"all",
						"favorites",
						TEMPLATE_CATEGORIES.BASIC,
						TEMPLATE_CATEGORIES.ADVANCED,
						TEMPLATE_CATEGORIES.CUSTOM,
					].map((category) => (
						<Button
							className={cn(
								"h-7 whitespace-nowrap px-3 text-xs",
								selectedCategory === category
									? "bg-purple-600 hover:bg-purple-700"
									: "hover:bg-background-transparent-white-hover"
							)}
							key={category}
							onClick={() => setSelectedCategory(category)}
							size="sm"
							variant={selectedCategory === category ? "default" : "ghost"}
						>
							{category === "all" && "All"}
							{category === "favorites" && (
								<>
									<Star className="mr-1 h-3 w-3 fill-current" />
									Favorites
								</>
							)}
							{category !== "all" && category !== "favorites" && category}
						</Button>
					))}
				</div>
			</div>

			{/* Templates List */}
			<ScrollArea className="flex-1 pr-2">
				<div className="space-y-2 pb-4">
					{sortedTemplates.length > 0 ? (
						sortedTemplates.map((template) => (
							<TemplateCard
								isFavorite={favoriteIds.includes(template.id)}
								isSelected={selectedTemplate?.id === template.id}
								key={template.id}
								onSelect={() => onSelectTemplate(template)}
								onToggleFavorite={() => handleToggleFavorite(template.id)}
								template={template}
							/>
						))
					) : (
						<div className="py-8 text-center text-text-light/50">
							<Layers className="mx-auto mb-3 h-12 w-12 opacity-50" />
							<p className="text-sm">No templates found</p>
							<p className="mt-1 text-xs">Try selecting a different category</p>
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Footer Info */}
			<div
				className={cn(
					"mt-4 rounded-lg p-3",
					"bg-background-transparent-white-hover",
					"border border-transparent"
				)}
			>
				<div className="flex items-start gap-2 text-text-light/70 text-xs">
					<Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
					<div>
						<p className="mb-1 font-medium text-text-light">About Templates</p>
						<p>
							Templates are pre-configured node patterns for common assurance
							case structures. Select a template to quickly create multiple
							connected nodes.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

/**
 * Template Stats Component Props
 */
type TemplateStatsProps = {
	templates?: Template[];
};

/**
 * Template Stats Component
 */
export const TemplateStats = ({
	templates = extendedTemplates,
}: TemplateStatsProps): ReactNode => {
	const totalTemplates = templates.length;
	const totalUsage = templates.reduce((sum, t) => sum + (t.usageCount || 0), 0);
	const categories = Object.values(TEMPLATE_CATEGORIES);

	return (
		<div className="grid grid-cols-3 gap-3">
			<div className="rounded-lg border border-transparent bg-background-transparent-white-hover p-3">
				<div className="font-bold text-2xl text-text-light">
					{totalTemplates}
				</div>
				<div className="text-text-light/60 text-xs">Templates</div>
			</div>
			<div className="rounded-lg border border-transparent bg-background-transparent-white-hover p-3">
				<div className="font-bold text-2xl text-text-light">{totalUsage}</div>
				<div className="text-text-light/60 text-xs">Total Uses</div>
			</div>
			<div className="rounded-lg border border-transparent bg-background-transparent-white-hover p-3">
				<div className="font-bold text-2xl text-text-light">
					{categories.length}
				</div>
				<div className="text-text-light/60 text-xs">Categories</div>
			</div>
		</div>
	);
};

export default BlockTemplates;
