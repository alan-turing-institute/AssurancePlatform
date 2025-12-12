"use client";

import { motion } from "framer-motion";
import {
	Award,
	BookOpen,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Circle,
	Lightbulb,
	Target,
} from "lucide-react";
import { useState } from "react";
import type {
	LearningObjective,
	LearningObjectivesProps,
} from "@/types/curriculum";

/**
 * Get background class for card variant based on completion state
 */
const getCardBackground = (isComplete: boolean): string => {
	if (isComplete) {
		return "bg-green-100 dark:bg-green-900/20";
	}
	return "bg-white dark:bg-gray-800";
};

/**
 * LearningObjectives - Display module learning objectives
 *
 * Can be used standalone or with progress tracking to show completion status.
 * Supports three display variants: card, list, and compact.
 */
const LearningObjectives = ({
	objectives = [],
	title = "Learning Objectives",
	showProgress = false,
	variant = "card",
	collapsible = false,
}: LearningObjectivesProps): React.ReactNode => {
	const [isExpanded, setIsExpanded] = useState(true);
	const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

	if (objectives.length === 0) {
		return null;
	}

	const toggleComplete = (id: string): void => {
		if (!showProgress) {
			return;
		}

		const newCompleted = new Set(completedIds);
		if (newCompleted.has(id)) {
			newCompleted.delete(id);
		} else {
			newCompleted.add(id);
		}
		setCompletedIds(newCompleted);
	};

	const completionPercentage = showProgress
		? Math.round((completedIds.size / objectives.length) * 100)
		: 0;

	// Compact variant - simple list
	if (variant === "compact") {
		return (
			<div className="my-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
				<div className="mb-3 flex items-center gap-2">
					<Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
					<h3 className="font-semibold text-blue-900 text-lg dark:text-blue-100">
						{title}
					</h3>
				</div>
				<ul className="space-y-2">
					{objectives.map((objective) => (
						<li className="flex items-start gap-2 text-sm" key={objective.id}>
							<span className="mt-0.5 text-blue-600 dark:text-blue-400">•</span>
							<span className="text-blue-900 dark:text-blue-100">
								{objective.text}
							</span>
						</li>
					))}
				</ul>
			</div>
		);
	}

	// List variant - simple checkable list
	if (variant === "list") {
		return (
			<div className="my-6">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
						<h3 className="font-semibold text-xl">{title}</h3>
					</div>
					{showProgress && (
						<span className="text-gray-600 text-sm dark:text-gray-400">
							{completedIds.size}/{objectives.length} completed
						</span>
					)}
				</div>
				<ul className="space-y-3">
					{objectives.map((objective) => {
						const isComplete = completedIds.has(objective.id);
						return (
							<li className="flex items-start gap-3" key={objective.id}>
								{showProgress ? (
									<button
										className="mt-0.5 transition-colors"
										onClick={() => toggleComplete(objective.id)}
										type="button"
									>
										{isComplete ? (
											<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
										) : (
											<Circle className="h-5 w-5 text-gray-400 hover:text-gray-600" />
										)}
									</button>
								) : (
									<Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
								)}
								<div className="flex-1">
									<p className={isComplete ? "text-gray-500 line-through" : ""}>
										{objective.text}
									</p>
									{objective.description && (
										<p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
											{objective.description}
										</p>
									)}
								</div>
							</li>
						);
					})}
				</ul>
			</div>
		);
	}

	// Card variant (default) - rich display with optional collapsing
	return (
		<div className="my-6 overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 dark:border-blue-800 dark:from-blue-900/20 dark:to-purple-900/20">
			{/* Header */}
			<div className="p-6">
				<div className="flex items-start justify-between">
					<div className="flex flex-1 items-start gap-3">
						<div className="rounded-lg bg-blue-600 p-2">
							<Target className="h-6 w-6 text-white" />
						</div>
						<div className="flex-1">
							<h3 className="mb-1 font-bold text-2xl text-gray-900 dark:text-gray-100">
								{title}
							</h3>
							<p className="text-gray-600 text-sm dark:text-gray-400">
								By the end of this module, you will be able to:
							</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						{showProgress && (
							<div className="text-right">
								<div className="font-bold text-2xl text-blue-600 dark:text-blue-400">
									{completionPercentage}%
								</div>
								<div className="text-gray-500 text-xs">complete</div>
							</div>
						)}
						{collapsible && (
							<button
								className="rounded-lg p-2 transition-colors hover:bg-white/50 dark:hover:bg-black/20"
								onClick={() => setIsExpanded(!isExpanded)}
								type="button"
							>
								{isExpanded ? (
									<ChevronUp className="h-5 w-5" />
								) : (
									<ChevronDown className="h-5 w-5" />
								)}
							</button>
						)}
					</div>
				</div>

				{/* Progress Bar */}
				{showProgress && (
					<div className="mt-4">
						<div className="h-2 w-full rounded-full bg-blue-200 dark:bg-blue-900">
							<motion.div
								animate={{ width: `${completionPercentage}%` }}
								className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
								initial={{ width: 0 }}
								transition={{ duration: 0.5, ease: "easeOut" }}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Objectives List */}
			{isExpanded && (
				<motion.div
					animate={{ height: "auto", opacity: 1 }}
					className="px-6 pb-6"
					exit={{ height: 0, opacity: 0 }}
					initial={{ height: 0, opacity: 0 }}
					transition={{ duration: 0.3 }}
				>
					<div className="space-y-4">
						{objectives.map((objective, idx) => {
							const isComplete = completedIds.has(objective.id);
							const Icon = objective.icon || BookOpen;

							return (
								<motion.div
									animate={{ opacity: 1, x: 0 }}
									className={`flex items-start gap-4 rounded-lg p-4 transition-all ${getCardBackground(isComplete)}`}
									initial={{ opacity: 0, x: -20 }}
									key={objective.id}
									transition={{ delay: idx * 0.1 }}
								>
									{showProgress ? (
										<button
											className="mt-0.5 flex-shrink-0 transition-colors"
											onClick={() => toggleComplete(objective.id)}
											type="button"
										>
											{isComplete ? (
												<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
											) : (
												<Circle className="h-6 w-6 text-gray-400 hover:text-gray-600" />
											)}
										</button>
									) : (
										<div className="flex-shrink-0 rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
											<Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
										</div>
									)}

									<div className="flex-1">
										<p
											className={`mb-1 font-medium ${
												isComplete
													? "text-gray-600 line-through dark:text-gray-400"
													: "text-gray-900 dark:text-gray-100"
											}`}
										>
											{objective.text}
										</p>
										{objective.description && (
											<p className="text-gray-600 text-sm dark:text-gray-400">
												{objective.description}
											</p>
										)}
										{objective.relatedTask && (
											<p className="mt-2 text-blue-600 text-xs dark:text-blue-400">
												Related: {objective.relatedTask}
											</p>
										)}
									</div>

									{objective.badge && (
										<div className="flex-shrink-0">
											<Award className="h-5 w-5 text-yellow-500" />
										</div>
									)}
								</motion.div>
							);
						})}
					</div>
				</motion.div>
			)}
		</div>
	);
};

/**
 * Example usage data structure
 */
export const exampleObjectives: LearningObjective[] = [
	{
		id: "obj-1",
		text: "Identify the key components of an assurance case",
		description: "Recognise goals, strategies, evidence, and context elements",
		icon: Target,
		relatedTask: "Exploration tasks 1-5",
	},
	{
		id: "obj-2",
		text: "Explain how structured arguments build trust",
		description: "Understand the logical flow from claims to evidence",
		icon: BookOpen,
		relatedTask: "Reflection prompts",
	},
	{
		id: "obj-3",
		text: "Evaluate the strength of assurance arguments",
		description: "Critically assess completeness and convincingness",
		icon: Lightbulb,
		relatedTask: "Assessment quiz",
	},
];

export default LearningObjectives;
