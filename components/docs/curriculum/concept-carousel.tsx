"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	ArrowRight,
	BookOpen,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	FileText,
	GitBranch,
	Info,
	Layers,
	Target,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
	Concept,
	ConceptCarouselProps,
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
 * Get icon component for a concept type
 */
const getConceptIcon = (
	type: ConceptType | string
): React.ComponentType<{ className?: string }> => conceptIcons[type] || Info;

/**
 * Get progress dot styling based on state
 */
const getProgressDotClass = (
	index: number,
	currentIndex: number,
	isViewed: boolean
): string => {
	if (index === currentIndex) {
		return "bg-blue-600 ring-2 ring-blue-400 ring-offset-2";
	}
	if (isViewed) {
		return "bg-blue-600";
	}
	return "bg-gray-200 dark:bg-gray-700";
};

/**
 * Slide animation variants for framer-motion
 */
const slideVariants = {
	enter: (direction: number) => ({
		x: direction > 0 ? 1000 : -1000,
		opacity: 0,
	}),
	center: {
		zIndex: 1,
		x: 0,
		opacity: 1,
	},
	exit: (direction: number) => ({
		zIndex: 0,
		x: direction < 0 ? 1000 : -1000,
		opacity: 0,
	}),
};

/**
 * ConceptCarousel - Modern carousel-based concept learning component
 *
 * Presents concepts one at a time in a focused, sequential manner.
 * Much more effective for learning than grid-based reveal.
 */
