import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { detectChanges } from "@/lib/services/change-detection-service";

/**
 * GET /api/cases/[id]/changes
 *
 * Detects changes between the current case content and its last published version.
 *
 * Query parameters:
 * - includeDetails: "true" to include change summary (addedElements, removedElements, modifiedElements)
 *
 * Returns:
 * {
 *   hasChanges: boolean;
 *   publishedAt: string | null;
 *   publishedId: string | null;
 *   changeSummary?: {
 *     addedElements: number;
 *     removedElements: number;
 *     modifiedElements: number;
 *   }
 * }
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	// Parse query parameters
	const url = new URL(request.url);
	const includeDetails = url.searchParams.get("includeDetails") === "true";

	try {
		const result = await detectChanges(session.user.id, id, includeDetails);

		if (result === null) {
			return NextResponse.json(
				{ error: "Case not found or access denied" },
				{ status: 404 }
			);
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error("[changes API] Error detecting changes:", error);
		return NextResponse.json(
			{ error: "Failed to detect changes" },
			{ status: 500 }
		);
	}
}
