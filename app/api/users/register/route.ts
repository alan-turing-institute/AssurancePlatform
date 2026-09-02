import { headers } from "next/headers";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiRateLimited,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { extractClientIp } from "@/lib/auth/extract-client-ip";
import { registerUserSchema } from "@/lib/schemas/user";
import {
	checkAndRecordRateLimit,
	RATE_LIMIT_CONFIGS,
} from "@/lib/services/rate-limit-service";
import { registerUser } from "@/lib/services/user-service";

/**
 * POST /api/users/register
 * Registers a new user with Prisma auth.
 * @response 413 - Payload too large
 */
export async function POST(request: Request) {
	try {
		const { username, email, password } = await parseJsonBody(
			request,
			registerUserSchema
		);

		// Extract IP address and user agent for rate limiting
		const headersList = await headers();
		const ipAddress = extractClientIp(headersList);
		const userAgent = headersList.get("user-agent") ?? undefined;

		// Check rate limit before processing
		const rateLimitResult = await checkAndRecordRateLimit(
			RATE_LIMIT_CONFIGS.register,
			{ ipAddress, email },
			{ ipAddress, userAgent }
		);

		if (!rateLimitResult.allowed) {
			return apiRateLimited(
				rateLimitResult.reason ?? "Too many requests",
				rateLimitResult.retryAfterMs
			);
		}

		const result = await registerUser({
			username,
			email,
			password: password ?? "",
		});

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
