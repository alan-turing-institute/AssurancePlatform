/**
 * Case Study Transform Utilities
 *
 * Pure transformation functions for converting Prisma models to API response formats.
 * These are kept separate from the server action file to avoid the "use server"
 * requirement that all exported functions must be async.
 */

import type { PublishedAssuranceCase } from "@/src/generated/prisma-new";
import type { CaseStudy as CaseStudyApiResponse } from "@/types/domain";
import type { CaseStudyWithRelations } from "./case-study-service";

export type PublishedAssuranceCaseResponse = {
	id: string;
	title: string;
	description: string | null;
	content: string;
	created_at: string;
	assurance_case_id: number;
};

/**
 * Transform a Prisma CaseStudy to the frontend API response format
 */
function transformCaseStudyForResponse(
	caseStudy: CaseStudyWithRelations
): CaseStudyApiResponse {
	return {
		id: caseStudy.id,
		title: caseStudy.title,
		description: caseStudy.description ?? "",
		authors: caseStudy.authors ?? "",
		sector: caseStudy.sector ?? "",
		contact: caseStudy.contact ?? undefined,
		type: caseStudy.type ?? undefined,
		image: caseStudy.image ?? undefined,
		published: caseStudy.published,
		publishedDate: caseStudy.publishedDate?.toISOString(),
		createdOn: caseStudy.createdOn.toISOString(),
		lastModifiedOn: caseStudy.lastModifiedOn.toISOString(),
		// Feature image URL for display
		feature_image_url: caseStudy.featureImage?.image ?? undefined,
		featuredImage: caseStudy.featureImage?.image ?? undefined,
		// Include source assurance case IDs (UUIDs as strings)
		assurance_cases: caseStudy.publishedCases.map(
			(link) => link.publishedAssuranceCase.assuranceCaseId
		),
	};
}

/**
 * Transform case studies for API response
 */
export function transformCaseStudiesForApi(
	caseStudies: CaseStudyWithRelations[]
): CaseStudyApiResponse[] {
	return caseStudies.map(transformCaseStudyForResponse);
}

/**
 * Transform a single case study for API response
 */
export function transformCaseStudyForApi(
	caseStudy: CaseStudyWithRelations
): CaseStudyApiResponse {
	return transformCaseStudyForResponse(caseStudy);
}

/**
 * Transform a published assurance case for API response
 */
export function transformPublishedCaseForApi(
	publishedCase: PublishedAssuranceCase
): PublishedAssuranceCaseResponse {
	return {
		id: publishedCase.id,
		title: publishedCase.title,
		description: publishedCase.description,
		// Stringify content for download (stored as JSON object in Prisma)
		content: JSON.stringify(publishedCase.content),
		created_at: publishedCase.createdAt.toISOString(),
		assurance_case_id: Number(publishedCase.assuranceCaseId),
	};
}
