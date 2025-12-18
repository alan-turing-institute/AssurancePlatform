"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	ArrowRight,
	Award,
	CheckCircle,
	HelpCircle,
	RefreshCw,
	Target,
	TrendingUp,
	XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type {
	ConfidenceRatingProps,
	MultipleChoiceQuestion,
	Question,
	QuizConfig,
	QuizProps,
	TrueFalseQuestion,
} from "@/types/curriculum";
import { useModuleProgress } from "./module-progress-context";

// ============================================
// Type Guards
// ============================================

/**
 * Type guard for multiple choice questions
 */
const isMultipleChoice = (q: Question): q is MultipleChoiceQuestion =>
	q.type === "multiple-choice";

// ============================================
// Helper Functions
// ============================================

/**
 * Get result icon based on score percentage
 */
const getResultIcon = (percentage: number): React.ReactNode => {
	if (percentage >= 80) {
		return <Award className="mx-auto mb-4 h-16 w-16 text-yellow-500" />;
	}
	if (percentage >= 60) {
		return <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />;
	}
	return <AlertCircle className="mx-auto mb-4 h-16 w-16 text-orange-500" />;
};

/**
 * Get result message based on score percentage
 */
const getResultMessage = (percentage: number): string => {
	if (percentage >= 80) {
		return "Excellent!";
	}
	if (percentage >= 60) {
		return "Good Job!";
	}
	return "Keep Learning!";
};

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
const shuffleArray = <T,>(array: T[], shouldShuffle: boolean): T[] => {
	if (!shouldShuffle) {
		return array;
	}
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
};

/**
 * Try to get progress context safely (returns null if not available)
 */
type ProgressContextType = ReturnType<typeof useModuleProgress> | null;

