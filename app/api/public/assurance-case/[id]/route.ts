import { type NextRequest, NextResponse } from "next/server";
import { getPublishedAssuranceCaseById } from "@/lib/services/case-study-service";
import { transformPublishedCaseForApi } from "@/lib/services/case-study-transforms";

type RouteParams = {
	params: Promise<{ id: string }>;
};

/**
 * GET /api/public/assurance-case/[id]
 * Get a published assurance case by ID (public access, no auth required)
 */
export async function GET(
	_request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	try {
		const { id } = await params;

		const publishedCase = await getPublishedAssuranceCaseById(id);

		if (!publishedCase) {
			return NextResponse.json(
				{ error: "Published assurance case not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(transformPublishedCaseForApi(publishedCase));
	} catch (error) {
		console.error("Error fetching published assurance case:", error);
		return NextResponse.json(
			{ error: "Failed to fetch published assurance case" },
			{ status: 500 }
		);
	}
}
