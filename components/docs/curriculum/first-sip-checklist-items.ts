import type { ChecklistItem } from "@/types/curriculum";

/**
 * Checklist items for the First Sip module.
 * These are the exploration tasks that guide users through
 * discovering the Fair Recruitment AI assurance case.
 */
export const firstSipChecklistItems: ChecklistItem[] = [
	{
		id: "find-goal",
		text: "Find the main goal",
		hint: "The goal states the overall claim about fairness in AI recruitment.",
	},
	{
		id: "explore-strategies",
		text: "Discover the three strategies",
		hint: "Each strategy represents a different approach to ensuring fairness: bias detection, transparency, and monitoring.",
	},
	{
		id: "follow-claims",
		text: "Follow claims to evidence",
		hint: "Click on a strategy node to reveal the claims (orange) and evidence (cyan) that support it.",
	},
	{
		id: "identify-context",
		text: "Identify the context",
		hint: "Context nodes provide important information about scope and assumptions, like regulatory requirements or technical constraints.",
	},
	{
		id: "explore-connections",
		text: "Explore the connections",
		hint: "Each connection represents a logical relationship. Evidence supports claims, claims support strategies, and strategies support the goal.",
	},
];

export default firstSipChecklistItems;
