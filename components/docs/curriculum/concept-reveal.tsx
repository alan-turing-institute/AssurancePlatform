"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	ArrowRight,
	BookOpen,
	CheckCircle,
	Eye,
	EyeOff,
	FileText,
	GitBranch,
	Info,
	Layers,
	Sparkles,
	Target,
	Zap,
} from "lucide-react";
import { createElement, useCallback, useEffect, useState } from "react";
import type {
	AnimationSpeed,
	Concept,
	ConceptRevealProps,
	ConceptType,
} from "@/types/curriculum";

/**
 * Icon map for concept types
 */
const conceptIcons: Record<
	ConceptType | string,
	React.ComponentType<{ className?: string }>
> = {
	goal: Target,
	strategy: GitBranch,
	property_claim: FileText,
	evidence: CheckCircle,
	context: AlertCircle,
	general: Info,
};

/**
 * Color scheme for concept types
 */
const conceptColors: Record<ConceptType | string, string> = {
	goal: "green",
	strategy: "purple",
	property_claim: "orange",
	evidence: "cyan",
	context: "gray",
	general: "blue",
};

/**
 * Animation speed mapping in milliseconds
 */
const speedMap: Record<AnimationSpeed, number> = {
	slow: 1000,
	normal: 500,
	fast: 250,
};

/**
 * Get icon component for a concept type
 */
const getConceptIcon = (
	type: ConceptType | string
): React.ComponentType<{ className?: string }> => conceptIcons[type] || Info;

/**
 * Get color scheme for a concept type
 */
const getConceptColors = (type: ConceptType | string): string =>
	conceptColors[type] || "blue";

/**
 * Get card border class based on selection and reveal state
 */
const getCardBorderClass = (
	isSelected: boolean,
	isRevealed: boolean
): string => {
	if (isSelected) {
		return "border-blue-500 bg-blue-50 shadow-lg dark:bg-blue-900/20";
	}
	if (isRevealed) {
		return "border-blue-300 bg-blue-50/50 hover:shadow-md dark:bg-blue-900/10";
	}
	return "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-900/50";
};

/**
 * ConceptReveal - Interactive concept discovery component
 *
 * Allows users to reveal and explore concepts through clicking.
 * Supports progressive reveal, show all, and interactive modes.
 */
