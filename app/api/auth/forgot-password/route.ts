import { headers } from "next/headers";
import {
	apiError,
	apiErrorFromUnknown,
	apiRateLimited,
	apiSuccess,
} from "@/lib/api-response";
import { AppError, validationError } from "@/lib/errors";
import { requestPasswordReset } from "@/lib/services/password-reset-service";

interface ForgotPasswordRequest {
	email: string;
}

/**
 * POST /api/auth/forgot-password
 * Request a password reset email.
 */
export async function POST(request: Request) {
	try {
		// Parse request body
		const body = (await request.json()) as ForgotPasswordRequest;

		if (!body.email) {
			return apiError(validationError("Email is required"));
		}

		// Get client IP and user agent for rate limiting
		const headersList = await headers();
		const forwarded = headersList.get("x-forwarded-for");
		const ipAddress = forwarded
			? (forwarded.split(",")[0]?.trim() ?? "unknown")
			: (headersList.get("x-real-ip") ?? "unknown");
		const userAgent = headersList.get("user-agent") ?? undefined;

		const result = await requestPasswordReset(body.email, ipAddress, userAgent);

		if ("error" in result) {
			if (result.rateLimited) {
				return apiRateLimited(result.error, 60 * 1000);
			}
			return apiError(
				new AppError({ code: "VALIDATION", message: result.error })
			);
		}

		// Always return success to prevent user enumeration
		return apiSuccess({
			success: true,
			message:
				"If an account with that email exists, you will receive a password reset link shortly.",
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
