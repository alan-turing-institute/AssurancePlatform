import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
	getCaseStudyById,
	updateCaseStudyImage,
} from "@/lib/services/case-study-service";
import { deleteFile, saveFile } from "@/lib/services/file-storage-service";

type RouteParams = {
	params: Promise<{ id: string }>;
};

/**
 * POST /api/case-studies/[id]/image
 * Upload a feature image for a case study
 */
export async function POST(
	request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	try {
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return NextResponse.json(
				{ error: "Invalid case study ID" },
				{ status: 400 }
			);
		}

		// Verify ownership
		const caseStudy = await getCaseStudyById(caseStudyId);

		if (!caseStudy) {
			return NextResponse.json(
				{ error: "Case study not found" },
				{ status: 404 }
			);
		}

		if (caseStudy.ownerId !== BigInt(session.user.id)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const formData = await request.formData();
		const imageFile = formData.get("image") as File | null;

		if (!imageFile || imageFile.size === 0) {
			return NextResponse.json(
				{ error: "No image file provided" },
				{ status: 400 }
			);
		}

		// Delete old image if it exists
		if (caseStudy.image) {
			await deleteFile(caseStudy.image);
		}

		// Save the new image to local storage
		const saveResult = await saveFile(imageFile, `case-studies/${caseStudyId}`);

		if (!(saveResult.success && saveResult.path)) {
			return NextResponse.json(
				{ error: saveResult.error ?? "Failed to save image" },
				{ status: 500 }
			);
		}

		// Update the database with the new image path
		const success = await updateCaseStudyImage(caseStudyId, saveResult.path);

		if (!success) {
			// Clean up the saved file if database update fails
			await deleteFile(saveResult.path);
			return NextResponse.json(
				{ error: "Failed to update image" },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			image: saveResult.path,
		});
	} catch (error) {
		console.error("Error uploading case study image:", error);
		return NextResponse.json(
			{ error: "Failed to upload image" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/case-studies/[id]/image
 * Delete the feature image for a case study
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	try {
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return NextResponse.json(
				{ error: "Invalid case study ID" },
				{ status: 400 }
			);
		}

		// Verify ownership
		const caseStudy = await getCaseStudyById(caseStudyId);

		if (!caseStudy) {
			return NextResponse.json(
				{ error: "Case study not found" },
				{ status: 404 }
			);
		}

		if (caseStudy.ownerId !== BigInt(session.user.id)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		// Delete the image file if it exists
		if (caseStudy.image) {
			await deleteFile(caseStudy.image);
		}

		// Update the database to remove the image reference
		const success = await updateCaseStudyImage(caseStudyId, null);

		if (!success) {
			return NextResponse.json(
				{ error: "Failed to delete image" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting case study image:", error);
		return NextResponse.json(
			{ error: "Failed to delete image" },
			{ status: 500 }
		);
	}
}
