/**
 * Zod schemas for case export/import functionality.
 *
 * Supports three formats:
 * - Nested: Tree structure with children[] (current export format, version "1.0")
 * - Flat: Elements array + evidenceLinks (internal import format)
 * - Legacy: Django schema (nested goals/strategies/claims, no version field)
 *
 * Legacy and Flat are supported for import (backward compatibility).
 * Export always produces Nested format.
 */

import { z } from "zod";

// ============================================
// ENUMS (matching Prisma schema)
// ============================================

export const ElementTypeSchema = z
	.enum([
		"GOAL",
		"CONTEXT",
		"STRATEGY",
		"PROPERTY_CLAIM",
		"EVIDENCE",
		"JUSTIFICATION",
		"ASSUMPTION",
		"MODULE",
		"AWAY_GOAL",
		"CONTRACT",
	])
	.describe("The type of element in an assurance case");

export const ElementRoleSchema = z
	.enum(["TOP_LEVEL", "SUPPORTING"])
	.describe(
		"The role of an element - TOP_LEVEL for root goals, SUPPORTING for child elements"
	);

export const ModuleEmbedTypeSchema = z
	.enum(["COPY", "REFERENCE"])
	.describe(
		"How a module is embedded - COPY creates independent copy, REFERENCE links to original"
	);

export type ElementType = z.infer<typeof ElementTypeSchema>;
export type ElementRole = z.infer<typeof ElementRoleSchema>;
export type ModuleEmbedType = z.infer<typeof ModuleEmbedTypeSchema>;

// ============================================
// V2 SCHEMAS (New Prisma Format)
// ============================================

/**
 * V2 Element schema - flat structure with parentId references
 */
export const ElementV2Schema = z
	.object({
		id: z.string().uuid().describe("Unique identifier for the element"),
		elementType: ElementTypeSchema,
		role: ElementRoleSchema.nullable().optional(),
		parentId: z
			.string()
			.uuid()
			.nullable()
			.describe("ID of the parent element, null for root elements"),
		name: z.string().nullable().describe("Display name of the element"),
		description: z.string().describe("Detailed description or content"),
		assumption: z
			.string()
			.nullable()
			.optional()
			.describe("Assumption text for applicable element types"),
		justification: z
			.string()
			.nullable()
			.optional()
			.describe("Justification text for applicable element types"),
		context: z
			.array(z.string())
			.optional()
			.describe("Context tags associated with the element"),
		url: z.string().nullable().optional().describe("URL for evidence elements"),
		level: z
			.number()
			.int()
			.nullable()
			.optional()
			.describe("Hierarchy level for property claims"),
		inSandbox: z
			.boolean()
			.default(false)
			.describe("Whether the element is in sandbox/draft mode"),
		fromPattern: z
			.boolean()
			.default(false)
			.optional()
			.describe("Whether the element was created from a pattern"),
		modifiedFromPattern: z
			.boolean()
			.default(false)
			.optional()
			.describe("Whether the element has been modified from its pattern"),
		comments: z
			.array(
				z.object({
					author: z.string().describe("Username of comment author"),
					content: z.string().describe("Comment text content"),
					createdAt: z
						.string()
						.describe("ISO 8601 timestamp of comment creation"),
				})
			)
			.optional()
			.describe("Comments attached to this element"),
	})
	.describe("An element in an assurance case (V2 flat format)");

export type ElementV2 = z.infer<typeof ElementV2Schema>;

/**
 * V2 Evidence Link schema - many-to-many relationship
 */
export const EvidenceLinkV2Schema = z
	.object({
		evidenceId: z.string().uuid().describe("ID of the evidence element"),
		claimId: z
			.string()
			.uuid()
			.describe("ID of the claim element the evidence supports"),
	})
	.describe("Link between evidence and the claim it supports");

export type EvidenceLinkV2 = z.infer<typeof EvidenceLinkV2Schema>;

/**
 * V2 Export format - the canonical export schema
 */
export const CaseExportV2Schema = z
	.object({
		version: z.literal("2.0").describe("Schema version identifier"),
		exportedAt: z.string().datetime().describe("ISO 8601 timestamp of export"),
		case: z
			.object({
				name: z
					.string()
					.min(1, "Case name is required")
					.describe("Name of the assurance case"),
				description: z.string().describe("Description of the assurance case"),
			})
			.describe("Case metadata"),
		elements: z.array(ElementV2Schema).describe("All elements in the case"),
		evidenceLinks: z
			.array(EvidenceLinkV2Schema)
			.describe("Links between evidence and claims"),
	})
	.describe("Assurance case export in V2 flat format");

export type CaseExportV2 = z.infer<typeof CaseExportV2Schema>;

