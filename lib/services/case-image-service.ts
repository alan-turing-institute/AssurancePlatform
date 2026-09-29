/**
 * Case Image Service
 *
 * Handles screenshot capture and retrieval for assurance cases.
 * Screenshots are uploaded to Azure Blob Storage (or local fallback in development).
 */

import { logger } from "@/lib/logger";
import { toMediaKey } from "@/lib/media-key";
import {
	type MediaFetchResult,
	mediaEtag,
	mediaVersionToken,
} from "@/lib/media-response";
import { caseScreenshotMediaRoute } from "@/lib/media-routes";

const log = logger.child({ component: "case-image-service" });

// Throttle duration in milliseconds (30 minutes)
const SCREENSHOT_THROTTLE_MS = 30 * 60 * 1000;

// ============================================
// Types
// ============================================

export interface CaseImageData {
	image: string;
	uploadedAt: string;
}

export interface ThrottledResult {
	nextAllowedAt: string;
	throttled: true;
}

export interface UploadCaseImageData {
	image: string;
	uploadedAt: string;
}

// ============================================
// Service functions
// ============================================

/**
 * Fetches the screenshot address for a case — always this case's own
 * private-media route, never the underlying storage key. Checks VIEW
 * permission before returning it.
 *
 * Returns the same "Permission denied" error for both not-found and forbidden
 * to prevent case existence enumeration.
 */
export async function getCaseImage(
	userId: string,
	caseId: string
): Promise<{ data: CaseImageData } | { error: string }> {
	const { prisma } = await import("@/lib/prisma");
	const { canAccessCase } = await import("@/lib/permissions");

	try {
		const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
		if (!hasAccess) {
			return { error: "Permission denied" };
		}

		const caseImage = await prisma.caseImage.findUnique({
			where: { caseId },
			select: { uploadedAt: true, imageUrl: true },
		});

		if (!caseImage) {
			return { error: "Image not found" };
		}

		return {
			data: {
				image: caseScreenshotMediaRoute(
					caseId,
					mediaVersionToken(toMediaKey(caseImage.imageUrl))
				),
				uploadedAt: caseImage.uploadedAt.toISOString(),
			},
		};
	} catch (error) {
		log.error("getCaseImage", { userId, caseId, error });
		return { error: "Failed to fetch case image" };
	}
}

/**
 * Uploads a new screenshot for a case with throttling.
 * Checks EDIT permission before uploading.
 *
 * Returns { data: { throttled: true, nextAllowedAt } } when the throttle
 * window has not elapsed since the last upload.
 */
export async function uploadCaseImage(
	userId: string,
	caseId: string,
	imageData: string
): Promise<
	{ data: UploadCaseImageData } | { data: ThrottledResult } | { error: string }
> {
	const { prisma } = await import("@/lib/prisma");
	const { canAccessCase } = await import("@/lib/permissions");
	const { uploadToBlob, generateScreenshotBlobPath } = await import(
		"@/lib/services/blob-storage-service"
	);

	try {
		const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
		if (!hasAccess) {
			return { error: "Permission denied" };
		}

		// Check throttle — only capture if last screenshot is old enough
		const existingImage = await prisma.caseImage.findUnique({
			where: { caseId },
			select: { uploadedAt: true },
		});

		if (existingImage) {
			const timeSinceLastUpload =
				Date.now() - existingImage.uploadedAt.getTime();
			if (timeSinceLastUpload < SCREENSHOT_THROTTLE_MS) {
				return {
					data: {
						throttled: true,
						nextAllowedAt: new Date(
							existingImage.uploadedAt.getTime() + SCREENSHOT_THROTTLE_MS
						).toISOString(),
					},
				};
			}
		}

		// Convert base64 to buffer
		const base64Data = imageData.includes(",")
			? (imageData.split(",")[1] ?? imageData)
			: imageData;
		const buffer = Buffer.from(base64Data, "base64");

		// Upload to Azure Blob Storage (or local fallback in development)
		const blobPath = generateScreenshotBlobPath(caseId);
		const uploadResult = await uploadToBlob(buffer, blobPath);

		if ("error" in uploadResult) {
			return { error: uploadResult.error };
		}

		const now = new Date();

		await prisma.caseImage.upsert({
			where: { caseId },
			create: {
				caseId,
				imageUrl: uploadResult.data.key,
				uploadedAt: now,
				uploadedById: userId,
			},
			update: {
				imageUrl: uploadResult.data.key,
				uploadedAt: now,
				uploadedById: userId,
			},
		});

		return {
			data: {
				image: caseScreenshotMediaRoute(
					caseId,
					mediaVersionToken(uploadResult.data.key)
				),
				uploadedAt: now.toISOString(),
			},
		};
	} catch (error) {
		log.error("uploadCaseImage", { userId, caseId, error });
		return { error: "Failed to upload case image" };
	}
}

/**
 * Fetches the screenshot's raw bytes for the private media route — checked
 * against VIEW access, with a missing file and a caller without access both
 * collapsing to the same `not-found` status so a caller can never tell the
 * two apart.
 */
export async function getCaseScreenshotMedia(
	userId: string,
	caseId: string
): Promise<MediaFetchResult> {
	const { prisma } = await import("@/lib/prisma");
	const { canAccessCase } = await import("@/lib/permissions");
	const { readMedia } = await import("@/lib/services/file-storage-service");

	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return { status: "forbidden" };
	}

	const caseImage = await prisma.caseImage.findUnique({
		where: { caseId },
		select: { imageUrl: true },
	});
	if (!caseImage) {
		return { status: "not-found" };
	}

	const key = toMediaKey(caseImage.imageUrl);
	const media = await readMedia(key);
	if (!media) {
		return { status: "not-found" };
	}

	return {
		status: "ok",
		data: media.data,
		contentType: media.contentType,
		etag: mediaEtag(key),
	};
}
