import type { NextRequest } from "next/server";
import { readFormDataWithLimit } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { upsertCaseInformationSchema } from "@/lib/schemas/case-information";
import {
	getCaseInformationForEdit,
	upsertCaseInformation,
} from "@/lib/services/case-information-service";
import {
	deleteFile,
	MAX_FILE_SIZE,
	saveFile,
} from "@/lib/services/file-storage-service";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * 16 KiB of headroom over `MAX_FILE_SIZE` for multipart framing (boundary
 * markers and field headers around the actual file bytes), passed to
 * `readFormDataWithLimit` so an oversized request is rejected before the
 * body is fully buffered.
 */
const MAX_IMAGE_UPLOAD_BYTES = MAX_FILE_SIZE + 16 * 1024;

/**
 * Resolves the authenticated user and the case-information record's current
 * state, shared by POST and DELETE below — both need the same EDIT-gated
 * existence/access check before touching storage, so a VIEW-only or
 * inaccessible user is refused before `formData()`, `saveFile` or
 * `deleteFile` ever runs. `upsertCaseInformation` keeps its own EDIT check
 * too (defence in depth), but is no longer the first refusal a VIEW-only
 * user meets. Returns a discriminated union rather than throwing so callers
 * can return the prepared error response directly.
 */
async function requireExistingCaseInformation(params: RouteParams["params"]) {
	const userId = await requireAuth();
	const { id: caseId } = await params;

	const existing = await getCaseInformationForEdit(userId, caseId);
	if ("error" in existing) {
		return {
			ok: false as const,
			response: apiError(serviceErrorToAppError(existing.error)),
		};
	}

	return { ok: true as const, userId, caseId, existing: existing.data };
}

/**
 * POST /api/cases/[id]/information/image
 *
 * @description Uploads the feature image for a case's case-information
 * record (ADR 0003 §1): the file is saved via the shared file-storage
 * service (Azure Blob in production, local disk in development), then the
 * resulting URL is persisted onto the case-information record. Requires
 * EDIT permission, enforced by `requireExistingCaseInformation` before the
 * request body is even parsed — a VIEW-only or inaccessible user is
 * refused before `formData()`, `saveFile` or `deleteFile` ever runs.
 * `upsertCaseInformation`'s own EDIT check stays as defence in depth; if it
 * ever rejects despite the earlier guard, the just-saved file is deleted so
 * nothing orphans in storage.
 *
 * @pathParam id - Case ID (UUID)
 * @body multipart/form-data with an `image` file field
 * @response 200 - `{ featureImageUrl }`
 * @response 400 - No file provided, or the file's content does not match
 * an allowed image format
 * @response 401 - Unauthorised
 * @response 403 - Permission denied (also returned for a non-existent case)
 * @response 413 - Request body too large, or the file itself exceeds the
 * maximum size even though the request body did not
 * @auth bearer
 * @tag Cases
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const guard = await requireExistingCaseInformation(params);
		if (!guard.ok) {
			return guard.response;
		}
		const { userId, caseId, existing } = guard;

		const formData = await readFormDataWithLimit(
			request,
			MAX_IMAGE_UPLOAD_BYTES
		);
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
		const previousUrl = existing?.featureImageUrl;
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
 * `featureImageUrl` on the record. Goes through `upsertCaseInformationSchema`
 * like every other write, passing `featureImageUrl: null` — the schema
 * treats `null` as an explicit clear, distinct from `undefined` ("leave
 * untouched"), so there is no need to bypass it as a plain string write.
 * Requires EDIT permission, enforced by `requireExistingCaseInformation`
 * before `deleteFile` is ever called.
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
		const guard = await requireExistingCaseInformation(params);
		if (!guard.ok) {
			return guard.response;
		}
		const { userId, caseId, existing } = guard;

		const currentUrl = existing?.featureImageUrl;

		const parsed = upsertCaseInformationSchema.safeParse({
			featureImageUrl: null,
		});
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		const updateResult = await upsertCaseInformation(
			userId,
			caseId,
			parsed.data
		);
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
