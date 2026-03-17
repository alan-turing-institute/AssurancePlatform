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
	deleteCaseStudy,
	getCaseStudyById,
	updateCaseStudy,
} from "@/lib/services/case-study-service";
import { transformCaseStudyForApi } from "@/lib/services/case-study-transforms";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/case-studies/[id]
 * Get a specific case study by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return apiError(validationError("Invalid case study ID"));
		}

		const result = await getCaseStudyById(caseStudyId, userId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(transformCaseStudyForApi(result.data));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PUT /api/case-studies/[id]
 * Update a case study
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return apiError(validationError("Invalid case study ID"));
		}

		const contentType = request.headers.get("content-type") ?? "";

		let data: Record<string, unknown>;

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			const publishedValue = formData.get("published");
			let published: boolean | undefined;
			if (publishedValue === "true") {
				published = true;
			} else if (publishedValue === "false") {
				published = false;
			}

			data = {
				title: formData.get("title") as string | null,
				description: formData.get("description") as string | null,
				authors: formData.get("authors") as string | null,
				category: formData.get("category") as string | null,
				sector: formData.get("sector") as string | null,
				contact: formData.get("contact") as string | null,
				type: formData.get("type") as string | null,
				published,
			};

			// Handle image file if provided
			const imageFile = formData.get("image") as File | null;
			if (imageFile && imageFile.size > 0) {
				data.image = imageFile.name;
			}
		} else {
			data = await request.json();
		}

		const result = await updateCaseStudy(caseStudyId, userId, {
			title: data.title as string | undefined,
			description: data.description as string | undefined,
			authors: data.authors as string | undefined,
			category: data.category as string | undefined,
			sector: data.sector as string | undefined,
			contact: data.contact as string | undefined,
			type: data.type as string | undefined,
			published: data.published as boolean | undefined,
			image: data.image as string | undefined,
		});

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(transformCaseStudyForApi(result.data));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * DELETE /api/case-studies/[id]
 * Delete a case study
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return apiError(validationError("Invalid case study ID"));
		}

		const result = await deleteCaseStudy(caseStudyId, userId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
