import { headers } from "next/headers";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiRateLimited,
	apiSuccess,
} from "@/lib/api-response";
import { extractClientIp } from "@/lib/auth/extract-client-ip";
import { AppError } from "@/lib/errors";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { requestPasswordReset } from "@/lib/services/password-reset-service";

/**
 * POST /api/auth/forgot-password
 * Request a password reset email.
 */
export async function POST(request: Request) {
	try {
		const { email } = await parseJsonBody(request, forgotPasswordSchema);

		// Get client IP and user agent for rate limiting
		const headersList = await headers();
		const ipAddress = extractClientIp(headersList);
		const userAgent = headersList.get("user-agent") ?? undefined;

		const result = await requestPasswordReset(email, ipAddress, userAgent);

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
