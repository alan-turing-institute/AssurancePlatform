"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	Award,
	CheckCircle2,
	ChevronDown,
	Circle,
	HelpCircle,
	Lightbulb,
	Maximize2,
	Minimize2,
	Target,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { ModuleProgressContextValue } from "@/types/curriculum";
import { useModuleProgress } from "./module-progress-context";

type DisplayMode = "default" | "floating";

type SubItem = {
	id: string;
	title: string;
};

type ChecklistItemData = {
	id: string;
	title: string;
	description?: string;
	hint?: string;
	subItems?: SubItem[];
};

type ExplorationChecklistProps = {
	items?: ChecklistItemData[];
	onComplete?: () => void;
	onItemCheck?: (itemId: string, isChecked: boolean) => void;
	showProgress?: boolean;
	allowHints?: boolean;
	autoSave?: boolean;
	displayMode?: DisplayMode;
	useGlobalProgress?: boolean;
};

/**
 * Get task card class based on checked state
 */
const getTaskCardClass = (isChecked: boolean): string => {
	if (isChecked) {
		return "border-green-400 bg-green-50 dark:bg-green-900/20";
	}
	return "border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800";
};

/**
 * Safe hook to get progress context
 */
const useSafeProgress = (
	enabled: boolean
): ModuleProgressContextValue | null => {
	let contextProgress: ModuleProgressContextValue | null = null;
	try {
		if (enabled) {
			// biome-ignore lint/correctness/useHookAtTopLevel: Safe try-catch pattern for optional context
			contextProgress = useModuleProgress();
		}
	} catch {
		// Context not available, continue with local state
	}
	return contextProgress;
};

// ============================================
// Sub-components to reduce cognitive complexity
// ============================================

type CongratsModalProps = {
	showCongrats: boolean;
	onClose: () => void;
};

const CongratsModal = ({
	showCongrats,
	onClose,
}: CongratsModalProps): React.ReactNode => (
	<AnimatePresence>
		{showCongrats && (
			<motion.div
				animate={{ opacity: 1, scale: 1 }}
				className="fixed inset-0 z-50 flex items-center justify-center p-4"
				exit={{ opacity: 0, scale: 0.9 }}
				initial={{ opacity: 0, scale: 0.9 }}
				onClick={onClose}
			>
				<div className="absolute inset-0 bg-black/50" />
				<motion.div
					className="relative w-full max-w-md rounded-lg bg-white p-8 shadow-2xl dark:bg-gray-800"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="text-center">
						<Award className="mx-auto mb-4 h-16 w-16 text-yellow-500" />
						<h3 className="mb-2 font-bold text-2xl">Congratulations! 🎉</h3>
						<p className="mb-6 text-gray-600 dark:text-gray-400">
							You&apos;ve completed all the exploration tasks! You now have a
							solid understanding of the assurance case structure.
						</p>
						<button
							className="rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
							onClick={onClose}
							type="button"
						>
							Continue
						</button>
					</div>
				</motion.div>
			</motion.div>
		)}
	</AnimatePresence>
);

type HintSectionProps = {
	hint: string;
	itemId: string;
	isExpanded: boolean;
	onToggle: (id: string) => void;
	allowHints: boolean;
};