const useSafeProgress = (enabled: boolean): ProgressContextType => {
	// Always call hooks unconditionally
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
 * Normalise config input to QuizConfig
 */
const normaliseConfig = (config: QuizConfig | Question[]): QuizConfig => {
	if (Array.isArray(config)) {
		return {
			id: "quiz",
			questions: config,
		};
	}
	return config;
};

/**
 * Determine the effective mode based on question types
 */
const determineMode = (
	questions: Question[],
	requestedMode: "sequential" | "all-at-once" | "auto"
): "sequential" | "all-at-once" => {
	if (requestedMode !== "auto") {
		return requestedMode;
	}
	// Auto mode: use all-at-once for pure true/false, sequential otherwise
	const allTrueFalse = questions.every((q) => q.type === "true-false");
	return allTrueFalse ? "all-at-once" : "sequential";
};

/**
 * Calculate score from answers
 */
const calculateScore = (
	questions: Question[],
	answers: Record<string, string | boolean>
): number =>
	questions.filter((q) => {
		if (isMultipleChoice(q)) {
			return answers[q.id] === q.correctAnswer;
		}
		return answers[q.id] === q.correct;
	}).length;

/**
 * Check if an answer is correct for a given question
 */
const isAnswerCorrect = (
	question: Question,
	answer: string | boolean | undefined
): boolean => {
	if (answer === undefined) {
		return false;
	}
	if (isMultipleChoice(question)) {
		return answer === question.correctAnswer;
	}
	return answer === question.correct;
};

/**
 * Get the text to display for a question
 */
const getQuestionText = (question: Question): string => {
	if (isMultipleChoice(question)) {
		return question.question;
	}
	return question.statement;
};

/**
 * Get the correct answer text for display
 */
const getCorrectAnswerText = (question: Question): string => {
	if (isMultipleChoice(question)) {
		const correctOption = question.options.find(
			(o) => o.id === question.correctAnswer
		);
		return correctOption?.text ?? "Unknown";
	}
	return question.correct ? "True" : "False";
};

/**
 * Get the user's answer text for display
 */
const getUserAnswerText = (
	question: Question,
	answer: string | boolean | undefined
): string => {
	if (answer === undefined) {
		return "Not answered";
	}
	if (isMultipleChoice(question)) {
		const selectedOption = question.options.find((o) => o.id === answer);
		return selectedOption?.text ?? "Unknown";
	}
	return answer ? "True" : "False";
};

// ============================================
// Quiz Results Component
// ============================================

type QuizResultsProps = {
	score: number;
	total: number;
	questions: Question[];
	answers: Record<string, string | boolean>;
	showFeedback: boolean;
	allowRetry: boolean;
	onRetry: () => void;
};

const QuizResults = ({
	score,
	total,
	questions,
	answers,
	showFeedback,
	allowRetry,
	onRetry,
}: QuizResultsProps): React.ReactNode => {
	const percentage = Math.round((score / total) * 100);

	return (
		<motion.div
			animate={{ opacity: 1, scale: 1 }}
			className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800"
			initial={{ opacity: 0, scale: 0.95 }}
		>
			<div className="text-center">
				{getResultIcon(percentage)}
				<h2 className="mb-2 font-bold text-2xl">
					{getResultMessage(percentage)}
				</h2>
				<p className="mb-6 text-gray-600 text-lg dark:text-gray-400">
					You scored {score} out of {total} ({percentage}%)
				</p>

				{showFeedback && (
					<QuizFeedbackList answers={answers} questions={questions} />
				)}

				{allowRetry && (
					<button
						className="mx-auto flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
						onClick={onRetry}
						type="button"
					>
						<RefreshCw className="h-4 w-4" />
						Try Again
					</button>
				)}
			</div>
		</motion.div>
	);
};

// ============================================
// Quiz Feedback List Component
// ============================================

type QuizFeedbackListProps = {
	questions: Question[];
	answers: Record<string, string | boolean>;
};

const QuizFeedbackList = ({
	questions,
	answers,
}: QuizFeedbackListProps): React.ReactNode => (
	<div className="mx-auto mb-6 max-w-2xl space-y-4 text-left">
		{questions.map((q, idx) => {
			const userAnswer = answers[q.id];
			const isCorrect = isAnswerCorrect(q, userAnswer);

			return (
				<div className="rounded-lg border p-4" key={q.id}>
					<div className="flex items-start gap-2">
						{isCorrect ? (
							<CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
						) : (
							<XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
						)}
						<div className="flex-1">
							<p className="mb-2 font-medium">
								{idx + 1}. {getQuestionText(q)}
							</p>
							<p className="text-gray-600 text-sm dark:text-gray-400">
								Your answer: {getUserAnswerText(q, userAnswer)}
							</p>
							{!isCorrect && (
								<p className="mt-1 text-green-600 text-sm dark:text-green-400">
									Correct answer: {getCorrectAnswerText(q)}
								</p>
							)}
							{q.explanation && (
								<p className="mt-2 text-gray-500 text-sm italic dark:text-gray-400">
									{q.explanation}
								</p>
							)}
						</div>
					</div>
				</div>
			);
		})}
	</div>
);

// ============================================
// Multiple Choice Question Renderer
// ============================================

type MultipleChoiceRendererProps = {
	question: MultipleChoiceQuestion;
	selectedAnswer: string | undefined;
	onAnswer: (optionId: string) => void;
	disabled: boolean;
	shuffleOptions: boolean;
	shuffleKey: number;
};

const MultipleChoiceRenderer = ({
	question,
	selectedAnswer,
	onAnswer,
	disabled,
	shuffleOptions,
	shuffleKey,
}: MultipleChoiceRendererProps): React.ReactNode => {
	// biome-ignore lint/correctness/useExhaustiveDependencies: shuffleKey triggers re-shuffle on retry
	const shuffledOptions = useMemo(
		() => shuffleArray(question.options, shuffleOptions),
		[question.options, shuffleOptions, shuffleKey]
	);

	return (
		<div>
			<h3 className="mb-4 flex items-start gap-2 font-semibold text-lg">
				<HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
				{question.question}
			</h3>

			<div className="space-y-3">
				{shuffledOptions.map((option) => {
					const isSelected = selectedAnswer === option.id;
					return (
						<button
							className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
								isSelected
									? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
									: "border-gray-200 hover:border-gray-300 dark:border-gray-600"
							} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
							disabled={disabled}
							key={option.id}
							onClick={() => !disabled && onAnswer(option.id)}
							type="button"
						>
							<div className="flex items-center gap-3">
								<div
									className={`h-4 w-4 shrink-0 rounded-full border-2 ${
										isSelected
											? "border-blue-500 bg-blue-500"
											: "border-gray-400"
									}`}
								>
									{isSelected && (
										<div className="h-full w-full scale-50 rounded-full bg-white" />
									)}
								</div>
								<span className="flex-1">{option.text}</span>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
};

// ============================================
// True/False Question Renderer
// ============================================

type TrueFalseRendererProps = {
	question: TrueFalseQuestion;
	selectedAnswer: boolean | undefined;
	onAnswer: (value: boolean) => void;
	disabled: boolean;
};

const TrueFalseRenderer = ({
	question,
	selectedAnswer,
	onAnswer,
	disabled,
}: TrueFalseRendererProps): React.ReactNode => (
	<div>
		<h3 className="mb-4 flex items-start gap-2 font-semibold text-lg">
			<HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
			{question.statement}
		</h3>

		<div className="flex gap-3">
			<button
				className={`rounded-md px-6 py-2 transition-colors ${
					selectedAnswer === true
						? "bg-blue-600 text-white"
						: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
				} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
				disabled={disabled}
				onClick={() => !disabled && onAnswer(true)}
				type="button"
			>
				True
			</button>
			<button
				className={`rounded-md px-6 py-2 transition-colors ${
					selectedAnswer === false
						? "bg-blue-600 text-white"
						: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
				} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
				disabled={disabled}
				onClick={() => !disabled && onAnswer(false)}
				type="button"
			>
				False
			</button>
		</div>
	</div>
);

// ============================================
// Sequential Quiz Mode Component
// ============================================

type SequentialQuizProps = {
	questions: Question[];
	title?: string;
	answers: Record<string, string | boolean>;
	currentIndex: number;
	shuffleKey: number;
	shuffleOptions: boolean;
	onAnswer: (questionId: string, answer: string | boolean) => void;
	onNext: () => void;
	onPrevious: () => void;
};

const SequentialQuiz = ({
	questions,
	title,
	answers,
	currentIndex,
	shuffleKey,
	shuffleOptions,
	onAnswer,
	onNext,
	onPrevious,
}: SequentialQuizProps): React.ReactNode => {
	const currentQuestion = questions[currentIndex];
	const hasAnswered = answers[currentQuestion.id] !== undefined;

	return (
		<div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
			{title && <h2 className="mb-4 font-bold text-xl">{title}</h2>}

			<div className="mb-6">
				<div className="mb-2 flex items-center justify-between">
					<span className="font-medium text-gray-700 text-sm dark:text-gray-300">
						Question {currentIndex + 1} of {questions.length}
					</span>
				</div>
				<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
					<motion.div
						animate={{
							width: `${((currentIndex + 1) / questions.length) * 100}%`,
						}}
						className="h-2 rounded-full bg-blue-600"
						initial={{ width: 0 }}
						transition={{ duration: 0.3 }}
					/>
				</div>
			</div>

			<AnimatePresence mode="wait">
				<motion.div
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -20 }}
					initial={{ opacity: 0, x: 20 }}
					key={currentIndex}
				>
					{isMultipleChoice(currentQuestion) ? (
						<MultipleChoiceRenderer
							disabled={false}
							onAnswer={(optionId) => onAnswer(currentQuestion.id, optionId)}
							question={currentQuestion}
							selectedAnswer={answers[currentQuestion.id] as string | undefined}
							shuffleKey={shuffleKey}
							shuffleOptions={shuffleOptions}
						/>
					) : (
						<TrueFalseRenderer
							disabled={false}
							onAnswer={(value) => onAnswer(currentQuestion.id, value)}
							question={currentQuestion}
							selectedAnswer={
								answers[currentQuestion.id] as boolean | undefined
							}
						/>
					)}
				</motion.div>
			</AnimatePresence>

			<div className="mt-6 flex items-center justify-between">
				<button
					className={`flex items-center gap-2 rounded-md px-4 py-2 ${
						currentIndex === 0
							? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"
							: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
					}`}
					disabled={currentIndex === 0}
					onClick={onPrevious}
					type="button"
				>
					Previous
				</button>

				<button
					className={`flex items-center gap-2 rounded-md px-4 py-2 ${
						hasAnswered
							? "bg-blue-600 text-white hover:bg-blue-700"
							: "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"
					}`}
					disabled={!hasAnswered}
					onClick={onNext}
					type="button"
				>
					{currentIndex === questions.length - 1 ? "Finish" : "Next"}
					<ArrowRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
};

// ============================================
// All-at-Once Quiz Mode Component
// ============================================

type AllAtOnceQuizProps = {
	questions: Question[];
	title?: string;
	answers: Record<string, string | boolean>;
	shuffleKey: number;
	shuffleOptions: boolean;
	onAnswer: (questionId: string, answer: string | boolean) => void;
	onComplete: () => void;
};

const AllAtOnceQuiz = ({
	questions,
	title,
	answers,
	shuffleKey,
	shuffleOptions,
	onAnswer,
	onComplete,
}: AllAtOnceQuizProps): React.ReactNode => {
	const allAnswered = questions.every((q) => answers[q.id] !== undefined);

	return (
		<div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
			{title && <h2 className="mb-4 font-bold text-xl">{title}</h2>}

			<div className="space-y-6">
				{questions.map((question, idx) => (
					<div
						className="rounded-lg border border-gray-200 p-4 dark:border-gray-600"
						key={question.id}
					>
						<div className="mb-2 font-medium text-gray-500 text-sm">
							Question {idx + 1}
						</div>
						{isMultipleChoice(question) ? (
							<MultipleChoiceRenderer
								disabled={false}
								onAnswer={(optionId) => onAnswer(question.id, optionId)}
								question={question}
								selectedAnswer={answers[question.id] as string | undefined}
								shuffleKey={shuffleKey}
								shuffleOptions={shuffleOptions}
							/>
						) : (
							<TrueFalseRenderer
								disabled={false}
								onAnswer={(value) => onAnswer(question.id, value)}
								question={question}
								selectedAnswer={answers[question.id] as boolean | undefined}
							/>
						)}
					</div>
				))}
			</div>

			<div className="mt-6">
				<button
					className={`w-full rounded-md px-6 py-2 ${
						allAnswered
							? "bg-blue-600 text-white hover:bg-blue-700"
							: "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"
					}`}
					disabled={!allAnswered}
					onClick={onComplete}
					type="button"
				>
					Check Answers
				</button>
			</div>
		</div>
	);
};

// ============================================
// Unified Quiz Component
// ============================================

export const Quiz = ({
	config,
	onComplete,
	taskId,
	useGlobalProgress = false,
	passThreshold,
	showFeedback,
	allowRetry,
	shuffleOptions,
	mode = "auto",
}: QuizProps): React.ReactNode => {
	const contextProgress = useSafeProgress(useGlobalProgress);
	const normalisedConfig = normaliseConfig(config);
	const questions = normalisedConfig.questions;

	const effectiveTaskId = taskId ?? normalisedConfig.id;
	const effectivePassThreshold =
		passThreshold ?? normalisedConfig.passThreshold ?? 60;
	const effectiveShowFeedback =
		showFeedback ?? normalisedConfig.showFeedback ?? true;
	const effectiveAllowRetry = allowRetry ?? normalisedConfig.allowRetry ?? true;
	const effectiveShuffle =
		shuffleOptions ?? normalisedConfig.shuffleOptions ?? false;
	const effectiveMode = determineMode(questions, mode);

	const [currentIndex, setCurrentIndex] = useState(0);
	const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
	const [showResults, setShowResults] = useState(false);
	const [score, setScore] = useState(0);
	const [shuffleKey, setShuffleKey] = useState(0);

	const handleAnswer = useCallback(
		(questionId: string, answer: string | boolean) => {
			setAnswers((prev) => ({ ...prev, [questionId]: answer }));
		},
		[]
	);

	const handleComplete = useCallback(() => {
		const finalScore = calculateScore(questions, answers);
		const percentage = Math.round((finalScore / questions.length) * 100);
		setScore(finalScore);
		setShowResults(true);

		if (contextProgress && percentage >= effectivePassThreshold) {
			contextProgress.completeTask(effectiveTaskId);
		}

		onComplete?.({
			score: finalScore,
			total: questions.length,
			percentage,
			passed: percentage >= effectivePassThreshold,
		});
	}, [
		questions,
		answers,
		contextProgress,
		effectivePassThreshold,
		effectiveTaskId,
		onComplete,
	]);

	const handleNext = useCallback(() => {
		if (currentIndex < questions.length - 1) {
			setCurrentIndex((prev) => prev + 1);
		} else {
			handleComplete();
		}
	}, [currentIndex, questions.length, handleComplete]);

	const handlePrevious = useCallback(() => {
		if (currentIndex > 0) {
			setCurrentIndex((prev) => prev - 1);
		}
	}, [currentIndex]);

	const handleRetry = useCallback(() => {
		setCurrentIndex(0);
		setAnswers({});
		setShowResults(false);
		setScore(0);
		setShuffleKey((k) => k + 1);
	}, []);

	if (questions.length === 0) {
		return <div>No questions available</div>;
	}

	if (showResults) {
		return (
			<QuizResults
				allowRetry={effectiveAllowRetry}
				answers={answers}
				onRetry={handleRetry}
				questions={questions}
				score={score}
				showFeedback={effectiveShowFeedback}
				total={questions.length}
			/>
		);
	}

	if (effectiveMode === "sequential") {
		return (
			<SequentialQuiz
				answers={answers}
				currentIndex={currentIndex}
				onAnswer={handleAnswer}
				onNext={handleNext}
				onPrevious={handlePrevious}
				questions={questions}
				shuffleKey={shuffleKey}
				shuffleOptions={effectiveShuffle}
				title={normalisedConfig.title}
			/>
		);
	}

	return (
		<AllAtOnceQuiz
			answers={answers}
			onAnswer={handleAnswer}
			onComplete={handleComplete}
			questions={questions}
			shuffleKey={shuffleKey}
			shuffleOptions={effectiveShuffle}
			title={normalisedConfig.title}
		/>
	);
};

// ============================================
// Confidence Rating Component
// ============================================

type ConfidenceLevel = {
	value: number;
	label: string;
	Icon: React.ComponentType<{ className?: string }>;
};

const confidenceLevels: ConfidenceLevel[] = [
	{ value: 1, label: "Not confident", Icon: XCircle },
	{ value: 2, label: "Slightly confident", Icon: AlertCircle },
	{ value: 3, label: "Moderately confident", Icon: Target },
	{ value: 4, label: "Confident", Icon: TrendingUp },
	{ value: 5, label: "Very confident", Icon: Award },
];

const confidenceFeedback: Record<number, string> = {
	1: "That's okay! This module is designed to help you build confidence step by step.",
	2: "You're on the right track. Keep exploring and you'll gain more confidence.",
	3: "Good progress! You have a solid foundation to build upon.",
	4: "Great! You have a strong understanding. Keep refining your knowledge.",
	5: "Excellent! You've mastered this concept. Consider helping others learn too!",
};

export const ConfidenceRating = ({
	topic,
	onSubmit,
	showFeedback = true,
	taskId = "confidence-rating",
	useGlobalProgress = false,
}: ConfidenceRatingProps): React.ReactNode => {
	const contextProgress = useSafeProgress(useGlobalProgress);
	const [rating, setRating] = useState<number | null>(null);
	const [submitted, setSubmitted] = useState(false);

	const handleSubmit = useCallback(() => {
		if (rating) {
			setSubmitted(true);
			contextProgress?.completeTask(taskId);
			onSubmit?.(rating);
		}
	}, [rating, contextProgress, taskId, onSubmit]);

	return (
		<div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
			<h3 className="mb-2 font-semibold text-lg">How confident do you feel?</h3>
			<p className="mb-4 text-gray-600 dark:text-gray-400">{topic}</p>

			<div className="mb-6 flex justify-center gap-2">
				{confidenceLevels.map((level) => {
					const { Icon } = level;
					const isSelected = rating === level.value;

					return (
						<button
							className={`flex-1 rounded-lg border-2 px-2 py-3 transition-all ${
								isSelected
									? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
									: "border-gray-200 hover:border-gray-300 dark:border-gray-600"
							} ${submitted ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
							disabled={submitted}
							key={level.value}
							onClick={() => !submitted && setRating(level.value)}
							type="button"
						>
							<Icon
								className={`mx-auto mb-1 h-8 w-8 ${isSelected ? "text-blue-600" : "text-gray-400"}`}
							/>
							<div className="text-center text-xs">{level.label}</div>
						</button>
					);
				})}
			</div>

			{!submitted && (
				<button
					className={`w-full rounded-md px-6 py-2 ${
						rating
							? "bg-blue-600 text-white hover:bg-blue-700"
							: "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"
					}`}
					disabled={!rating}
					onClick={handleSubmit}
					type="button"
				>
					Submit Rating
				</button>
			)}

			<AnimatePresence>
				{submitted && showFeedback && rating && (
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className="mt-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20"
						initial={{ opacity: 0, y: 20 }}
					>
						<div className="flex gap-3">
							<Award className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
							<p className="text-blue-800 text-sm dark:text-blue-200">
								{confidenceFeedback[rating]}
							</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default { Quiz, ConfidenceRating };
