import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import { detectChanges } from "@/lib/services/change-detection-service";
import type {
	FullPublishStatus,
	MarkReadyResult,
	PrismaPublishStatus,
	PublishResult,
	PublishStatus,
	StatusTransitionResult,
	UnmarkReadyResult,
	UnpublishResult,
} from "@/lib/services/publish-service.types";

// ============================================
// Service Functions
// ============================================

/**
 * Gets the publish status of an assurance case.
 * Returns whether the case is published and how many case studies link to it.
 */
export async function getPublishStatus(
	userId: string,
	caseId: string
): Promise<{ data: PublishStatus } | { error: string }> {
	// Check user has at least VIEW permission
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case with its published status
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			published: true,
			publishedAt: true,
			publishedVersions: {
				select: {
					id: true,
					caseStudyLinks: {
						select: {
							caseStudyId: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 1,
			},
		},
	});

	if (!assuranceCase) {
		return { error: "Permission denied" };
	}

	// Get the most recent published version
	const latestPublished = assuranceCase.publishedVersions[0];

	// Count unique linked case studies
	const linkedCaseStudyIds = new Set<number>();
	if (latestPublished) {
		for (const link of latestPublished.caseStudyLinks) {
			linkedCaseStudyIds.add(link.caseStudyId);
		}
	}

	return {
		data: {
			isPublished: assuranceCase.published,
			publishedId: latestPublished?.id ?? null,
			publishedAt: assuranceCase.publishedAt,
			linkedCaseStudyCount: linkedCaseStudyIds.size,
		},
	};
}

/**
 * Publishes an assurance case.
 * Creates a snapshot of the current case content and marks it as published.
 *
 * Requires EDIT permission or higher.
 */
export async function publishAssuranceCase(
	userId: string,
	caseId: string,
	description?: string
): Promise<PublishResult> {
	// Check user has EDIT permission
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case to check if it exists
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			name: true,
			published: true,
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	// Export case content as JSON
	const exportResult = await exportCase(userId, caseId, {
		includeComments: true,
	});

	if ("error" in exportResult) {
		return { error: exportResult.error };
	}

	const now = new Date();

	try {
		// Create the published version and update the case in a transaction
		const [publishedCase] = await prisma.$transaction([
			prisma.publishedAssuranceCase.create({
				data: {
					title: assuranceCase.name,
					content: exportResult.data,
					description: description ?? null,
					assuranceCaseId: caseId,
					createdAt: now,
				},
			}),
			prisma.assuranceCase.update({
				where: { id: caseId },
				data: {
					published: true,
					publishedAt: now,
					publishStatus: "PUBLISHED",
				},
			}),
		]);

		return {
			data: { publishedId: publishedCase.id, publishedAt: now },
		};
	} catch (error) {
		console.error("Failed to publish case:", error);
		return { error: "Failed to publish case" };
	}
}

/**
 * Unpublishes an assurance case.
 * If the case is linked to case studies and force is false, returns a warning.
 *
 * Requires EDIT permission or higher.
 */
