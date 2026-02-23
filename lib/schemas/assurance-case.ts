import { z } from "zod";
import { requiredString } from "./base";

/**
 * Schema for creating a new assurance case
 */
export const createAssuranceCaseSchema = z
	.object({
		name: requiredString("Case name", 1, 255),
		description: requiredString("Description", 1, 5000),
		colorProfile: z
			.string()
			.default("default")
			.describe("Colour scheme for case visualisation"),
	})
	.describe("Input schema for creating a new assurance case");

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
	.object({
		name: z.string().min(1).max(255).optional(),
		description: z.string().min(1).max(5000).optional(),
		color_profile: z.string().optional(),
		layout_direction: z.enum(["TB", "LR"]).optional(),
	})
	.describe("Input schema for updating an assurance case");

export type UpdateAssuranceCaseInput = z.input<
	typeof updateAssuranceCaseSchema
>;
