import { z } from "zod";
import { emailSchema, permissionLevelSchema, uuidSchema } from "./base";

/**
 * Share case by email
 */
export const shareByEmailSchema = z.strictObject({
	type: z.literal("user").optional(),
	email: emailSchema,
	permission: permissionLevelSchema,
});

export type ShareByEmailSchemaInput = z.input<typeof shareByEmailSchema>;
export type ShareByEmailSchemaOutput = z.output<typeof shareByEmailSchema>;

/**
 * Share case with team
 */
export const shareWithTeamSchema = z.strictObject({
	type: z.literal("team"),
	teamId: uuidSchema,
	permission: permissionLevelSchema,
});

export type ShareWithTeamSchemaInput = z.input<typeof shareWithTeamSchema>;
export type ShareWithTeamSchemaOutput = z.output<typeof shareWithTeamSchema>;

/**
 * Peeks at the `type` discriminator on a POST /api/cases/[id]/permissions
 * body before either full schema below runs — shareWithTeamSchema and
 * shareByEmailSchema require different fields, so the route needs to know
 * which one to validate against before it can pick one. Loose (not
 * strict): everything but `type` is exactly what the chosen full schema
 * goes on to validate for real; this pre-parse only ever reads the
 * discriminator.
 */
export const shareTypeDiscriminatorSchema = z.looseObject({
	type: z.string().optional(),
});

/**
 * Discriminated union for sharing — either by email or with team
 */
export const sharePermissionSchema = z.discriminatedUnion("type", [
	shareWithTeamSchema,
	shareByEmailSchema.extend({ type: z.literal("user") }),
]);

export type SharePermissionSchemaInput = z.input<typeof sharePermissionSchema>;
export type SharePermissionSchemaOutput = z.output<
	typeof sharePermissionSchema
>;

/**
 * Update an existing permission
 */
export const updatePermissionSchema = z.strictObject({
	permission: permissionLevelSchema,
	type: z.enum(["user", "team"]).optional(),
});

export type UpdatePermissionSchemaInput = z.input<
	typeof updatePermissionSchema
>;
export type UpdatePermissionSchemaOutput = z.output<
	typeof updatePermissionSchema
>;
