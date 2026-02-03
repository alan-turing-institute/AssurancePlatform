import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import {
	createCaseStudy,
	getCaseStudiesByOwner,
} from "@/lib/services/case-study-service";
import {
	transformCaseStudiesForApi,
	transformCaseStudyForApi,
} from "@/lib/services/case-study-transforms";

/**
 * GET /api/case-studies
 * List all case studies owned by the current user
 */
export async function GET() {
	try {
		const userId = await requireAuth();
		const caseStudies = await getCaseStudiesByOwner(userId);
		return apiSuccess(transformCaseStudiesForApi(caseStudies));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/case-studies
 * Create a new case study
 */
export async function POST(request: NextRequest) {
	try {
		const userId = await requireAuth();

		const contentType = request.headers.get("content-type") ?? "";

		let data: Record<string, unknown>;

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			data = {
				title: formData.get("title") as string,
				description: formData.get("description") as string | null,
				authors: formData.get("authors") as string | null,
				category: formData.get("category") as string | null,
				sector: formData.get("sector") as string | null,
				contact: formData.get("contact") as string | null,
				type: formData.get("type") as string | null,
				published: formData.get("published") === "true",
			};

			// Handle image file if provided
			const imageFile = formData.get("image") as File | null;
			if (imageFile && imageFile.size > 0) {
				// For now, store a placeholder - image handling would need file storage setup
				data.image = imageFile.name;
			}
		} else {
			data = await request.json();
		}

		if (!data.title || typeof data.title !== "string") {
			return apiError(validationError("Title is required"));
		}

		const caseStudy = await createCaseStudy(userId, {
			title: data.title,
			description: data.description as string | undefined,
			authors: data.authors as string | undefined,
			category: data.category as string | undefined,
			sector: data.sector as string | undefined,
			contact: data.contact as string | undefined,
			type: data.type as string | undefined,
			published: data.published as boolean | undefined,
			image: data.image as string | undefined,
		});

		return apiSuccess(transformCaseStudyForApi(caseStudy), 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
