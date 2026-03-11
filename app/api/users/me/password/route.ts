import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { changePassword } from "@/lib/services/user-management-service";

/**
 * PUT /api/users/me/password
 * Changes the current user's password.
 */
export async function PUT(request: Request) {
	try {
		const userId = await requireAuth();

		// Parse and validate request body
		const body: unknown = await request.json();
		const parsed = changePasswordSchema.safeParse(body);
		if (!parsed.success) {
			return apiError(
				validationError("Current password and new password are required")
			);
		}

		const result = await changePassword(userId, {
			currentPassword: parsed.data.currentPassword,
			newPassword: parsed.data.newPassword,
		});

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
