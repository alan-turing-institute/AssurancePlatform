import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Feature flag for Prisma-based API
const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

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
	const { prismaNew } = await import("@/lib/prisma-new");

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

/**
 * Fetches the current user from Django API.
 */
async function getUserFromDjango(token: string): Promise<UserResponse | null> {
	const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
	if (!apiUrl) {
		throw new Error("API_URL or NEXT_PUBLIC_API_URL must be configured");
	}

	const response = await fetch(`${apiUrl}/api/user/`, {
		headers: {
			Authorization: `Token ${token}`,
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			return null;
		}
		throw new Error(`Django API returned status ${response.status}`);
	}

	return response.json();
}

export async function GET() {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.key) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		let user: UserResponse | null;

		if (USE_PRISMA_AUTH) {
			// For Prisma auth, the session contains the user ID
			// We need to validate the refresh token and get the user ID
			const { validateRefreshToken } = await import(
				"@/lib/auth/refresh-token-service"
			);
			const validation = await validateRefreshToken(session.key);

			if (!validation.valid) {
				return NextResponse.json({ error: "Session expired" }, { status: 401 });
			}

			user = await getUserFromPrisma(validation.userId);
		} else {
			user = await getUserFromDjango(session.key);
		}

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
