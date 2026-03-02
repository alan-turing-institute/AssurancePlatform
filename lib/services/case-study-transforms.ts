/**
 * Case Study Transform Utilities
 *
 * Pure transformation functions for converting Prisma models to API response formats.
 * These are kept separate from the server action file to avoid the "use server"
 * requirement that all exported functions must be async.
 */

import type { PublishedAssuranceCase } from "@/src/generated/prisma";
import type { CaseStudy as CaseStudyApiResponse } from "@/types/domain";
import type { CaseStudyWithRelations } from "./case-study-service";

export type PublishedAssuranceCaseResponse = {
	id: string;
	title: string;
	description: string | null;
	content: string;
	createdAt: string;
	assuranceCaseId: number;
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
		featuredImage: caseStudy.featureImage?.image ?? undefined,
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
		createdAt: publishedCase.createdAt.toISOString(),
		assuranceCaseId: Number(publishedCase.assuranceCaseId),
	};
}
