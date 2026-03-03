import { z } from "zod";

/**
 * Schema for resetting a password using a valid token.
 */
export const resetPasswordSchema = z.object({
	token: z.string().min(1, "Token is required"),
	password: z.string().min(1, "Password is required"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Schema for changing the current user's password.
 */
export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(1, "New password is required"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
