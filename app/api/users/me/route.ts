import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { updateUserProfileSchema } from "@/lib/schemas/user";

interface DeleteAccountRequest {
	password?: string;
}

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

		const parsed = updateUserProfileSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		// Call service to update profile
		const { updateUserProfile } = await import(
			"@/lib/services/user-management-service"
		);

		const result = await updateUserProfile(userId, parsed.data);

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

		// Parse request body (password for confirmation)
		let password: string | undefined;
		try {
			const body = (await request.json()) as DeleteAccountRequest;
			password = body.password;
		} catch {
			// Body may be empty for OAuth users
		}

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
