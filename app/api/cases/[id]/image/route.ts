import { type NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";

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
	const { id: caseId } = await params;
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { prismaNew } = await import("@/lib/prisma");
	const { getCasePermission } = await import("@/lib/permissions");

	// Check user has permission to view the case
	const permissionResult = await getCasePermission({
		userId: validated.userId,
		caseId,
	});
	if (!permissionResult.hasAccess) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	// Fetch the case image
	const caseImage = await prismaNew.caseImage.findUnique({
		where: { caseId },
		select: { imageUrl: true, uploadedAt: true },
	});

	if (!caseImage) {
		return NextResponse.json({ error: "No image" }, { status: 404 });
	}

	return NextResponse.json({
		image: caseImage.imageUrl,
		uploadedAt: caseImage.uploadedAt.toISOString(),
	});
}

/**
 * POST /api/cases/[id]/image
 * Uploads a new screenshot for a case with throttling.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { prismaNew } = await import("@/lib/prisma");
	const { getCasePermission } = await import("@/lib/permissions");
	const { uploadToBlob, generateScreenshotBlobPath } = await import(
		"@/lib/services/blob-storage-service"
	);

	// Check user has edit permission
	const permissionResult = await getCasePermission({
		userId: validated.userId,
		caseId,
	});
	if (
		!(
			permissionResult.hasAccess &&
			permissionResult.permission &&
			["ADMIN", "EDIT"].includes(permissionResult.permission)
		)
	) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	// Check throttle - only capture if last screenshot is old enough
	const existingImage = await prismaNew.caseImage.findUnique({
		where: { caseId },
		select: { uploadedAt: true },
	});

	if (existingImage) {
		const timeSinceLastUpload = Date.now() - existingImage.uploadedAt.getTime();
		if (timeSinceLastUpload < SCREENSHOT_THROTTLE_MS) {
			return NextResponse.json({
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
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 }
		);
	}

	const { image } = body;
	if (!image) {
		return NextResponse.json({ error: "Missing image data" }, { status: 400 });
	}

	// Convert base64 to buffer
	const base64Data = image.includes(",") ? image.split(",")[1] : image;
	const buffer = Buffer.from(base64Data, "base64");

	// Upload to Azure Blob Storage
	const blobPath = generateScreenshotBlobPath(caseId);
	const uploadResult = await uploadToBlob(buffer, blobPath);

	if (!uploadResult.success) {
		return NextResponse.json({ error: uploadResult.error }, { status: 500 });
	}

	// Upsert the case image record
	const now = new Date();
	await prismaNew.caseImage.upsert({
		where: { caseId },
		create: {
			caseId,
			imageUrl: uploadResult.url,
			uploadedAt: now,
			uploadedById: validated.userId,
		},
		update: {
			imageUrl: uploadResult.url,
			uploadedAt: now,
			uploadedById: validated.userId,
		},
	});

	return NextResponse.json({
		success: true,
		image: uploadResult.url,
		uploadedAt: now.toISOString(),
	});
}
