import { z } from "zod";
import { emailSchema, optionalString, requiredString } from "./base";

// ============================================
// Password Primitives
// ============================================

/**
 * Strong password — min 8 chars, uppercase, digit, special character.
 * Used across registration, reset, and change-password flows.
 */
export const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
	.regex(/\d/, "Password must contain at least one number")
	.regex(
		/[!@#$%^&*()_,.?":{}|<>]/,
		"Password must contain at least one special character"
	)
	.describe("Strong password with uppercase, digit, and special character");

// ============================================
// Auth Form Schemas
// ============================================

/**
 * Sign-in form — accepts email or username as identifier
 */
export const signInFormSchema = z.object({
	identifier: z.string().min(2, "Please enter your email or username"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignInFormInput = z.input<typeof signInFormSchema>;
export type SignInFormOutput = z.output<typeof signInFormSchema>;

/**
 * Reset password form — requires matching passwords
 */
export const resetPasswordFormSchema = z
	.object({
		password: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export type ResetPasswordFormInput = z.input<typeof resetPasswordFormSchema>;
export type ResetPasswordFormOutput = z.output<typeof resetPasswordFormSchema>;

/**
 * Change password form — requires current password + matching new passwords
 */
export const changePasswordFormSchema = z
	.object({
		currentPassword: z
			.string()
			.min(2, "Current password must be at least 2 characters"),
		newPassword: passwordSchema,
		confirmPassword: z
			.string()
			.min(2, "Confirm password must be at least 2 characters"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passwords do not match",
	});

export type ChangePasswordFormInput = z.input<typeof changePasswordFormSchema>;
export type ChangePasswordFormOutput = z.output<
	typeof changePasswordFormSchema
>;

/**
 * Register form validation schema — UI-level constraints for the registration form.
 * Stricter than `registerUserSchema` (which is the API-level schema).
 */
export const registerFormSchema = z.object({
	username: z
		.string()
		.min(2, "Username must be at least 2 characters")
		.max(250, "Username must be less than 250 characters")
		.regex(/^\S*$/, "Username cannot contain spaces"),
	email: emailSchema,
	password1: passwordSchema,
	password2: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
		.regex(/\d/, "Password must contain at least one number")
		.regex(
			/[!@#$%^&*()_,.?":{}|<>]/,
			"Password must contain at least one special character"
		),
});

export type RegisterFormInput = z.input<typeof registerFormSchema>;
export type RegisterFormOutput = z.output<typeof registerFormSchema>;

/**
 * Forgot password form schema — validates an email address
 */
export const forgotPasswordFormSchema = z.object({
	email: emailSchema,
});

export type ForgotPasswordFormInput = z.input<typeof forgotPasswordFormSchema>;
export type ForgotPasswordFormOutput = z.output<
	typeof forgotPasswordFormSchema
>;

/**
 * Personal info form schema — UI-level validation for the settings profile form.
 * Stricter than `updateUserProfileSchema` (which is the API-level schema).
 */
export const personalInfoFormSchema = z.object({
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	username: z
		.string()
		.min(3, "Username must be at least 3 characters")
		.regex(/^[a-zA-Z0-9_]+$/, {
			message: "Username can only contain letters, numbers, and underscores",
		}),
	email: emailSchema,
});

export type PersonalInfoFormInput = z.input<typeof personalInfoFormSchema>;
export type PersonalInfoFormOutput = z.output<typeof personalInfoFormSchema>;

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
export type RegisterUserSchemaOutput = z.output<typeof registerUserSchema>;

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
export type UpdateUserProfileSchemaOutput = z.output<
	typeof updateUserProfileSchema
>;
