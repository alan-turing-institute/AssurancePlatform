"use server";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

type AssuranceCase = {
	id: number | string;
	name: string;
	description?: string;
	created_date?: string;
	lock_reason?: string | null;
	owner?: number | string;
};

async function fetchAssuranceCasesFromPrisma(
	refreshToken: string
): Promise<AssuranceCase[] | null> {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");

	const validation = await validateRefreshToken(refreshToken);
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
}

async function fetchAssuranceCasesFromDjango(
	token: string
): Promise<AssuranceCase[] | null> {
	try {
		const myHeaders = new Headers();
		myHeaders.append("Content-Type", "application/json");
		myHeaders.append("Authorization", `Token ${token}`);

		const requestOptions: RequestInit = {
			method: "GET",
			headers: myHeaders,
			redirect: "follow",
		};

		const response = await fetch(
			`${(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) ?? (process.env.API_URL_STAGING || process.env.NEXT_PUBLIC_API_URL_STAGING)}/api/cases?owner=true&view=false&edit=false&review=false`,
			requestOptions
		);

		if (response.status === 401) {
			return null;
		}

		const result = await response.json();
		return result;
	} catch (_error) {
		return null;
	}
}

export const fetchAssuranceCases = async (
	token: string
): Promise<AssuranceCase[] | null> => {
	if (USE_PRISMA_AUTH) {
		return await fetchAssuranceCasesFromPrisma(token);
	}
	return await fetchAssuranceCasesFromDjango(token);
};

async function fetchSharedAssuranceCasesFromPrisma(
	refreshToken: string
): Promise<AssuranceCase[] | null> {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");

	const validation = await validateRefreshToken(refreshToken);
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
}

async function fetchSharedAssuranceCasesFromDjango(
	token: string
): Promise<AssuranceCase[] | null> {
	try {
		const myHeaders = new Headers();
		myHeaders.append("Content-Type", "application/json");
		myHeaders.append("Authorization", `Token ${token}`);

		const url = `${(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) ?? (process.env.API_URL_STAGING || process.env.NEXT_PUBLIC_API_URL_STAGING)}/api/cases?owner=false&view=true&edit=true`;

		const requestOptions: RequestInit = {
			method: "GET",
			headers: myHeaders,
			redirect: "follow",
		};

		const response = await fetch(url, requestOptions);

		if (response.status === 401) {
			return null;
		}

		const result = await response.json();
		return result;
	} catch (_error) {
		return null;
	}
}

export const fetchSharedAssuranceCases = async (
	token: string
): Promise<AssuranceCase[] | null> => {
	if (USE_PRISMA_AUTH) {
		return await fetchSharedAssuranceCasesFromPrisma(token);
	}
	return await fetchSharedAssuranceCasesFromDjango(token);
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

async function createAssuranceCaseInPrisma(
	refreshToken: string,
	input: CreateCaseInput
): Promise<CreateCaseResult> {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");

	const validation = await validateRefreshToken(refreshToken);
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
}

async function createAssuranceCaseInDjango(
	token: string,
	input: CreateCaseInput
): Promise<CreateCaseResult> {
	try {
		const response = await fetch(
			`${(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) ?? (process.env.API_URL_STAGING || process.env.NEXT_PUBLIC_API_URL_STAGING)}/api/cases/`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Token ${token}`,
				},
				body: JSON.stringify({
					name: input.name,
					description: input.description,
					lock_uuid: null,
					goals: [],
					color_profile: input.colorProfile ?? "default",
				}),
			}
		);

		if (!response.ok) {
			return { success: false, error: "Failed to create case" };
		}

		const result = await response.json();
		return { success: true, id: result.id };
	} catch (_error) {
		return { success: false, error: "Failed to create case" };
	}
}

export const createAssuranceCase = async (
	token: string,
	input: CreateCaseInput
): Promise<CreateCaseResult> => {
	if (USE_PRISMA_AUTH) {
		return await createAssuranceCaseInPrisma(token, input);
	}
	return await createAssuranceCaseInDjango(token, input);
};

export const fetchPublishedAssuranceCases = async (token: string) => {
	try {
		const myHeaders = new Headers();
		myHeaders.append("Content-Type", "application/json");
		myHeaders.append("Authorization", `Token ${token}`);

		const requestOptions: RequestInit = {
			method: "GET",
			headers: myHeaders,
			redirect: "follow",
		};

		const response = await fetch(
			`${(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) ?? (process.env.API_URL_STAGING || process.env.NEXT_PUBLIC_API_URL_STAGING)}/api/published-assurance-cases/`,
			requestOptions
		);

		if (response.status === 401) {
			return null;
		}

		const result = await response.json();
		return result;
	} catch (_error) {
		// redirect('/login')
		return null;
	}
};
