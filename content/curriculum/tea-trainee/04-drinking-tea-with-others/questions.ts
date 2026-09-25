/**
 * Quiz questions for Module: 04-drinking-tea-with-others
 *
 * Used by the unified Quiz component on the assessment page.
 */

import type { Question, QuizConfig } from "@/types/curriculum";

export const drinkingQuestions: Question[] = [
	{
		id: "q1",
		type: "multiple-choice",
		question:
			"What gives a team access to a case?",
		options: [
			{ id: "a", text: "Merely creating the team" },
			{ id: "b", text: "Granting that team a case permission in Share Case" },
			{ id: "c", text: "Publishing the case to Discover" },
		],
		correctAnswer: "b",
		explanation:
			"Team membership and case access are separate controls.",
	},
	{
		id: "q2",
		type: "multiple-choice",
		question:
			"Which level lets a colleague discuss an element without editing its claim?",
		options: [
			{ id: "a", text: "Can view" },
			{ id: "b", text: "Can comment" },
			{ id: "c", text: "Admin only" },
		],
		correctAnswer: "b",
		explanation:
			"Comment permission supports review without granting element edits.",
	},
	{
		id: "q3",
		type: "multiple-choice",
		question:
			"What happens when you publish a case?",
		options: [
			{ id: "a", text: "Every visitor can edit the working case" },
			{ id: "b", text: "A public version appears on Discover" },
			{ id: "c", text: "All private comments become public evidence" },
		],
		correctAnswer: "b",
		explanation:
			"Publishing creates a public snapshot while working-case permissions remain separate.",
	},
	{
		id: "q4",
		type: "multiple-choice",
		question:
			"A person loses a direct grant but can still open the case. What should you check?",
		options: [
			{ id: "a", text: "The export preset" },
			{ id: "b", text: "Whether a team grant still gives access" },
			{ id: "c", text: "Whether a Google backup exists" },
		],
		correctAnswer: "b",
		explanation:
			"Effective case permission can come from direct and team grants.",
	},
	{
		id: "q5",
		type: "multiple-choice",
		question:
			"What is the best point to invite affected people into deliberation?",
		options: [
			{ id: "a", text: "Only after publishing" },
			{ id: "b", text: "While the goal and use setting can still change" },
			{ id: "c", text: "After every claim is marked Asserted" },
		],
		correctAnswer: "b",
		explanation:
			"Early engagement can reveal concerns that alter the case and the project.",
	},
	{
		id: "q6",
		type: "multiple-choice",
		question:
			"What does a machine integration token enable?",
		options: [
			{ id: "a", text: "A human reviewer to sign into the browser" },
			{ id: "b", text: "An authorised service to call selected machine endpoints" },
			{ id: "c", text: "Automatic publication of every case" },
		],
		correctAnswer: "b",
		explanation:
			"Scopes and case grants constrain machine operations; the token is not a person account.",
	},
	{
		id: "q7",
		type: "multiple-choice",
		question:
			"What should a team do when evidence is still missing?",
		options: [
			{ id: "a", text: "Hide the gap from reviewers" },
			{ id: "b", text: "Publish an invented reference" },
			{ id: "c", text: "Record the gap and agree who will generate and review evidence" },
		],
		correctAnswer: "c",
		explanation:
			"Collaboration makes unresolved work visible and assigns a next action.",
	},
];

/**
 * Quiz configuration for the 04-drinking-tea-with-others knowledge check.
 */
export const drinkingQuiz: QuizConfig = {
	id: "knowledge-check",
	title: "Knowledge Check",
	questions: drinkingQuestions,
	passThreshold: 60,
	showFeedback: true,
	allowRetry: true,
	shuffleOptions: false,
};
