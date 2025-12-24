import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import { changePassword } from "@/lib/services/user-management-service";

type PasswordChangeRequest = {
	currentPassword: string;
	newPassword: string;
};

/**
 * PUT /api/users/me/password
 * Changes the current user's password.
 */
export async function PUT(request: Request) {
	try {
		const validated = await validateSession();

		if (!validated) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		// Parse request body
		const body = (await request.json()) as PasswordChangeRequest;

		if (!(body.currentPassword && body.newPassword)) {
			return NextResponse.json(
				{ error: "Current password and new password are required" },
				{ status: 400 }
			);
		}

		const result = await changePassword(validated.userId, {
			currentPassword: body.currentPassword,
			newPassword: body.newPassword,
		});

		if (!result.success) {
			// Map field names if needed for frontend compatibility
			const field = result.field === "currentPassword" ? "password" : undefined;
			return NextResponse.json({ error: result.error, field }, { status: 400 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error changing password:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
