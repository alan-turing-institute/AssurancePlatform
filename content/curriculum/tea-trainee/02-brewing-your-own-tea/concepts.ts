import type { Concept } from "@/types/curriculum";

/**
 * Core concepts for Module: 02-brewing-your-own-tea
 */
export const brewingConcepts: Concept[] = [
	{
		id: "concept-working-case",
		type: "general",
		name: "Working case",
		definition:
			"An editable assurance case kept in the signed-in workspace. Its current contents can change as the team learns more.",
		example: "your Fair Recruitment AI practice case at `/case/<id>`.",
	},
	{
		id: "concept-top-level-goal",
		type: "goal",
		name: "Top-level goal",
		definition:
			"The main proposition the case tries to justify, placed at the root of the argument.",
		example:
			"`G1` says that the recruitment system makes fair recommendations.",
	},
	{
		id: "concept-context",
		type: "general",
		name: "Context",
		definition:
			"A boundary or definition needed to interpret a claim. It does not prove the claim.",
		example:
			"your `G1` context names the recruitment setting and a fairness frame.",
	},
	{
		id: "concept-strategy",
		type: "strategy",
		name: "Strategy",
		definition:
			"The stated approach for breaking a broad goal into supportable parts.",
		example:
			"the first strategy addresses discrimination prevention through data and model checks.",
	},
	{
		id: "concept-property-claim",
		type: "property_claim",
		name: "Property claim",
		definition:
			"A more specific statement that can be examined against evidence.",
		example: "the training dataset has been audited for representation.",
	},
	{
		id: "concept-evidence",
		type: "evidence",
		name: "Evidence",
		definition:
			"An artefact or result offered to support a claim, which still needs assessment for relevance and quality.",
		example: "the practice audit report described beneath the property claim.",
	},
];
