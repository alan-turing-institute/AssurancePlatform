/**
 * Quiz questions for Module: 02-brewing-your-own-tea
 *
 * Used by the unified Quiz component on the assessment page.
 */

import type { Question, QuizConfig } from "@/types/curriculum";

export const brewingQuestions: Question[] = [
	{
		id: "q1",
		type: "multiple-choice",
		question: "What does Create New Assurance Case ask you to provide?",
		options: [
			{ id: "a", text: "A name and a starter template" },
			{ id: "b", text: "A name and description" },
			{ id: "c", text: "A name, description and colour profile" },
		],
		correctAnswer: "b",
		explanation:
			"The current creation dialog collects a name and description, then makes a blank case with `G1`.",
	},
	{
		id: "q2",
		type: "multiple-choice",
		question: "What do you edit first after creating this practice case?",
		options: [
			{ id: "a", text: "The generated `G1` goal description" },
			{ id: "b", text: "A new top-level goal added through the child menu" },
			{ id: "c", text: "The case information form" },
		],
		correctAnswer: "a",
		explanation:
			"Case creation generates a top-level goal with a placeholder description.",
	},
	{
		id: "q3",
		type: "multiple-choice",
		question: "Why add the recruitment setting as context?",
		options: [
			{ id: "a", text: "It proves the system is fair" },
			{ id: "b", text: "It automatically imports an audit" },
			{ id: "c", text: "It sets the scope in which the goal should be read" },
		],
		correctAnswer: "c",
		explanation:
			"Context states the boundaries and meanings used by the argument.",
	},
	{
		id: "q4",
		type: "multiple-choice",
		question: "Which element can you add beneath a strategy in this branch?",
		options: [
			{ id: "a", text: "An evidence item directly beneath the strategy" },
			{ id: "b", text: "A property claim" },
			{ id: "c", text: "A context node as a child of the strategy" },
		],
		correctAnswer: "b",
		explanation:
			"The strategy's Add Element menu offers a property claim as a child.",
	},
	{
		id: "q5",
		type: "multiple-choice",
		question: "What does Needs support mean on a property claim?",
		options: [
			{ id: "a", text: "The author marks the claim as requiring more support" },
			{ id: "b", text: "The server has verified the claim is false" },
			{ id: "c", text: "The case has been published" },
		],
		correctAnswer: "a",
		explanation:
			"Assertion status is an author-declared state, not an automatic evidence judgement.",
	},
	{
		id: "q6",
		type: "multiple-choice",
		question: "Which statement about saving this walkthrough is correct?",
		options: [
			{
				id: "a",
				text: "You must press a whole-case Save button after every add",
			},
			{
				id: "b",
				text: "Submitting each add or edit dialog persists that change",
			},
			{ id: "c", text: "Export is the only way to save the case" },
		],
		correctAnswer: "b",
		explanation:
			"The add and edit actions persist their changes, while export makes a separate review copy.",
	},
	{
		id: "q7",
		type: "multiple-choice",
		question: "What does the evidence item establish by itself?",
		options: [
			{ id: "a", text: "The entire system is fair" },
			{ id: "b", text: "Every monitoring claim has support" },
			{
				id: "c",
				text: "A particular artefact is offered to support a particular claim",
			},
		],
		correctAnswer: "c",
		explanation:
			"Reviewers still need to inspect its content, quality and fit to the claim.",
	},
];

/**
 * Quiz configuration for the 02-brewing-your-own-tea knowledge check.
 */
export const brewingQuiz: QuizConfig = {
	id: "knowledge-check",
	title: "Knowledge Check",
	questions: brewingQuestions,
	passThreshold: 60,
	showFeedback: true,
	allowRetry: true,
	shuffleOptions: false,
};
