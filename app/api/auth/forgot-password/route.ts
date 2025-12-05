import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/services/password-reset-service";

type ForgotPasswordRequest = {
	email: string;
};

/**
 * POST /api/auth/forgot-password
 * Request a password reset email.
 */
export async function POST(request: Request) {
	try {
		// Parse request body
		const body = (await request.json()) as ForgotPasswordRequest;

		if (!body.email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		// Get client IP and user agent for rate limiting
		const headersList = await headers();
		const forwarded = headersList.get("x-forwarded-for");
		const ipAddress = forwarded
			? forwarded.split(",")[0].trim()
			: (headersList.get("x-real-ip") ?? "unknown");
		const userAgent = headersList.get("user-agent") ?? undefined;

		const result = await requestPasswordReset(body.email, ipAddress, userAgent);

		if (!result.success) {
			const status = result.rateLimited ? 429 : 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		// Always return success to prevent user enumeration
		return NextResponse.json({
			success: true,
			message:
				"If an account with that email exists, you will receive a password reset link shortly.",
		});
	} catch (error) {
		console.error("Error requesting password reset:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
