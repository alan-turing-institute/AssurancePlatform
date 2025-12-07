import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { validateRefreshToken } from "@/lib/auth/refresh-token-service";
import { authOptions } from "@/lib/auth-options";
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
		const session = await getServerSession(authOptions);

		if (!session?.key) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const validation = await validateRefreshToken(session.key);

		if (!validation.valid) {
			return NextResponse.json({ error: "Session expired" }, { status: 401 });
		}

		const user = await getUserFromPrisma(validation.userId);

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		return NextResponse.json(user);
	} catch (error) {
		console.error("Error fetching user:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

/**
 * PATCH /api/users/me
 * Updates the current user's profile.
 */
export async function PATCH(request: Request) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.key) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const validation = await validateRefreshToken(session.key);

		if (!validation.valid) {
			return NextResponse.json({ error: "Session expired" }, { status: 401 });
		}

		// Parse request body
		const body = (await request.json()) as ProfileUpdateRequest;

		// Call service to update profile
		const { updateUserProfile } = await import(
			"@/lib/services/user-management-service"
		);

		const result = await updateUserProfile(validation.userId, {
			username: body.username,
			firstName: body.firstName,
			lastName: body.lastName,
			email: body.email,
		});

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error, field: result.field },
				{ status: 400 }
			);
		}

		// Fetch updated user to return
		const updatedUser = await getUserFromPrisma(validation.userId);
		return NextResponse.json(updatedUser);
	} catch (error) {
		console.error("Error updating user profile:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/users/me
 * Deletes the current user's account.
 */
export async function DELETE(request: Request) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.key) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const validation = await validateRefreshToken(session.key);

		if (!validation.valid) {
			return NextResponse.json({ error: "Session expired" }, { status: 401 });
		}

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

		const result = await deleteAccount(validation.userId, password);

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error, field: result.field },
				{ status: 400 }
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting account:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
