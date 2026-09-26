import type { ReflectionPrompt } from "@/types/curriculum";

/**
 * Reflection prompts for Module: 02-brewing-your-own-tea
 */
export const brewingReflectionPrompts: ReflectionPrompt[] = [
	{
		id: "argument-scope",
		category: "Structure Analysis",
		title: "What the Evidence Covers",
		question:
			"Which part of your goal does the data-audit claim address, and which part remains open? *Hint: compare the scope of the property claim with the whole hiring recommendation.*",
		required: true,
	},
	{
		id: "evidence-quality",
		category: "Critical Thinking",
		title: "What a Reviewer Would Check",
		question:
			"What would a reviewer need to inspect before accepting your evidence item? *Hint: name the report, its method and the groups it covers.*",
		required: false,
	},
	{
		id: "context-vs-proof",
		category: "Structure Analysis",
		title: "Context Is Not Proof",
		question:
			"Where did you put a boundary as context rather than treating it as proof? *Hint: look at your fairness definition and recruitment setting.*",
		required: false,
	},
	{
		id: "assertion-status",
		category: "Application",
		title: "Choosing an Assertion Status",
		question:
			"When would you choose Needs support instead of Asserted? *Hint: consider what your current evidence actually demonstrates.*",
		required: false,
	},
];
