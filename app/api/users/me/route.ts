import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { prismaNew } from "@/lib/prisma";

type UserResponse = {
	id: string;
	username: string;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	avatarUrl?: string | null;
	groups?: Array<{
		id: string;
		name: string;
	}>;
};

/**
 * Fetches the current user from Prisma.
 */
async function getUserFromPrisma(userId: string): Promise<UserResponse | null> {
	const user = await prismaNew.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			username: true,
			email: true,
			firstName: true,
			lastName: true,
			avatarUrl: true,
			teamMemberships: {
				select: {
					team: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			},
		},
	});

	if (!user) {
		return null;
	}

	return {
		id: user.id,
		username: user.username,
		email: user.email,
		firstName: user.firstName,
		lastName: user.lastName,
		avatarUrl: user.avatarUrl,
		groups: user.teamMemberships.map((membership) => ({
			id: membership.team.id,
			name: membership.team.name,
		})),
	};
}

type ProfileUpdateRequest = {
	username?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
};

type DeleteAccountRequest = {
	password?: string;
};

/**
 * GET /api/users/me
 * Fetches the current user's profile.
 */
export async function GET() {
	try {
		const userId = await requireAuth();

		const user = await getUserFromPrisma(userId);

		if (!user) {
			return apiError(notFound("User"));
		}

		return apiSuccess(user);
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

		// Parse request body
		const body = (await request.json()) as ProfileUpdateRequest;

		// Call service to update profile
		const { updateUserProfile } = await import(
			"@/lib/services/user-management-service"
		);

		const result = await updateUserProfile(userId, {
			username: body.username,
			firstName: body.firstName,
			lastName: body.lastName,
			email: body.email,
		});

		if (!result.success) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Fetch updated user to return
		const updatedUser = await getUserFromPrisma(userId);
		return apiSuccess(updatedUser);
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

		if (!result.success) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
