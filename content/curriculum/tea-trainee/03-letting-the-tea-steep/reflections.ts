import type { ReflectionPrompt } from "@/types/curriculum";

/**
 * Reflection prompts for Module: 03-letting-the-tea-steep
 */
export const steepingReflectionPrompts: ReflectionPrompt[] = [
	{
		id: "principle-relevance",
		category: "Application",
		title: "Naming the Relevant Principle",
		question:
			"Which principle is most relevant to the case you built, and why? *Hint: name a possible effect on a person or group.*",
		required: true,
	},
	{
		id: "whose-experience",
		category: "Critical Thinking",
		title: "Whose Experience Matters",
		question:
			"Whose experience could change your current definition of the problem? *Hint: look beyond the team that develops the model.*",
		required: false,
	},
	{
		id: "specify-the-goal",
		category: "Structure Analysis",
		title: "Making a Broad Word Precise",
		question:
			"Which broad word in your goal needs a more precise meaning? *Hint: try to write a property claim that a reviewer could challenge.*",
		required: false,
	},
	{
		id: "action-and-limits",
		category: "Application",
		title: "Action, Evidence and Its Limits",
		question:
			"What action would produce evidence for that claim, and what limitation might remain? *Hint: distinguish a test result from the whole system outcome.*",
		required: false,
	},
	{
		id: "value-conflict",
		category: "Critical Thinking",
		title: "Where Values Pull Apart",
		question:
			"Where do two values pull against each other? *Hint: explain why your choice is proportionate and who should review it.*",
		required: false,
	},
];
