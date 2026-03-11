import type { Tour } from "nextstepjs";

export const caseCanvasTour: Tour = {
	tour: "case-canvas",
	steps: [
		{
			icon: "🎨",
			title: "Welcome to the Case Canvas",
			content:
				"This is where you build and visualise your assurance case. The canvas shows a hierarchical tree of goals, strategies, claims, and evidence.",
			side: "top",
			showControls: true,
			showSkip: true,
			pointerPadding: 0,
			pointerRadius: 0,
		},
		{
			icon: "📝",
			title: "Case Name",
			content:
				"Click here to view and edit the details of your assurance case, including its name and description.",
			selector: "[data-tour='case-header']",
			side: "bottom",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "📋",
			title: "Publication Status",
			content:
				"Track whether your case is a Draft, Ready to Publish, or Published. Click to manage the publication workflow.",
			selector: "[data-tour='case-status']",
			side: "bottom-right",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "🛠️",
			title: "The Toolbar",
			content:
				"All your editing tools are here — Undo/Redo, Auto-Layout, Resources, Share, Export, JSON View, Notes, and Settings. Hover over each icon to see what it does.",
			selector: "[data-tour='toolbar']",
			side: "top",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "↩️",
			title: "Undo & Redo",
			content:
				"Made a mistake? Use undo and redo to step through your change history. You can also use Cmd+Z and Cmd+Shift+Z.",
			selector: "[data-tour='toolbar-undo-redo']",
			side: "top",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "🔗",
			title: "Share & Export",
			content:
				"Invite collaborators to view or edit your case, or export it as JSON for backup and sharing.",
			selector: "[data-tour='toolbar-share']",
			side: "top",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "✨",
			title: "Start Building!",
			content:
				"You're all set. Click on any node to explore it, or use the + button in the toolbar to add a new Goal node.",
			side: "top",
			showControls: true,
			showSkip: false,
			pointerPadding: 0,
			pointerRadius: 0,
		},
	],
};
