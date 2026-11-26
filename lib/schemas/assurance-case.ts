import { z } from "zod";
import { requiredString } from "./base";
import { CaseKindSchema } from "./case-export";

/**
 * The name and description of a new case. Shared by the ways of starting one
 * so that a case made from a pattern is held to the same rules as a blank one.
 */
export const newCaseNameSchema = requiredString("Case name", 1, 255);
export const newCaseDescriptionSchema = requiredString("Description", 1, 5000);

/**
 * Schema for creating a new assurance case
 */
export const createAssuranceCaseSchema = z.strictObject({
	name: newCaseNameSchema,
	description: newCaseDescriptionSchema,
	colourProfile: z.string().default("default"),
	kind: CaseKindSchema.default("CASE"),
});

export type CreateAssuranceCaseInput = z.input<
	typeof createAssuranceCaseSchema
>;
export type CreateAssuranceCaseData = z.output<
	typeof createAssuranceCaseSchema
>;

/**
 * Schema for updating an assurance case (PUT /api/cases/[id])
 * All fields are optional — only provided fields are updated.
 */
export const updateAssuranceCaseSchema = z
	.strictObject({
		name: newCaseNameSchema.optional(),
		description: z.string().min(1).max(5000).optional(),
		colourProfile: z.string().optional(),
		layoutDirection: z.enum(["TB", "LR"]).optional(),
	})
	.describe("Input schema for updating an assurance case");

export type UpdateAssuranceCaseInput = z.input<
	typeof updateAssuranceCaseSchema
>;
