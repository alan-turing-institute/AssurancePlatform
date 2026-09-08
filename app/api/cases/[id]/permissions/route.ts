import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { readJsonBody } from "@/lib/api-request";
import { validationError } from "@/lib/errors";
import {
	shareByEmailSchema,
	shareTypeDiscriminatorSchema,
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

		if ("error" in result) {
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
		const session = await requireAuthSession();
		const { id: caseId } = await params;
		// The schema to validate against depends on `type` — read the raw
		// (still size-capped) body once, peek at the discriminator with a
		// loose pre-parse, then run the real (strict) schema for whichever
		// branch it names.
		const raw = await readJsonBody(request);
		const discriminator = shareTypeDiscriminatorSchema.safeParse(raw);

		if (discriminator.data?.type === "team") {
			const parsed = shareWithTeamSchema.safeParse(raw);
			if (!parsed.success) {
				return apiError(
					validationError(
						parsed.error.issues[0]?.message ?? "Invalid input"
					)
				);
			}

			const result = await shareWithTeam(session.userId, caseId, {
				teamId: parsed.data.teamId,
				permission: parsed.data.permission,
			});

			if ("error" in result) {
				return apiError(serviceErrorToAppError(result.error));
			}

			// Emit SSE event for real-time updates
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			const username = session.username ?? session.email ?? "Someone";
			emitSSEEvent("permission:changed", caseId, {
				username,
				userId: session.userId,
			});

			return apiSuccess(result.data, 201);
		}

		// Default to user share (by email)
		const parsed = shareByEmailSchema.safeParse(raw);
		if (!parsed.success) {
			return apiError(
				validationError(
					parsed.error.issues[0]?.message ?? "Invalid input"
				)
			);
		}

		const result = await shareByEmail(session.userId, caseId, {
			email: parsed.data.email,
			permission: parsed.data.permission,
		});

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username ?? session.email ?? "Someone";
		emitSSEEvent("permission:changed", caseId, {
			username,
			userId: session.userId,
		});

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
