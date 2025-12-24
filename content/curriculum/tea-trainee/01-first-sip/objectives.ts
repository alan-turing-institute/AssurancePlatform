import type { LearningObjective } from "@/types/curriculum";

/**
 * Learning objectives for Module 1: First Sip
 *
 * These objectives define what learners should be able to do
 * after completing the module.
 */
export const firstSipObjectives: LearningObjective[] = [
	{
		id: "obj-1",
		text: "Identify the key components of an assurance case",
		description:
			"Recognise goals, strategies, property claims, evidence, and context elements",
	},
	{
		id: "obj-2",
		text: "Explain how structured arguments build trustworthiness",
		description: "Understand the logical flow from to-level goal to evidence",
	},
	{
		id: "obj-3",
		text: "Trace argument chains in a realistic assurance case",
		description:
			"Follow strategies and connections in an interactive and illustrative example of a Fair Recruitment AI case",
	},
	{
		id: "obj-4",
		text: "Evaluate the strength and completeness of assurance arguments",
		description:
			"Critically assess what makes arguments convincing and identify gaps",
	},
];
