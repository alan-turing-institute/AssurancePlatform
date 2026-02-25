import { z } from "zod";
import { optionalString, requiredString } from "./base";

/**
 * Create team input
 */
export const createTeamSchema = z.object({
	name: requiredString("Team name", 1, 100),
	description: optionalString(500),
});

export type CreateTeamSchemaInput = z.input<typeof createTeamSchema>;

/**
 * Update team input (all fields optional, but at least one required)
 */
export const updateTeamSchema = z
	.object({
		name: requiredString("Team name", 1, 100).optional(),
		description: optionalString(500),
	})
	.refine((data) => Object.values(data).some((v) => v !== undefined), {
		message: "At least one field to update must be provided",
	});

export type UpdateTeamSchemaInput = z.input<typeof updateTeamSchema>;

/**
 * Add team member input
 */
export const addTeamMemberSchema = z.object({
	email: z
		.string()
		.min(1, "Email is required")
		.email("Please enter a valid email address")
		.max(254, "Email must be less than 254 characters")
		.transform((v) => v.toLowerCase().trim()),
	role: z
		.enum(["ADMIN", "MEMBER"], {
			errorMap: () => ({ message: "Invalid team role" }),
		})
		.optional(),
});

export type AddTeamMemberSchemaInput = z.input<typeof addTeamMemberSchema>;
