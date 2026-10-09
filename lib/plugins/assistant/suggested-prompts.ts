const READ_CASE = "read_case";
const LINT_CASE = "lint_case";
const SUGGEST_TECHNIQUES = "suggest_techniques";

/** How the selected element is named in a prompt when it has no label. */
const UNLABELLED_ELEMENT = "the selected element";

export interface SuggestedPromptsInput {
	/** The label of the selected element, when the diagram gives it one. */
	label?: string;
	/** Whether an element is selected. */
	selected: boolean;
	/** The names of the tools the server registered for this case. */
	tools: readonly string[];
}

export interface SuggestedPrompts {
	/** Whether the introduction should mention the technique suggestions. */
	mentionsTechniques: boolean;
	/** Short questions the user can send with one click, each one the assistant can answer with a registered tool. */
	prompts: string[];
}

/**
 * The prompts to offer before the first message. Each needs the tool that
 * answers it, and the technique prompt needs a selected element because only
 * then does the server send the claim's exact text.
 */
export function suggestedPrompts({
	label,
	selected,
	tools,
}: SuggestedPromptsInput): SuggestedPrompts {
	const has = (name: string) => tools.includes(name);
	const prompts: string[] = [];
	if (selected) {
		const name = label || UNLABELLED_ELEMENT;
		if (has(READ_CASE)) {
			prompts.push(`Explain ${name}'s role`, `What evidence supports ${name}?`);
		}
		if (has(SUGGEST_TECHNIQUES)) {
			prompts.push(`Suggest techniques for ${name}`);
		}
	} else if (has(READ_CASE)) {
		prompts.push("What is the top-level goal?", "Which claims lack evidence?");
	}
	if (has(LINT_CASE)) {
		prompts.push("Check this case against the rules");
	}
	return { prompts, mentionsTechniques: has(SUGGEST_TECHNIQUES) };
}
