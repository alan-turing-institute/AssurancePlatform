import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import {
	deleteAccountSchema,
	updateUserProfileSchema,
} from "@/lib/schemas/user";

/**
 * GET /api/users/me
 * Fetches the current user's profile.
 */
export async function GET() {
	try {
		const userId = await requireAuth();

		const { getUserProfile } = await import("@/lib/services/user-service");
		const result = await getUserProfile(userId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PATCH /api/users/me
 * Updates the current user's profile.
 */
export async function PATCH(request: Request) {
	try {
		const userId = await requireAuth();

		const data = await parseJsonBody(request, updateUserProfileSchema);

		// Call service to update profile
		const { updateUserProfile } = await import(
			"@/lib/services/user-management-service"
		);

		const result = await updateUserProfile(userId, data);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Fetch updated user to return
		const { getUserProfile } = await import("@/lib/services/user-service");
		const profileResult = await getUserProfile(userId);

		if ("error" in profileResult) {
			return apiError(serviceErrorToAppError(profileResult.error));
		}

		return apiSuccess(profileResult.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * DELETE /api/users/me
 * Deletes the current user's account.
 */
export async function DELETE(request: Request) {
	try {
		const userId = await requireAuth();

		// Body carries a password for confirmation, but may be empty for
		// OAuth users, who have none to send — treated the same as {}
		// (emptyBodyAs), the same way POST /api/cases/[id]/publish treats an
		// absent body as "use defaults".
		const { password } = await parseJsonBody(request, deleteAccountSchema, {
			emptyBodyAs: {},
		});

		// Call service to delete account
		const { deleteAccount } = await import(
			"@/lib/services/user-management-service"
		);

		const result = await deleteAccount(userId, password);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
