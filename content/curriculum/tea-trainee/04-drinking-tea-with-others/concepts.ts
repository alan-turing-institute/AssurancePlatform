import type { Concept } from "@/types/curriculum";

/**
 * Core concepts for Module: 04-drinking-tea-with-others
 */
export const drinkingConcepts: Concept[] = [
	{
		id: "concept-team-role",
		type: "general",
		name: "Team role",
		definition:
			"A role for managing membership and settings within a team, separate from a case permission.",
		example:
			"a team admin adds a recruitment specialist to the review team.",
	},
	{
		id: "concept-case-permission",
		type: "general",
		name: "Case permission",
		definition:
			"A grant that determines whether a person or team can view, comment, edit or administer a working case.",
		example:
			"an independent reviewer receives Can comment on Fair Recruitment AI.",
	},
	{
		id: "concept-comment",
		type: "general",
		name: "Comment",
		definition:
			"A discussion attached to a case or element that helps others question an argument without replacing its text.",
		example:
			"a reviewer asks whether the dataset audit covers disabled applicants.",
	},
	{
		id: "concept-public-snapshot",
		type: "general",
		name: "Public snapshot",
		definition:
			"The version of a case published to Discover for readers outside the working-case permissions.",
		example:
			"a reviewed Fair Recruitment AI version appears under a stable slug.",
	},
	{
		id: "concept-backup",
		type: "general",
		name: "Backup",
		definition:
			"A separate copy of case data kept for later import or review.",
		example:
			"an author saves JSON to the TEA Platform Backups folder before a major revision.",
	},
	{
		id: "concept-machine-integration",
		type: "general",
		name: "Machine integration",
		definition:
			"A registered external service with scoped tokens and case grants for allowed machine calls.",
		example:
			"a monitoring service appends health evidence to a property claim.",
	},
];
