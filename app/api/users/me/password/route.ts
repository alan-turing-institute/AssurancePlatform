import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { changePassword } from "@/lib/services/user-management-service";

/**
 * PUT /api/users/me/password
 * Changes the current user's password.
 */
export async function PUT(request: Request) {
	try {
		const userId = await requireAuth();

		const { currentPassword, newPassword } = await parseJsonBody(
			request,
			changePasswordSchema
		);

		const result = await changePassword(userId, {
			currentPassword,
			newPassword,
		});

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
