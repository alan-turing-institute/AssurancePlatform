/**
 * Copy for the Help sheet (`components/modals/help-modal.tsx`).
 *
 * Kept in one data module, separate from the sheet's rendering, so the
 * content is reviewable as prose and testable against the element-type
 * source of truth without touching any component code.
 */

import { ELEMENT_TYPES } from "@/lib/schemas/element-validation";

export interface HelpGuideEntry {
	/** Docs anchor, when one exists. Omitted where the quick-reference page has no matching heading. */
	docsHref?: string;
	/** How to use it well. */
	guidance: string;
	/** Stable identifier. For ELEMENT_GUIDE this is the Prisma ElementType value. */
	id: string;
	/** How the element's short label is generated, e.g. "P1", "P1.1". */
	naming?: string;
	/** One sentence: what the item is. */
	summary: string;
	title: string;
}

const ELEMENT_TYPES_DOCS_PAGE =
	"/docs/curriculum/quick-reference/02-element-types";

/**
 * The full set of element types a case can contain, matching the Prisma
 * `ElementType` enum (`prisma/schema.prisma`). `CONTEXT` predates the
 * `context[]` field on GOAL/STRATEGY/PROPERTY_CLAIM and is marked legacy
 * there, so `ELEMENT_TYPES` (lib/schemas/element-validation.ts) excludes it
 * even though it remains a live enum value — added back here so the guide,
 * and its cross-check test, cover every type a case can contain.
 */
export const AUTHORITATIVE_ELEMENT_TYPE_IDS: readonly string[] = [
	...ELEMENT_TYPES,
	"CONTEXT",
];

export const ELEMENT_GUIDE: HelpGuideEntry[] = [
	{
		id: "GOAL",
		title: "Goal",
		summary: "The top-level claim the whole case sets out to demonstrate.",
		guidance:
			"State plainly what should be true of the system. Keep it broad enough to frame the whole case, and leave how you will show it to the strategies and claims underneath.",
		naming:
			"G1. Most cases have a single goal. A second only appears when the case embeds another case as a module.",
		docsHref: `${ELEMENT_TYPES_DOCS_PAGE}#goal-claims`,
	},
	{
		id: "PROPERTY_CLAIM",
		title: "Property claim",
		summary:
			"A specific claim that supports the goal, a strategy, or another property claim above it.",
		guidance:
			"A claim is a proposition that can be true or false. Keep each one narrow enough to check against evidence, and split anything that reads like several claims joined together.",
		naming:
			"P1 for a top-level claim. A sub-claim takes its parent's number with a dot added, for example P1.1, P1.2.",
		docsHref: `${ELEMENT_TYPES_DOCS_PAGE}#property-claims`,
	},
	{
		id: "STRATEGY",
		title: "Strategy",
		summary:
			"An explanation of how a goal or claim is broken down into the property claims that support it.",
		guidance:
			"A strategy groups the claims that together support its parent, and explains why they belong together. It makes no claim of its own, so use it to make the decomposition visible rather than to assert something new.",
		naming: "S1",
		docsHref: `${ELEMENT_TYPES_DOCS_PAGE}#strategies`,
	},
	{
		id: "EVIDENCE",
		title: "Evidence",
		summary: "An artefact that grounds a property claim in something concrete.",
		guidance:
			"Evidence must be an artefact someone can inspect, such as a test report or a certificate, not an assertion that the claim is true. Link it directly to the claim it supports.",
		naming: "E1",
		docsHref: `${ELEMENT_TYPES_DOCS_PAGE}#evidence`,
	},
	{
		id: "CONTEXT",
		title: "Context",
		summary:
			"Information that sets the boundary conditions a goal, strategy, or property claim assumes.",
		guidance:
			"Context states the operating conditions the argument assumes, such as who is using the system, where, and under what constraints, so a reader can see the limits the claim holds within.",
		naming: "C1",
		docsHref: `${ELEMENT_TYPES_DOCS_PAGE}#context`,
	},
	{
		id: "JUSTIFICATION",
		title: "Justification",
		summary:
			"A short note explaining why a goal, strategy, or claim belongs in the argument.",
		guidance:
			"Use a justification to say why an element is relevant or was chosen, not to restate what it already says. It attaches to the element it explains and cannot have children of its own.",
		naming: "J1",
		docsHref: `${ELEMENT_TYPES_DOCS_PAGE}#justifications`,
	},
	{
		id: "ASSUMPTION",
		title: "Assumption",
		summary:
			"A statement of something the argument relies on but has not itself proven.",
		guidance:
			"Record an assumption whenever a claim, goal, or strategy depends on a condition you are taking on trust, so a reviewer can see, and challenge, what the case is resting on. Like a justification, it attaches to the element it qualifies and cannot have children of its own.",
		naming: "A1",
		docsHref: `${ELEMENT_TYPES_DOCS_PAGE}#assumptions`,
	},
	{
		id: "MODULE",
		title: "Module",
		summary:
			"A reference that embeds another whole assurance case as a component of this one.",
		guidance:
			"Use a module when an existing case is itself part of the system you are assuring, and you want its argument brought in as a unit rather than rebuilt here.",
		naming: "M1",
	},
	{
		id: "AWAY_GOAL",
		title: "Away goal",
		summary:
			"A reference to one specific element inside another assurance case, rather than the whole case.",
		guidance:
			"Use an away goal when only a single claim or goal in another case is relevant here. Unlike a module, it points at that one element directly instead of pulling in the whole case.",
		naming: "AG1",
	},
	{
		id: "CONTRACT",
		title: "Contract",
		summary:
			"An interface element that marks the boundary between this case and a module it embeds.",
		guidance:
			"Use a contract to record the conditions an embedded module's argument depends on, so the boundary between it and the rest of the case stays explicit.",
		naming: "Ct1",
	},
];

