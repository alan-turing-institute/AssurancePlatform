import type { ReflectionPrompt } from "@/types/curriculum";

/**
 * Reflection prompts for Module 1: First Sip
 *
 * These prompts guide learners to reflect on their understanding
 * of the Fair Recruitment AI assurance case.
 */
export const firstSipReflectionPrompts: ReflectionPrompt[] = [
	{
		id: "argument-flow",
		category: "Structure Analysis",
		title: "Following the Logic",
		question:
			"How does the case build its argument from the main goal down to specific evidence? Can you describe the logical flow?",
		required: true,
	},
	{
		id: "convincing-aspects",
		category: "Critical Thinking",
		title: "Strengths and Weaknesses",
		question:
			"What aspects of this assurance case did you find most convincing? Were there any claims that you disagreed with or areas of the argument that seemed weak or incomplete?",
		required: false,
	},
	{
		id: "real-world",
		category: "Application",
		title: "Your Context",
		question:
			"Can you think of a system or decision in your own work where this structured approach to building trust would be valuable?",
		required: false,
	},
];
