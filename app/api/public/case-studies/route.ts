import { NextResponse } from "next/server";
import { getPublishedCaseStudies } from "@/lib/services/case-study-service";
import { transformCaseStudiesForApi } from "@/lib/services/case-study-transforms";

/**
 * GET /api/public/case-studies
 * List all published case studies (public access, no auth required)
 */
export async function GET(): Promise<NextResponse> {
	try {
		const caseStudies = await getPublishedCaseStudies();
		return NextResponse.json(transformCaseStudiesForApi(caseStudies));
	} catch (error) {
		console.error("Error fetching published case studies:", error);
		return NextResponse.json(
			{ error: "Failed to fetch case studies" },
			{ status: 500 }
		);
	}
}
