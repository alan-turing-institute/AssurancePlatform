import { z } from "zod";
import { emailSchema, permissionLevelSchema, uuidSchema } from "./base";

/**
 * Share case by email
 */
export const shareByEmailSchema = z.object({
	type: z.literal("user").optional(),
	email: emailSchema,
	permission: permissionLevelSchema,
});

export type ShareByEmailSchemaInput = z.input<typeof shareByEmailSchema>;

/**
 * Share case with team
 */
export const shareWithTeamSchema = z.object({
	type: z.literal("team"),
	teamId: uuidSchema,
	permission: permissionLevelSchema,
});

export type ShareWithTeamSchemaInput = z.input<typeof shareWithTeamSchema>;

/**
 * Discriminated union for sharing — either by email or with team
 */
export const sharePermissionSchema = z.discriminatedUnion("type", [
	shareWithTeamSchema,
	shareByEmailSchema.extend({ type: z.literal("user") }),
]);

export type SharePermissionSchemaInput = z.input<typeof sharePermissionSchema>;

/**
 * Update an existing permission
 */
export const updatePermissionSchema = z.object({
	permission: permissionLevelSchema,
	type: z.enum(["user", "team"]).optional(),
});

export type UpdatePermissionSchemaInput = z.input<
	typeof updatePermissionSchema
>;
