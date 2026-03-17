/**
 * Case Image Service
 *
 * Handles screenshot capture and retrieval for assurance cases.
 * Screenshots are uploaded to Azure Blob Storage (or local fallback in development).
 */

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
 * Fetches the screenshot image URL for a case.
 * Checks VIEW permission before returning image data.
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
			select: { imageUrl: true, uploadedAt: true },
		});

		if (!caseImage) {
			return { error: "Image not found" };
		}

		return {
			data: {
				image: caseImage.imageUrl,
				uploadedAt: caseImage.uploadedAt.toISOString(),
			},
		};
	} catch (error) {
		console.error("[getCaseImage]", { userId, caseId, error });
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
				imageUrl: uploadResult.data.url,
				uploadedAt: now,
				uploadedById: userId,
			},
			update: {
				imageUrl: uploadResult.data.url,
				uploadedAt: now,
				uploadedById: userId,
			},
		});

		return {
			data: {
				image: uploadResult.data.url,
				uploadedAt: now.toISOString(),
			},
		};
	} catch (error) {
		console.error("[uploadCaseImage]", { userId, caseId, error });
		return { error: "Failed to upload case image" };
	}
}
