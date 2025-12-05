"use server";

import { prismaNew } from "@/lib/prisma-new";
import {
	deleteDirectory,
	deleteFile,
} from "@/lib/services/file-storage-service";
import type {
	CaseStudy as PrismaCaseStudy,
	PublishedAssuranceCase,
} from "@/src/generated/prisma-new";

// ============================================
// Types
// ============================================

export type CaseStudyWithRelations = PrismaCaseStudy & {
	publishedCases: {
		publishedAssuranceCase: PublishedAssuranceCase;
	}[];
	featureImage: { image: string; uploadedAt: Date } | null;
};

export type CaseStudyCreateInput = {
	title: string;
	description?: string;
	authors?: string;
	category?: string;
	sector?: string;
	contact?: string;
	type?: string;
	published?: boolean;
	image?: string;
};

export type CaseStudyUpdateInput = Partial<CaseStudyCreateInput> & {
	id: number;
};

// ============================================
// Service Functions
// ============================================

/**
 * Get all case studies owned by a user
 */
export async function getCaseStudiesByOwner(
	ownerId: string
): Promise<CaseStudyWithRelations[]> {
	const caseStudies = await prismaNew.caseStudy.findMany({
		where: {
			ownerId,
		},
		include: {
			publishedCases: {
				include: {
					publishedAssuranceCase: true,
				},
			},
			featureImage: true,
		},
		orderBy: {
			lastModifiedOn: "desc",
		},
	});

	return caseStudies as CaseStudyWithRelations[];
}

/**
 * Get all published case studies (public)
 */
export async function getPublishedCaseStudies(): Promise<
	CaseStudyWithRelations[]
> {
	const caseStudies = await prismaNew.caseStudy.findMany({
		where: {
			published: true,
		},
		include: {
			publishedCases: {
				include: {
					publishedAssuranceCase: true,
				},
			},
			featureImage: true,
		},
		orderBy: {
			publishedDate: "desc",
		},
	});

	return caseStudies as CaseStudyWithRelations[];
}

/**
 * Get a case study by ID
 */
export async function getCaseStudyById(
	id: number
): Promise<CaseStudyWithRelations | null> {
	const caseStudy = await prismaNew.caseStudy.findUnique({
		where: { id },
		include: {
			publishedCases: {
				include: {
					publishedAssuranceCase: true,
				},
			},
			featureImage: true,
		},
	});

	return caseStudy as CaseStudyWithRelations | null;
}

/**
 * Get a published case study by ID (public access)
 */
export async function getPublishedCaseStudyById(
	id: number
): Promise<CaseStudyWithRelations | null> {
	const caseStudy = await prismaNew.caseStudy.findFirst({
		where: {
			id,
			published: true,
		},
		include: {
			publishedCases: {
				include: {
					publishedAssuranceCase: true,
				},
			},
			featureImage: true,
		},
	});

	return caseStudy as CaseStudyWithRelations | null;
}

/**
 * Create a new case study
 */
export async function createCaseStudy(
	ownerId: string,
	data: CaseStudyCreateInput
): Promise<CaseStudyWithRelations> {
	const now = new Date();

	const caseStudy = await prismaNew.caseStudy.create({
		data: {
			title: data.title,
			description: data.description ?? null,
			authors: data.authors ?? null,
			category: data.category ?? null,
			sector: data.sector ?? null,
			contact: data.contact ?? null,
			type: data.type ?? null,
			image: data.image ?? null,
			published: data.published ?? false,
			publishedDate: data.published ? now : null,
			ownerId,
			createdOn: now,
			lastModifiedOn: now,
		},
		include: {
			publishedCases: {
				include: {
					publishedAssuranceCase: true,
				},
			},
			featureImage: true,
		},
	});

	return caseStudy as CaseStudyWithRelations;
}

/**
 * Update a case study
 */
export async function updateCaseStudy(
	id: number,
	ownerId: string,
	data: Partial<CaseStudyCreateInput>
): Promise<CaseStudyWithRelations | null> {
	// Verify ownership
	const existing = await prismaNew.caseStudy.findUnique({
		where: { id },
	});

	if (!existing || existing.ownerId !== ownerId) {
		return null;
	}

	const now = new Date();
	const wasPublished = existing.published;
	const isNowPublished = data.published ?? existing.published;

	const caseStudy = await prismaNew.caseStudy.update({
		where: { id },
		data: {
			title: data.title,
			description: data.description,
			authors: data.authors,
			category: data.category,
			sector: data.sector,
			contact: data.contact,
			type: data.type,
			image: data.image,
			published: data.published,
			// Set publishedDate when first published
			publishedDate:
				!wasPublished && isNowPublished ? now : existing.publishedDate,
			lastModifiedOn: now,
		},
		include: {
			publishedCases: {
				include: {
					publishedAssuranceCase: true,
				},
			},
			featureImage: true,
		},
	});

	return caseStudy as CaseStudyWithRelations;
}

