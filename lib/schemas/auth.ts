import { z } from "zod";

/**
 * Schema for resetting a password using a valid token.
 */
export const resetPasswordSchema = z.strictObject({
	token: z.string().min(1, "Token is required"),
	password: z.string().min(1, "Password is required"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Schema for changing the current user's password.
 */
export const changePasswordSchema = z.strictObject({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(1, "New password is required"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Schema for requesting a password reset email. Deliberately does NOT use
 * `emailSchema` (`lib/schemas/base.ts`) or `forgotPasswordFormSchema`
 * (`lib/schemas/user.ts`, the UI form's schema) — both add an email-format
 * check, which would turn a malformed-but-non-empty address into a 400 here
 * and leak whether the input *looked like* a real address. The route's
 * existing behaviour (`requestPasswordReset`) already returns the same
 * generic success message for a known and an unknown email, so this schema
 * only needs to confirm a body was sent at all — it must not become a new
 * enumeration or format oracle.
 */
export const forgotPasswordSchema = z.strictObject({
	// Custom message on the base type error too, not just .min() — a wholly
	// absent `email` key hits the type check first ("expected string,
	// received undefined"), and the pre-migration route treated a missing
	// key and an empty string identically ("Email is required" either way).
	email: z.string({ error: "Email is required" }).min(1, "Email is required"),
});
