/**
 * Shared constants for diagram export functionality.
 *
 * Used by both the image export and document export sections.
 *
 * @module export-constants
 */

/**
 * Depth filter options for diagram exports.
 *
 * Values correspond to `maxDepth` passed to `pruneByDepth()`, where the root
 * node is depth 0. "Root + 1 level" (value "1") keeps the root goal plus its
 * direct children (e.g. strategies or property claims, depending on case
 * structure).
 */
export const DEPTH_OPTIONS = [
	{ value: "all", label: "All levels" },
	{ value: "1", label: "Root + 1 level" },
	{ value: "2", label: "Root + 2 levels" },
	{ value: "3", label: "Root + 3 levels" },
	{ value: "4", label: "Root + 4 levels" },
	{ value: "5", label: "Root + 5 levels" },
] as const;
