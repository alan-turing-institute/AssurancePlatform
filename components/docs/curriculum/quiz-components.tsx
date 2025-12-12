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
	MultipleChoiceQuizProps,
	QuizQuestion,
	TrueFalseQuizProps,
	TrueFalseStatement,
} from "@/types/curriculum";
import { useModuleProgress } from "./module-progress-context";

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
 * Get border class for true/false statement based on revealed state
 */
const getStatementBorderClass = (
	isRevealed: boolean,
	isCorrect: boolean
): string => {
	if (!isRevealed) {
		return "border-gray-200 dark:border-gray-600";
	}
	if (isCorrect) {
		return "border-green-400 bg-green-50 dark:bg-green-900/20";
	}
	return "border-red-400 bg-red-50 dark:bg-red-900/20";
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

// ============================================
// Quiz Results Component (extracted)
// ============================================

type QuizResultsProps = {
	score: number;
	total: number;
	questions: QuizQuestion[];
	selectedAnswers: Record<string, string>;
	showFeedback: boolean;
	allowRetry: boolean;
	onRetry: () => void;
};

const QuizResults = ({
	score,
	total,
	questions,
	selectedAnswers,
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
					<QuizFeedbackList
						questions={questions}
						selectedAnswers={selectedAnswers}
					/>
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
// Quiz Feedback List Component (extracted)
// ============================================

type QuizFeedbackListProps = {
	questions: QuizQuestion[];
	selectedAnswers: Record<string, string>;
};

const QuizFeedbackList = ({
	questions,
	selectedAnswers,
}: QuizFeedbackListProps): React.ReactNode => (
	<div className="mx-auto mb-6 max-w-2xl space-y-4 text-left">
		{questions.map((q, idx) => {
			const userAnswer = selectedAnswers[q.id];
			const isCorrect = userAnswer === q.correctAnswer;

			return (
				<div className="rounded-lg border p-4" key={q.id}>
					<div className="flex items-start gap-2">
						{isCorrect ? (
							<CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
						) : (
							<XCircle className="mt-0.5 h-5 w-5 text-red-500" />
						)}
						<div className="flex-1">
							<p className="mb-2 font-medium">
								{idx + 1}. {q.question}
							</p>
							<p className="text-gray-600 text-sm dark:text-gray-400">
								Your answer:{" "}
								{q.options.find((o) => o.id === userAnswer)?.text ||
									"Not answered"}
							</p>
							{!isCorrect && (
								<p className="mt-1 text-green-600 text-sm dark:text-green-400">
									Correct answer:{" "}
									{q.options.find((o) => o.id === q.correctAnswer)?.text}
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
// True/False Statement Item (extracted)
// ============================================

type StatementItemProps = {
	statement: TrueFalseStatement;
	index: number;
	userAnswer: boolean | undefined;
	isRevealed: boolean;
	isCorrect: boolean;
	disabled: boolean;
	showExplanations: boolean;
	onAnswer: (id: string, value: boolean) => void;
};

const StatementItem = ({
	statement,
	index,
	userAnswer,
	isRevealed,
	isCorrect,
	disabled,
	showExplanations,
	onAnswer,
}: StatementItemProps): React.ReactNode => (
	<div
		className={`rounded-lg border p-4 ${getStatementBorderClass(isRevealed, isCorrect)}`}
		key={statement.id}
	>
		<div className="flex items-start gap-3">
			<span className="font-semibold text-gray-500">{index + 1}.</span>
			<div className="flex-1">
				<p className="mb-3">{statement.statement}</p>
				<div className="flex gap-3">
					<button
						className={`rounded-md px-4 py-2 transition-colors ${
							userAnswer === true
								? "bg-blue-600 text-white"
								: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
						}`}
						disabled={disabled}
						onClick={() => onAnswer(statement.id, true)}
						type="button"
					>
						True
					</button>
					<button
						className={`rounded-md px-4 py-2 transition-colors ${
							userAnswer === false
								? "bg-blue-600 text-white"
								: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
						}`}
						disabled={disabled}
						onClick={() => onAnswer(statement.id, false)}
						type="button"
					>
						False
					</button>
				</div>

				<AnimatePresence>
					{isRevealed && (
						<motion.div
							animate={{ height: "auto", opacity: 1 }}
							className="mt-3 overflow-hidden"
							exit={{ height: 0, opacity: 0 }}
							initial={{ height: 0, opacity: 0 }}
						>
							<div className="flex items-start gap-2">
								{isCorrect ? (
									<CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
								) : (
									<XCircle className="mt-0.5 h-5 w-5 text-red-500" />
								)}
								<div>
									<p className="font-medium text-sm">
										{isCorrect
											? "Correct!"
											: `Incorrect. The answer is ${statement.correct ? "True" : "False"}.`}
									</p>
									{showExplanations && statement.explanation && (
										<p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
											{statement.explanation}
										</p>
									)}
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	</div>
);

// ============================================
// Multiple Choice Quiz Component
// ============================================

export const MultipleChoiceQuiz = ({
	questions = [],
	onComplete,
	showFeedback = true,
	allowRetry = true,
	shuffleOptions = false,
	taskId = "multiple-choice-quiz",
	useGlobalProgress = false,
	passThreshold = 60,
}: MultipleChoiceQuizProps): React.ReactNode => {
	const contextProgress = useSafeProgress(useGlobalProgress);
	const [currentQuestion, setCurrentQuestion] = useState(0);
	const [selectedAnswers, setSelectedAnswers] = useState<
		Record<string, string>
	>({});
	const [showResults, setShowResults] = useState(false);
	const [score, setScore] = useState(0);
	const [shuffleKey, setShuffleKey] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: shuffleKey triggers re-shuffle on retry
	const shuffledQuestions = useMemo(
		() =>
			questions.map((q) => ({
				...q,
				options: shuffleArray(q.options, shuffleOptions),
			})),
		[questions, shuffleOptions, shuffleKey]
	);

	const handleAnswer = useCallback((questionId: string, optionId: string) => {
		setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
	}, []);

	const calculateScore = useCallback(() => {
		let correct = 0;
		for (const q of shuffledQuestions) {
			if (selectedAnswers[q.id] === q.correctAnswer) {
				correct++;
			}
		}
		setScore(correct);
		setShowResults(true);

		const percentage = Math.round((correct / shuffledQuestions.length) * 100);

		if (contextProgress && percentage >= passThreshold) {
			contextProgress.completeTask(taskId);
		}

		onComplete?.({
			score: correct,
			total: shuffledQuestions.length,
			percentage,
			passed: percentage >= passThreshold,
		});
	}, [
		shuffledQuestions,
		selectedAnswers,
		contextProgress,
		passThreshold,
		taskId,
		onComplete,
	]);

	const handleNext = useCallback(() => {
		if (currentQuestion < shuffledQuestions.length - 1) {
			setCurrentQuestion((prev) => prev + 1);
		} else {
			calculateScore();
		}
	}, [currentQuestion, shuffledQuestions.length, calculateScore]);

	const handlePrevious = useCallback(() => {
		if (currentQuestion > 0) {
			setCurrentQuestion((prev) => prev - 1);
		}
	}, [currentQuestion]);

	const resetQuiz = useCallback(() => {
		setCurrentQuestion(0);
		setSelectedAnswers({});
		setShowResults(false);
		setScore(0);
		setShuffleKey((k) => k + 1);
	}, []);

	if (shuffledQuestions.length === 0) {
		return <div>No questions available</div>;
	}

	if (showResults) {
		return (
			<QuizResults
				allowRetry={allowRetry}
				onRetry={resetQuiz}
				questions={shuffledQuestions}
				score={score}
				selectedAnswers={selectedAnswers}
				showFeedback={showFeedback}
				total={shuffledQuestions.length}
			/>
		);
	}

	const activeQuestion = shuffledQuestions[currentQuestion];
	const hasAnswered = selectedAnswers[activeQuestion.id] !== undefined;

	return (
		<div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
			<div className="mb-6">
				<div className="mb-2 flex items-center justify-between">
					<span className="font-medium text-gray-700 text-sm dark:text-gray-300">
						Question {currentQuestion + 1} of {shuffledQuestions.length}
					</span>
				</div>
				<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
					<motion.div
						animate={{
							width: `${((currentQuestion + 1) / shuffledQuestions.length) * 100}%`,
						}}
						className="h-2 rounded-full bg-linear-to-r from-blue-500 to-purple-600"
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
					key={currentQuestion}
				>
					<h3 className="mb-4 flex items-start gap-2 font-semibold text-lg">
						<HelpCircle className="mt-0.5 h-5 w-5 text-blue-500" />
						{activeQuestion.question}
					</h3>

					<div className="space-y-3">
						{activeQuestion.options.map((option) => {
							const isSelected =
								selectedAnswers[activeQuestion.id] === option.id;
							return (
								<button
									className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
										isSelected
											? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
											: "border-gray-200 hover:border-gray-300 dark:border-gray-600"
									}`}
									key={option.id}
									onClick={() => handleAnswer(activeQuestion.id, option.id)}
									type="button"
								>
									<div className="flex items-center gap-3">
										<div
											className={`h-4 w-4 rounded-full border-2 ${
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
				</motion.div>
			</AnimatePresence>

			<div className="mt-6 flex items-center justify-between">
				<button
					className={`flex items-center gap-2 rounded-md px-4 py-2 ${
						currentQuestion === 0
							? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"
							: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
					}`}
					disabled={currentQuestion === 0}
					onClick={handlePrevious}
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
					onClick={handleNext}
					type="button"
				>
					{currentQuestion === shuffledQuestions.length - 1 ? "Finish" : "Next"}
					<ArrowRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
};

// ============================================
// True/False Quiz Component
// ============================================

export const TrueFalseQuiz = ({
	statements = [],
	onComplete,
	showExplanations = true,
	taskId = "true-false-quiz",
	useGlobalProgress = false,
	passThreshold = 60,
}: TrueFalseQuizProps): React.ReactNode => {
	const contextProgress = useSafeProgress(useGlobalProgress);
	const [answers, setAnswers] = useState<Record<string, boolean>>({});
	const [revealed, setRevealed] = useState<Record<string, boolean>>({});
	const [completed, setCompleted] = useState(false);

	const handleAnswer = useCallback((statementId: string, value: boolean) => {
		setAnswers((prev) => ({ ...prev, [statementId]: value }));
		setRevealed((prev) => ({ ...prev, [statementId]: true }));
	}, []);

	const calculateResults = useCallback(() => {
		const correct = statements.filter(
			(s) => answers[s.id] === s.correct
		).length;
		const percentage = Math.round((correct / statements.length) * 100);
		setCompleted(true);

		if (contextProgress && percentage >= passThreshold) {
			contextProgress.completeTask(taskId);
		}

		onComplete?.({
			score: correct,
			total: statements.length,
			percentage,
			passed: percentage >= passThreshold,
		});
	}, [statements, answers, contextProgress, passThreshold, taskId, onComplete]);

	const reset = useCallback(() => {
		setAnswers({});
		setRevealed({});
		setCompleted(false);
	}, []);

	const allAnswered = statements.every((s) => answers[s.id] !== undefined);

	return (
		<div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
			<h3 className="mb-4 font-bold text-xl">True or False?</h3>

			<div className="space-y-4">
				{statements.map((statement, idx) => (
					<StatementItem
						disabled={completed}
						index={idx}
						isCorrect={answers[statement.id] === statement.correct}
						isRevealed={revealed[statement.id] ?? false}
						key={statement.id}
						onAnswer={handleAnswer}
						showExplanations={showExplanations}
						statement={statement}
						userAnswer={answers[statement.id]}
					/>
				))}
			</div>

			<div className="mt-6 flex gap-3">
				{!completed && (
					<button
						className={`rounded-md px-6 py-2 ${
							allAnswered
								? "bg-blue-600 text-white hover:bg-blue-700"
								: "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"
						}`}
						disabled={!allAnswered}
						onClick={calculateResults}
						type="button"
					>
						Check Answers
					</button>
				)}
				{completed && (
					<button
						className="rounded-md bg-gray-200 px-6 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
						onClick={reset}
						type="button"
					>
						Try Again
					</button>
				)}
			</div>
		</div>
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

// ============================================
// Example Data
// ============================================

export const exampleQuizData = {
	multipleChoice: [
		{
			id: "mc-1",
			question: "What is the top-level element in an assurance case?",
			options: [
				{ id: "a", text: "Evidence" },
				{ id: "b", text: "Strategy" },
				{ id: "c", text: "Goal" },
				{ id: "d", text: "Context" },
			],
			correctAnswer: "c",
			explanation:
				"The goal represents the main claim that the assurance case is trying to establish.",
		},
		{
			id: "mc-2",
			question: "Which element provides concrete proof for property claims?",
			options: [
				{ id: "a", text: "Evidence" },
				{ id: "b", text: "Strategy" },
				{ id: "c", text: "Goal" },
				{ id: "d", text: "Context" },
			],
			correctAnswer: "a",
			explanation:
				"Evidence provides the concrete facts, test results, or documentation that supports property claims.",
		},
	] satisfies QuizQuestion[],
	trueFalse: [
		{
			id: "tf-1",
			statement: "Strategies connect goals directly to evidence.",
			correct: false,
			explanation:
				"Strategies connect goals to property claims, which are then supported by evidence.",
		},
		{
			id: "tf-2",
			statement:
				"Context defines the boundaries and assumptions of the assurance case.",
			correct: true,
			explanation:
				"Context elements explicitly state the scope, assumptions, and conditions under which the goal is claimed to be satisfied.",
		},
	] satisfies TrueFalseStatement[],
};

export default { MultipleChoiceQuiz, TrueFalseQuiz, ConfidenceRating };
