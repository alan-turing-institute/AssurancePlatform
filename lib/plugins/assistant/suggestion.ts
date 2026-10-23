import { z } from "zod";

/** The tool that suggests rewording an existing element. */
export const SUGGEST_EDIT = "suggest_edit";
/** The tool that suggests a new element beneath an existing one. */
export const SUGGEST_NEW_ELEMENT = "suggest_new_element";

/** The two tools that only suggest. Neither writes to the case. */
export const SUGGESTION_TOOL_NAMES: readonly string[] = [
	SUGGEST_EDIT,
	SUGGEST_NEW_ELEMENT,
];

/** The longest text the server accepts in one field of an element. */
export const MAX_SUGGESTED_CHARS = 5000;

/** What the user did with a suggestion card. `changed` means Apply refused because the element had changed since the suggestion was made. */
export const suggestionOutcomeSchema = z.enum([
	"applied",
	"dismissed",
	"changed",
]);

export type SuggestionOutcome = z.infer<typeof suggestionOutcomeSchema>;

/** The child types the assistant may suggest, in the form the server's element routes name them. */
export const NEW_ELEMENT_TYPES = [
	"strategy",
	"property_claim",
	"evidence",
] as const;

export type NewElementType = (typeof NEW_ELEMENT_TYPES)[number];

const textChange = z.object({ before: z.string(), after: z.string() });
const listChange = z.object({
	before: z.array(z.string()),
	after: z.array(z.string()),
});

/** A suggested rewording: for each field it changes, the stored text and the suggested text. */
const editSuggestionSchema = z.object({
	suggested: z.literal(true),
	kind: z.literal("edit"),
	elementId: z.string(),
	/** The element's type in lower case, such as `property_claim`. */
	elementType: z.string(),
	/** The element's label, such as P1; empty when it has none. */
	label: z.string(),
	changes: z.object({
		description: textChange.optional(),
		assumption: textChange.optional(),
		justification: textChange.optional(),
		context: listChange.optional(),
	}),
});

/** A suggested new element beneath an existing one. */
const newElementSuggestionSchema = z.object({
	suggested: z.literal(true),
	kind: z.literal("new"),
	parentId: z.string(),
	parentLabel: z.string(),
	parentType: z.string(),
	childType: z.enum(NEW_ELEMENT_TYPES),
	description: z.string(),
});

/** A request the tool refused, with the reason in plain words. */
const refusalSchema = z.object({
	suggested: z.literal(false),
	reason: z.string(),
});

export type EditSuggestion = z.infer<typeof editSuggestionSchema>;
export type NewElementSuggestion = z.infer<typeof newElementSuggestionSchema>;
export type Refusal = z.infer<typeof refusalSchema>;
export type Suggestion = EditSuggestion | NewElementSuggestion;

const suggestionResultSchema = z.union([
	editSuggestionSchema,
	newElementSuggestionSchema,
	refusalSchema,
]);

/** A suggestion tool's result when it has the expected shape, otherwise null. */
export function parseSuggestionResult(
	output: unknown
): Suggestion | Refusal | null {
	const parsed = suggestionResultSchema.safeParse(output);
	return parsed.success ? parsed.data : null;
}

const TYPE_LABELS: Record<string, string> = {
	goal: "goal",
	strategy: "strategy",
	property_claim: "claim",
	evidence: "evidence",
	assumption: "assumption",
	justification: "justification",
	away_goal: "away goal",
	module: "module",
};

/** An element type as the user sees it: a claim, not `property_claim`. */
export function typeLabel(type: string): string {
	return TYPE_LABELS[type.toLowerCase()] ?? "element";
}
