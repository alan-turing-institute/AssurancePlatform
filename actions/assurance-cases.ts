"use server";

import { validateSession } from "@/lib/auth/validate-session";
import type { ActionResult } from "@/lib/errors";
import {
	type CreateAssuranceCaseInput,
	createAssuranceCaseSchema,
} from "@/lib/schemas/assurance-case";
import { validateInput } from "@/lib/validation/input-validation";

type AssuranceCase = {
	id: number | string;
	name: string;
	description?: string;
	createdDate?: string;
	updatedDate?: string;
	owner?: number | string;
	isDemo?: boolean;
};

export const fetchAssuranceCases = async (): Promise<
	AssuranceCase[] | null
> => {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const { listUserCases } = await import("@/lib/services/case-fetch-service");
	const result = await listUserCases(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
};

export const fetchSharedAssuranceCases = async (): Promise<
	AssuranceCase[] | null
> => {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const { listSharedCases } = await import("@/lib/services/case-fetch-service");
	const result = await listSharedCases(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
};

export const createAssuranceCase = async (
	input: CreateAssuranceCaseInput
): Promise<ActionResult<{ id: string }>> => {
	const validated = await validateSession();
	if (!validated) {
		return { success: false, error: "Invalid session" };
	}

	const validation = validateInput(input, createAssuranceCaseSchema);
	if (!validation.success) {
		return {
			success: false,
			error: validation.error,
			fieldErrors: validation.fieldErrors,
		};
	}

	const { createCase } = await import("@/lib/services/case-fetch-service");
	const result = await createCase(validated.userId, {
		name: validation.data.name,
		description: validation.data.description,
		colourProfile: validation.data.colourProfile,
	});

	if ("error" in result) {
		return { success: false, error: result.error };
	}

	return { success: true, data: result.data };
};

export const fetchPublishedAssuranceCases = async (): Promise<
	AssuranceCase[]
> => {
	// Note: Published cases feature not yet implemented in Prisma schema
	// This function is retained for backwards compatibility but returns empty array
	return await Promise.resolve([]);
};

type PublishedCaseForStudy = {
	id: string;
	name: string;
	description: string;
	publishStatus: string;
	publishedAt: string | null;
	markedReadyAt: string | null;
	publishedVersionId: string | null;
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
		"@/lib/services/case-study-service"
	);

	const result = await getCasesAvailableForCaseStudy(validated.userId);

	if ("error" in result) {
		return [];
	}

	return result.data.map((c) => ({
		id: c.id,
		name: c.name,
		description: c.description,
		publishStatus: c.publishStatus,
		publishedAt: c.publishedAt?.toISOString() ?? null,
		markedReadyAt: c.markedReadyAt?.toISOString() ?? null,
		publishedVersionId: c.publishedVersionId,
	}));
}
