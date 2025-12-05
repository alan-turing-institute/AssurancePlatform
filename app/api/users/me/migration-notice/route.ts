import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/**
 * POST /api/users/me/migration-notice
 * Marks the migration notice as seen for the current user.
 * Only succeeds if the user has a valid email address (not a placeholder).
 */
export async function POST() {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.key) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const { validateRefreshToken } = await import(
			"@/lib/auth/refresh-token-service"
		);
		const { prismaNew } = await import("@/lib/prisma-new");

		const validation = await validateRefreshToken(session.key);

		if (!validation.valid) {
			return NextResponse.json({ error: "Session expired" }, { status: 401 });
		}

		// Fetch user to check if they have a valid email
		const user = await prismaNew.user.findUnique({
			where: { id: validation.userId },
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
			where: { id: validation.userId },
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
