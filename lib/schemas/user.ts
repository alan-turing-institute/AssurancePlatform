import { z } from "zod";
import { emailSchema, optionalString, requiredString } from "./base";

/**
 * Register user input
 */
export const registerUserSchema = z
	.object({
		username: requiredString("Username", 1, 150),
		email: emailSchema,
		password: z.string().min(1, "Password is required").optional(),
		password1: z.string().min(1, "Password is required").optional(),
		password2: z.string().optional(),
	})
	.transform((data) => ({
		...data,
		password: data.password || data.password1,
	}))
	.refine((data) => !!data.password, {
		message: "Password is required",
		path: ["password"],
	})
	.refine(
		(data) => {
			if (data.password1 && data.password2) {
				return data.password1 === data.password2;
			}
			return true;
		},
		{ message: "Passwords do not match", path: ["password2"] }
	);

export type RegisterUserSchemaInput = z.input<typeof registerUserSchema>;

/**
 * Update user profile input
 */
export const updateUserProfileSchema = z
	.object({
		username: requiredString("Username", 1, 150).optional(),
		firstName: optionalString(150),
		lastName: optionalString(150),
		email: emailSchema.optional(),
	})
	.refine((data) => Object.values(data).some((v) => v !== undefined), {
		message: "At least one field to update must be provided",
	});

export type UpdateUserProfileSchemaInput = z.input<
	typeof updateUserProfileSchema
>;
