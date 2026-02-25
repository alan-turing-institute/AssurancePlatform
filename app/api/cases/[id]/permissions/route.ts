import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import {
	shareByEmailSchema,
	shareWithTeamSchema,
} from "@/lib/schemas/permission";
import {
	listCasePermissions,
	shareByEmail,
	shareWithTeam,
} from "@/lib/services/case-permission-service";

/**
 * GET /api/cases/[id]/permissions
 * Lists all permissions for a case. Requires ADMIN permission.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;
		const result = await listCasePermissions(userId, caseId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/cases/[id]/permissions
 * Shares a case with a user (by email) or team.
 * Requires ADMIN permission.
 *
 * Body: { type: "user", email: string, permission: string }
 *    or { type: "team", teamId: string, permission: string }
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;
		const body = await request.json().catch(() => null);

		if (body?.type === "team") {
			const parsed = shareWithTeamSchema.safeParse(body);
			if (!parsed.success) {
				return apiError(
					validationError(
						parsed.error.errors[0]?.message ?? "Invalid input"
					)
				);
			}

			const result = await shareWithTeam(userId, caseId, {
				teamId: parsed.data.teamId,
				permission: parsed.data.permission,
			});

			if (result.error) {
				return apiError(serviceErrorToAppError(result.error));
			}

			return apiSuccess(result.data, 201);
		}

		// Default to user share (by email)
		const parsed = shareByEmailSchema.safeParse(body);
		if (!parsed.success) {
			return apiError(
				validationError(
					parsed.error.errors[0]?.message ?? "Invalid input"
				)
			);
		}

		const result = await shareByEmail(userId, caseId, {
			email: parsed.data.email,
			permission: parsed.data.permission,
		});

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Return appropriate response based on result
		if (result.data?.already_shared) {
			return apiSuccess(
				{ message: "User already has access to this case" },
				200
			);
		}

		if (result.data?.invite_created) {
			const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
			const inviteUrl = `${baseUrl}/invites/${result.data.invite_token}`;
			return apiSuccess({ message: "Invite created", invite_url: inviteUrl }, 201);
		}

		return apiSuccess(result.data?.permission, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
