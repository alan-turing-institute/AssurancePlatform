import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { createCaseStudySchema } from "@/lib/schemas/case-study";
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

		let rawData: Record<string, unknown>;

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			rawData = {
				title: formData.get("title") as string,
				description: formData.get("description") as string | null,
				authors: formData.get("authors") as string | null,
				category: formData.get("category") as string | null,
				sector: formData.get("sector") as string | null,
				contact: formData.get("contact") as string | null,
				type: formData.get("type") as string | null,
				published: formData.get("published") as string | null,
			};

			// Handle image file if provided
			const imageFile = formData.get("image") as File | null;
			if (imageFile && imageFile.size > 0) {
				rawData.image = imageFile.name;
			}
		} else {
			rawData = await request.json();
		}

		const parsed = createCaseStudySchema.safeParse(rawData);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		const data = parsed.data;
		const caseStudy = await createCaseStudy(userId, {
			title: data.title,
			description: data.description,
			authors: data.authors,
			category: data.category,
			sector: data.sector,
			contact: data.contact,
			type: data.type,
			published: data.published,
			image: rawData.image as string | undefined,
		});

		return apiSuccess(transformCaseStudyForApi(caseStudy), 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
