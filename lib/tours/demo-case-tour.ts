import type { Tour } from "nextstepjs";

export const demoCaseTour: Tour = {
	tour: "demo-case",
	steps: [
		{
			icon: "👋",
			title: "Welcome to Your Tutorial Case",
			content:
				"This is a pre-built assurance case that demonstrates how Trustworthy and Ethical Assurance (TEA) works. We'll walk through each element type so you understand the methodology.",
			selector: "[data-tour='case-header']",
			side: "bottom",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "🎯",
			title: "The Goal",
			content:
				"Every assurance case starts with a top-level Goal — the overall claim you want to demonstrate. This one argues that a chatbot is safe and trustworthy for deployment.",
			selector: "[data-tour='demo-goal']",
			side: "bottom",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "🔍",
			title: "Node Details",
			content:
				"Click the chevron on any node to reveal more details. Goals have context statements that scope the claim. Strategies have justifications that explain the reasoning behind a decomposition.",
			selector: "[data-tour='demo-expand']",
			side: "top",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "🔀",
			title: "Strategies",
			content:
				"A Strategy explains how you break a goal into smaller, arguable parts. This strategy decomposes the goal by considering response quality attributes separately.",
			selector: "[data-tour='demo-strategy-1']",
			side: "bottom",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "📌",
			title: "Property Claims",
			content:
				"Claims are specific, testable assertions that support a strategy. Each claim should be precise enough to verify with evidence.",
			selector: "[data-tour='demo-claim-1']",
			side: "top",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "📄",
			title: "Evidence",
			content:
				"Evidence is the proof that backs up a claim — test reports, assessments, audits, or policy documents. Each piece of evidence links to one or more claims.",
			selector: "[data-tour='demo-evidence-1']",
			side: "top",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "🌳",
			title: "The Tree Structure",
			content:
				"Together, these elements form a tree: Goals at the top decompose through Strategies into Claims, which are supported by Evidence at the leaves. This is the core of TEA.",
			selector: "[data-tour='demo-goal']",
			side: "bottom",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "➕",
			title: "Adding New Elements",
			content:
				"Click the + button on any node to add child elements. Goals can have Strategies, Strategies can have Property Claims, and Property Claims can have Evidence.",
			selector: "[data-tour='demo-goal']",
			side: "bottom",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "🛠️",
			title: "Editing & Tools",
			content:
				"Click on the pencil icon to edit a node's content. Use the toolbar for undo/redo, auto-layout, sharing, and exporting your case.",
			selector: "[data-tour='toolbar']",
			side: "top",
			showControls: true,
			showSkip: true,
			pointerPadding: 10,
			pointerRadius: 8,
		},
		{
			icon: "🚀",
			title: "Start Building!",
			content:
				"You've learned the fundamentals of TEA. Go back to the dashboard to create your own assurance case, or continue exploring this tutorial case.",
			selector: "[data-tour='case-header']",
			side: "bottom",
			showControls: true,
			showSkip: false,
			pointerPadding: 10,
			pointerRadius: 8,
		},
	],
};
