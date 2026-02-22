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
	updated_date?: string;
	owner?: number | string;
	isDemo?: boolean;
};

export const fetchAssuranceCases = async (
	_token: string
): Promise<AssuranceCase[] | null> => {
	const { prismaNew } = await import("@/lib/prisma");

	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	// Get cases where user is creator OR has explicit permission (exclude soft-deleted)
	const cases = await prismaNew.assuranceCase.findMany({
		where: {
			deletedAt: null,
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
			updatedAt: true,
			createdById: true,
			isDemo: true,
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
		updated_date: c.updatedAt.toISOString(),
		owner: c.createdById ?? undefined,
		isDemo: c.isDemo,
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

	// Get cases where user has permission (direct or via team) but is NOT the creator (exclude soft-deleted)
	const cases = await prismaNew.assuranceCase.findMany({
		where: {
			deletedAt: null,
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
			updatedAt: true,
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
		updated_date: c.updatedAt.toISOString(),
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

type PublishedCaseForStudy = {
	id: string;
	name: string;
	description: string;
	publish_status: string;
	published_at: string | null;
	marked_ready_at: string | null;
	published_version_id: string | null;
};

/**
 * Fetches the current user's cases that are available for linking to case studies
 * (those with READY_TO_PUBLISH or PUBLISHED status).
 */
export async function fetchPublishedCasesForStudy(): Promise<
	PublishedCaseForStudy[]
> {
	const validated = await validateSession();
	if (!validated) {
		return [];
	}

	const { getCasesAvailableForCaseStudy } = await import(
		"@/lib/services/publish-service"
	);

	const cases = await getCasesAvailableForCaseStudy(validated.userId);

	return cases.map((c) => ({
		id: c.id,
		name: c.name,
		description: c.description,
		publish_status: c.publishStatus,
		published_at: c.publishedAt?.toISOString() ?? null,
		marked_ready_at: c.markedReadyAt?.toISOString() ?? null,
		published_version_id: c.publishedVersionId,
	}));
}
