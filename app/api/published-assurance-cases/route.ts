import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCasesAvailableForCaseStudy } from "@/lib/services/publish-service";

/**
 * GET /api/published-assurance-cases
 *
 * Returns assurance cases that can be linked to case studies.
 * Returns cases owned by the current user with
 * publishStatus in (READY_TO_PUBLISH, PUBLISHED).
 */
export async function GET() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	try {
		const cases = await getCasesAvailableForCaseStudy(session.user.id);

		// Transform to API response format
		const response = cases.map((c) => ({
			id: c.id,
			name: c.name,
			description: c.description,
			publish_status: c.publishStatus,
			published_at: c.publishedAt?.toISOString() ?? null,
			marked_ready_at: c.markedReadyAt?.toISOString() ?? null,
			published_version_id: c.publishedVersionId,
		}));

		return NextResponse.json(response);
	} catch (error) {
		console.error("Error fetching cases for case study:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
