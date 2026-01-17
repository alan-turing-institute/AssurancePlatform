import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import { purgeCase } from "@/lib/services/case-trash-service";

/**
 * Permanently delete a case from trash
 *
 * @description Permanently deletes a soft-deleted case. This action cannot be undone.
 * Only the case owner can purge their deleted cases.
 * The case must be in trash (deletedAt must be set).
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
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id } = await params;

	const result = await purgeCase(validated.userId, id);

	if (result.error) {
		return NextResponse.json(
			{ error: result.error },
			{ status: result.status ?? 500 }
		);
	}

	return NextResponse.json({ success: true });
}
