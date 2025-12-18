/**
 * Quiz questions for Module 1: First Sip
 *
 * Contains knowledge check questions about the Fair Recruitment AI case.
 * Used by the unified Quiz component on the assessment page.
 *
 * Questions are designed to test deeper understanding rather than simple recall,
 * aligned with the module's learning objectives:
 * 1. Identify key elements of an assurance case
 * 2. Explain how structured arguments build trustworthiness
 * 3. Trace argument chains in example assurance cases
 * 4. Evaluate strength and completeness of assurance arguments
 */

import type { Question, QuizConfig } from "@/types/curriculum";

/**
 * All questions for the First Sip module assessment.
 * Questions alternate between multiple choice and true/false for variety.
 */
export const firstSipQuestions: Question[] = [
	{
		id: "q1",
		type: "multiple-choice",
		question:
			"In the Fair Recruitment AI case, the goal is broken down using three strategies: discrimination prevention, transparency, and monitoring. Why is this decomposition approach valuable?",
		options: [
			{ id: "a", text: "It makes the document longer and more impressive" },
			{
				id: "b",
				text: "It allows different types of evidence to support different aspects of the claim",
			},
			{
				id: "c",
				text: "It ensures the system passes all regulatory requirements",
			},
			{ id: "d", text: "It prevents anyone from challenging the argument" },
		],
		correctAnswer: "b",
		explanation:
			"Strategies allow an argument to be broken down into distinct sub-argument, each requiring a set of related claims and appropriate evidence. This can be useful where specialised teams need to focus on different aspects of a system's evaluation and assessment.",
	},
	{
		id: "q2",
		type: "true-false",
		statement:
			"In the Fair Recruitment AI case, the monitoring strategy (S3) has property claims but no evidence attached. This means the assurance case is complete and ready for review.",
		correct: false,
		explanation:
			"An assurance case with missing evidence represents an incomplete argument. Claims without supporting evidence are gaps that need to be addressed before the case can be considered complete.",
	},
	{
		id: "q3",
		type: "multiple-choice",
		question:
			"The Fair Recruitment AI case defines fairness according to the UK Equality Act 2010. What would happen if this context were removed from the assurance case?",
		options: [
			{
				id: "a",
				text: "The argument would be stronger because it has more general applicability.",
			},
			{ id: "b", text: "The evidence would no longer be valid." },
			{
				id: "c",
				text: "Reviewers wouldn't know which definition of fairness or non-discrimination is being claimed.",
			},
			{ id: "d", text: "The strategies would need to be rewritten." },
		],
		correctAnswer: "c",
		explanation:
			"Context defines the specific meaning and scope of claims. Without knowing which definition of fairness and non-discrimination applies, reviewers cannot evaluate whether the evidence adequately supports the goal.",
	},
	{
		id: "q4",
		type: "multiple-choice",
		question:
			"In the Fair Recruitment AI case, what connects the claim 'Training data has been audited and balanced' (P1) to the goal 'The system makes fair hiring recommendations'?",
		options: [
			{ id: "a", text: "P1 directly proves the goal is true." },
			{ id: "b", text: "P1 is evidence that proves the goal." },
			{ id: "c", text: "P1 and the goal are not connected in the argument." },
			{
				id: "d",
				text: "P1 supports Strategy S1 (discrimination prevention), which argues for one aspect of the goal.",
			},
		],
		correctAnswer: "d",
		explanation:
			"Individual property claims are unlikely to directly prove a goal. Instead, P1 (partially) supports the goal via strategy S1 (discrimination prevention). However, the claim is insufficient on its own.  This hierarchical structure is fundamental to how assurance cases work.",
	},
	{
		id: "q5",
		type: "true-false",
		statement:
			"Even with strong evidence for all property claims, an assurance case can still be weak if the claims don't adequately decompose the goal.",
		correct: true,
		explanation:
			"Strong evidence is necessary but not sufficient. The overall argument also depends on whether the property claims (and strategies) adequately decompose the goal. A gap in reasoning at any level weakens the entire case.",
	},
];

/**
 * Quiz configuration for the First Sip knowledge check.
 * Combines all question types into a single quiz.
 */
export const firstSipQuiz: QuizConfig = {
	id: "knowledge-check",
	title: "Knowledge Check",
	questions: firstSipQuestions,
	passThreshold: 60,
	showFeedback: true,
	allowRetry: true,
	shuffleOptions: false,
};
