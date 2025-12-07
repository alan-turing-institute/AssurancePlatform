import { headers } from "next/headers";
import { NextResponse } from "next/server";
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
			return NextResponse.json({ error: "Token is required" }, { status: 400 });
		}

		const result = await validateResetToken(token);

		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 400 });
		}

		return NextResponse.json({
			valid: true,
			email: result.email,
		});
	} catch (error) {
		console.error("Error validating reset token:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
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
			return NextResponse.json({ error: "Token is required" }, { status: 400 });
		}

		if (!body.password) {
			return NextResponse.json(
				{ error: "Password is required" },
				{ status: 400 }
			);
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
			return NextResponse.json({ error: result.error }, { status: 400 });
		}

		return NextResponse.json({
			success: true,
			message: "Your password has been reset successfully. You can now log in.",
		});
	} catch (error) {
		console.error("Error resetting password:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
