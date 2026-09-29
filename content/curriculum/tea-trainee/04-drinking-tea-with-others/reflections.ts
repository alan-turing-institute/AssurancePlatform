import type { ReflectionPrompt } from "@/types/curriculum";

/**
 * Reflection prompts for Module: 04-drinking-tea-with-others
 */
export const drinkingReflectionPrompts: ReflectionPrompt[] = [
	{
		id: "who-challenges-the-goal",
		category: "Application",
		title: "Who Should Challenge the Goal",
		question:
			"Who should challenge the fairness goal before you settle its wording? *Hint: include people affected by the recruitment process.*",
		required: true,
	},
	{
		id: "matching-permissions",
		category: "Application",
		title: "Matching Permission to Task",
		question:
			"Which collaborator needs Can comment, which needs Can edit, and who should manage access? *Hint: match permission to a concrete task.*",
		required: false,
	},
	{
		id: "public-reader-gaps",
		category: "Critical Thinking",
		title: "What a Public Reader Would Miss",
		question:
			"What would a public reader misunderstand if you published the current practice case? *Hint: consider missing evidence and private comments.*",
		required: false,
	},
	{
		id: "responding-to-gaps",
		category: "Application",
		title: "Responding to a Reviewer's Gap",
		question:
			"How would you respond to a reviewer who finds a gap in a claim? *Hint: name the case edit, evidence work and person responsible.*",
		required: false,
	},
	{
		id: "when-to-use-tools",
		category: "Structure Analysis",
		title: "When Import, Backup or a Token Helps",
		question:
			"When would an import, backup or machine token help your project? *Hint: distinguish a one-off copy from ongoing automated evidence.*",
		required: false,
	},
];
