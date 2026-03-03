import { headers } from "next/headers";
import {
	apiError,
	apiErrorFromUnknown,
	apiRateLimited,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { registerUserSchema } from "@/lib/schemas/user";
import {
	checkAndRecordRateLimit,
	RATE_LIMIT_CONFIGS,
} from "@/lib/services/rate-limit-service";
import { registerUser } from "@/lib/services/user-service";

/**
 * POST /api/users/register
 * Registers a new user with Prisma auth.
 */
export async function POST(request: Request) {
	try {
		const parsed = registerUserSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		const { username, email, password } = parsed.data;

		// Extract IP address and user agent for rate limiting
		const headersList = await headers();
		const forwarded = headersList.get("x-forwarded-for");
		const ipAddress = forwarded
			? forwarded.split(",")[0].trim()
			: (headersList.get("x-real-ip") ?? "unknown");
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
