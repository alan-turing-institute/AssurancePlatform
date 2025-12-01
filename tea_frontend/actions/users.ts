"use server";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

type CurrentUser = {
	id: number | string;
	username: string;
	email: string;
	first_name?: string;
	last_name?: string;
	avatar?: string | null;
	groups?: Array<{ id: number | string; name: string }>;
};

async function fetchCurrentUserFromPrisma(
	refreshToken: string
): Promise<CurrentUser | null | undefined> {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");

	const validation = await validateRefreshToken(refreshToken);
	if (!validation.valid) {
		return null;
	}

	const user = await prismaNew.user.findUnique({
		where: { id: validation.userId },
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
		first_name: user.firstName ?? undefined,
		last_name: user.lastName ?? undefined,
		avatar: user.avatarUrl,
		groups: user.teamMemberships.map((m) => ({
			id: m.team.id,
			name: m.team.name,
		})),
	};
}

async function fetchCurrentUserFromDjango(
	token: string
): Promise<CurrentUser | null | undefined> {
	const requestOptions: RequestInit = {
		headers: {
			Authorization: `Token ${token}`,
		},
	};

	const response = await fetch(
		`${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL}/api/user/`,
		requestOptions
	);

	if (response.status === 404 || response.status === 403) {
		return;
	}

	if (response.status === 401) {
		return null;
	}

	const result = await response.json();
	return result;
}

export const fetchCurrentUser = async (
	token: string
): Promise<CurrentUser | null | undefined> => {
	if (USE_PRISMA_AUTH) {
		return fetchCurrentUserFromPrisma(token);
	}
	return fetchCurrentUserFromDjango(token);
};
