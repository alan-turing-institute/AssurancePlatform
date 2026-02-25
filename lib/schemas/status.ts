import { z } from "zod";
import { optionalString } from "./base";

/**
 * Update case publish status input
 */
export const updateCaseStatusSchema = z.object({
	targetStatus: z.enum(["DRAFT", "READY_TO_PUBLISH", "PUBLISHED"], {
		errorMap: () => ({
			message:
				"Invalid targetStatus. Must be one of: DRAFT, READY_TO_PUBLISH, PUBLISHED",
		}),
	}),
	description: optionalString(5000),
});

export type UpdateCaseStatusSchemaInput = z.input<
	typeof updateCaseStatusSchema
>;
