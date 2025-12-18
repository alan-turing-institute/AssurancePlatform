"use client";

import { motion } from "framer-motion";
import { Info } from "lucide-react";
import type React from "react";
import type { StageDefinition } from "./stage-definitions";

type StageGuidancePanelProps = {
	/** Current stage definition */
	stage: StageDefinition;
};

/**
 * StageGuidancePanel - Displays contextual guidance for the current stage
 *
 * Provides clear instructions for each stage of the progressive disclosure.
 */
const StageGuidancePanel = ({
	stage,
}: StageGuidancePanelProps): React.ReactNode => (
	<motion.div
		animate={{ opacity: 1 }}
		className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:from-blue-950/30 dark:to-indigo-950/30"
		initial={{ opacity: 0 }}
		key={stage.id}
		transition={{ duration: 0.2 }}
	>
		<div className="flex items-start gap-3">
			<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
				<Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
			</div>
			<div className="flex-1">
				<h3 className="mb-1 font-semibold text-gray-900 text-sm dark:text-gray-100">
					Stage {stage.id}: {stage.title}
				</h3>
				<p className="text-gray-700 text-sm leading-relaxed dark:text-gray-300">
					{stage.guidance}
				</p>
			</div>
		</div>
	</motion.div>
);

export default StageGuidancePanel;
