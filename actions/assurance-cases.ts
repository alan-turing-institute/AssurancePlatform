"use server";

type AssuranceCase = {
	id: number | string;
	name: string;
	description?: string;
	created_date?: string;
	lock_reason?: string | null;
	owner?: number | string;
};

export const fetchAssuranceCases = async (
	token: string
): Promise<AssuranceCase[] | null> => {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");

	const validation = await validateRefreshToken(token);
	if (!validation.valid) {
		return null;
	}

	// Get cases where user is creator OR has explicit permission
	const cases = await prismaNew.assuranceCase.findMany({
		where: {
			OR: [
				{ createdById: validation.userId },
				{
					userPermissions: {
						some: {
							userId: validation.userId,
						},
					},
				},
			],
		},
		select: {
			id: true,
			name: true,
			description: true,
			createdAt: true,
			lockUuid: true,
			createdById: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return cases.map((c) => ({
		id: c.id,
		name: c.name,
		description: c.description ?? undefined,
		created_date: c.createdAt.toISOString(),
		lock_reason: c.lockUuid,
		owner: c.createdById ?? undefined,
	}));
};

export const fetchSharedAssuranceCases = async (
	token: string
): Promise<AssuranceCase[] | null> => {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");

	const validation = await validateRefreshToken(token);
	if (!validation.valid) {
		return null;
	}

	// Get cases where user has permission (direct or via team) but is NOT the creator
	const cases = await prismaNew.assuranceCase.findMany({
		where: {
			AND: [
				// User has permission (either direct or via team membership)
				{
					OR: [
						// Direct user permission
						{
							userPermissions: {
								some: {
									userId: validation.userId,
								},
							},
						},
						// Team-based permission (user is member of a team with access)
						{
							teamPermissions: {
								some: {
									team: {
										members: {
											some: {
												userId: validation.userId,
											},
										},
									},
								},
							},
						},
					],
				},
				// User is NOT the creator
				{
					NOT: {
						createdById: validation.userId,
					},
				},
			],
		},
		select: {
			id: true,
			name: true,
			description: true,
			createdAt: true,
			lockUuid: true,
			createdById: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return cases.map((c) => ({
		id: c.id,
		name: c.name,
		description: c.description ?? undefined,
		created_date: c.createdAt.toISOString(),
		lock_reason: c.lockUuid,
		owner: c.createdById ?? undefined,
	}));
};

type CreateCaseInput = {
	name: string;
	description: string;
	colorProfile?: string;
};

type CreateCaseResult = {
	success: boolean;
	id?: string;
	error?: string;
};

export const createAssuranceCase = async (
	token: string,
	input: CreateCaseInput
): Promise<CreateCaseResult> => {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");

	const validation = await validateRefreshToken(token);
	if (!validation.valid) {
		return { success: false, error: "Invalid session" };
	}

	try {
		const newCase = await prismaNew.assuranceCase.create({
			data: {
				name: input.name,
				description: input.description,
				colorProfile: input.colorProfile ?? "default",
				createdById: validation.userId,
			},
		});

		return { success: true, id: newCase.id };
	} catch (error) {
		console.error("Failed to create case:", error);
		return { success: false, error: "Failed to create case" };
	}
};

export const fetchPublishedAssuranceCases = async (
	_token: string
): Promise<AssuranceCase[]> => {
	// Note: Published cases feature not yet implemented in Prisma schema
	// This function is retained for backwards compatibility but returns empty array
	return await Promise.resolve([]);
};
