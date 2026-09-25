/**
 * Quiz questions for Module: 03-letting-the-tea-steep
 *
 * Used by the unified Quiz component on the assessment page.
 */

import type { Question, QuizConfig } from "@/types/curriculum";

export const steepingQuestions: Question[] = [
	{
		id: "q1",
		type: "multiple-choice",
		question: "Why begin a case before the end of a project?",
		options: [
			{
				id: "a",
				text: "It can guide reflection and evidence generation while decisions are open",
			},
			{ id: "b", text: "It guarantees approval for deployment" },
			{ id: "c", text: "It removes the need for stakeholder engagement" },
		],
		correctAnswer: "a",
		explanation:
			"The developing case can shape action while decisions are still open.",
	},
	{
		id: "q2",
		type: "multiple-choice",
		question: "Which statement is a principle rather than a specified action?",
		options: [
			{
				id: "a",
				text: "Test dataset coverage for the groups affected by shortlisting",
			},
			{ id: "b", text: "The system should be fair" },
			{ id: "c", text: "Record how the recruitment data was gathered" },
		],
		correctAnswer: "b",
		explanation:
			"Fairness is a starting goal that needs project-specific meaning and actions.",
	},
	{
		id: "q3",
		type: "multiple-choice",
		question:
			"What comes after identifying relevant principles in the operationalisation sequence?",
		options: [
			{ id: "a", text: "Publish the case immediately" },
			{ id: "b", text: "Weigh their importance for this project" },
			{ id: "c", text: "Mark every claim Asserted" },
		],
		correctAnswer: "b",
		explanation:
			"Weighing makes the project's priorities and trade-offs explicit before specification.",
	},
	{
		id: "q4",
		type: "multiple-choice",
		question:
			"Why consult prison staff and social researchers in the prison example?",
		options: [
			{ id: "a", text: "To replace technical testing with opinion" },
			{ id: "b", text: "To obtain an automatic platform score" },
			{
				id: "c",
				text: "To expose use-setting constraints and possible harms the project team may miss",
			},
		],
		correctAnswer: "c",
		explanation:
			"Different forms of expertise improve the questions and the eventual argument.",
	},
	{
		id: "q5",
		type: "multiple-choice",
		question: "What does specifying fairness for the prison example require?",
		options: [
			{
				id: "a",
				text: "State the particular fairness concerns and actions to examine",
			},
			{ id: "b", text: "Assume one statistical metric settles all interests" },
			{ id: "c", text: "Copy the word fairness into every node" },
		],
		correctAnswer: "a",
		explanation:
			"A principle becomes useful when it is precise enough to guide decisions in context.",
	},
	{
		id: "q6",
		type: "multiple-choice",
		question:
			"How should you treat a claim whose expected audit does not yet exist?",
		options: [
			{ id: "a", text: "Invent a report reference so the diagram is complete" },
			{
				id: "b",
				text: "Mark the support gap and plan the work that would produce evidence",
			},
			{ id: "c", text: "Publish the claim as a verified result" },
		],
		correctAnswer: "b",
		explanation:
			"The case should expose a gap rather than conceal missing evidence.",
	},
	{
		id: "q7",
		type: "multiple-choice",
		question:
			"What if explainability and confidentiality pull in different directions?",
		options: [
			{ id: "a", text: "Hide the conflict from the case" },
			{
				id: "b",
				text: "Record the interests, reasons and chosen trade-off for review",
			},
			{ id: "c", text: "Assume the platform resolves it automatically" },
		],
		correctAnswer: "b",
		explanation:
			"Transparent deliberation and revision make the choice open to review.",
	},
];

/**
 * Quiz configuration for the 03-letting-the-tea-steep knowledge check.
 */
export const steepingQuiz: QuizConfig = {
	id: "knowledge-check",
	title: "Knowledge Check",
	questions: steepingQuestions,
	passThreshold: 60,
	showFeedback: true,
	allowRetry: true,
	shuffleOptions: false,
};
