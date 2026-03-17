import { prisma } from "@/lib/prisma";
import {
	deleteDirectory,
	deleteFile,
} from "@/lib/services/file-storage-service";
import type {
	CaseStudy as PrismaCaseStudy,
	PublishStatus as PrismaPublishStatus,
	PublishedAssuranceCase,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

// ============================================
// Types
// ============================================

export type CaseStudyWithRelations = PrismaCaseStudy & {
	publishedCases: {
		publishedAssuranceCase: PublishedAssuranceCase;
	}[];
	featureImage: { image: string; uploadedAt: Date } | null;
};

export interface CaseStudyCreateInput {
	authors?: string;
	category?: string;
	contact?: string;
	description?: string;
	image?: string;
	published?: boolean;
	sector?: string;
	title: string;
	type?: string;
}

export type CaseStudyUpdateInput = Partial<CaseStudyCreateInput> & {
	id: number;
};

// ============================================
// Service Functions
// ============================================

/**
 * Get all case studies owned by a user
 *
 * Note: The legacy CaseStudy table has owner_id as BigInt, but new users have UUID IDs.
 * We handle this gracefully by catching type mismatch errors and returning empty results.
 * New case studies created through the new system will work correctly.
 */
export async function getCaseStudiesByOwner(
	ownerId: string
): ServiceResult<CaseStudyWithRelations[]> {
	try {
		const caseStudies = await prisma.caseStudy.findMany({
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

		return { data: caseStudies as CaseStudyWithRelations[] };
	} catch (error) {
		// Handle legacy table type mismatch (BigInt owner_id vs UUID user ID)
		if (
			error instanceof Error &&
			error.message.includes("invalid input syntax for type bigint")
		) {
			console.warn(
				"getCaseStudiesByOwner: Legacy table type mismatch, returning empty array"
			);
			return { data: [] };
		}
		console.error("Failed to get case studies by owner:", error);
		return { error: "Failed to fetch case studies" };
	}
}

/**
 * Get all published case studies (public)
 */
export async function getPublishedCaseStudies(): ServiceResult<
	CaseStudyWithRelations[]
> {
	try {
		const caseStudies = await prisma.caseStudy.findMany({
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

		return { data: caseStudies as CaseStudyWithRelations[] };
	} catch (error) {
		console.error("Failed to get published case studies:", error);
		return { error: "Failed to fetch published case studies" };
	}
}

/**
 * Get a case study by ID, verifying the given user is the owner.
 * Returns the same error for not-found and forbidden to prevent enumeration.
 */
export async function getCaseStudyById(
	id: number,
	userId: string
): ServiceResult<CaseStudyWithRelations> {
	try {
		const caseStudy = await prisma.caseStudy.findUnique({
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

		if (!caseStudy || caseStudy.ownerId !== userId) {
			return { error: "Permission denied" };
		}

		return { data: caseStudy as CaseStudyWithRelations };
	} catch (error) {
		console.error("[getCaseStudyById]", { id, userId, error });
		return { error: "Failed to fetch case study" };
	}
}

/**
 * Get a published case study by ID (public access)
 */
export async function getPublishedCaseStudyById(
	id: number
): ServiceResult<CaseStudyWithRelations> {
	try {
		const caseStudy = await prisma.caseStudy.findFirst({
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

		if (!caseStudy) {
			return { error: "Case study not found" };
		}

		return { data: caseStudy as CaseStudyWithRelations };
	} catch (error) {
		console.error("Failed to get published case study by ID:", error);
		return { error: "Failed to fetch case study" };
	}
}

/**
 * Create a new case study
 */
export async function createCaseStudy(
	ownerId: string,
	data: CaseStudyCreateInput
): ServiceResult<CaseStudyWithRelations> {
	try {
		const now = new Date();

		const caseStudy = await prisma.caseStudy.create({
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

		return { data: caseStudy as CaseStudyWithRelations };
	} catch (error) {
		console.error("Failed to create case study:", error);
		return { error: "Failed to create case study" };
	}
}

/**
 * Update a case study
 */
export async function updateCaseStudy(
	id: number,
	ownerId: string,
	data: Partial<CaseStudyCreateInput>
): ServiceResult<CaseStudyWithRelations> {
	try {
		// Verify ownership
		const existing = await prisma.caseStudy.findUnique({
			where: { id },
		});

		if (!existing || existing.ownerId !== ownerId) {
			return { error: "Permission denied" };
		}

		const now = new Date();
		const wasPublished = existing.published;
		const isNowPublished = data.published ?? existing.published;

		const caseStudy = await prisma.caseStudy.update({
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

		return { data: caseStudy as CaseStudyWithRelations };
	} catch (error) {
		console.error("Failed to update case study:", error);
		return { error: "Failed to update case study" };
	}
}

/**
 * Delete a case study
 */
export async function deleteCaseStudy(
	id: number,
	ownerId: string
): ServiceResult {
	try {
		// Verify ownership and get feature image info
		const existing = await prisma.caseStudy.findUnique({
			where: { id },
			include: { featureImage: true },
		});

		if (!existing || existing.ownerId !== ownerId) {
			return { error: "Permission denied" };
		}

		// Delete the uploaded image file if it exists
		if (existing.featureImage?.image) {
			await deleteFile(existing.featureImage.image);
		}

		// Also clean up the entire upload directory for this case study
		await deleteDirectory(`case-studies/${id}`);

		// Delete associated records first
		await prisma.caseStudyPublishedCase.deleteMany({
			where: { caseStudyId: id },
		});

		await prisma.caseStudyImage.deleteMany({
			where: { caseStudyId: id },
		});

		await prisma.caseStudy.delete({
			where: { id },
		});

		return { data: true };
	} catch (error) {
		console.error("Failed to delete case study:", error);
		return { error: "Failed to delete case study" };
	}
}

/**
 * Get a published assurance case by ID
 */
export async function getPublishedAssuranceCaseById(
	id: string
): ServiceResult<PublishedAssuranceCase> {
	try {
		const record = await prisma.publishedAssuranceCase.findUnique({
			where: { id },
		});

		if (!record) {
			return { error: "Published case not found" };
		}

		return { data: record };
	} catch (error) {
		console.error("Failed to get published assurance case by ID:", error);
		return { error: "Failed to fetch published case" };
	}
}

/**
 * Get a published assurance case by the source assurance case ID
 */
export async function getPublishedAssuranceCaseByCaseId(
	assuranceCaseId: string
): ServiceResult<PublishedAssuranceCase> {
	try {
		const record = await prisma.publishedAssuranceCase.findFirst({
			where: { assuranceCaseId },
			orderBy: { createdAt: "desc" },
		});

		if (!record) {
			return { error: "Published case not found" };
		}

		return { data: record };
	} catch (error) {
		console.error("Failed to get published assurance case by case ID:", error);
		return { error: "Failed to fetch published case" };
	}
}

/**
 * Link a published assurance case to a case study
 */
export async function linkPublishedCaseToCaseStudy(
	caseStudyId: number,
	publishedAssuranceCaseId: string
): ServiceResult {
	try {
		await prisma.caseStudyPublishedCase.create({
			data: {
				caseStudyId,
				publishedAssuranceCaseId,
			},
		});
		return { data: true };
	} catch {
		// Likely a unique constraint violation
		return { error: "Link already exists" };
	}
}

/**
 * Unlink a published assurance case from a case study
 */
export async function unlinkPublishedCaseFromCaseStudy(
	caseStudyId: number,
	publishedAssuranceCaseId: string
): ServiceResult {
	try {
		const result = await prisma.caseStudyPublishedCase.deleteMany({
			where: {
				caseStudyId,
				publishedAssuranceCaseId,
			},
		});

		if (result.count === 0) {
			return { error: "Link not found" };
		}

		return { data: true };
	} catch (error) {
		console.error("Failed to unlink published case from case study:", error);
		return { error: "Failed to unlink case" };
	}
}

/**
 * Update case study feature image
 */
export async function updateCaseStudyImage(
	caseStudyId: number,
	imagePath: string
): ServiceResult {
	try {
		await prisma.caseStudyImage.upsert({
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
		return { data: true };
	} catch (error) {
		console.error("Failed to update case study image:", error);
		return { error: "Failed to update image" };
	}
}

/**
 * Delete case study feature image
 */
export async function deleteCaseStudyImage(caseStudyId: number): ServiceResult {
	try {
		const result = await prisma.caseStudyImage.deleteMany({
			where: { caseStudyId },
		});

		if (result.count === 0) {
			return { error: "Image not found" };
		}

		return { data: true };
	} catch (error) {
		console.error("Failed to delete case study image:", error);
		return { error: "Failed to delete image" };
	}
}

// ============================================
// Linking Functions for Publishing Workflow
// ============================================

/**
 * Gets the latest published version ID for an assurance case.
 * Handles legacy table issues gracefully by catching errors.
 */
async function getLatestPublishedVersionId(
	caseId: string
): Promise<string | null> {
	try {
		const publishedVersions = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: caseId },
			select: { id: true },
			orderBy: { createdAt: "desc" },
			take: 1,
		});
		return publishedVersions[0]?.id ?? null;
	} catch (error) {
		console.warn(
			`Failed to fetch published versions for case ${caseId}:`,
			error
		);
		return null;
	}
}

/**
 * Attempts to publish a case and returns the published ID if successful.
 * Handles legacy table issues gracefully by catching errors.
 */
async function tryPublishCase(
	ownerId: string,
	caseId: string
): Promise<string | null> {
	const { publishAssuranceCase } = await import(
		"@/lib/services/publish-service"
	);

	try {
		const result = await publishAssuranceCase(ownerId, caseId);
		return "error" in result ? null : result.data.publishedId;
	} catch (error) {
		console.warn(
			`Failed to publish case ${caseId} (legacy table issue):`,
			error
		);
		return null;
	}
}

/**
 * Resolves source AssuranceCase IDs to their latest PublishedAssuranceCase IDs.
 * For cases that are READY_TO_PUBLISH but not yet published, this will publish them first.
 *
 * Note: The legacy PublishedAssuranceCase table has type mismatches with the new schema.
 * We query publishedVersions separately with error handling to avoid crashes.
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

	// Get the source cases with their publish status
	const sourceCases = await prisma.assuranceCase.findMany({
		where: { id: { in: sourceCaseIds } },
		select: { id: true, publishStatus: true, createdById: true },
	});

	const publishedCaseIds: string[] = [];

	for (const sourceCase of sourceCases) {
		const publishedId = await resolvePublishedIdForCase(sourceCase, ownerId);
		if (publishedId) {
			publishedCaseIds.push(publishedId);
		}
	}

	return publishedCaseIds;
}

/**
 * Resolves a single case to its published version ID.
 */
async function resolvePublishedIdForCase(
	sourceCase: { id: string; publishStatus: string; createdById: string },
	ownerId?: string
): Promise<string | null> {
	const latestPublishedId = await getLatestPublishedVersionId(sourceCase.id);

	if (latestPublishedId) {
		await syncPublishStatusIfNeeded(sourceCase);
		return latestPublishedId;
	}

	// If READY_TO_PUBLISH, owner provided, and owner is the case creator, publish it now
	const canPublish =
		sourceCase.publishStatus === "READY_TO_PUBLISH" &&
		ownerId &&
		sourceCase.createdById === ownerId;

	if (canPublish) {
		return tryPublishCase(ownerId, sourceCase.id);
	}

	return null;
}

/**
 * Syncs the publish status to PUBLISHED if needed.
 */
async function syncPublishStatusIfNeeded(sourceCase: {
	id: string;
	publishStatus: string;
}): Promise<void> {
	if (sourceCase.publishStatus !== "PUBLISHED") {
		await prisma.assuranceCase.update({
			where: { id: sourceCase.id },
			data: { publishStatus: "PUBLISHED", published: true },
		});
	}
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
): ServiceResult<CaseStudyWithRelations> {
	try {
		const now = new Date();

		// Resolve source case IDs to published case IDs (publishes READY_TO_PUBLISH cases)
		const publishedCaseIds = await resolvePublishedCaseIds(
			sourceCaseIds,
			ownerId
		);

		// Create case study and links in a transaction
		const caseStudy = await prisma.$transaction(async (tx) => {
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
			return { error: "Failed to create case study" };
		}

		return { data: caseStudy as CaseStudyWithRelations };
	} catch (error) {
		console.error("Failed to create case study with links:", error);
		return { error: "Failed to create case study" };
	}
}

/**
 * Updates a case study and synchronises linked published assurance cases.
 *
 * @param id - Case study ID
 * @param ownerId - The user ID (for ownership verification)
 * @param data - Case study update data
 * @param sourceCaseIds - New array of source AssuranceCase IDs to link (optional)
 * @returns The updated case study with relations
 */
export async function updateCaseStudyWithLinks(
	id: number,
	ownerId: string,
	data: Partial<CaseStudyCreateInput>,
	sourceCaseIds?: string[]
): ServiceResult<CaseStudyWithRelations> {
	try {
		// Verify ownership
		const existing = await prisma.caseStudy.findUnique({
			where: { id },
		});

		if (!existing || existing.ownerId !== ownerId) {
			return { error: "Permission denied" };
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
		const caseStudy = await prisma.$transaction(async (tx) => {
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

		if (!caseStudy) {
			return { error: "Failed to update case study" };
		}

		return { data: caseStudy as CaseStudyWithRelations };
	} catch (error) {
		console.error("Failed to update case study with links:", error);
		return { error: "Failed to update case study" };
	}
}

// ============================================
// Publishing Workflow Helpers
// ============================================

export interface CaseAvailableForStudy {
	description: string;
	id: string;
	markedReadyAt: Date | null;
	name: string;
	publishedAt: Date | null;
	publishedVersionId: string | null;
	publishStatus: PrismaPublishStatus;
}

/**
 * Gets cases that are ready to publish OR published for a specific user.
 * Used for case study linking - shows cases available for selection.
 *
 * Note: The publishedVersions relation uses a legacy Django table that may have
 * type mismatches with UUID-based case IDs. We query it separately to handle errors.
 */
export async function getCasesAvailableForCaseStudy(
	userId: string
): ServiceResult<CaseAvailableForStudy[]> {
	try {
		// Query cases without publishedVersions to avoid legacy table issues
		const cases = await prisma.assuranceCase.findMany({
			where: {
				createdById: userId,
				publishStatus: {
					in: ["READY_TO_PUBLISH", "PUBLISHED"],
				},
			},
			select: {
				id: true,
				name: true,
				description: true,
				publishStatus: true,
				publishedAt: true,
				markedReadyAt: true,
			},
			orderBy: {
				updatedAt: "desc",
			},
		});

		// Batch query all published versions for these cases (fixes N+1)
		const caseIds = cases.map((c) => c.id);
		let publishedVersionsMap = new Map<string, string>();

		try {
			const publishedVersions = await prisma.publishedAssuranceCase.findMany({
				where: { assuranceCaseId: { in: caseIds } },
				select: { id: true, assuranceCaseId: true, createdAt: true },
				orderBy: { createdAt: "desc" },
			});

			// Group by assuranceCaseId and take the latest (first due to orderBy desc)
			for (const pv of publishedVersions) {
				if (!publishedVersionsMap.has(pv.assuranceCaseId)) {
					publishedVersionsMap.set(pv.assuranceCaseId, pv.id);
				}
			}
		} catch (innerError) {
			// Handle legacy table type mismatch gracefully
			console.warn("Failed to fetch published versions:", innerError);
			publishedVersionsMap = new Map();
		}

		// Map cases to results with published version IDs
		return {
			data: cases.map((c) => ({
				id: c.id,
				name: c.name,
				description: c.description,
				publishStatus: c.publishStatus,
				publishedAt: c.publishedAt,
				markedReadyAt: c.markedReadyAt,
				publishedVersionId: publishedVersionsMap.get(c.id) ?? null,
			})),
		};
	} catch (error) {
		console.error("Failed to get cases available for case study:", error);
		return { error: "Failed to fetch available cases" };
	}
}
