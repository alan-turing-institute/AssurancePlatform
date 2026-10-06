import type { Tour } from "nextstepjs";
import { tourStep } from "./step";

export const demoCaseTour: Tour = {
	tour: "demo-case",
	steps: [
		tourStep({
			title: "A worked example",
			content:
				"This tutorial case argues that a customer support chatbot is safe to deploy. It is yours to explore and edit. This tour walks through the four kinds of element it uses, from the top of the tree to the bottom.",
			target: "case-header",
			side: "bottom",
		}),
		tourStep({
			title: "The goal",
			content:
				"Every case starts with a goal: the overall claim the case sets out to demonstrate. State it plainly, and leave how you will show it to the elements beneath.",
			target: "demo-goal",
			side: "right",
		}),
		tourStep({
			title: "Context and details",
			content:
				"This goal is shown expanded, so you can read its context: the operating conditions the claim assumes, such as who uses the system and where. The chevron collapses or expands any element.",
			target: "demo-expand",
			side: "right",
		}),
		tourStep({
			title: "The strategy",
			content:
				"A strategy explains how the goal is broken down. This one argues about the quality of the chatbot's responses, splitting content safety from factual accuracy so each can be evidenced on its own. A strategy makes no claim of its own; its justification says why the split is reasonable.",
			target: "demo-strategy-1",
			side: "right",
		}),
		tourStep({
			title: "The property claim",
			content:
				"A property claim is a specific statement that can be true or false. This one says responses contain no harmful or misleading content. Keep each claim narrow enough to check against evidence.",
			target: "demo-claim-1",
			side: "right",
		}),
		tourStep({
			title: "The evidence",
			content:
				"Evidence is an artefact someone can inspect, such as a test report or an assessment, linked to the claim it supports. Here a red-teaming report supports the claim above it. Read from the bottom up and you have the whole argument: evidence supports claims, claims follow a strategy, and the strategy supports the goal.",
			target: "demo-evidence-1",
			side: "right",
		}),
		tourStep({
			title: "Editing the case",
			content:
				"Use the controls at the foot of an element to add a child element, edit its text, show or hide its children, or add a comment. Each new element gets a short label, such as S1 or P1, automatically.",
			target: "demo-goal",
			side: "right",
		}),
		tourStep({
			title: "Where to go next",
			content:
				"When you are ready, return to the dashboard and choose Create new case. A short tour of the editing tools runs the first time you open a case of your own. The Help button here lists every element type and toolbar option, and can restart this tour.",
			target: "toolbar-help",
			side: "top",
			final: true,
		}),
	],
};
