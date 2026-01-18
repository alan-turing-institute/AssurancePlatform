import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import { restoreCase } from "@/lib/services/case-trash-service";

/**
 * Restore a case from trash
 *
 * @description Restores a soft-deleted case, clearing deletedAt and deletedBy fields.
 * Only the case owner can restore their deleted cases.
 *
 * @pathParam id - Case ID (UUID)
 * @response 200 - { success: true }
 * @response 400 - Case is not in trash
 * @response 401 - Unauthorised
 * @response 403 - Permission denied (owner only)
 * @response 404 - Case not found
 * @auth bearer
 * @tag Cases
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id } = await params;

	const result = await restoreCase(validated.userId, id);

	if (result.error) {
		return NextResponse.json(
			{ error: result.error },
			{ status: result.status ?? 500 }
		);
	}

	return NextResponse.json({ success: true });
}
