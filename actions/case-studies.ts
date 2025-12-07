"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
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

/**
 * Fetch all case studies owned by the current user
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const fetchCaseStudies = async (_token?: string) => {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
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
	const caseStudy = await getPublishedCaseStudyById(id);

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
		throw new Error("Unauthorized");
	}

	const caseStudy = await getCaseStudyById(id);

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
 * Parse assurance_cases from FormData.
 * Accepts JSON string or comma-separated list of IDs.
 */
function parseAssuranceCaseIds(formData: FormData): string[] {
	const assuranceCasesRaw = formData.get("assurance_cases") as string | null;

	if (!assuranceCasesRaw) {
		return [];
	}

	// Try parsing as JSON array first
	try {
		const parsed = JSON.parse(assuranceCasesRaw);
		if (Array.isArray(parsed)) {
			return parsed.filter((id): id is string => typeof id === "string");
		}
	} catch {
		// Not JSON, try comma-separated
	}

	// Fall back to comma-separated
	return assuranceCasesRaw
		.split(",")
		.map((id) => id.trim())
		.filter((id) => id.length > 0);
}

/**
 * Create a new case study
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const createCaseStudy = async (_token: string, formData: FormData) => {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return null;
	}

	try {
		const title = formData.get("title") as string;
		if (!title) {
			return null;
		}

		// Parse assurance case IDs to link
		const assuranceCaseIds = parseAssuranceCaseIds(formData);

		const caseStudy = await createCaseStudyWithLinks(
			session.user.id,
			{
				title,
				description: (formData.get("description") as string) || undefined,
				authors: (formData.get("authors") as string) || undefined,
				category: (formData.get("category") as string) || undefined,
				sector: (formData.get("sector") as string) || undefined,
				contact: (formData.get("contact") as string) || undefined,
				type: (formData.get("type") as string) || undefined,
				published: formData.get("published") === "true",
			},
			assuranceCaseIds
		);

		revalidatePath("/dashboard/case-studies");
		return transformCaseStudyForApi(caseStudy);
	} catch (error) {
		console.error("Error creating case study:", error);
		return null;
	}
};

/**
 * Update an existing case study
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const updateCaseStudy = async (
	_token: string | undefined,
	formData: FormData
) => {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return false;
	}

	try {
		const id = Number(formData.get("id"));
		if (Number.isNaN(id)) {
			return false;
		}

		const updateData: Record<string, unknown> = {};

		const title = formData.get("title") as string | null;
		if (title) {
			updateData.title = title;
		}

		const description = formData.get("description") as string | null;
		if (description !== null) {
			updateData.description = description;
		}

		const authors = formData.get("authors") as string | null;
		if (authors !== null) {
			updateData.authors = authors;
		}

		const category = formData.get("category") as string | null;
		if (category !== null) {
			updateData.category = category;
		}

		const sector = formData.get("sector") as string | null;
		if (sector !== null) {
			updateData.sector = sector;
		}

		const contact = formData.get("contact") as string | null;
		if (contact !== null) {
			updateData.contact = contact;
		}

		const type = formData.get("type") as string | null;
		if (type !== null) {
			updateData.type = type;
		}

		const published = formData.get("published");
		if (published !== null) {
			updateData.published = published === "true";
		}

		// Parse assurance case IDs to link (undefined means don't update links)
		const assuranceCasesRaw = formData.get("assurance_cases");
		const assuranceCaseIds =
			assuranceCasesRaw !== null ? parseAssuranceCaseIds(formData) : undefined;

		const caseStudy = await updateCaseStudyWithLinks(
			id,
			session.user.id,
			updateData as {
				title?: string;
				description?: string;
				authors?: string;
				category?: string;
				sector?: string;
				contact?: string;
				type?: string;
				published?: boolean;
			},
			assuranceCaseIds
		);

		if (!caseStudy) {
			return false;
		}

		revalidatePath(`/dashboard/case-studies/${id}`);
		revalidatePath(`/discover/${id}`);
		revalidatePath("/discover");
		return true;
	} catch (error) {
		console.error("Error updating case study:", error);
		return false;
	}
};

/**
 * Delete a case study
 * @deprecated The token parameter is no longer used - session is used instead
 */
export const deleteCaseStudy = async (_token: string, caseStudyId: number) => {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return false;
	}

	try {
		const deleted = await deleteCaseStudyService(caseStudyId, session.user.id);

		if (!deleted) {
			return false;
		}

		revalidatePath("/dashboard/case-studies");
		return true;
	} catch (error) {
		console.error("Error deleting case study:", error);
		return false;
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