export async function unpublishAssuranceCase(
	userId: string,
	caseId: string,
	force = false
): Promise<UnpublishResult> {
	// Check user has EDIT permission
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case with its published versions and linked case studies
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			published: true,
			publishedVersions: {
				select: {
					id: true,
					caseStudyLinks: {
						select: {
							caseStudy: {
								select: {
									id: true,
									title: true,
								},
							},
						},
					},
				},
			},
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	if (!assuranceCase.published) {
		return { error: "Case is not published" };
	}

	// Collect all linked case studies
	const linkedCaseStudies: { id: number; title: string }[] = [];
	for (const publishedVersion of assuranceCase.publishedVersions) {
		for (const link of publishedVersion.caseStudyLinks) {
			// Avoid duplicates
			if (!linkedCaseStudies.some((cs) => cs.id === link.caseStudy.id)) {
				linkedCaseStudies.push({
					id: link.caseStudy.id,
					title: link.caseStudy.title,
				});
			}
		}
	}

	// If linked to case studies and not forcing, return warning
	if (linkedCaseStudies.length > 0 && !force) {
		return {
			error: "Cannot unpublish: linked to case studies",
			linkedCaseStudies,
		};
	}

	try {
		// Delete all published versions and their links, then update the case
		await prisma.$transaction(async (tx) => {
			// Get all published version IDs
			const publishedVersionIds = assuranceCase.publishedVersions.map(
				(pv) => pv.id
			);

			// Delete case study links
			if (publishedVersionIds.length > 0) {
				await tx.caseStudyPublishedCase.deleteMany({
					where: {
						publishedAssuranceCaseId: { in: publishedVersionIds },
					},
				});

				// Delete published versions
				await tx.publishedAssuranceCase.deleteMany({
					where: {
						id: { in: publishedVersionIds },
					},
				});
			}

			// Update the case
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: {
					published: false,
					publishedAt: null,
					publishStatus: "DRAFT",
					markedReadyAt: null,
					markedReadyById: null,
				},
			});
		});

		return { data: { success: true as const } };
	} catch (error) {
		console.error("Failed to unpublish case:", error);
		return { error: "Failed to unpublish case" };
	}
}

/**
 * Gets the list of published assurance cases for a user.
 * Returns cases that the user has published.
 */
export async function getPublishedCasesByUser(
	userId: string
): Promise<
	{ id: string; title: string; description: string | null; createdAt: Date }[]
> {
	const publishedCases = await prisma.publishedAssuranceCase.findMany({
		where: {
			assuranceCase: {
				createdById: userId,
			},
		},
		select: {
			id: true,
			title: true,
			description: true,
			createdAt: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return publishedCases;
}

// ============================================
// 3-State Publishing Workflow Functions
// ============================================

/**
 * Gets the full publish status including 3-state workflow information.
 * Returns publish status, ready status, and change detection.
 *
 * Note: The publishedVersions relation uses a legacy Django table that may have
 * type mismatches with UUID-based case IDs. We handle this gracefully by
 * separating the queries and catching potential errors.
 */
export async function getFullPublishStatus(
	userId: string,
	caseId: string
): Promise<{ data?: FullPublishStatus; error?: string }> {
	// Check user has at least VIEW permission
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case with its publish status (excluding publishedVersions to avoid legacy table issues)
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			published: true,
			publishedAt: true,
			publishStatus: true,
			markedReadyAt: true,
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	// Try to get published versions separately to handle legacy table issues gracefully
	let latestPublished: {
		id: string;
		caseStudyLinks: { caseStudyId: number }[];
	} | null = null;
	let linkedCaseStudyCount = 0;

	try {
		const publishedVersions = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: caseId },
			select: {
				id: true,
				caseStudyLinks: {
					select: {
						caseStudyId: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
			take: 1,
		});

		latestPublished = publishedVersions[0] ?? null;

		// Count unique linked case studies
		if (latestPublished) {
			const linkedCaseStudyIds = new Set<number>();
			for (const link of latestPublished.caseStudyLinks) {
				linkedCaseStudyIds.add(link.caseStudyId);
			}
			linkedCaseStudyCount = linkedCaseStudyIds.size;
		}
	} catch (error) {
		// Log but don't fail - legacy table may have issues
		console.warn(
			"Failed to fetch published versions (legacy table issue):",
			error
		);
	}

	// Detect changes using content-based comparison
	let hasChanges = false;
	if (assuranceCase.published && latestPublished) {
		try {
			const changeResult = await detectChanges(userId, caseId, false);
			hasChanges =
				"data" in changeResult ? changeResult.data.hasChanges : false;
		} catch (error) {
			console.warn("Failed to detect changes:", error);
		}
	}

	return {
		data: {
			publishStatus: assuranceCase.publishStatus,
			isPublished: assuranceCase.published,
			publishedId: latestPublished?.id ?? null,
			publishedAt: assuranceCase.publishedAt,
			markedReadyAt: assuranceCase.markedReadyAt,
			linkedCaseStudyCount,
			hasChanges,
		},
	};
}

/**
 * Marks an assurance case as ready to publish.
 * Transitions from DRAFT to READY_TO_PUBLISH status.
 *
 * Requires EDIT permission or higher.
 */
export async function markCaseAsReady(
	userId: string,
	caseId: string
): Promise<MarkReadyResult> {
	// Check user has EDIT permission
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case to check its current status
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			publishStatus: true,
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	// Only allow transition from DRAFT
	if (assuranceCase.publishStatus !== "DRAFT") {
		return {
			error: `Cannot mark as ready: case is currently ${assuranceCase.publishStatus}`,
		};
	}

	const now = new Date();

	try {
		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: {
				publishStatus: "READY_TO_PUBLISH",
				markedReadyAt: now,
				markedReadyById: userId,
			},
		});

		return { data: { markedReadyAt: now } };
	} catch (error) {
		console.error("Failed to mark case as ready:", error);
		return { error: "Failed to mark case as ready" };
	}
}

/**
 * Unmarks an assurance case as ready to publish.
 * Transitions from READY_TO_PUBLISH back to DRAFT status.
 *
 * Requires EDIT permission or higher.
 */
export async function unmarkCaseAsReady(
	userId: string,
	caseId: string
): Promise<UnmarkReadyResult> {
	// Check user has EDIT permission
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case to check its current status
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			publishStatus: true,
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	// Only allow transition from READY_TO_PUBLISH
	if (assuranceCase.publishStatus !== "READY_TO_PUBLISH") {
		return {
			error: `Cannot unmark: case is currently ${assuranceCase.publishStatus}`,
		};
	}

	try {
		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: {
				publishStatus: "DRAFT",
				markedReadyAt: null,
				markedReadyById: null,
			},
		});

		return { data: { success: true as const } };
	} catch (error) {
		console.error("Failed to unmark case as ready:", error);
		return { error: "Failed to unmark case as ready" };
	}
}

