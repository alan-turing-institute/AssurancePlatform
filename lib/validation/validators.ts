import { emailSchema, usernameSchema } from "@/lib/schemas/base";
import { passwordSchema } from "@/lib/schemas/user";

type ValidationResult =
	| { valid: true; value: string }
	| { valid: false; error: string };

export function validateUsername(username: string): ValidationResult {
	const result = usernameSchema.safeParse(username);
	if (!result.success) {
		return {
			valid: false,
			error: result.error.issues[0]?.message ?? "Invalid input",
		};
	}
	return { valid: true, value: result.data };
}

export function validatePassword(password: string): ValidationResult {
	const result = passwordSchema.safeParse(password);
	if (!result.success) {
		return {
			valid: false,
			error: result.error.issues[0]?.message ?? "Invalid input",
		};
	}
	return { valid: true, value: result.data };
}

export function validateEmail(email: string): ValidationResult {
	const result = emailSchema.safeParse(email);
	if (!result.success) {
		return {
			valid: false,
			error: result.error.issues[0]?.message ?? "Invalid input",
		};
	}
	return { valid: true, value: result.data };
}
