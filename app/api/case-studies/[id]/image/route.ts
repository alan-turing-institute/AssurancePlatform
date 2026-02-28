import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { forbidden, notFound, validationError } from "@/lib/errors";
import {
	deleteCaseStudyImage,
	getCaseStudyById,
	updateCaseStudyImage,
} from "@/lib/services/case-study-service";
import { deleteFile, saveFile } from "@/lib/services/file-storage-service";

type RouteParams = {
	params: Promise<{ id: string }>;
};

/**
 * GET /api/case-studies/[id]/image
 * Fetch the feature image for a case study
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		await requireAuth();
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return apiError(validationError("Invalid case study ID"));
		}

		const caseStudy = await getCaseStudyById(caseStudyId);

		if (!caseStudy) {
			return apiError(notFound("Case study"));
		}

		if (!caseStudy.featureImage?.image) {
			return apiError(notFound("Image"));
		}

		return apiSuccess({
			image: caseStudy.featureImage.image,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/case-studies/[id]/image
 * Upload a feature image for a case study
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return apiError(validationError("Invalid case study ID"));
		}

		// Verify ownership
		const caseStudy = await getCaseStudyById(caseStudyId);

		if (!caseStudy) {
			return apiError(notFound("Case study"));
		}

		if (caseStudy.ownerId !== userId) {
			return apiError(forbidden());
		}

		const formData = await request.formData();
		const imageFile = formData.get("image") as File | null;

		if (!imageFile || imageFile.size === 0) {
			return apiError(validationError("No image file provided"));
		}

		// Delete old image if it exists
		if (caseStudy.featureImage?.image) {
			await deleteFile(caseStudy.featureImage.image);
		}

		// Save the new image to local storage
		const saveResult = await saveFile(imageFile, `case-studies/${caseStudyId}`);

		if ("error" in saveResult) {
			return apiError(serviceErrorToAppError(saveResult.error));
		}

		// Update the database with the new image path
		const success = await updateCaseStudyImage(
			caseStudyId,
			saveResult.data.path
		);

		if (!success) {
			// Clean up the saved file if database update fails
			await deleteFile(saveResult.data.path);
			return apiError(serviceErrorToAppError("Failed to update image"));
		}

		return apiSuccess({
			success: true,
			image: saveResult.data.path,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * DELETE /api/case-studies/[id]/image
 * Delete the feature image for a case study
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return apiError(validationError("Invalid case study ID"));
		}

		// Verify ownership
		const caseStudy = await getCaseStudyById(caseStudyId);

		if (!caseStudy) {
			return apiError(notFound("Case study"));
		}

		if (caseStudy.ownerId !== userId) {
			return apiError(forbidden());
		}

		// Delete the image file if it exists
		if (caseStudy.featureImage?.image) {
			await deleteFile(caseStudy.featureImage.image);
		}

		// Delete the database record
		const success = await deleteCaseStudyImage(caseStudyId);

		if (!success) {
			return apiError(serviceErrorToAppError("Failed to delete image"));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
