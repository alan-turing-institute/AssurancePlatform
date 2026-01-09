"use server";

import { validateSession } from "@/lib/auth/validate-session";
import {
	type CreateAssuranceCaseInput,
	createAssuranceCaseSchema,
} from "@/lib/schemas/assurance-case";
import { validateInput } from "@/lib/validation/server-action";
import type { ActionResult } from "@/types";

type AssuranceCase = {
	id: number | string;
	name: string;
	description?: string;
	created_date?: string;
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
		owner: c.createdById ?? undefined,
	}));
};

export const createAssuranceCase = async (
	_token: string,
	input: CreateAssuranceCaseInput
): Promise<ActionResult<{ id: string }>> => {
	// 1. Validate input
	const validation = validateInput(input, createAssuranceCaseSchema);
	if (!validation.success) {
		return {
			success: false,
			error: validation.error,
			fieldErrors: validation.fieldErrors,
		};
	}

	// 2. Authenticate
	const validated = await validateSession();
	if (!validated) {
		return { success: false, error: "Invalid session" };
	}

	// 3. Business logic
	const { prismaNew } = await import("@/lib/prisma");

	try {
		const newCase = await prismaNew.assuranceCase.create({
			data: {
				name: validation.data.name,
				description: validation.data.description,
				colorProfile: validation.data.colorProfile,
				createdById: validated.userId,
			},
		});

		return { success: true, data: { id: newCase.id } };
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
