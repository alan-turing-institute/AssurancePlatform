import { type NextRequest, NextResponse } from "next/server";
import { getPublishedCaseStudyById } from "@/lib/services/case-study-service";
import { transformCaseStudyForApi } from "@/lib/services/case-study-transforms";

type RouteParams = {
	params: Promise<{ id: string }>;
};

/**
 * GET /api/public/case-studies/[id]
 * Get a specific published case study (public access, no auth required)
 */
export async function GET(
	_request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	try {
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return NextResponse.json(
				{ error: "Invalid case study ID" },
				{ status: 400 }
			);
		}

		const caseStudy = await getPublishedCaseStudyById(caseStudyId);

		if (!caseStudy) {
			return NextResponse.json(
				{ error: "Case study not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(transformCaseStudyForApi(caseStudy));
	} catch (error) {
		console.error("Error fetching published case study:", error);
		return NextResponse.json(
			{ error: "Failed to fetch case study" },
			{ status: 500 }
		);
	}
}
