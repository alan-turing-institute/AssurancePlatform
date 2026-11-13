import type { Concept } from "@/types/curriculum";

/**
 * Core element concepts for Module 1: First Sip
 *
 * These concepts introduce learners to the fundamental building blocks
 * of an assurance case: Goals, Strategies, Property Claims, Evidence,
 * Context, Justifications, and Assumptions.
 *
 * Examples are drawn from the Fair Recruitment AI case study.
 */
export const coreElementsConcepts: Concept[] = [
	{
		id: "concept-goal",
		type: "goal",
		name: "Goal",
		definition:
			"A goal represents the top-level claim that the assurance case is trying to establish. It states what needs to be assured.",
		details: [
			"Always appears at the top of the hierarchy",
			"Must be clear and concise",
			"Sets the direction for the entire argument",
		],
		example: "The AI recruitment system makes fair hiring recommendations.",
	},
	{
		id: "concept-strategy",
		type: "strategy",
		name: "Strategy",
		definition:
			"A strategy describes the approach used to argue that a goal is satisfied. It breaks down complex goals into manageable parts.",
		details: [
			"Divides goals into sub-arguments",
			"Provides the reasoning approach",
			"Makes the argument structure explicit and transparent",
		],
		example:
			"Demonstrate fairness by showing that neither the training data nor the system's recommendations discriminate on any protected characteristic under the UK Equality Act 2010.",
	},
	{
		id: "concept-property-claim",
		type: "property_claim",
		name: "Property Claim",
		definition:
			"Property claims are specific assertions that can be supported by evidence. They represent concrete, verifiable statements about the system.",
		details: [
			"Must be testable or verifiable",
			"More specific than goals",
			"Directly linked to evidence",
		],
		example:
			"The training dataset represents every demographic group in balanced proportions.",
	},
	{
		id: "concept-evidence",
		type: "evidence",
		name: "Evidence",
		definition:
			"Evidence provides the concrete facts, test results, or documentation that supports property claims and grounds the argument in verifiable information.",
		details: [
			"Must be objective and verifiable",
			"Can include test results, audits, or analysis",
			"Provides the foundation for the argument",
		],
		example:
			"Audit report detailing demographic breakdown of 50,000 candidate profiles, demonstrating balanced representation across protected characteristics.",
	},
	{
		id: "concept-context",
		type: "context",
		name: "Context",
		definition:
			"Context defines the specific conditions under which claims are valid. It specifies the boundaries, operational environment, and scope of the assurance.",
		details: [
			"Essential for meaningful assurance",
			"Defines who, what, where, when, and under what conditions",
			"Makes explicit what is excluded from scope",
		],
		example:
			"The system is used by the HR recruitment team, who review its recommendations and make every hiring decision.",
	},
	{
		id: "concept-justification",
		type: "justification",
		name: "Justification",
		definition:
			"Justifications explain why a particular claim, goal, or strategy is appropriate or relevant to the argument. They provide the rationale for including an element.",
		details: [
			"Explains the reasoning behind decisions",
			"Helps reviewers understand argument logic",
			"Can reference standards, regulations, or stakeholder needs",
		],
		example:
			"Fairness metrics were selected based on stakeholder consultation workshops and regulatory guidance from the Equality and Human Rights Commission.",
	},
	{
		id: "concept-assumption",
		type: "assumption",
		name: "Assumption",
		definition:
			"Assumptions make explicit any conditions that are taken to be true without direct evidence. They identify dependencies that must hold for the argument to be valid.",
		details: [
			"States conditions taken to be true",
			"Identifies dependencies outside the assurance scope",
			"Makes implicit reasoning explicit for reviewers",
		],
		example:
			"Assumes the training data distribution matches the deployment distribution and that demographic patterns remain stable over time.",
	},
];
