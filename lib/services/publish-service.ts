import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import { captureCaseInformationForSnapshot } from "@/lib/services/case-information-service";
import { detectChanges } from "@/lib/services/change-detection-service";
import { capturePluginDataForSnapshot } from "@/lib/services/plugin-data-service";
import type {
	FullPublishStatus,
	PrismaPublishStatus,
	PublishResult,
	PublishStatus,
	StatusTransitionResult,
	UnpublishResult,
} from "@/lib/services/publish-service.types";
import { generateUniqueSlug } from "@/lib/services/slug-service";
import type { Prisma } from "@/src/generated/prisma";

// Derived from `prisma.$transaction`'s own callback parameter — same pattern
// as `slug-service.ts` (kept local rather than imported: `Prisma.
// TransactionClient` does not structurally match this project's
// `.$extends()`-wrapped client from `lib/prisma.ts`).
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
type TransactionClient = TransactionCallback extends (
	tx: infer T
) => Promise<unknown>
	? T
	: never;

// ============================================
// Shared helpers — publish / republish
// ============================================

/**
 * Composes the JSON snapshot content shared by every publish flow: the
 * exported case tree plus captured plugin data (ADR 0002 v2 §3) and case
 * information (ADR 0003 §3), each included only when present — `undefined`,
 * not an empty object, when there is none — so a snapshot never gains a key
 * for data the case doesn't hold.
 *
 * Shared verbatim between `publishAssuranceCase` (first publish) and
 * `updatePublishedCase` (republish) — both must freeze identical content
 * shapes, so this is the single place that composition happens.
 */
async function composeSnapshotContent(
	userId: string,
	caseId: string
): Promise<{ data: Record<string, unknown> } | { error: string }> {
	const exportResult = await exportCase(userId, caseId, {
		includeComments: true,
	});
	if ("error" in exportResult) {
		return { error: exportResult.error };
	}

	// Every plugin namespace holding data on this case, captured verbatim
	// (ADR 0002 v2 §3) — follows data present, not this (or any) viewer's
	// plugin toggles. `undefined` when the case holds no plugin data at all,
	// so the snapshot gains no `pluginData` key rather than an empty one.
	const pluginData = await capturePluginDataForSnapshot(caseId);
	// Case information (ADR 0003 §3 — "the snapshot freezes metadata as well
	// as content"), composed the same way: `undefined`, not an empty object,
	// when the case has no case information at all.
	const caseInformation = await captureCaseInformationForSnapshot(caseId);

	return {
		data: {
			...exportResult.data,
			...(pluginData && { pluginData }),
			...(caseInformation && { caseInformation }),
		},
	};
}

/**
 * Retires whichever row is currently `isCurrent: true` for `caseId` and
 * inserts its replacement, inside the caller's transaction. Retirement must
 * run BEFORE the insert — the partial unique index on (slug) WHERE
 * is_current would otherwise reject the new row for reusing the same slug
 * while the old row is still marked current.
 *
 * `updateMany` (not `update` on one known id) so this is correct whether
 * zero or one row is currently marked: first-publish has none (this call is
 * then a defensive no-op guarding the "at most one current row per case"
 * invariant against being called twice on an already-published case — e.g.
 * directly via `POST /api/cases/[id]/publish`, outside `transitionStatus`'s
 * DRAFT-only gate); republish has exactly one.
 *
 * Shared verbatim between `publishAssuranceCase` and `updatePublishedCase`;
 * each layers its own extra side effects (case status flip vs case-study
 * link migration) around this call.
 */
async function swapCurrentPublishedVersion(
	tx: TransactionClient,
	input: {
		caseId: string;
		title: string;
		slug: string;
		content: Prisma.InputJsonValue;
		description: string | null;
		createdAt: Date;
	}
) {
	await tx.publishedAssuranceCase.updateMany({
		where: { assuranceCaseId: input.caseId, isCurrent: true },
		data: { isCurrent: false },
	});

	return tx.publishedAssuranceCase.create({
		data: {
			title: input.title,
			slug: input.slug,
			content: input.content,
			description: input.description,
			assuranceCaseId: input.caseId,
			createdAt: input.createdAt,
		},
	});
}

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

	// Compose the JSON snapshot content (export + plugin data + case
	// information) — shared with `updatePublishedCase`, see
	// `composeSnapshotContent` above.
	const contentResult = await composeSnapshotContent(userId, caseId);
	if ("error" in contentResult) {
		return { error: contentResult.error };
	}
	// The composed snapshot is plain JSON but, as a plain object built from
	// named interfaces (`CaseInformationSnapshot` etc.) with no index
	// signature of their own, doesn't structurally satisfy `InputJsonObject`
	// even though every value it can hold is a valid `InputJsonValue`.
	// Routing through `unknown` is TS's own prescribed escape hatch for
	// exactly this "no sufficient overlap" case (same pattern as
	// `health-scoring-service.ts`) — not a blind `any`.
	const content = contentResult.data as unknown as Prisma.InputJsonValue;

	const now = new Date();

	try {
		// Generating the slug and creating the row must share one transaction
		// — otherwise a concurrent first-publish of a same-named case could
		// observe the same "no collision yet" result and both try to claim
		// the identical slug (the table's unique index would then reject the
		// second, surfacing as an opaque 500 rather than the numeric-suffix
		// behaviour ADR 0003 §6 promises).
		const publishedCase = await prisma.$transaction(async (tx) => {
			const slug = await generateUniqueSlug(assuranceCase.name, tx);
			const created = await swapCurrentPublishedVersion(tx, {
				caseId,
				title: assuranceCase.name,
				slug,
				content,
				description: description ?? null,
				createdAt: now,
			});
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: {
					published: true,
					publishedAt: now,
					publishStatus: "PUBLISHED",
				},
			});
			return created;
		});

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
// Publishing Workflow Functions
// ============================================

/**
 * Gets the full publish status (DRAFT / PUBLISHED — the "Ready to Publish"
 * intermediate step was retired, ADR 0003 §2) plus change detection.
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
				where: { isCurrent: true },
				select: {
					id: true,
					slug: true,
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

	// Compose the JSON snapshot content — shared with `publishAssuranceCase`,
	// see `composeSnapshotContent` above.
	const contentResult = await composeSnapshotContent(userId, caseId);
	if ("error" in contentResult) {
		return { error: contentResult.error };
	}
	// See `publishAssuranceCase` above for why this cast is needed.
	const content = contentResult.data as unknown as Prisma.InputJsonValue;

	const now = new Date();

	try {
		// Create new version and migrate links in a transaction
		const newPublished = await prisma.$transaction(async (tx) => {
			// Carrying the EXISTING slug forward verbatim (ADR 0003 §6: stable
			// across renames) — never regenerated here, even if
			// `assuranceCase.name` has changed since first publish.
			const published = await swapCurrentPublishedVersion(tx, {
				caseId,
				title: assuranceCase.name,
				slug: currentPublished.slug,
				content,
				description: description ?? null,
				createdAt: now,
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
		case "DRAFT->PUBLISHED":
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
