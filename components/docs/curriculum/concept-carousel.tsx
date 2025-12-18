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
	Target,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ConceptCarouselProps, ConceptType } from "@/types/curriculum";
import { useModuleProgress } from "./module-progress-context";

/**
 * Safe progress context hook - returns null if context not available
 */
type ProgressContextType = ReturnType<typeof useModuleProgress> | null;

const useSafeProgress = (enabled: boolean): ProgressContextType => {
	let progress: ProgressContextType = null;
	try {
		// biome-ignore lint/correctness/useHookAtTopLevel: Safe try-catch pattern for optional context
		progress = useModuleProgress();
	} catch {
		// Context not available
	}
	return enabled ? progress : null;
};

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
	taskId,
}: ConceptCarouselProps): React.ReactNode => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [viewedConcepts, setViewedConcepts] = useState<Set<number>>(
		new Set([0])
	);
	const [direction, setDirection] = useState(0);
	const [hasCompleted, setHasCompleted] = useState(false);

	// Get module progress context (may not be available if used outside provider)
	const moduleProgress = useSafeProgress(!!taskId);

	// Mark current concept as viewed
	useEffect(() => {
		if (!viewedConcepts.has(currentIndex)) {
			setViewedConcepts((prev) => new Set([...prev, currentIndex]));

			if (onConceptView && concepts[currentIndex]) {
				onConceptView(concepts[currentIndex].id, currentIndex);
			}
		}
	}, [currentIndex, onConceptView, viewedConcepts, concepts]);

	// Check if all concepts viewed and mark task complete
	useEffect(() => {
		if (
			viewedConcepts.size === concepts.length &&
			concepts.length > 0 &&
			!hasCompleted
		) {
			setHasCompleted(true);

			// Call the onComplete callback
			if (onComplete) {
				onComplete();
			}

			// Mark the task as complete in the progress tracker
			if (taskId && moduleProgress) {
				moduleProgress.completeTask(taskId);
			}
		}
	}, [
		viewedConcepts,
		concepts.length,
		onComplete,
		taskId,
		moduleProgress,
		hasCompleted,
	]);

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
			<div className="relative min-h-[400px]">
				<AnimatePresence custom={direction} initial={false} mode="wait">
					<motion.div
						animate="center"
						className="p-6"
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
						<div className="p-8">
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

							{/* Definition */}
							{currentConcept.definition && (
								<p className="mb-4 font-medium text-gray-600 text-lg dark:text-gray-400">
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
								<div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
									<h4 className="mb-2 flex items-center gap-2 font-semibold text-gray-700 text-sm dark:text-gray-300">
										<BookOpen className="h-4 w-4" />
										Example
									</h4>
									<p className="text-gray-600 text-sm italic dark:text-gray-400">
										"{currentConcept.example}"
									</p>
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

export default ConceptCarousel;
