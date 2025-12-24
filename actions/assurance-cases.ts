"use server";

import { validateSession } from "@/lib/auth/validate-session";

type AssuranceCase = {
	id: number | string;
	name: string;
	description?: string;
	created_date?: string;
	lock_reason?: string | null;
	owner?: number | string;
};

export const fetchAssuranceCases = async (
	_token: string
): Promise<AssuranceCase[] | null> => {
	const { prismaNew } = await import("@/lib/prisma");

	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	// Get cases where user is creator OR has explicit permission
	const cases = await prismaNew.assuranceCase.findMany({
		where: {
			OR: [
				{ createdById: validated.userId },
				{
					userPermissions: {
						some: {
							userId: validated.userId,
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
	_token: string
): Promise<AssuranceCase[] | null> => {
	const { prismaNew } = await import("@/lib/prisma");

	const validated = await validateSession();
	if (!validated) {
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
									userId: validated.userId,
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
												userId: validated.userId,
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
						createdById: validated.userId,
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
	_token: string,
	input: CreateCaseInput
): Promise<CreateCaseResult> => {
	const { prismaNew } = await import("@/lib/prisma");

	const validated = await validateSession();
	if (!validated) {
		return { success: false, error: "Invalid session" };
	}

	try {
		const newCase = await prismaNew.assuranceCase.create({
			data: {
				name: input.name,
				description: input.description,
				colorProfile: input.colorProfile ?? "default",
				createdById: validated.userId,
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
