"use client";

import { Check, Circle, Info } from "lucide-react";
import type React from "react";
import type { StageDefinition, StagePrompt } from "./stage-definitions";

interface StageGuidancePanelProps {
	/** Ids of prompts the learner has completed */
	donePromptIds?: Set<string>;
	/** Prompts to list under the guidance text */
	prompts?: StagePrompt[];
	/** Current stage definition */
	stage: StageDefinition;
}

/**
 * StageGuidancePanel - Displays contextual guidance for the current stage
 *
 * Provides clear instructions for each stage of the progressive disclosure,
 * and lists the stage's prompts with a tick against each one the learner
 * has completed.
 */
const StageGuidancePanel = ({
	stage,
	prompts = [],
	donePromptIds,
}: StageGuidancePanelProps): React.ReactNode => (
	<div className="rounded-lg border bg-muted/40 p-4" key={stage.id}>
		<div className="flex items-start gap-3">
			<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
				<Info className="h-4 w-4 text-primary" />
			</div>
			<div className="flex-1">
				<h3 className="mb-1 font-semibold text-foreground text-sm">
					Stage {stage.id}: {stage.title}
				</h3>
				<p className="text-foreground/80 text-sm leading-relaxed">
					{stage.guidance}
				</p>
				{prompts.length > 0 && (
					<ul className="mt-3 space-y-1.5">
						{prompts.map((prompt) => {
							const done = donePromptIds?.has(prompt.id) ?? false;
							return (
								<li
									aria-label={done ? `${prompt.text} (done)` : undefined}
									className="flex items-start gap-2 text-sm"
									key={prompt.id}
								>
									{done ? (
										<Check
											aria-hidden="true"
											className="mt-0.5 h-4 w-4 flex-shrink-0 text-success"
										/>
									) : (
										<Circle
											aria-hidden="true"
											className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground"
										/>
									)}
									<span
										className={
											done ? "text-muted-foreground" : "text-foreground/80"
										}
									>
										{prompt.text}
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	</div>
);

export default StageGuidancePanel;
