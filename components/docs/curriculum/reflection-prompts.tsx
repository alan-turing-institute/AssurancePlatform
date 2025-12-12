"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	BookOpen,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Download,
	MessageSquare,
	Save,
	Send,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
	ReflectionPrompt,
	ReflectionPromptsProps,
} from "@/types/curriculum";
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
 * ReflectionPrompts - Guided reflection questions for learners
 *
 * Presents prompts one at a time with validation, auto-save,
 * and optional integration with ModuleProgressContext.
 */
const ReflectionPrompts = ({
	prompts = [],
	onSubmit,
	onSave,
	allowSkip = true,
	autoSave = false,
	showProgress = true,
	minResponseLength = 50,
	useGlobalProgress = false,
}: ReflectionPromptsProps): React.ReactNode => {
	const contextProgress = useSafeProgress(useGlobalProgress);
	const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
	const [responses, setResponses] = useState<Record<string, string>>({});
	const [currentResponse, setCurrentResponse] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [submitted, setSubmitted] = useState(false);
	const [savedNotification, setSavedNotification] = useState(false);

	// Load saved responses from localStorage if autoSave is enabled
	useEffect(() => {
		if (autoSave && typeof window !== "undefined") {
			const saved = localStorage.getItem("reflection-responses");
			if (saved) {
				setResponses(JSON.parse(saved) as Record<string, string>);
			}
		}
	}, [autoSave]);

	// Load current response when prompt changes
	useEffect(() => {
		const promptId = prompts[currentPromptIndex]?.id;
		setCurrentResponse(responses[promptId] || "");
		setErrors({});
	}, [currentPromptIndex, prompts, responses]);

	// Auto-save responses
	useEffect(() => {
		if (
			autoSave &&
			typeof window !== "undefined" &&
			Object.keys(responses).length > 0
		) {
			localStorage.setItem("reflection-responses", JSON.stringify(responses));
			setSavedNotification(true);
			const timer = setTimeout(() => setSavedNotification(false), 2000);
			return () => clearTimeout(timer);
		}
	}, [responses, autoSave]);

	const handleResponseChange = useCallback((value: string): void => {
		setCurrentResponse(value);
		setErrors({});
	}, []);

	const validateResponse = useCallback((): Record<string, string> => {
		const prompt = prompts[currentPromptIndex];
		const validationErrors: Record<string, string> = {};

		if (!allowSkip && currentResponse.trim().length === 0) {
			validationErrors.required = "A response is required";
		} else if (
			currentResponse.trim().length > 0 &&
			currentResponse.trim().length < minResponseLength
		) {
			validationErrors.length = `Please provide a more detailed response (minimum ${minResponseLength} characters)`;
		}

		if (prompt?.validation) {
			const validationResult = prompt.validation(currentResponse);
			if (validationResult !== true) {
				validationErrors.custom = validationResult;
			}
		}

		return validationErrors;
	}, [
		prompts,
		currentPromptIndex,
		allowSkip,
		currentResponse,
		minResponseLength,
	]);

	const saveCurrentResponse = useCallback((): boolean => {
		const validationErrors = validateResponse();
		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			return false;
		}

		const promptId = prompts[currentPromptIndex]?.id;
		if (!promptId) {
			return false;
		}

		setResponses((prev) => ({
			...prev,
			[promptId]: currentResponse.trim(),
		}));

		// Complete task in global context if enabled and response is provided
		if (contextProgress && currentResponse.trim().length > 0) {
			contextProgress.completeTask(promptId);
		}

		if (onSave) {
			onSave(promptId, currentResponse.trim());
		}

		return true;
	}, [
		validateResponse,
		prompts,
		currentPromptIndex,
		currentResponse,
		contextProgress,
		onSave,
	]);

	const handleSubmitAll = useCallback((): void => {
		if (saveCurrentResponse()) {
			const allResponses = {
				...responses,
				[prompts[currentPromptIndex]?.id || ""]: currentResponse.trim(),
			};

			// Check if all required prompts have responses
			const missingRequired = prompts
				.filter((p) => p.required)
				.find((p) => !allResponses[p.id] || allResponses[p.id].length === 0);

			if (missingRequired && !allowSkip) {
				setErrors({
					submit: `Please complete all required prompts. Missing: ${missingRequired.title}`,
				});
				return;
			}

			setSubmitted(true);
			if (onSubmit) {
				onSubmit(allResponses);
			}
		}
	}, [
		saveCurrentResponse,
		responses,
		prompts,
		currentPromptIndex,
		currentResponse,
		allowSkip,
		onSubmit,
	]);

	const handleNext = useCallback((): void => {
		if (saveCurrentResponse()) {
			if (currentPromptIndex < prompts.length - 1) {
				setCurrentPromptIndex((prev) => prev + 1);
			} else if (currentPromptIndex === prompts.length - 1) {
				handleSubmitAll();
			}
		}
	}, [
		saveCurrentResponse,
		currentPromptIndex,
		prompts.length,
		handleSubmitAll,
	]);

	const handlePrevious = useCallback((): void => {
		saveCurrentResponse();
		if (currentPromptIndex > 0) {
			setCurrentPromptIndex((prev) => prev - 1);
		}
	}, [saveCurrentResponse, currentPromptIndex]);

	const handleExport = useCallback((): void => {
		const exportData = {
			timestamp: new Date().toISOString(),
			responses,
			prompts: prompts.map((p) => ({
				id: p.id,
				title: p.title,
				question: p.question,
			})),
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `reflection-responses-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}, [responses, prompts]);

	const resetAll = useCallback((): void => {
		setResponses({});
		setCurrentResponse("");
		setCurrentPromptIndex(0);
		setSubmitted(false);
		setErrors({});
		if (autoSave && typeof window !== "undefined") {
			localStorage.removeItem("reflection-responses");
		}
	}, [autoSave]);

	if (prompts.length === 0) {
		return (
			<div className="rounded-lg bg-gray-100 p-6 text-center dark:bg-gray-800">
				<AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-400" />
				<p className="text-gray-600 dark:text-gray-400">
					No reflection prompts available
				</p>
			</div>
		);
	}

	if (submitted) {
		return (
			<motion.div
				animate={{ opacity: 1, scale: 1 }}
				className="rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800"
				initial={{ opacity: 0, scale: 0.95 }}
			>
				<CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
				<h3 className="mb-2 font-bold text-2xl">Reflections Submitted!</h3>
				<p className="mb-6 text-gray-600 dark:text-gray-400">
					Thank you for your thoughtful responses. Your reflections have been
					recorded.
				</p>
				<div className="flex justify-center gap-3">
					<button
						className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
						onClick={handleExport}
						type="button"
					>
						<Download className="h-4 w-4" />
						Export Responses
					</button>
					<button
						className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						onClick={resetAll}
						type="button"
					>
						Start Over
					</button>
				</div>
			</motion.div>
		);
	}

	const currentPrompt = prompts[currentPromptIndex];
	const progressPercentage = Math.round(
		((currentPromptIndex + 1) / prompts.length) * 100
	);
	const completedCount = Object.keys(responses).length;

	return (
		<div className="rounded-lg bg-white shadow-lg dark:bg-gray-800">
			{/* Header */}
			<div className="border-gray-200 border-b p-6 dark:border-gray-700">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="mb-1 flex items-center gap-2 font-bold text-2xl">
							<MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
							Reflection & Synthesis
						</h2>
						<p className="text-gray-600 dark:text-gray-400">
							Take a moment to reflect on what you've discovered
						</p>
					</div>
					{showProgress && (
						<div className="text-right">
							<div className="mb-1 text-gray-600 text-sm dark:text-gray-400">
								Question {currentPromptIndex + 1} of {prompts.length}
							</div>
							<div className="text-gray-500 text-xs">
								{completedCount} responses saved
							</div>
						</div>
					)}
				</div>

				{/* Progress Bar */}
				{showProgress && (
					<div className="mt-4">
						<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
							<motion.div
								animate={{ width: `${progressPercentage}%` }}
								className="h-2 rounded-full bg-linear-to-r from-blue-500 to-purple-600"
								initial={{ width: 0 }}
								transition={{ duration: 0.3 }}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Current Prompt */}
			<div className="p-6">
				<AnimatePresence mode="wait">
					<motion.div
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -20 }}
						initial={{ opacity: 0, x: 20 }}
						key={currentPromptIndex}
						transition={{ duration: 0.3 }}
					>
						{/* Prompt Category */}
						{currentPrompt?.category && (
							<div className="mb-3 inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 font-medium text-purple-700 text-xs dark:bg-purple-900/30 dark:text-purple-300">
								<BookOpen className="h-3 w-3" />
								{currentPrompt.category}
							</div>
						)}

						{/* Prompt Title */}
						<h3 className="mb-2 font-semibold text-lg">
							{currentPrompt?.title}
						</h3>

						{/* Prompt Question */}
						<p className="mb-4 text-gray-700 dark:text-gray-300">
							{currentPrompt?.question}
						</p>

						{/* Example Response */}
						{currentPrompt?.example && (
							<div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
								<p className="mb-1 font-medium text-gray-500 text-xs dark:text-gray-400">
									Example response:
								</p>
								<p className="text-gray-600 text-sm italic dark:text-gray-400">
									"{currentPrompt.example}"
								</p>
							</div>
						)}

						{/* Response Input */}
						<div className="relative">
							<textarea
								aria-label={`Response for ${currentPrompt?.title}`}
								className={`w-full resize-none rounded-lg border bg-white px-4 py-3 text-gray-900 transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100 ${
									errors.required || errors.length || errors.custom
										? "border-red-500"
										: "border-gray-300 dark:border-gray-600"
								}`}
								onChange={(e) => handleResponseChange(e.target.value)}
								placeholder="Type your reflection here..."
								rows={6}
								value={currentResponse}
							/>
							{currentResponse.length > 0 && (
								<div className="absolute right-2 bottom-2 text-gray-500 text-xs">
									{currentResponse.length} characters
								</div>
							)}
						</div>

						{/* Error Messages */}
						{Object.entries(errors).map(([key, error]) => (
							<div
								className="mt-2 flex items-center gap-1 text-red-600 text-sm dark:text-red-400"
								key={key}
							>
								<AlertCircle className="h-4 w-4" />
								{error}
							</div>
						))}

						{/* Required Indicator */}
						{currentPrompt?.required && !allowSkip && (
							<p className="mt-2 text-gray-500 text-xs dark:text-gray-400">
								* This prompt requires a response
							</p>
						)}
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Actions */}
			<div className="border-gray-200 border-t p-6 dark:border-gray-700">
				<div className="flex items-center justify-between">
					{/* Navigation */}
					<div className="flex gap-2">
						<button
							className={`flex items-center gap-2 rounded-md px-4 py-2 transition-colors ${
								currentPromptIndex === 0
									? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"
									: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
							}`}
							disabled={currentPromptIndex === 0}
							onClick={handlePrevious}
							type="button"
						>
							<ChevronLeft className="h-4 w-4" />
							Previous
						</button>
						{allowSkip && (
							<button
								className="px-4 py-2 text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
								onClick={handleNext}
								type="button"
							>
								Skip
							</button>
						)}
					</div>

					{/* Submit/Next */}
					<div className="flex items-center gap-3">
						{savedNotification && (
							<motion.div
								animate={{ opacity: 1, y: 0 }}
								className="flex items-center gap-1 text-green-600 text-xs dark:text-green-400"
								exit={{ opacity: 0, y: 10 }}
								initial={{ opacity: 0, y: 10 }}
							>
								<Save className="h-3 w-3" />
								Saved
							</motion.div>
						)}
						<button
							className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
							onClick={handleNext}
							type="button"
						>
							{currentPromptIndex === prompts.length - 1 ? (
								<>
									Submit All
									<Send className="h-4 w-4" />
								</>
							) : (
								<>
									Next
									<ChevronRight className="h-4 w-4" />
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

/**
 * Example prompts data
 */
export const exampleReflectionPrompts: ReflectionPrompt[] = [
	{
		id: "reflect-1",
		category: "Initial Understanding",
		title: "First Impressions",
		question:
			"What was your initial reaction when you first saw the Fair Recruitment AI assurance case? What stood out to you?",
		example:
			"I was surprised by how the argument was structured in layers, with each level providing more detail...",
		required: true,
	},
	{
		id: "reflect-2",
		category: "Structure Analysis",
		title: "Argument Flow",
		question:
			"How does the assurance case build its argument from the main goal down to the evidence? Can you describe the logical flow?",
		example:
			"The case starts with a broad fairness claim and systematically breaks it down into specific, measurable aspects...",
		required: true,
	},
	{
		id: "reflect-3",
		category: "Critical Thinking",
		title: "Strengths and Weaknesses",
		question:
			"What do you think are the strongest parts of this assurance case? Are there any areas that could be improved?",
		required: false,
	},
	{
		id: "reflect-4",
		category: "Application",
		title: "Real-World Relevance",
		question:
			"How might this type of structured argument be useful in your own work or field? Can you think of a specific application?",
		required: false,
	},
	{
		id: "reflect-5",
		category: "Synthesis",
		title: "Key Takeaways",
		question:
			"What are the three most important things you learned from exploring this assurance case?",
		required: true,
		validation: (response: string): true | string => {
			const lines = response
				.trim()
				.split("\n")
				.filter((l) => l.trim().length > 0);
			if (lines.length >= 3) {
				return true;
			}
			return "Please provide at least three key takeaways";
		},
	},
];

export default ReflectionPrompts;
