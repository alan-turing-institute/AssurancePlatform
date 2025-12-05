"use server";

type CurrentUser = {
	id: number | string;
	username: string;
	email: string;
	firstName?: string;
	lastName?: string;
	avatar?: string | null;
	groups?: Array<{ id: number | string; name: string }>;
	hasSeenMigrationNotice?: boolean;
};

export const fetchCurrentUser = async (
	token: string
): Promise<CurrentUser | null | undefined> => {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");

	const validation = await validateRefreshToken(token);
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
			hasSeenMigrationNotice: true,
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
		firstName: user.firstName ?? undefined,
		lastName: user.lastName ?? undefined,
		avatar: user.avatarUrl,
		groups: user.teamMemberships.map((m) => ({
			id: m.team.id,
			name: m.team.name,
		})),
		hasSeenMigrationNotice: user.hasSeenMigrationNotice,
	};
};
