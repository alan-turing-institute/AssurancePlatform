import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import { listTrashedCases } from "@/lib/services/case-trash-service";

/**
 * List cases in the user's trash
 *
 * @description Returns all soft-deleted cases owned by the current user.
 * Only case owners can view their deleted cases; collaborators cannot see
 * deleted cases they were shared with.
 *
 * @response 200 - Array of trashed cases with deletion info
 * @response 401 - Unauthorised
 * @auth bearer
 * @tag Cases
 */
export async function GET() {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const result = await listTrashedCases(validated.userId);

	if (result.error) {
		return NextResponse.json({ error: result.error }, { status: 500 });
	}

	return NextResponse.json(result.data?.cases ?? []);
}