/**
 * Delete a case study
 */
export async function deleteCaseStudy(
	id: number,
	ownerId: string
): Promise<boolean> {
	// Verify ownership and get feature image info
	const existing = await prismaNew.caseStudy.findUnique({
		where: { id },
		include: { featureImage: true },
	});

	if (!existing || existing.ownerId !== ownerId) {
		return false;
	}

	// Delete the uploaded image file if it exists
	if (existing.featureImage?.image) {
		await deleteFile(existing.featureImage.image);
	}

	// Also clean up the entire upload directory for this case study
	await deleteDirectory(`case-studies/${id}`);

	// Delete associated records first
	await prismaNew.caseStudyPublishedCase.deleteMany({
		where: { caseStudyId: id },
	});

	await prismaNew.caseStudyImage.deleteMany({
		where: { caseStudyId: id },
	});

	await prismaNew.caseStudy.delete({
		where: { id },
	});

	return true;
}

/**
 * Get a published assurance case by ID
 */
export async function getPublishedAssuranceCaseById(
	id: string
): Promise<PublishedAssuranceCase | null> {
	return await prismaNew.publishedAssuranceCase.findUnique({
		where: { id },
	});
}

/**
 * Get a published assurance case by the source assurance case ID
 */
export async function getPublishedAssuranceCaseByCaseId(
	assuranceCaseId: string
): Promise<PublishedAssuranceCase | null> {
	return await prismaNew.publishedAssuranceCase.findFirst({
		where: { assuranceCaseId },
		orderBy: { createdAt: "desc" },
	});
}

/**
 * Link a published assurance case to a case study
 */
export async function linkPublishedCaseToCaseStudy(
	caseStudyId: number,
	publishedAssuranceCaseId: string
): Promise<boolean> {
	try {
		await prismaNew.caseStudyPublishedCase.create({
			data: {
				caseStudyId,
				publishedAssuranceCaseId,
			},
		});
		return true;
	} catch {
		// Likely a unique constraint violation
		return false;
	}
}

/**
 * Unlink a published assurance case from a case study
 */
export async function unlinkPublishedCaseFromCaseStudy(
	caseStudyId: number,
	publishedAssuranceCaseId: string
): Promise<boolean> {
	const result = await prismaNew.caseStudyPublishedCase.deleteMany({
		where: {
			caseStudyId,
			publishedAssuranceCaseId,
		},
	});

	return result.count > 0;
}

/**
 * Update case study feature image
 */
