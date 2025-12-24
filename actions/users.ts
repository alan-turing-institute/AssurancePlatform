"use server";

import { validateSession } from "@/lib/auth/validate-session";

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
	_token: string
): Promise<CurrentUser | null | undefined> => {
	const { prismaNew } = await import("@/lib/prisma");

	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const user = await prismaNew.user.findUnique({
		where: { id: validated.userId },
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
