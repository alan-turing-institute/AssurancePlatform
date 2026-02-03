import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { AppError, forbidden, notFound, validationError } from "@/lib/errors";

// Throttle duration in milliseconds (30 minutes)
const SCREENSHOT_THROTTLE_MS = 30 * 60 * 1000;

/**
 * GET /api/cases/[id]/image
 * Fetches the screenshot image URL for a case.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const { prismaNew } = await import("@/lib/prisma");
		const { getCasePermission } = await import("@/lib/permissions");

		// Check user has permission to view the case
		const permissionResult = await getCasePermission({
			userId,
			caseId,
		});
		if (!permissionResult.hasAccess) {
			return apiError(notFound());
		}

		// Fetch the case image
		const caseImage = await prismaNew.caseImage.findUnique({
			where: { caseId },
			select: { imageUrl: true, uploadedAt: true },
		});

		if (!caseImage) {
			return apiError(notFound("Image"));
		}

		return apiSuccess({
			image: caseImage.imageUrl,
			uploadedAt: caseImage.uploadedAt.toISOString(),
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/cases/[id]/image
 * Uploads a new screenshot for a case with throttling.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const { prismaNew } = await import("@/lib/prisma");
		const { getCasePermission } = await import("@/lib/permissions");
		const { uploadToBlob, generateScreenshotBlobPath } = await import(
			"@/lib/services/blob-storage-service"
		);

		// Check user has edit permission
		const permissionResult = await getCasePermission({
			userId,
			caseId,
		});
		if (
			!(
				permissionResult.hasAccess &&
				permissionResult.permission &&
				["ADMIN", "EDIT"].includes(permissionResult.permission)
			)
		) {
			return apiError(forbidden());
		}

		// Check throttle - only capture if last screenshot is old enough
		const existingImage = await prismaNew.caseImage.findUnique({
			where: { caseId },
			select: { uploadedAt: true },
		});

		if (existingImage) {
			const timeSinceLastUpload =
				Date.now() - existingImage.uploadedAt.getTime();
			if (timeSinceLastUpload < SCREENSHOT_THROTTLE_MS) {
				return apiSuccess({
					message: "Throttled",
					nextAllowedAt: new Date(
						existingImage.uploadedAt.getTime() + SCREENSHOT_THROTTLE_MS
					).toISOString(),
				});
			}
		}

		// Parse request body
		let body: { image?: string };
		try {
			body = await request.json();
		} catch {
			return apiError(validationError("Invalid request body"));
		}

		const { image } = body;
		if (!image) {
			return apiError(validationError("Missing image data"));
		}

		// Convert base64 to buffer
		const base64Data = image.includes(",") ? image.split(",")[1] : image;
		const buffer = Buffer.from(base64Data, "base64");

		// Upload to Azure Blob Storage
		const blobPath = generateScreenshotBlobPath(caseId);
		const uploadResult = await uploadToBlob(buffer, blobPath);

		if (!uploadResult.success) {
			return apiError(
				new AppError({ code: "INTERNAL", message: uploadResult.error })
			);
		}

		// Upsert the case image record
		const now = new Date();
		await prismaNew.caseImage.upsert({
			where: { caseId },
			create: {
				caseId,
				imageUrl: uploadResult.url,
				uploadedAt: now,
				uploadedById: userId,
			},
			update: {
				imageUrl: uploadResult.url,
				uploadedAt: now,
				uploadedById: userId,
			},
		});

		return apiSuccess({
			success: true,
			image: uploadResult.url,
			uploadedAt: now.toISOString(),
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
