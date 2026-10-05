import type { Tour } from "nextstepjs";
import { tourStep } from "./step";

export const dashboardTour: Tour = {
	tour: "dashboard",
	steps: [
		tourStep({
			title: "Welcome to TEA",
			content:
				"TEA helps you build, share and publish assurance cases: structured arguments, backed by evidence, that a system has a property such as safety or fairness. This short tour shows you around the dashboard. Use the arrow keys to move between steps, or press Escape to close it.",
			side: "top",
		}),
		tourStep({
			title: "Create a case",
			content:
				"Choose this card to start a case of your own. You give it a name and a description, and the platform opens it with a single top-level goal for you to fill in.",
			target: "create-case",
			side: "right",
		}),
		tourStep({
			title: "Import a case",
			content:
				"If you already have a case as a JSON export, a file in a GitHub repository or a Google Drive backup, import it here rather than rebuilding it.",
			target: "import-case",
			side: "bottom-right",
		}),
		tourStep({
			title: "Find a case",
			content:
				"Type part of a name to narrow the list. The menu to the right sorts your cases by date created, name or last modified.",
			target: "case-filter",
			side: "bottom",
		}),
		tourStep({
			title: "Cases shared with you",
			content:
				"Cases that other people or teams have shared with you appear here, with the permission they granted: view, comment or edit.",
			target: "sidebar-shared",
			side: "right",
		}),
		tourStep({
			title: "Teams",
			content:
				"Create a team to share cases with a group of colleagues at once, instead of inviting each person separately.",
			target: "sidebar-teams",
			side: "right",
		}),
		tourStep({
			title: "Discover",
			content:
				"Published cases from other users are listed here. Reading a few is a good way to see how an argument is laid out before you write your own.",
			target: "sidebar-discover",
			side: "right",
		}),
		tourStep({
			title: "Start with the tutorial case",
			content:
				"This case is a worked example you can explore and edit without risk. Open it next: a second short tour explains each type of element as you look at it. The Documentation link in the sidebar covers everything else, and you can run this tour again from the Take the tour button at the top of the page.",
			target: "tutorial-case",
			side: "left",
			final: true,
		}),
	],
};
