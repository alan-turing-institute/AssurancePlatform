/**
 * Stage definitions for progressive disclosure of assurance cases
 *
 * Each stage reveals more of the case structure, guiding users through
 * the concepts progressively.
 */

export type StageDefinition = {
	/** Stage number (1-indexed) */
	id: number;
	/** Full title for the stage */
	title: string;
	/** Short title for stepper UI */
	shortTitle: string;
	/** Guidance text explaining what to observe and do */
	guidance: string;
	/** Path to the JSON file for this stage (relative to /data/) */
	caseFile: string;
	/** Task ID that corresponds to completing this stage */
	taskId: string;
};

/**
 * Get a stage by its ID
 */
export const getStageById = (
	stages: StageDefinition[],
	id: number
): StageDefinition | undefined => stages.find((s) => s.id === id);

/**
 * Get the next stage after the current one
 */
export const getNextStage = (
	stages: StageDefinition[],
	currentId: number
): StageDefinition | undefined => stages.find((s) => s.id === currentId + 1);

/**
 * Get the previous stage before the current one
 */
export const getPreviousStage = (
	stages: StageDefinition[],
	currentId: number
): StageDefinition | undefined => stages.find((s) => s.id === currentId - 1);

/**
 * Check if a stage is the first stage
 */
export const isFirstStage = (
	stages: StageDefinition[],
	currentId: number
): boolean => currentId === stages[0]?.id;

/**
 * Check if a stage is the last stage
 */
export const isLastStage = (
	stages: StageDefinition[],
	currentId: number
): boolean => currentId === stages.at(-1)?.id;
