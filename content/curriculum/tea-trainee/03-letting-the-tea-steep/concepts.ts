import type { Concept } from "@/types/curriculum";

/**
 * Core concepts for Module: 03-letting-the-tea-steep
 */
export const steepingConcepts: Concept[] = [
	{
		id: "concept-ethical-principle",
		type: "general",
		name: "Ethical principle",
		definition:
			"A broad aim that starts deliberation but does not itself prescribe a project action.",
		example:
			"fairness prompts the recruitment team to ask which applicants may be affected.",
	},
	{
		id: "concept-stakeholder-engagement",
		type: "general",
		name: "Stakeholder engagement",
		definition:
			"Involving people with different knowledge of a system and its effects while questions and decisions are still open.",
		example:
			"prison staff and social researchers challenge a proposed safety tool's assumptions.",
	},
	{
		id: "concept-proportionality",
		type: "general",
		name: "Proportionality",
		definition:
			"Giving time and attention to concerns in relation to their likely effects and the system's use.",
		example:
			"a clinical decision aid calls for more intensive safety inquiry than a minor internal analysis.",
	},
	{
		id: "concept-specification",
		type: "general",
		name: "Specification",
		definition:
			"Making a principle precise enough for a particular system, population and setting.",
		example:
			"fairness for a prison tool includes a stated concern about discrimination by protected characteristic.",
	},
	{
		id: "concept-operationalisation",
		type: "general",
		name: "Operationalisation",
		definition:
			"Moving from identified and weighed principles to specified actions, revision and evaluation.",
		example:
			"examine data collection, test outcomes and document the evaluation method.",
	},
	{
		id: "concept-justification",
		type: "general",
		name: "Justification",
		definition:
			"The reasoned link between a claim, the action taken and evidence offered for it.",
		example:
			"a recruitment dataset audit is offered for a narrow representation claim, while the wider fairness goal remains open.",
	},
];