const ConceptCarousel = ({
	concepts = [],
	mode = "free",
	onComplete,
	onConceptView,
}: ConceptCarouselProps): React.ReactNode => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [viewedConcepts, setViewedConcepts] = useState<Set<number>>(
		new Set([0])
	);
	const [direction, setDirection] = useState(0);

	// Mark current concept as viewed
	useEffect(() => {
		if (!viewedConcepts.has(currentIndex)) {
			setViewedConcepts((prev) => new Set([...prev, currentIndex]));

			if (onConceptView && concepts[currentIndex]) {
				onConceptView(concepts[currentIndex].id, currentIndex);
			}
		}
	}, [currentIndex, onConceptView, viewedConcepts, concepts]);

	// Check if all concepts viewed
	useEffect(() => {
		if (viewedConcepts.size === concepts.length && onComplete) {
			onComplete();
		}
	}, [viewedConcepts, concepts.length, onComplete]);

	// Navigation handlers
	const goToNext = useCallback(() => {
		if (currentIndex < concepts.length - 1) {
			setDirection(1);
			setCurrentIndex((prev) => prev + 1);
		}
	}, [currentIndex, concepts.length]);

	const goToPrevious = useCallback(() => {
		if (currentIndex > 0) {
			setDirection(-1);
			setCurrentIndex((prev) => prev - 1);
		}
	}, [currentIndex]);

	const goToIndex = useCallback(
		(index: number) => {
			if (mode === "guided" && index > Math.max(...viewedConcepts)) {
				// In guided mode, can't skip ahead to unviewed concepts
				return;
			}

			setDirection(index > currentIndex ? 1 : -1);
			setCurrentIndex(index);
		},
		[mode, currentIndex, viewedConcepts]
	);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				e.preventDefault();
				goToNext();
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				e.preventDefault();
				goToPrevious();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [goToNext, goToPrevious]);

	if (concepts.length === 0) {
		return (
			<div className="py-8 text-center text-gray-500 dark:text-gray-400">
				No concepts to display
			</div>
		);
	}

	const currentConcept = concepts[currentIndex];
	const Icon = getConceptIcon(currentConcept.type);
	const canGoBack = currentIndex > 0;
	const canGoForward = currentIndex < concepts.length - 1;

	return (
		<div className="overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800">
			{/* Header with progress */}
			<div className="border-gray-200 border-b px-6 py-4 dark:border-gray-700">
				{/* Progress dots */}
				<div className="flex gap-2">
					{concepts.map((concept, index) => (
						<button
							aria-label={`Go to concept ${index + 1}`}
							className={`h-2 flex-1 rounded-full transition-all ${getProgressDotClass(index, currentIndex, viewedConcepts.has(index))} ${mode === "guided" && !viewedConcepts.has(index) ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-80"}`}
							disabled={mode === "guided" && !viewedConcepts.has(index)}
							key={concept.id}
							onClick={() => goToIndex(index)}
							type="button"
						/>
					))}
				</div>
			</div>

			{/* Carousel content */}
			<div className="relative min-h-[400px] overflow-hidden">
				<AnimatePresence custom={direction} initial={false}>
					<motion.div
						animate="center"
						className="absolute inset-0 p-6"
						custom={direction}
						exit="exit"
						initial="enter"
						key={currentIndex}
						transition={{
							x: { type: "spring", stiffness: 300, damping: 30 },
							opacity: { duration: 0.2 },
						}}
						variants={slideVariants}
					>
						<div className="h-full p-8">
							{/* Icon and title */}
							<div className="mb-4 flex items-start gap-4">
								<div className="text-blue-600 dark:text-blue-400">
									<Icon className="h-12 w-12" />
								</div>
								<div className="flex-1">
									<h3 className="font-bold text-3xl text-gray-900 dark:text-gray-100">
										{currentConcept.name}
									</h3>
								</div>
							</div>

							{/* Brief */}
							{currentConcept.brief && (
								<p className="mb-4 font-medium text-gray-600 text-lg dark:text-gray-400">
									{currentConcept.brief}
								</p>
							)}

							{/* Definition */}
							{currentConcept.definition && (
								<p className="mb-6 text-base text-gray-700 leading-relaxed dark:text-gray-300">
									{currentConcept.definition}
								</p>
							)}

							{/* Details */}
							{currentConcept.details && currentConcept.details.length > 0 && (
								<div className="mb-6">
									<h4 className="mb-3 font-semibold text-gray-700 text-sm dark:text-gray-300">
										Key Points
									</h4>
									<div className="space-y-2">
										{currentConcept.details.map((detail) => (
											<div
												className="flex items-start gap-2"
												key={`${currentConcept.id}-detail-${detail}`}
											>
												<ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
												<p className="text-gray-600 text-sm dark:text-gray-400">
													{detail}
												</p>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Example */}
							{currentConcept.example && (
								<div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
									<h4 className="mb-2 flex items-center gap-2 font-semibold text-gray-700 text-sm dark:text-gray-300">
										<BookOpen className="h-4 w-4" />
										Example
									</h4>
									<p className="text-gray-600 text-sm italic dark:text-gray-400">
										"{currentConcept.example}"
									</p>
								</div>
							)}

							{/* Relationships */}
							{currentConcept.relationships &&
								currentConcept.relationships.length > 0 && (
									<div>
										<h4 className="mb-2 flex items-center gap-2 font-semibold text-gray-700 text-sm dark:text-gray-300">
											<Layers className="h-4 w-4" />
											How it connects
										</h4>
										<div className="flex flex-wrap gap-2">
											{currentConcept.relationships.map((rel) => (
												<span
													className="rounded-full bg-gray-200 px-3 py-1 text-gray-700 text-xs dark:bg-gray-700 dark:text-gray-300"
													key={`${currentConcept.id}-rel-${rel}`}
												>
													{rel}
												</span>
											))}
										</div>
									</div>
								)}
						</div>
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Navigation footer */}
			<div className="border-gray-200 border-t px-6 py-4 dark:border-gray-700">
				<div className="flex items-center justify-end gap-2">
					<button
						aria-label="Previous concept"
						className={`rounded p-2 transition-colors ${
							canGoBack
								? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
								: "cursor-not-allowed bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600"
						}`}
						disabled={!canGoBack}
						onClick={goToPrevious}
						type="button"
					>
						<ChevronLeft className="h-5 w-5" />
					</button>

					<button
						aria-label="Next concept"
						className={`rounded p-2 transition-colors ${
							canGoForward
								? "bg-blue-600 text-white hover:bg-blue-700"
								: "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700"
						}`}
						disabled={!canGoForward}
						onClick={goToNext}
						type="button"
					>
						<ChevronRight className="h-5 w-5" />
					</button>
				</div>
			</div>
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

export default ConceptCarousel;