export async function updateCaseStudyImage(
	caseStudyId: number,
	imagePath: string
): Promise<boolean> {
	try {
		await prismaNew.caseStudyImage.upsert({
			where: { caseStudyId },
			create: {
				caseStudyId,
				image: imagePath,
				uploadedAt: new Date(),
			},
			update: {
				image: imagePath,
				uploadedAt: new Date(),
			},
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Delete case study feature image
 */
export async function deleteCaseStudyImage(
	caseStudyId: number
): Promise<boolean> {
	const result = await prismaNew.caseStudyImage.deleteMany({
		where: { caseStudyId },
	});

	return result.count > 0;
}

// ============================================
// Linking Functions for Publishing Workflow
// ============================================

/**
 * Resolves source AssuranceCase IDs to their latest PublishedAssuranceCase IDs.
 * For cases that are READY_TO_PUBLISH but not yet published, this will publish them first.
 *
 * @param sourceCaseIds - Array of source AssuranceCase IDs
 * @param ownerId - The user ID performing the operation (for publishing)
 * @returns Array of PublishedAssuranceCase IDs
 */
export async function resolvePublishedCaseIds(
	sourceCaseIds: string[],
	ownerId?: string
): Promise<string[]> {
	if (sourceCaseIds.length === 0) {
		return [];
	}

	// Import publish service dynamically to avoid circular dependencies
	const { publishAssuranceCase } = await import(
		"@/lib/services/publish-service"
	);

	// Get the source cases with their publish status and latest published version
	const sourceCases = await prismaNew.assuranceCase.findMany({
		where: {
			id: { in: sourceCaseIds },
		},
		select: {
			id: true,
			publishStatus: true,
			createdById: true,
			publishedVersions: {
				select: {
					id: true,
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 1,
			},
		},
	});

	const publishedCaseIds: string[] = [];

	for (const sourceCase of sourceCases) {
		// If already has a published version, use that and ensure status is synced
		if (sourceCase.publishedVersions.length > 0) {
			publishedCaseIds.push(sourceCase.publishedVersions[0].id);

			// Sync publishStatus to PUBLISHED if it's not already
			// This handles cases where status got out of sync
			if (sourceCase.publishStatus !== "PUBLISHED") {
				await prismaNew.assuranceCase.update({
					where: { id: sourceCase.id },
					data: {
						publishStatus: "PUBLISHED",
						published: true,
					},
				});
			}
			continue;
		}

		// If READY_TO_PUBLISH, owner provided, and owner is the case creator, publish it now
		if (
			sourceCase.publishStatus === "READY_TO_PUBLISH" &&
			ownerId &&
			sourceCase.createdById === ownerId
		) {
			const result = await publishAssuranceCase(ownerId, sourceCase.id);
			if (result.success) {
				publishedCaseIds.push(result.publishedId);
			}
		}
	}

	return publishedCaseIds;
}

/**
 * Creates a case study with linked published assurance cases in a transaction.
 *
 * @param ownerId - The user ID creating the case study
 * @param data - Case study data
 * @param sourceCaseIds - Array of source AssuranceCase IDs to link
 * @returns The created case study with relations
 */
export async function createCaseStudyWithLinks(
	ownerId: string,
	data: CaseStudyCreateInput,
	sourceCaseIds: string[]
): Promise<CaseStudyWithRelations> {
	const now = new Date();

	// Resolve source case IDs to published case IDs (publishes READY_TO_PUBLISH cases)
	const publishedCaseIds = await resolvePublishedCaseIds(
		sourceCaseIds,
		ownerId
	);

	// Create case study and links in a transaction
	const caseStudy = await prismaNew.$transaction(async (tx) => {
		// Create the case study
		const created = await tx.caseStudy.create({
			data: {
				title: data.title,
				description: data.description ?? null,
				authors: data.authors ?? null,
				category: data.category ?? null,
				sector: data.sector ?? null,
				contact: data.contact ?? null,
				type: data.type ?? null,
				image: data.image ?? null,
				published: data.published ?? false,
				publishedDate: data.published ? now : null,
				ownerId,
				createdOn: now,
				lastModifiedOn: now,
			},
		});

		// Create links to published cases
		if (publishedCaseIds.length > 0) {
			await tx.caseStudyPublishedCase.createMany({
				data: publishedCaseIds.map((publishedCaseId) => ({
					caseStudyId: created.id,
					publishedAssuranceCaseId: publishedCaseId,
				})),
			});
		}

		// Fetch with relations
		return tx.caseStudy.findUnique({
			where: { id: created.id },
			include: {
				publishedCases: {
					include: {
						publishedAssuranceCase: true,
					},
				},
				featureImage: true,
			},
		});
	});

	if (!caseStudy) {
		throw new Error("Failed to create case study");
	}

	return caseStudy as CaseStudyWithRelations;
}

/**
 * Updates a case study and synchronises linked published assurance cases.
 *
 * @param id - Case study ID
 * @param ownerId - The user ID (for ownership verification)
 * @param data - Case study update data
 * @param sourceCaseIds - New array of source AssuranceCase IDs to link (optional)
 * @returns The updated case study with relations, or null if not found/not owned
 */
export async function updateCaseStudyWithLinks(
	id: number,
	ownerId: string,
	data: Partial<CaseStudyCreateInput>,
	sourceCaseIds?: string[]
): Promise<CaseStudyWithRelations | null> {
	// Verify ownership
	const existing = await prismaNew.caseStudy.findUnique({
		where: { id },
	});

	if (!existing || existing.ownerId !== ownerId) {
		return null;
	}

	const now = new Date();
	const wasPublished = existing.published;
	const isNowPublished = data.published ?? existing.published;

	// Resolve source case IDs to published case IDs if provided (publishes READY_TO_PUBLISH cases)
	const publishedCaseIds =
		sourceCaseIds !== undefined
			? await resolvePublishedCaseIds(sourceCaseIds, ownerId)
			: undefined;

	// Update case study and links in a transaction
	const caseStudy = await prismaNew.$transaction(async (tx) => {
		// Update the case study
		await tx.caseStudy.update({
			where: { id },
			data: {
				title: data.title,
				description: data.description,
				authors: data.authors,
				category: data.category,
				sector: data.sector,
				contact: data.contact,
				type: data.type,
				image: data.image,
				published: data.published,
				publishedDate:
					!wasPublished && isNowPublished ? now : existing.publishedDate,
				lastModifiedOn: now,
			},
		});

		// Update links if sourceCaseIds were provided
		if (publishedCaseIds !== undefined) {
			// Remove existing links
			await tx.caseStudyPublishedCase.deleteMany({
				where: { caseStudyId: id },
			});

			// Create new links
			if (publishedCaseIds.length > 0) {
				await tx.caseStudyPublishedCase.createMany({
					data: publishedCaseIds.map((publishedCaseId) => ({
						caseStudyId: id,
						publishedAssuranceCaseId: publishedCaseId,
					})),
				});
			}
		}

		// Fetch with relations
		return tx.caseStudy.findUnique({
			where: { id },
			include: {
				publishedCases: {
					include: {
						publishedAssuranceCase: true,
					},
				},
				featureImage: true,
			},
		});
	});

	return caseStudy as CaseStudyWithRelations | null;
}
