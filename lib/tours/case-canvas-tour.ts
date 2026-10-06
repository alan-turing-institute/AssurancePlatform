import type { Tour } from "nextstepjs";
import { tourStep } from "./step";

export const caseCanvasTour: Tour = {
	tour: "case-canvas",
	steps: [
		tourStep({
			title: "The case canvas",
			content:
				"This is where you build the case. The canvas shows it as a tree: a goal at the top, broken down by strategies into property claims, each supported by evidence. This tour covers the controls; the Help button covers the element types.",
			side: "top",
		}),
		tourStep({
			title: "Your goal",
			content:
				"Every case has a top-level goal. Where you can edit the case, the controls at the foot of the element let you change its text and add a strategy or property claim beneath it.",
			target: "top-goal",
			side: "right",
		}),
		tourStep({
			title: "Case information",
			content:
				"Choose the case name, or the information button in the toolbar, to open the case's details: its name, description and other case-level settings.",
			target: "case-header",
			side: "bottom",
		}),
		tourStep({
			title: "The toolbar",
			content:
				"Undo and redo step through your changes, and also work as Cmd+Z and Cmd+Shift+Z. Focus re-lays out the diagram and fits it to the window. Settings switches the diagram between top-down and left-right. Hover over any button for its name.",
			target: "toolbar",
			side: "top",
		}),
		tourStep({
			title: "Share and export",
			content:
				"Share invites people or teams to view, comment on or edit the case. Export, next to it, downloads a copy in one of the supported formats, for people without an account or for your own records.",
			target: "toolbar-share",
			side: "top",
		}),
		tourStep({
			title: "Help",
			content:
				"Help lists every element type and toolbar option, links to the full documentation, and can restart this tour at any time.",
			target: "toolbar-help",
			side: "top",
		}),
		tourStep({
			title: "Draft and published",
			content:
				"A case starts as a draft that only you and the people you share it with can see. When it is ready, choose the status to publish a copy to Discover; the original stays editable.",
			target: "case-status",
			side: "bottom-right",
		}),
		tourStep({
			title: "Over to you",
			content:
				"Start by editing the goal, then add a strategy or claim beneath it. Keep each claim narrow enough to support with evidence. You can restart this tour from Help whenever you need it.",
			side: "top",
			final: true,
		}),
	],
};
