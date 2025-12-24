import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";

/**
 * POST /api/users/me/migration-notice
 * Marks the migration notice as seen for the current user.
 * Only succeeds if the user has a valid email address (not a placeholder).
 */
export async function POST() {
	try {
		const validated = await validateSession();

		if (!validated) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const { prismaNew } = await import("@/lib/prisma");

		// Fetch user to check if they have a valid email
		const user = await prismaNew.user.findUnique({
			where: { id: validated.userId },
			select: { email: true },
		});

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// Check if email is valid (not a placeholder)
		const hasValidEmail = user.email && !user.email.includes("@placeholder");

		if (!hasValidEmail) {
			return NextResponse.json(
				{ error: "Valid email required to dismiss migration notice" },
				{ status: 400 }
			);
		}

		// Update user to mark migration notice as seen
		await prismaNew.user.update({
			where: { id: validated.userId },
			data: { hasSeenMigrationNotice: true },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error marking migration notice as seen:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
