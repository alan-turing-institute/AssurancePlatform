import { headers } from "next/headers";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import {
	resetPassword,
	validateResetToken,
} from "@/lib/services/password-reset-service";

type ResetPasswordRequest = {
	token: string;
	password: string;
};

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

		if (!result.success) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			valid: true,
			email: result.email,
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
		// Parse request body
		const body = (await request.json()) as ResetPasswordRequest;

		if (!body.token) {
			return apiError(validationError("Token is required"));
		}

		if (!body.password) {
			return apiError(validationError("Password is required"));
		}

		// Get client IP and user agent for audit logging
		const headersList = await headers();
		const forwarded = headersList.get("x-forwarded-for");
		const ipAddress = forwarded
			? forwarded.split(",")[0].trim()
			: (headersList.get("x-real-ip") ?? "unknown");
		const userAgent = headersList.get("user-agent") ?? undefined;

		const result = await resetPassword(
			body.token,
			body.password,
			ipAddress,
			userAgent
		);

		if (!result.success) {
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
