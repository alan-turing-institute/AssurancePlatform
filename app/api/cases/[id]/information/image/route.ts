import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import {
	getCaseInformation,
	upsertCaseInformation,
} from "@/lib/services/case-information-service";
import { deleteFile, saveFile } from "@/lib/services/file-storage-service";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * POST /api/cases/[id]/information/image
 *
 * @description Uploads the feature image for a case's case-information
 * record (ADR 0003 §1). Mirrors the case-study feature-image upload
 * pattern (`/api/case-studies/[id]/image`): the file is saved via the
 * shared file-storage service (Azure Blob in production, local disk in
 * development), then the resulting URL is persisted onto the
 * case-information record. Requires EDIT permission, enforced by
 * `upsertCaseInformation` — if the persist step rejects (no EDIT access),
 * the just-saved file is deleted so nothing orphans in storage.
 *
 * @pathParam id - Case ID (UUID)
 * @body multipart/form-data with an `image` file field
 * @response 200 - `{ featureImageUrl }`
 * @response 400 - No file provided
 * @response 401 - Unauthorised
 * @response 403 - Permission denied (also returned for a non-existent case)
 * @auth bearer
 * @tag Cases
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		// VIEW-gated existence/access check, so an unauthenticated stranger
		// never reaches the storage write below (the EDIT check that
		// actually authorises the change happens in `upsertCaseInformation`).
		const existing = await getCaseInformation(userId, caseId);
		if ("error" in existing) {
			return apiError(serviceErrorToAppError(existing.error));
		}

		const formData = await request.formData();
		const imageFile = formData.get("image") as File | null;

		if (!imageFile || imageFile.size === 0) {
			return apiError(validationError("No image file provided"));
		}

		const saveResult = await saveFile(
			imageFile,
			`cases/${caseId}/case-information`
		);
		if ("error" in saveResult) {
			return apiError(serviceErrorToAppError(saveResult.error));
		}

		const updateResult = await upsertCaseInformation(userId, caseId, {
			featureImageUrl: saveResult.data.path,
		});
		if ("error" in updateResult) {
			// Not authorised to persist the change after all — clean up the
			// file we just wrote rather than leaving it orphaned in storage.
			await deleteFile(saveResult.data.path);
			return apiError(serviceErrorToAppError(updateResult.error));
		}

		// Best-effort cleanup of the previous image, if any and different.
		const previousUrl = existing.data?.featureImageUrl;
		if (previousUrl && previousUrl !== saveResult.data.path) {
			await deleteFile(previousUrl);
		}

		return apiSuccess({ featureImageUrl: saveResult.data.path });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * DELETE /api/cases/[id]/information/image
 *
 * @description Removes the feature image from a case's case-information
 * record. Deletes the stored file (best-effort) and clears
 * `featureImageUrl` on the record. Calls `upsertCaseInformation` directly
 * with an empty string rather than through the zod schema — the schema's
 * `optionalString` transform treats an empty string as "field omitted",
 * which would leave the existing image untouched instead of clearing it.
 * Requires EDIT permission.
 *
 * @pathParam id - Case ID (UUID)
 * @response 200 - `{ success: true }`
 * @response 401 - Unauthorised
 * @response 403 - Permission denied (also returned for a non-existent case)
 * @auth bearer
 * @tag Cases
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const existing = await getCaseInformation(userId, caseId);
		if ("error" in existing) {
			return apiError(serviceErrorToAppError(existing.error));
		}

		const currentUrl = existing.data?.featureImageUrl;

		const updateResult = await upsertCaseInformation(userId, caseId, {
			featureImageUrl: "",
		});
		if ("error" in updateResult) {
			return apiError(serviceErrorToAppError(updateResult.error));
		}

		if (currentUrl) {
			await deleteFile(currentUrl);
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