const HintSection = ({
	hint,
	itemId,
	isExpanded,
	onToggle,
	allowHints,
}: HintSectionProps): React.ReactNode => {
	if (!(allowHints && hint)) {
		return null;
	}

	return (
		<>
			<button
				className="ml-2 rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
				onClick={() => onToggle(itemId)}
				type="button"
			>
				<HelpCircle className="h-4 w-4 text-blue-500" />
			</button>
			<AnimatePresence>
				{isExpanded && (
					<motion.div
						animate={{ height: "auto", opacity: 1 }}
						className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
						exit={{ height: 0, opacity: 0 }}
						initial={{ height: 0, opacity: 0 }}
					>
						<div className="flex gap-2">
							<Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
							<p className="text-blue-800 text-sm dark:text-blue-200">{hint}</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
};

type ChecklistItemRowProps = {
	item: ChecklistItemData;
	isChecked: boolean;
	isHintExpanded: boolean;
	allowHints: boolean;
	onToggleItem: (id: string) => void;
	onToggleHint: (id: string) => void;
	checkedItems: Set<string>;
};

const ChecklistItemRow = ({
	item,
	isChecked,
	isHintExpanded,
	allowHints,
	onToggleItem,
	onToggleHint,
	checkedItems,
}: ChecklistItemRowProps): React.ReactNode => (
	<div
		className={`rounded-lg border p-4 transition-all ${getTaskCardClass(isChecked)}`}
	>
		<div className="flex items-start gap-3">
			<button
				className="mt-0.5 transition-colors"
				onClick={() => onToggleItem(item.id)}
				type="button"
			>
				{isChecked ? (
					<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
				) : (
					<Circle className="h-5 w-5 text-gray-400 hover:text-gray-600" />
				)}
			</button>

			<div className="flex-1">
				<div className="flex items-start justify-between">
					<div>
						<h3
							className={`font-medium ${
								isChecked
									? "text-gray-600 line-through dark:text-gray-400"
									: "text-gray-900 dark:text-gray-100"
							}`}
						>
							{item.title}
						</h3>
						{item.description && (
							<p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
								{item.description}
							</p>
						)}
					</div>

					{allowHints && item.hint && (
						<HintSection
							allowHints={allowHints}
							hint={item.hint}
							isExpanded={isHintExpanded}
							itemId={item.id}
							onToggle={onToggleHint}
						/>
					)}
				</div>

				{/* Sub-items */}
				{item.subItems && item.subItems.length > 0 && (
					<div className="mt-3 ml-6 space-y-2">
						{item.subItems.map((subItem) => {
							const isSubChecked = checkedItems.has(subItem.id);
							return (
								<div className="flex items-center gap-2" key={subItem.id}>
									<button
										aria-label={`Mark ${subItem.title} as ${isSubChecked ? "incomplete" : "complete"}`}
										onClick={() => onToggleItem(subItem.id)}
										type="button"
									>
										{isSubChecked ? (
											<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
										) : (
											<Circle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
										)}
									</button>
									<span
										className={`text-sm ${
											isSubChecked
												? "text-gray-500 line-through dark:text-gray-400"
												: "text-gray-700 dark:text-gray-300"
										}`}
									>
										{subItem.title}
									</span>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	</div>
);

type FloatingMinimizedProps = {
	checkedCount: number;
	totalCount: number;
	onExpand: () => void;
};

const FloatingMinimized = ({
	checkedCount,
	totalCount,
	onExpand,
}: FloatingMinimizedProps): React.ReactNode => (
	<motion.div
		animate={{ opacity: 1, y: 0 }}
		className="fixed right-6 bottom-6 z-50"
		initial={{ opacity: 0, y: 100 }}
	>
		<button
			className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
			onClick={onExpand}
			type="button"
		>
			<Target className="h-4 w-4" />
			<span className="font-medium text-sm">
				{checkedCount}/{totalCount} tasks
			</span>
		</button>
	</motion.div>
);

type FloatingCompactProps = {
	currentTask: { item: ChecklistItemData; index: number } | null;
	checkedCount: number;
	totalCount: number;
	progressPercentage: number;
	allowHints: boolean;
	expandedHints: Set<string>;
	onToggleHint: (id: string) => void;
	onToggleItem: (id: string) => void;
	onExpand: () => void;
	onMinimize: () => void;
	onDismiss: () => void;
};

const FloatingCompact = ({
	currentTask,
	checkedCount,
	totalCount,
	progressPercentage,
	allowHints,
	expandedHints,
	onToggleHint,
	onToggleItem,
	onExpand,
	onMinimize,
	onDismiss,
}: FloatingCompactProps): React.ReactNode => (
	<motion.div
		animate={{ opacity: 1, y: 0 }}
		className="fixed right-6 bottom-6 z-50 w-full max-w-md"
		initial={{ opacity: 0, y: 100 }}
	>
		<div className="rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
			{/* Header Bar */}
			<div className="flex items-center justify-between border-gray-200 border-b p-4 dark:border-gray-700">
				<div className="flex flex-1 items-center gap-3">
					<Target className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">
							<span className="font-medium">
								Task {currentTask ? currentTask.index + 1 : checkedCount} of{" "}
								{totalCount}
							</span>
							<span>•</span>
							<span>{progressPercentage}% complete</span>
						</div>
						{currentTask && (
							<h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">
								{currentTask.item.title}
							</h3>
						)}
						{!currentTask && checkedCount === totalCount && (
							<h3 className="font-semibold text-green-600 dark:text-green-400">
								All tasks complete! 🎉
							</h3>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1">
					<button
						aria-label="Expand checklist"
						className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
						onClick={onExpand}
						title="View all tasks"
						type="button"
					>
						<Maximize2 className="h-4 w-4" />
					</button>
					<button
						aria-label="Minimize checklist"
						className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
						onClick={onMinimize}
						title="Minimize"
						type="button"
					>
						<Minimize2 className="h-4 w-4" />
					</button>
					<button
						aria-label="Dismiss checklist"
						className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
						onClick={onDismiss}
						title="Dismiss"
						type="button"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Current Task Details */}
			{currentTask && (
				<div className="p-4">
					<p className="mb-3 text-gray-600 text-sm dark:text-gray-400">
						{currentTask.item.description}
					</p>

					{allowHints && currentTask.item.hint && (
						<div className="flex gap-2">
							<button
								className="flex items-center gap-2 text-blue-600 text-sm hover:underline dark:text-blue-400"
								onClick={() => onToggleHint(currentTask.item.id)}
								type="button"
							>
								<HelpCircle className="h-4 w-4" />
								{expandedHints.has(currentTask.item.id)
									? "Hide hint"
									: "Show hint"}
							</button>
						</div>
					)}

					<AnimatePresence>
						{allowHints &&
							currentTask.item.hint &&
							expandedHints.has(currentTask.item.id) && (
								<motion.div
									animate={{ height: "auto", opacity: 1 }}
									className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
									exit={{ height: 0, opacity: 0 }}
									initial={{ height: 0, opacity: 0 }}
								>
									<div className="flex gap-2">
										<Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
										<p className="text-blue-800 text-sm dark:text-blue-200">
											{currentTask.item.hint}
										</p>
									</div>
								</motion.div>
							)}
					</AnimatePresence>

					<button
						className="mt-3 rounded-md bg-green-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-green-700"
						onClick={() => onToggleItem(currentTask.item.id)}
						type="button"
					>
						Mark as Complete
					</button>
				</div>
			)}

			{/* Progress Bar */}
			<div className="px-4 pb-4">
				<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
					<motion.div
						animate={{ width: `${progressPercentage}%` }}
						className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
						initial={{ width: 0 }}
						transition={{ duration: 0.5, ease: "easeOut" }}
					/>
				</div>
			</div>
		</div>
	</motion.div>
);

type FloatingExpandedProps = {
	items: ChecklistItemData[];
	checkedItems: Set<string>;
	expandedHints: Set<string>;
	checkedCount: number;
	progressPercentage: number;
	allowHints: boolean;
	onToggleItem: (id: string) => void;
	onToggleHint: (id: string) => void;
	onCollapse: () => void;
	onReset: () => void;
};

const FloatingExpanded = ({
	items,
	checkedItems,
	expandedHints,
	checkedCount,
	progressPercentage,
	allowHints,
	onToggleItem,
	onToggleHint,
	onCollapse,
	onReset,
}: FloatingExpandedProps): React.ReactNode => (
	<>
		<motion.div
			animate={{ opacity: 1 }}
			className="fixed inset-0 z-50 bg-black/50"
			initial={{ opacity: 0 }}
			onClick={onCollapse}
		/>
		<motion.div
			animate={{ opacity: 1, y: 0 }}
			className="fixed right-0 bottom-0 left-0 z-50 max-h-[80vh] overflow-hidden"
			initial={{ opacity: 0, y: 100 }}
		>
			<div className="rounded-t-2xl bg-white shadow-2xl dark:bg-gray-800">
				{/* Header */}
				<div className="flex items-center justify-between border-gray-200 border-b p-6 dark:border-gray-700">
					<div>
						<h2 className="flex items-center gap-2 font-bold text-2xl">
							<Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
							Exploration Checklist
						</h2>
						<p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
							{checkedCount} of {items.length} completed ({progressPercentage}%)
						</p>
					</div>
					<button
						aria-label="Collapse checklist"
						className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
						onClick={onCollapse}
						type="button"
					>
						<ChevronDown className="h-6 w-6" />
					</button>
				</div>

				{/* Scrollable Content */}
				<div className="max-h-[60vh] overflow-y-auto p-6">
					{/* Progress Bar */}
					<div className="mb-6">
						<div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
							<motion.div
								animate={{ width: `${progressPercentage}%` }}
								className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
								initial={{ width: 0 }}
								transition={{ duration: 0.5, ease: "easeOut" }}
							/>
						</div>
					</div>

					{/* All Tasks */}
					<div className="space-y-3">
						{items.map((item) => (
							<ChecklistItemRow
								allowHints={allowHints}
								checkedItems={checkedItems}
								isChecked={checkedItems.has(item.id)}
								isHintExpanded={expandedHints.has(item.id)}
								item={item}
								key={item.id}
								onToggleHint={onToggleHint}
								onToggleItem={onToggleItem}
							/>
						))}
					</div>

					<div className="mt-6">
						<button
							className="rounded-md bg-gray-100 px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
							onClick={onReset}
							type="button"
						>
							Reset Progress
						</button>
					</div>
				</div>
			</div>
		</motion.div>
	</>
);

// ============================================
// Main Component
// ============================================

/**
 * ExplorationChecklist - Interactive checklist for exploration tasks
 *
 * Supports default inline mode and floating overlay mode
 * Integrates with ModuleProgressContext when enabled
 */
const ExplorationChecklist = ({
	items = [],
	onComplete,
	onItemCheck,
	showProgress = true,
	allowHints = true,
	autoSave = false,
	displayMode = "default",
	useGlobalProgress = false,
}: ExplorationChecklistProps): React.ReactNode => {
	const contextProgress = useSafeProgress(useGlobalProgress);

	const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
	const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());
	const [showCongrats, setShowCongrats] = useState(false);

	// Floating mode states
	const [isFloatingExpanded, setIsFloatingExpanded] = useState(false);
	const [isFloatingMinimized, setIsFloatingMinimized] = useState(false);
	const [isFloatingDismissed, setIsFloatingDismissed] = useState(false);

	// Load saved progress from localStorage if autoSave is enabled
	useEffect(() => {
		if (autoSave && typeof window !== "undefined") {
			const saved = localStorage.getItem("exploration-checklist-progress");
			if (saved) {
				setCheckedItems(new Set(JSON.parse(saved)));
			}
		}
	}, [autoSave]);

	// Save progress to localStorage
	useEffect(() => {
		if (autoSave && typeof window !== "undefined") {
			localStorage.setItem(
				"exploration-checklist-progress",
				JSON.stringify(Array.from(checkedItems))
			);
		}
	}, [checkedItems, autoSave]);

	// Check if all items are complete
	useEffect(() => {
		if (checkedItems.size === items.length && items.length > 0) {
			setShowCongrats(true);
			if (onComplete) {
				onComplete();
			}
		}
	}, [checkedItems, items.length, onComplete]);

	const toggleItem = useCallback(
		(itemId: string): void => {
			const newChecked = new Set(checkedItems);
			const isNowChecked = !newChecked.has(itemId);

			if (newChecked.has(itemId)) {
				newChecked.delete(itemId);
			} else {
				newChecked.add(itemId);
			}
			setCheckedItems(newChecked);

			// Integrate with global progress context if enabled
			if (contextProgress && isNowChecked) {
				contextProgress.completeTask(itemId);
			} else if (contextProgress && !isNowChecked) {
				contextProgress.resetTask(itemId);
			}

			if (onItemCheck) {
				onItemCheck(itemId, isNowChecked);
			}
		},
		[checkedItems, contextProgress, onItemCheck]
	);

	const toggleHint = useCallback(
		(itemId: string): void => {
			const newExpanded = new Set(expandedHints);
			if (newExpanded.has(itemId)) {
				newExpanded.delete(itemId);
			} else {
				newExpanded.add(itemId);
			}
			setExpandedHints(newExpanded);
		},
		[expandedHints]
	);

	const resetProgress = useCallback((): void => {
		setCheckedItems(new Set());
		setExpandedHints(new Set());
		setShowCongrats(false);
		if (autoSave && typeof window !== "undefined") {
			localStorage.removeItem("exploration-checklist-progress");
		}
	}, [autoSave]);

	const progressPercentage =
		items.length > 0 ? Math.round((checkedItems.size / items.length) * 100) : 0;

	const getCurrentTask = (): {
		item: ChecklistItemData;
		index: number;
	} | null => {
		const currentIndex = items.findIndex((item) => !checkedItems.has(item.id));
		return currentIndex >= 0
			? { item: items[currentIndex], index: currentIndex }
			: null;
	};

	const currentTask = getCurrentTask();
	const closeCongrats = useCallback(() => setShowCongrats(false), []);

	// Render floating mode
	if (displayMode === "floating") {
		if (isFloatingDismissed) {
			return null;
		}

		if (isFloatingMinimized) {
			return (
				<FloatingMinimized
					checkedCount={checkedItems.size}
					onExpand={() => setIsFloatingMinimized(false)}
					totalCount={items.length}
				/>
			);
		}

		if (!isFloatingExpanded) {
			return (
				<>
					<FloatingCompact
						allowHints={allowHints}
						checkedCount={checkedItems.size}
						currentTask={currentTask}
						expandedHints={expandedHints}
						onDismiss={() => setIsFloatingDismissed(true)}
						onExpand={() => setIsFloatingExpanded(true)}
						onMinimize={() => setIsFloatingMinimized(true)}
						onToggleHint={toggleHint}
						onToggleItem={toggleItem}
						progressPercentage={progressPercentage}
						totalCount={items.length}
					/>
					<CongratsModal onClose={closeCongrats} showCongrats={showCongrats} />
				</>
			);
		}

		return (
			<>
				<FloatingExpanded
					allowHints={allowHints}
					checkedCount={checkedItems.size}
					checkedItems={checkedItems}
					expandedHints={expandedHints}
					items={items}
					onCollapse={() => setIsFloatingExpanded(false)}
					onReset={resetProgress}
					onToggleHint={toggleHint}
					onToggleItem={toggleItem}
					progressPercentage={progressPercentage}
				/>
				<CongratsModal onClose={closeCongrats} showCongrats={showCongrats} />
			</>
		);
	}

	// Default mode rendering
	return (
		<div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
			{/* Header */}
			<div className="mb-6">
				<h2 className="mb-2 flex items-center gap-2 font-bold text-2xl">
					<Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
					Exploration Checklist
				</h2>
				<p className="text-gray-600 dark:text-gray-400">
					Complete these discovery tasks to understand the assurance case
					structure
				</p>
			</div>

			{/* Progress Bar */}
			{showProgress && (
				<div className="mb-6">
					<div className="mb-2 flex items-center justify-between">
						<span className="font-medium text-gray-700 text-sm dark:text-gray-300">
							Progress
						</span>
						<span className="font-medium text-gray-700 text-sm dark:text-gray-300">
							{checkedItems.size} of {items.length} completed (
							{progressPercentage}
							%)
						</span>
					</div>
					<div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
						<motion.div
							animate={{ width: `${progressPercentage}%` }}
							className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
							initial={{ width: 0 }}
							transition={{ duration: 0.5, ease: "easeOut" }}
						/>
					</div>
				</div>
			)}

			{/* Checklist Items */}
			<div className="space-y-3">
				{items.map((item, index) => (
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						initial={{ opacity: 0, y: 20 }}
						key={item.id}
						transition={{ delay: index * 0.1 }}
					>
						<ChecklistItemRow
							allowHints={allowHints}
							checkedItems={checkedItems}
							isChecked={checkedItems.has(item.id)}
							isHintExpanded={expandedHints.has(item.id)}
							item={item}
							onToggleHint={toggleHint}
							onToggleItem={toggleItem}
						/>
					</motion.div>
				))}
			</div>

			{/* Actions */}
			<div className="mt-6 flex gap-3">
				<button
					className="rounded-md bg-gray-100 px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					onClick={resetProgress}
					type="button"
				>
					Reset Progress
				</button>
			</div>

			<CongratsModal onClose={closeCongrats} showCongrats={showCongrats} />
		</div>
	);
};

/**
 * Example usage data structure
 */
export const exampleChecklistItems: ChecklistItemData[] = [
	{
		id: "task-1",
		title: "Find the main goal",
		description: "Locate the top-level goal that describes the overall claim",
		hint: "Look for the green node at the top of the diagram. It should describe fairness in AI recruitment.",
	},
	{
		id: "task-2",
		title: "Identify the three strategies",
		description: "Discover how the main goal is broken down into approaches",
		hint: "Purple nodes represent strategies. Each one addresses a different aspect of fairness.",
		subItems: [
			{ id: "task-2-1", title: "Find the bias detection strategy" },
			{ id: "task-2-2", title: "Find the transparency strategy" },
			{ id: "task-2-3", title: "Find the monitoring strategy" },
		],
	},
	{
		id: "task-3",
		title: "Explore the property claims",
		description: "Find the specific claims that support each strategy",
		hint: "Orange nodes are property claims. They make specific, measurable statements.",
	},
	{
		id: "task-4",
		title: "Locate the evidence",
		description: "Find what evidence supports the property claims",
		hint: "Cyan nodes represent evidence. They provide concrete proof for the claims.",
	},
	{
		id: "task-5",
		title: "Understand the context",
		description: "Identify the contextual information that scopes the case",
		hint: "Gray nodes provide context. They define important boundaries and definitions.",
	},
];

export default ExplorationChecklist;
