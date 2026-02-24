import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { notFound, validationError } from "@/lib/errors";

/**
 * POST /api/users/me/migration-notice
 * Marks the migration notice as seen for the current user.
 * Only succeeds if the user has a valid email address (not a placeholder).
 */
export async function POST() {
	try {
		const userId = await requireAuth();

		const { prisma } = await import("@/lib/prisma");

		// Fetch user to check if they have a valid email
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (!user) {
			return apiError(notFound("User"));
		}

		// Check if email is valid (not a placeholder)
		const hasValidEmail = user.email && !user.email.includes("@placeholder");

		if (!hasValidEmail) {
			return apiError(
				validationError("Valid email required to dismiss migration notice")
			);
		}

		// Update user to mark migration notice as seen
		await prisma.user.update({
			where: { id: userId },
			data: { hasSeenMigrationNotice: true },
		});

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