export const CANVAS_OPTION_GUIDE: HelpGuideEntry[] = [
	{
		id: "history",
		title: "Undo and redo",
		summary:
			"Two buttons that step backwards and forwards through your recent changes to the canvas.",
		guidance:
			"Use undo to reverse a mistake straight after making it, and redo to restore a change you undid by accident. Both also work from the keyboard, as Cmd+Z and Cmd+Shift+Z.",
	},
	{
		id: "focus",
		title: "Focus",
		summary: "Re-lays out the whole diagram and fits it to the window.",
		guidance:
			"Use this when the canvas has become cluttered or scrolled out of view, to bring every element back into a tidy, visible arrangement.",
	},
	{
		id: "reset-identifiers",
		title: "Reset identifiers",
		summary:
			"Renumbers every element's short label, such as P1 or E1, so the sequence runs continuously again.",
		guidance:
			"Use this after deleting or moving elements has left gaps or duplicates in the numbering. You cannot undo this, so check the case is otherwise settled before running it.",
	},
	{
		id: "case-information",
		title: "Case information",
		summary:
			"Opens a panel showing the case's name, description, and other case-level details.",
		guidance:
			"Use this to check or edit what the case is about, separately from the argument itself.",
	},
	{
		id: "help",
		title: "Help",
		summary: "Opens this guide to the canvas's elements and toolbar.",
		guidance:
			"Use this whenever you are unsure what an element type or a toolbar button is for.",
	},
	{
		id: "share",
		title: "Share",
		summary:
			"Opens the sharing panel, where you can invite other people or teams to view, comment on, or edit the case.",
		guidance:
			"Use this to control who can see or change the case, and at what permission level. Only available to people who can manage the case.",
	},
	{
		id: "export",
		title: "Export",
		summary:
			"Opens a dialog for downloading the case in one of the platform's supported file formats.",
		guidance:
			"Use this to take a copy of the case out of the platform, for example to share with someone who does not have an account, or to keep an offline record.",
	},
	{
		id: "json-view",
		title: "JSON view",
		summary: "Opens a raw, structured view of the case's underlying data.",
		guidance:
			"Use this if you need to inspect or copy the case's exact data, for example when debugging or comparing versions.",
	},
	{
		id: "notes",
		title: "Notes",
		summary:
			"Opens a panel for writing free-text notes about the case, separate from the argument itself.",
		guidance:
			"Use this to keep working notes, reminders, or context for collaborators that do not belong inside the argument.",
	},
	{
		id: "settings",
		title: "Settings",
		summary:
			"Opens a panel for the canvas's display preferences, covering light, dark, or system mode, layout direction, and colour preset.",
		guidance: "Use this to change how the canvas looks, not what it contains.",
	},
	{
		id: "delete",
		title: "Delete case",
		summary: "Moves the whole case to the trash.",
		guidance:
			"Use this to remove a case you no longer need. You can restore it from the trash within 30 days. Only people who can manage the case can use this.",
	},
];
