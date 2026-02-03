import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
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
		const body = await request.json();

		// Extract IP address and user agent for rate limiting
		const headersList = await headers();
		const forwarded = headersList.get("x-forwarded-for");
		const ipAddress = forwarded
			? forwarded.split(",")[0].trim()
			: (headersList.get("x-real-ip") ?? "unknown");
		const userAgent = headersList.get("user-agent") ?? undefined;

		// Support both password formats (password1/password2 from form, or password directly)
		const password = body.password || body.password1;
		const email = body.email?.toLowerCase().trim();

		// Check rate limit before processing
		const rateLimitResult = await checkAndRecordRateLimit(
			RATE_LIMIT_CONFIGS.register,
			{ ipAddress, email },
			{ ipAddress, userAgent }
		);

		if (!rateLimitResult.allowed) {
			const response = new NextResponse(
				JSON.stringify({
					error: rateLimitResult.reason,
					code: "RATE_LIMITED",
				}),
				{ status: 429 }
			);

			// Add Retry-After header if available
			if (rateLimitResult.retryAfterMs) {
				response.headers.set(
					"Retry-After",
					String(Math.ceil(rateLimitResult.retryAfterMs / 1000))
				);
			}

			return response;
		}

		// Validate passwords match if both provided
		if (body.password1 && body.password2 && body.password1 !== body.password2) {
			return apiError(
				validationError("Passwords do not match", {
					password2: "Passwords do not match",
				})
			);
		}

		if (!(body.username && body.email && password)) {
			return apiError(
				validationError("Username, email, and password are required")
			);
		}

		const result = await registerUser({
			username: body.username,
			email: body.email,
			password,
		});

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
