"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
	caseStudyIdSchema,
	createCaseStudySchema,
	updateCaseStudySchema,
} from "@/lib/schemas/case-study";
import {
	createCaseStudyWithLinks,
	deleteCaseStudy as deleteCaseStudyService,
	getCaseStudiesByOwner,
	getCaseStudyById,
	getPublishedAssuranceCaseByCaseId,
	getPublishedCaseStudies,
	getPublishedCaseStudyById,
	updateCaseStudyWithLinks,
} from "@/lib/services/case-study-service";
import {
	transformCaseStudiesForApi,
	transformCaseStudyForApi,
	transformPublishedCaseForApi,
} from "@/lib/services/case-study-transforms";
import {
	validateFormData,
	validateInput,
} from "@/lib/validation/server-action";
import type { ActionResult } from "@/types";

type CaseStudyResponse = ReturnType<typeof transformCaseStudyForApi>;

/**
 * Fetch all case studies owned by the current user
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const fetchCaseStudies = async (_token?: string) => {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		throw new Error("Unauthorised");
	}

	const caseStudies = await getCaseStudiesByOwner(session.user.id);
	return transformCaseStudiesForApi(caseStudies);
};

/**
 * Fetch all published case studies (public access)
 */
export const fetchPublishedCaseStudies = async () => {
	const caseStudies = await getPublishedCaseStudies();
	return transformCaseStudiesForApi(caseStudies);
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

	const caseStudy = await getPublishedCaseStudyById(validation.data);

	if (!caseStudy) {
		notFound();
	}

	return transformCaseStudyForApi(caseStudy);
};

/**
 * Fetch a specific case study by ID (requires authentication)
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const fetchCaseStudyById = async (_token: string, id: number) => {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		throw new Error("Unauthorised");
	}

	// Validate ID
	const validation = validateInput(id, caseStudyIdSchema);
	if (!validation.success) {
		throw new Error("Invalid case study ID");
	}

	const caseStudy = await getCaseStudyById(validation.data);

	if (!caseStudy) {
		throw new Error("Case study not found");
	}

	// Verify ownership
	if (caseStudy.ownerId !== session.user.id) {
		throw new Error("Forbidden");
	}

	return transformCaseStudyForApi(caseStudy);
};

/**
 * Create a new case study
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const createCaseStudy = async (
	_token: string,
	formData: FormData
): Promise<ActionResult<CaseStudyResponse>> => {
	// 1. Authenticate
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
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

	// 3. Business logic
	try {
		const caseStudy = await createCaseStudyWithLinks(
			session.user.id,
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

		revalidatePath("/dashboard/case-studies");
		return { success: true, data: transformCaseStudyForApi(caseStudy) };
	} catch (error) {
		console.error("Error creating case study:", error);
		return { success: false, error: "Failed to create case study" };
	}
};

/**
 * Update an existing case study
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const updateCaseStudy = async (
	_token: string | undefined,
	formData: FormData
): Promise<ActionResult<boolean>> => {
	// 1. Authenticate
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
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

	// 3. Business logic
	try {
		const { id, assurance_cases, ...updateData } = validation.data;

		const caseStudy = await updateCaseStudyWithLinks(
			id,
			session.user.id,
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
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const deleteCaseStudy = async (
	_token: string,
	caseStudyId: number
): Promise<ActionResult<boolean>> => {
	// 1. Authenticate
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return { success: false, error: "Unauthorised" };
	}

	// 2. Validate input
	const validation = validateInput(caseStudyId, caseStudyIdSchema);
	if (!validation.success) {
		return { success: false, error: validation.error };
	}

	// 3. Business logic
	try {
		const deleted = await deleteCaseStudyService(
			validation.data,
			session.user.id
		);

		if (!deleted) {
			return { success: false, error: "Case study not found or access denied" };
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
	const publishedCase =
		await getPublishedAssuranceCaseByCaseId(assuranceCaseId);

	if (!publishedCase) {
		throw new Error("Published assurance case not found");
	}

	return transformPublishedCaseForApi(publishedCase);
};
