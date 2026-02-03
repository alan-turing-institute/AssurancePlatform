import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
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
		const userId = await requireAuth();

		// Parse request body
		const body = (await request.json()) as PasswordChangeRequest;

		if (!(body.currentPassword && body.newPassword)) {
			return apiError(
				validationError("Current password and new password are required")
			);
		}

		const result = await changePassword(userId, {
			currentPassword: body.currentPassword,
			newPassword: body.newPassword,
		});

		if (!result.success) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
