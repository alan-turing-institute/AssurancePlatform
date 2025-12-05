import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCasesAvailableForCaseStudy } from "@/lib/services/publish-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * GET /api/published-assurance-cases
 *
 * Returns assurance cases that can be linked to case studies.
 * When using Prisma auth, returns cases owned by the current user with
 * publishStatus in (READY_TO_PUBLISH, PUBLISHED).
 *
 * Query parameters:
 * - forCaseStudy: "true" to filter for case study linking (owner's cases only)
 */
export async function GET(request: NextRequest) {
	// Check for Prisma auth path with forCaseStudy filter
	const url = new URL(request.url);
	const forCaseStudy = url.searchParams.get("forCaseStudy") === "true";

	if (USE_PRISMA_AUTH && forCaseStudy) {
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

	// Legacy Django proxy path
	const authHeader = request.headers.get("Authorization");

	if (!authHeader) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const response = await fetch(
			`${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL}/api/published-assurance-cases/`,
			{
				headers: {
					Authorization: authHeader,
					"Content-Type": "application/json",
					Connection: "close",
				},
				cache: "no-store",
			}
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to fetch" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