const ConceptReveal = ({
	concepts = [],
	mode = "progressive",
	onConceptReveal,
	showDefinitions = true,
	animationSpeed = "normal",
}: ConceptRevealProps): React.ReactNode => {
	const [revealedConcepts, setRevealedConcepts] = useState<Set<string>>(
		new Set()
	);
	const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
	const [autoRevealIndex, setAutoRevealIndex] = useState(0);
	const [isAutoPlaying, setIsAutoPlaying] = useState(false);

	const animSpeed = speedMap[animationSpeed] || 500;

	// Auto-play progressive reveal
	useEffect(() => {
		if (
			mode === "progressive" &&
			isAutoPlaying &&
			autoRevealIndex < concepts.length
		) {
			const timer = setTimeout(() => {
				const conceptId = concepts[autoRevealIndex].id;
				setRevealedConcepts((prev) => new Set([...prev, conceptId]));
				setAutoRevealIndex((prev) => prev + 1);

				if (onConceptReveal) {
					onConceptReveal(conceptId);
				}
			}, animSpeed * 2);

			return () => clearTimeout(timer);
		}
		if (autoRevealIndex >= concepts.length) {
			setIsAutoPlaying(false);
		}
	}, [
		mode,
		isAutoPlaying,
		autoRevealIndex,
		concepts,
		animSpeed,
		onConceptReveal,
	]);

	const handleRevealConcept = useCallback(
		(conceptId: string) => {
			setRevealedConcepts((prev) => new Set([...prev, conceptId]));
			setSelectedConcept(concepts.find((c) => c.id === conceptId) || null);

			if (onConceptReveal) {
				onConceptReveal(conceptId);
			}
		},
		[concepts, onConceptReveal]
	);

	const handleHideConcept = useCallback(
		(conceptId: string) => {
			const newRevealed = new Set(revealedConcepts);
			newRevealed.delete(conceptId);
			setRevealedConcepts(newRevealed);
			if (selectedConcept?.id === conceptId) {
				setSelectedConcept(null);
			}
		},
		[revealedConcepts, selectedConcept]
	);

	const toggleAllConcepts = useCallback(() => {
		if (revealedConcepts.size === concepts.length) {
			setRevealedConcepts(new Set());
			setSelectedConcept(null);
		} else {
			setRevealedConcepts(new Set(concepts.map((c) => c.id)));
		}
	}, [revealedConcepts.size, concepts]);

	const startAutoPlay = useCallback(() => {
		setIsAutoPlaying(true);
		setAutoRevealIndex(0);
		setRevealedConcepts(new Set());
	}, []);

	const resetAll = useCallback(() => {
		setRevealedConcepts(new Set());
		setSelectedConcept(null);
		setAutoRevealIndex(0);
		setIsAutoPlaying(false);
	}, []);

	return (
		<div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
			{/* Header */}
			<div className="mb-6">
				<h2 className="mb-2 flex items-center gap-2 font-bold text-2xl">
					<Sparkles className="h-6 w-6 text-yellow-500" />
					Concept Discovery
				</h2>
				<p className="text-gray-600 dark:text-gray-400">
					Click on elements to reveal their definitions and understand their
					role
				</p>
			</div>

			{/* Controls */}
			<div className="mb-6 flex flex-wrap gap-2">
				{mode === "progressive" && (
					<button
						className={`flex items-center gap-2 rounded-md px-4 py-2 transition-colors ${
							isAutoPlaying
								? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"
								: "bg-blue-600 text-white hover:bg-blue-700"
						}`}
						disabled={isAutoPlaying}
						onClick={startAutoPlay}
						type="button"
					>
						<Zap className="h-4 w-4" />
						{isAutoPlaying ? "Playing..." : "Auto Reveal"}
					</button>
				)}
				<button
					className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
					onClick={toggleAllConcepts}
					type="button"
				>
					{revealedConcepts.size === concepts.length ? (
						<>
							<EyeOff className="h-4 w-4" />
							Hide All
						</>
					) : (
						<>
							<Eye className="h-4 w-4" />
							Reveal All
						</>
					)}
				</button>
				<button
					className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					onClick={resetAll}
					type="button"
				>
					Reset
				</button>
			</div>

			{/* Concepts Grid */}
			<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{concepts.map((concept, index) => {
					const isRevealed = revealedConcepts.has(concept.id);
					const isSelected = selectedConcept?.id === concept.id;
					const Icon = getConceptIcon(concept.type);

					return (
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							initial={{ opacity: 0, y: 20 }}
							key={concept.id}
							transition={{ delay: index * 0.1 }}
						>
							<button
								className={`w-full rounded-lg border-2 p-4 transition-all ${getCardBorderClass(isSelected, isRevealed)}`}
								onClick={() =>
									isRevealed
										? handleHideConcept(concept.id)
										: handleRevealConcept(concept.id)
								}
								type="button"
							>
								<div className="flex items-start gap-3">
									<div
										className={`mt-1 ${isRevealed ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}
									>
										<Icon className="h-5 w-5" />
									</div>
									<div className="flex-1 text-left">
										<h3
											className={`font-semibold ${
												isRevealed
													? "text-gray-900 dark:text-gray-100"
													: "text-gray-600 dark:text-gray-400"
											}`}
										>
											{concept.name}
										</h3>
										{concept.brief && (
											<p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
												{concept.brief}
											</p>
										)}
										<AnimatePresence>
											{isRevealed && showDefinitions && concept.definition && (
												<motion.div
													animate={{ height: "auto", opacity: 1 }}
													className="overflow-hidden"
													exit={{ height: 0, opacity: 0 }}
													initial={{ height: 0, opacity: 0 }}
													transition={{ duration: animSpeed / 1000 }}
												>
													<p className="mt-3 border-gray-200 border-t pt-3 text-gray-700 text-sm dark:border-gray-700 dark:text-gray-300">
														{concept.definition}
													</p>
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								</div>
							</button>
						</motion.div>
					);
				})}
			</div>

			{/* Detailed View */}
			<AnimatePresence>
				{selectedConcept && (
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className="border-gray-200 border-t pt-6 dark:border-gray-700"
						exit={{ opacity: 0, y: -20 }}
						initial={{ opacity: 0, y: 20 }}
					>
						<div className="rounded-lg bg-linear-to-r from-blue-50 to-purple-50 p-6 dark:from-blue-900/20 dark:to-purple-900/20">
							<div className="flex items-start gap-4">
								<div
									className={`text-${getConceptColors(selectedConcept.type)}-600 dark:text-${getConceptColors(selectedConcept.type)}-400`}
								>
									{createElement(getConceptIcon(selectedConcept.type), {
										className: "h-8 w-8",
									})}
								</div>
								<div className="flex-1">
									<h3 className="mb-2 font-bold text-xl">
										{selectedConcept.name}
									</h3>
									{selectedConcept.definition && (
										<p className="mb-4 text-gray-700 dark:text-gray-300">
											{selectedConcept.definition}
										</p>
									)}

									{/* Additional Details */}
									{selectedConcept.details && (
										<div className="space-y-3">
											{selectedConcept.details.map((detail) => (
												<div
													className="flex items-start gap-2"
													key={`${selectedConcept.id}-detail-${detail}`}
												>
													<ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
													<p className="text-gray-600 text-sm dark:text-gray-400">
														{detail}
													</p>
												</div>
											))}
										</div>
									)}

									{/* Example */}
									{selectedConcept.example && (
										<div className="mt-4 rounded-md bg-white p-4 dark:bg-gray-800">
											<h4 className="mb-2 flex items-center gap-2 font-semibold text-gray-700 text-sm dark:text-gray-300">
												<BookOpen className="h-4 w-4" />
												Example
											</h4>
											<p className="text-gray-600 text-sm italic dark:text-gray-400">
												"{selectedConcept.example}"
											</p>
										</div>
									)}

									{/* Relationships */}
									{selectedConcept.relationships && (
										<div className="mt-4">
											<h4 className="mb-2 flex items-center gap-2 font-semibold text-gray-700 text-sm dark:text-gray-300">
												<Layers className="h-4 w-4" />
												How it connects
											</h4>
											<div className="flex flex-wrap gap-2">
												{selectedConcept.relationships.map((rel) => (
													<span
														className="rounded-full bg-gray-200 px-3 py-1 text-gray-700 text-xs dark:bg-gray-700 dark:text-gray-300"
														key={`${selectedConcept.id}-rel-${rel}`}
													>
														{rel}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Progress Indicator */}
			{mode === "progressive" && (
				<div className="mt-6 border-gray-200 border-t pt-6 dark:border-gray-700">
					<div className="mb-2 flex items-center justify-between">
						<span className="text-gray-600 text-sm dark:text-gray-400">
							Concepts Revealed
						</span>
						<span className="font-medium text-gray-700 text-sm dark:text-gray-300">
							{revealedConcepts.size} / {concepts.length}
						</span>
					</div>
					<div className="flex gap-1">
						{concepts.map((concept) => (
							<div
								className={`h-2 flex-1 rounded-full transition-colors ${
									revealedConcepts.has(concept.id)
										? "bg-blue-500"
										: "bg-gray-200 dark:bg-gray-700"
								}`}
								key={concept.id}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

/**
 * Example concept data for demonstrations
 */
export const exampleConcepts: Concept[] = [
	{
		id: "concept-goal",
		type: "goal",
		name: "Goal",
		brief: "The main claim or objective",
		definition:
			"A goal represents the top-level claim that the assurance case is trying to establish. It states what needs to be assured.",
		details: [
			"Always appears at the top of the hierarchy",
			"Must be clear and unambiguous",
			"Defines the scope of the entire argument",
		],
		example:
			"The AI recruitment system makes fair and unbiased hiring recommendations",
		relationships: ["Supported by Strategies", "Scoped by Context"],
	},
	{
		id: "concept-strategy",
		type: "strategy",
		name: "Strategy",
		brief: "How we break down the argument",
		definition:
			"A strategy describes the approach used to argue that a goal is satisfied. It breaks down complex goals into manageable parts.",
		details: [
			"Divides goals into sub-arguments",
			"Provides the reasoning approach",
			"Can be argument by decomposition, by evidence, or by concretion",
		],
		example: "Argument through bias detection and mitigation measures",
		relationships: ["Links Goals to Claims", "Defines argument structure"],
	},
	{
		id: "concept-property-claim",
		type: "property_claim",
		name: "Property Claim",
		brief: "Specific, measurable assertions",
		definition:
			"Property claims are specific assertions that can be supported by evidence. They represent concrete, verifiable statements.",
		details: [
			"Must be testable or verifiable",
			"More specific than goals",
			"Directly linked to evidence",
		],
		example: "Training data has been audited and balanced to prevent bias",
		relationships: ["Supported by Evidence", "Implements Strategy"],
	},
	{
		id: "concept-evidence",
		type: "evidence",
		name: "Evidence",
		brief: "Concrete proof or documentation",
		definition:
			"Evidence provides the concrete facts, test results, or documentation that supports property claims.",
		details: [
			"Must be objective and verifiable",
			"Can include test results, audits, or analysis",
			"Provides the foundation for the argument",
		],
		example: "Data audit report showing demographic distribution",
		relationships: ["Supports Property Claims", "Grounds the argument"],
	},
	{
		id: "concept-context",
		type: "general",
		name: "Context",
		brief: "Scope and assumptions",
		definition:
			"Context defines the boundaries, assumptions, and conditions under which the goal is claimed to be satisfied. Context is stored as an attribute on nodes rather than as a separate element.",
		details: [
			"Sets boundaries for the argument",
			"States assumptions explicitly",
			"Clarifies definitions and scope",
		],
		example: "Fairness defined according to UK Equality Act 2010",
		relationships: ["Scopes Goals", "Defines boundaries"],
	},
];

export default ConceptReveal;
