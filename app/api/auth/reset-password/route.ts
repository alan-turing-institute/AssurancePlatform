import { headers } from "next/headers";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import {
	resetPassword,
	validateResetToken,
} from "@/lib/services/password-reset-service";

/**
 * GET /api/auth/reset-password?token=xxx
 * Validate a password reset token.
 */
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const token = searchParams.get("token");

		if (!token) {
			return apiError(validationError("Token is required"));
		}

		const result = await validateResetToken(token);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			valid: true,
			email: result.data.email,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/auth/reset-password
 * Reset password using a valid token.
 */
export async function POST(request: Request) {
	try {
		const body = await request.json().catch(() => null);
		const parsed = resetPasswordSchema.safeParse(body);

		if (!parsed.success) {
			const firstError = parsed.error.issues[0];
			return apiError(
				validationError(firstError?.message ?? "Invalid request")
			);
		}

		// Get client IP and user agent for audit logging
		const headersList = await headers();
		const forwarded = headersList.get("x-forwarded-for");
		const ipAddress = forwarded
			? (forwarded.split(",")[0]?.trim() ?? "unknown")
			: (headersList.get("x-real-ip") ?? "unknown");
		const userAgent = headersList.get("user-agent") ?? undefined;

		const result = await resetPassword(
			parsed.data.token,
			parsed.data.password,
			ipAddress,
			userAgent
		);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			success: true,
			message: "Your password has been reset successfully. You can now log in.",
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
