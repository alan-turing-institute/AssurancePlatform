import { headers } from "next/headers";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { extractClientIp } from "@/lib/auth/extract-client-ip";
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
 * @response 413 - Payload too large
 */
export async function POST(request: Request) {
	try {
		const data = await parseJsonBody(request, resetPasswordSchema);

		// Get client IP and user agent for audit logging
		const headersList = await headers();
		const ipAddress = extractClientIp(headersList);
		const userAgent = headersList.get("user-agent") ?? undefined;

		const result = await resetPassword(
			data.token,
			data.password,
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