// ============================================
// NESTED SCHEMAS (Tree Export Format - version "1.0")
// Current export format with hierarchical structure
// ============================================

/**
 * Comment type for export/import
 */
export interface ExportComment {
	author: string;
	content: string;
	createdAt: string;
}

/**
 * Tree Node - recursive structure with unified children array.
 * Evidence is shown inline under claims they support.
 *
 * Field availability depends on element type:
 * - role: GOAL only
 * - assumption: GOAL, STRATEGY, PROPERTY_CLAIM, ASSUMPTION, AWAY_GOAL
 * - justification: GOAL, STRATEGY, PROPERTY_CLAIM, JUSTIFICATION
 * - context: GOAL, STRATEGY, PROPERTY_CLAIM (array of strings)
 * - url: EVIDENCE only
 * - level: PROPERTY_CLAIM only
 * - moduleReferenceId: MODULE (required), AWAY_GOAL (required)
 * - moduleEmbedType: MODULE only (required)
 * - modulePublicSummary: MODULE only
 * - isDefeater, defeatsElementId: any type (dialogical reasoning)
 * - comments: optional, included when includeComments export option is true
 */
export interface TreeNode {
	assumption?: string | null;
	children: TreeNode[];
	// Comments (optional - included when export option enabled)
	comments?: ExportComment[];
	context?: string[];
	defeatsElementId?: string;
	description: string;
	// Pattern metadata (only included when true)
	fromPattern?: boolean;
	id: string;
	inSandbox: boolean;
	// Dialogical reasoning
	isDefeater?: boolean;
	justification?: string | null;
	level?: number | null;
	modifiedFromPattern?: boolean;
	moduleEmbedType?: ModuleEmbedType;
	modulePublicSummary?: string | null;
	// Module fields
	moduleReferenceId?: string;
	name: string | null;
	// Type-specific fields (only included when applicable)
	role?: ElementRole | null;
	type: ElementType;
	url?: string | null;
}

// Comment schema for export/import
export const ExportCommentSchema = z
	.object({
		author: z.string().describe("Username of the comment author"),
		content: z.string().describe("Comment text content"),
		createdAt: z.string().describe("ISO 8601 timestamp of comment creation"),
	})
	.describe("A comment attached to an element");

// biome-ignore lint/suspicious/noExplicitAny: Required for Zod recursive schema typing
export const TreeNodeSchema: z.ZodType<any> = z.lazy(() =>
	z.object({
		id: z.string().uuid(),
		type: ElementTypeSchema,
		name: z.string().nullable(),
		description: z.string(),
		inSandbox: z.boolean().default(false),
		children: z.array(TreeNodeSchema),
		// Type-specific fields (optional - only included when applicable)
		role: ElementRoleSchema.nullable().optional(),
		assumption: z.string().nullable().optional(),
		justification: z.string().nullable().optional(),
		context: z.array(z.string()).optional(),
		url: z.string().nullable().optional(),
		level: z.number().int().nullable().optional(),
		// Module fields
		moduleReferenceId: z.string().uuid().optional(),
		moduleEmbedType: ModuleEmbedTypeSchema.optional(),
		modulePublicSummary: z.string().nullable().optional(),
		// Pattern metadata (optional - only included when true)
		fromPattern: z.boolean().default(false).optional(),
		modifiedFromPattern: z.boolean().default(false).optional(),
		// Dialogical reasoning
		isDefeater: z.boolean().optional(),
		defeatsElementId: z.string().uuid().optional(),
		// Comments (optional - included when export option enabled)
		comments: z.array(ExportCommentSchema).optional(),
	})
);

/**
 * Nested Export format - tree structure for human readability.
 * Evidence appears inline under claims, may be duplicated if multi-linked.
 * Uses version "1.0" as this is the first officially versioned export format
 * (the legacy Django format had no version field).
 */
export const CaseExportNestedSchema = z
	.object({
		version: z.literal("1.0").describe("Schema version identifier"),
		exportedAt: z.string().datetime().describe("ISO 8601 timestamp of export"),
		case: z
			.object({
				name: z
					.string()
					.min(1, "Case name is required")
					.describe("Name of the assurance case"),
				description: z.string().describe("Description of the assurance case"),
			})
			.describe("Case metadata"),
		tree: TreeNodeSchema.describe("Root element of the case tree"),
	})
	.describe("Assurance case export in nested tree format (v1.0)");

export type CaseExportNested = z.infer<typeof CaseExportNestedSchema>;

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export interface ValidationError {
	code: string;
	message: string;
	path: string;
}

export interface ImportValidationResult {
	errors: ValidationError[];
	isValid: boolean;
	version: "flat" | "nested" | null;
	warnings: string[];
}
