import type { StageDefinition } from "@/components/docs/curriculum/stage-definitions";

/**
 * Stage definitions for the Fair Recruitment AI exploration
 *
 * Each stage progressively reveals more of the assurance case structure,
 * guiding learners through the concepts step by step.
 */
export const fairRecruitmentStages: StageDefinition[] = [
	{
		id: 1,
		title: "The Main Goal",
		shortTitle: "Goal",
		guidance:
			"All assurance cases begin with a top-level claim called the goal. In this first stage, familiarise yourself with the viewer by dragging the canvas to pan around, using your scroll wheel to zoom in and out, and clicking on the green goal node (G1) to expand its full description. When you're ready, use the right arrow to continue.",
		caseFile: "curriculum/first-sip/stage-1-goal.json",
		taskId: "stage-1-goal",
	},
	{
		id: 2,
		title: "Setting the Context",
		shortTitle: "Context",
		guidance:
			"Expand G1 again. Context items (shown in grey) define the scope and assumptions of the argument. Notice how the context specifies what 'fairness' means in this case and describes the operational environment. These boundaries are essential for interpreting the rest of the argument.",
		caseFile: "curriculum/first-sip/stage-2-context.json",
		taskId: "stage-2-context",
	},
	{
		id: 3,
		title: "Breaking Down the Argument",
		shortTitle: "Strategies",
		guidance:
			"Strategies help structure an argument by breaking it into sub-arguments. Click on each strategy node (S1, S2, S3) to understand how this case argues for fairness through three different approaches: discrimination prevention, transparency, and ongoing monitoring. Use the 'Fullscreen' button to see more of the case.",
		caseFile: "curriculum/first-sip/stage-3-strategies.json",
		taskId: "stage-3-strategies",
	},
	{
		id: 4,
		title: "Diving into Discrimination Prevention",
		shortTitle: "Claims",
		guidance:
			"Property claims (blue nodes) are specific, testable statements that support a strategy. Expand the discrimination prevention branch by clicking on P1 and P2. Notice how these claims are more concrete than the goal: P1 addresses training data quality, while P2 focuses on statistical testing. Each claim will need evidence to support it. Use the 'Auto Layout' button to reorganise the view if needed.",
		caseFile: "curriculum/first-sip/stage-4-claims.json",
		taskId: "stage-4-claims",
	},
	{
		id: 5,
		title: "Grounding in Evidence",
		shortTitle: "Evidence",
		guidance:
			"Evidence provides the concrete proof supporting each claim. Click on E1 and E2 to see what artefacts support the discrimination prevention claims. E1 is an audit report demonstrating balanced training data, while E2 presents statistical fairness metrics. Consider whether this evidence is sufficient to support the claims.",
		caseFile: "curriculum/first-sip/stage-5-evidence.json",
		taskId: "stage-5-evidence",
	},
	{
		id: 6,
		title: "Transparency and Explainability",
		shortTitle: "Transparency",
		guidance:
			"Now explore the transparency branch under Strategy S2. Click on P3 and P4 to see how explainability and appeals are addressed, then examine their supporting evidence (E3 and E4). Compare this branch to the discrimination prevention branch—notice how different aspects of fairness require different types of evidence.",
		caseFile: "curriculum/first-sip/stage-6-transparency.json",
		taskId: "stage-6-transparency",
	},
	{
		id: 7,
		title: "The Complete Picture",
		shortTitle: "Complete",
		guidance:
			"The full assurance case is now visible. Explore the monitoring branch (S3) with its claims P5 and P6. Notice that these claims have no evidence attached—this represents a gap in the argument. Navigate freely through all branches using the viewer controls. Consider the overall structure: does the argument convincingly support the goal?",
		caseFile: "curriculum/first-sip/stage-7-complete.json",
		taskId: "stage-7-complete",
	},
];
