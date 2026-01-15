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
