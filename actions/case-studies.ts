"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { validateSession } from "@/lib/auth/validate-session";
import {
	caseStudyIdSchema,
	createCaseStudySchema,
	updateCaseStudySchema,
} from "@/lib/schemas/case-study";
import {
	validateFormData,
	validateInput,
} from "@/lib/validation/input-validation";
import type { ActionResult } from "@/types";

/**
 * Fetch all case studies owned by the current user
 */
export const fetchCaseStudies = async () => {
	const session = await validateSession();

	if (!session) {
		return null;
	}

	const { getCaseStudiesByOwner } = await import(
		"@/lib/services/case-study-service"
	);
	const { transformCaseStudiesForApi } = await import(
		"@/lib/services/case-study-transforms"
	);

	const result = await getCaseStudiesByOwner(session.userId);
	if ("error" in result) {
		return null;
	}
	return transformCaseStudiesForApi(result.data);
};

/**
 * Fetch all published case studies (public access)
 */
export const fetchPublishedCaseStudies = async () => {
	const { getPublishedCaseStudies } = await import(
		"@/lib/services/case-study-service"
	);
	const { transformCaseStudiesForApi } = await import(
		"@/lib/services/case-study-transforms"
	);

	const result = await getPublishedCaseStudies();
	if ("error" in result) {
		return null;
	}
	return transformCaseStudiesForApi(result.data);
};

/**
 * Fetch a specific published case study by ID (public access)
 */
export const fetchPublishedCaseStudyById = async (id: number) => {
	// Validate ID
	const validation = validateInput(id, caseStudyIdSchema);
	if (!validation.success) {
		notFound();
	}

	const { getPublishedCaseStudyById } = await import(
		"@/lib/services/case-study-service"
	);
	const { transformCaseStudyForApi } = await import(
		"@/lib/services/case-study-transforms"
	);

	const result = await getPublishedCaseStudyById(validation.data);

	if ("error" in result) {
		notFound();
	}

	return transformCaseStudyForApi(result.data);
};

/**
 * Fetch a specific case study by ID (requires authentication)
 */
export const fetchCaseStudyById = async (id: number) => {
	const session = await validateSession();

	if (!session) {
		return null;
	}

	// Validate ID
	const validation = validateInput(id, caseStudyIdSchema);
	if (!validation.success) {
		return null;
	}

	const { getCaseStudyById } = await import(
		"@/lib/services/case-study-service"
	);
	const { transformCaseStudyForApi } = await import(
		"@/lib/services/case-study-transforms"
	);

	const result = await getCaseStudyById(validation.data, session.userId);

	if ("error" in result) {
		return null;
	}

	return transformCaseStudyForApi(result.data);
};

/**
 * Create a new case study
 */
export const createCaseStudy = async (
	formData: FormData
): Promise<
	ActionResult<
		ReturnType<
			typeof import("@/lib/services/case-study-transforms").transformCaseStudyForApi
		>
	>
> => {
	// 1. Authenticate
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	// 2. Validate input
	const validation = validateFormData(formData, createCaseStudySchema);
	if (!validation.success) {
		return {
			success: false,
			error: validation.error,
			fieldErrors: validation.fieldErrors,
		};
	}

	const { createCaseStudyWithLinks } = await import(
		"@/lib/services/case-study-service"
	);
	const { transformCaseStudyForApi } = await import(
		"@/lib/services/case-study-transforms"
	);

	// 3. Business logic
	try {
		const createResult = await createCaseStudyWithLinks(
			session.userId,
			{
				title: validation.data.title,
				description: validation.data.description,
				authors: validation.data.authors,
				category: validation.data.category,
				sector: validation.data.sector,
				contact: validation.data.contact,
				type: validation.data.type,
				published: validation.data.published,
			},
			validation.data.assurance_cases
		);

		if ("error" in createResult) {
			return { success: false, error: createResult.error };
		}

		revalidatePath("/dashboard/case-studies");
		return {
			success: true,
			data: transformCaseStudyForApi(createResult.data),
		};
	} catch (error) {
		console.error("Error creating case study:", error);
		return { success: false, error: "Failed to create case study" };
	}
};

/**
 * Update an existing case study
 */
export const updateCaseStudy = async (
	formData: FormData
): Promise<ActionResult<boolean>> => {
	// 1. Authenticate
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	// 2. Validate input
	const validation = validateFormData(formData, updateCaseStudySchema);
	if (!validation.success) {
		return {
			success: false,
			error: validation.error,
			fieldErrors: validation.fieldErrors,
		};
	}

	const { updateCaseStudyWithLinks } = await import(
		"@/lib/services/case-study-service"
	);

	// 3. Business logic
	try {
		const { id, assurance_cases, ...updateData } = validation.data;

		const caseStudy = await updateCaseStudyWithLinks(
			id,
			session.userId,
			{
				title: updateData.title,
				description: updateData.description,
				authors: updateData.authors,
				category: updateData.category,
				sector: updateData.sector,
				contact: updateData.contact,
				type: updateData.type,
				published: updateData.published,
			},
			assurance_cases
		);

		if (!caseStudy) {
			return { success: false, error: "Case study not found or access denied" };
		}

		revalidatePath(`/dashboard/case-studies/${id}`);
		revalidatePath(`/discover/${id}`);
		revalidatePath("/discover");
		return { success: true, data: true };
	} catch (error) {
		console.error("Error updating case study:", error);
		return { success: false, error: "Failed to update case study" };
	}
};

/**
 * Delete a case study
 */
export const deleteCaseStudy = async (
	caseStudyId: number
): Promise<ActionResult<boolean>> => {
	// 1. Authenticate
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	// 2. Validate input
	const validation = validateInput(caseStudyId, caseStudyIdSchema);
	if (!validation.success) {
		return { success: false, error: validation.error };
	}

	const { deleteCaseStudy: deleteCaseStudyService } = await import(
		"@/lib/services/case-study-service"
	);

	// 3. Business logic
	try {
		const result = await deleteCaseStudyService(
			validation.data,
			session.userId
		);

		if ("error" in result) {
			return { success: false, error: result.error };
		}

		revalidatePath("/dashboard/case-studies");
		return { success: true, data: true };
	} catch (error) {
		console.error("Error deleting case study:", error);
		return { success: false, error: "Failed to delete case study" };
	}
};

/**
 * Fetch a published assurance case by the source assurance case ID (public access)
 */
export const fetchPublishedAssuranceCaseId = async (
	assuranceCaseId: string
) => {
	const { getPublishedAssuranceCaseByCaseId } = await import(
		"@/lib/services/case-study-service"
	);
	const { transformPublishedCaseForApi } = await import(
		"@/lib/services/case-study-transforms"
	);

	const result = await getPublishedAssuranceCaseByCaseId(assuranceCaseId);

	if ("error" in result) {
		return null;
	}

	return transformPublishedCaseForApi(result.data);
};