/**
 * Gets cases that are ready to publish for a specific user.
 * Returns cases owned by the user with READY_TO_PUBLISH status.
 */
export async function getReadyToPublishCases(userId: string): Promise<
	{
		id: string;
		name: string;
		description: string;
		markedReadyAt: Date | null;
	}[]
> {
	const cases = await prisma.assuranceCase.findMany({
		where: {
			createdById: userId,
			publishStatus: "READY_TO_PUBLISH",
		},
		select: {
			id: true,
			name: true,
			description: true,
			markedReadyAt: true,
		},
		orderBy: {
			markedReadyAt: "desc",
		},
	});

	return cases;
}

/**
 * Updates an existing published assurance case with current content.
 * Creates a new PublishedAssuranceCase record and migrates case study links.
 *
 * Requires EDIT permission or higher.
 */
export async function updatePublishedCase(
	userId: string,
	caseId: string,
	description?: string
): Promise<PublishResult> {
	// Check user has EDIT permission
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case and current published version
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			name: true,
			published: true,
			publishStatus: true,
			publishedVersions: {
				select: {
					id: true,
					caseStudyLinks: {
						select: {
							caseStudyId: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 1,
			},
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	if (!assuranceCase.published || assuranceCase.publishStatus !== "PUBLISHED") {
		return { error: "Case is not published" };
	}

	const currentPublished = assuranceCase.publishedVersions[0];
	if (!currentPublished) {
		return { error: "No published version found" };
	}

	// Export current case content
	const exportResult = await exportCase(userId, caseId, {
		includeComments: true,
	});

	if ("error" in exportResult) {
		return { error: exportResult.error };
	}

	const now = new Date();

	try {
		// Create new version and migrate links in a transaction
		const newPublished = await prisma.$transaction(async (tx) => {
			// Create new published version
			const published = await tx.publishedAssuranceCase.create({
				data: {
					title: assuranceCase.name,
					content: exportResult.data,
					description: description ?? null,
					assuranceCaseId: caseId,
					createdAt: now,
				},
			});

			// Get case study IDs linked to old version
			const linkedCaseStudyIds = currentPublished.caseStudyLinks.map(
				(link) => link.caseStudyId
			);

			// Migrate links to new version
			if (linkedCaseStudyIds.length > 0) {
				// Delete old links
				await tx.caseStudyPublishedCase.deleteMany({
					where: {
						publishedAssuranceCaseId: currentPublished.id,
					},
				});

				// Create new links
				await tx.caseStudyPublishedCase.createMany({
					data: linkedCaseStudyIds.map((caseStudyId) => ({
						caseStudyId,
						publishedAssuranceCaseId: published.id,
					})),
				});
			}

			// Update case's publishedAt timestamp
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { publishedAt: now },
			});

			return published;
		});

		return {
			data: { publishedId: newPublished.id, publishedAt: now },
		};
	} catch (error) {
		console.error("Failed to update published case:", error);
		return { error: "Failed to update published case" };
	}
}

/**
 * Transitions an assurance case to a new publish status.
 * Handles all valid status transitions with appropriate side effects.
 */
export async function transitionStatus(
	userId: string,
	caseId: string,
	targetStatus: PrismaPublishStatus,
	description?: string
): Promise<StatusTransitionResult> {
	// Get current status first
	const statusResult = await getFullPublishStatus(userId, caseId);
	if (statusResult.error || !statusResult.data) {
		return {
			error: statusResult.error ?? "Failed to get status",
		};
	}

	const currentStatus = statusResult.data.publishStatus;
	const transitionKey = `${currentStatus}->${targetStatus}`;

	return executeStatusTransition(transitionKey, userId, caseId, description);
}

/**
 * Executes the appropriate status transition based on the transition key.
 */
function executeStatusTransition(
	transitionKey: string,
	userId: string,
	caseId: string,
	description?: string
): Promise<StatusTransitionResult> {
	switch (transitionKey) {
		case "DRAFT->READY_TO_PUBLISH":
			return handleMarkAsReady(userId, caseId);

		case "READY_TO_PUBLISH->DRAFT":
			return handleUnmarkAsReady(userId, caseId);

		case "READY_TO_PUBLISH->PUBLISHED":
			return handlePublish(userId, caseId, description);

		case "PUBLISHED->DRAFT":
			return handleUnpublish(userId, caseId);

		case "PUBLISHED->PUBLISHED":
			// Update published case (create new snapshot)
			return handleUpdatePublished(userId, caseId, description);

		default:
			return Promise.resolve({
				error: `Invalid status transition: ${transitionKey.replace("->", " to ")}`,
			});
	}
}

async function handleMarkAsReady(
	userId: string,
	caseId: string
): Promise<StatusTransitionResult> {
	const result = await markCaseAsReady(userId, caseId);
	if ("error" in result) {
		return { error: result.error };
	}
	return { data: { newStatus: "READY_TO_PUBLISH" } };
}

async function handleUnmarkAsReady(
	userId: string,
	caseId: string
): Promise<StatusTransitionResult> {
	const result = await unmarkCaseAsReady(userId, caseId);
	if ("error" in result) {
		return { error: result.error };
	}
	return { data: { newStatus: "DRAFT" } };
}

async function handlePublish(
	userId: string,
	caseId: string,
	description?: string
): Promise<StatusTransitionResult> {
	const result = await publishAssuranceCase(userId, caseId, description);
	if ("error" in result) {
		return { error: result.error };
	}
	return {
		data: {
			newStatus: "PUBLISHED",
			publishedId: result.data.publishedId,
			publishedAt: result.data.publishedAt,
		},
	};
}

async function handleUnpublish(
	userId: string,
	caseId: string
): Promise<StatusTransitionResult> {
	const result = await unpublishAssuranceCase(userId, caseId);
	if ("error" in result) {
		return {
			error: result.error,
			linkedCaseStudies: result.linkedCaseStudies,
		};
	}
	return { data: { newStatus: "DRAFT" } };
}

async function handleUpdatePublished(
	userId: string,
	caseId: string,
	description?: string
): Promise<StatusTransitionResult> {
	const result = await updatePublishedCase(userId, caseId, description);
	if ("error" in result) {
		return { error: result.error };
	}
	return {
		data: {
			newStatus: "PUBLISHED",
			publishedId: result.data.publishedId,
			publishedAt: result.data.publishedAt,
		},
	};
}
