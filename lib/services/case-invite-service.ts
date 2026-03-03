import { randomBytes } from "node:crypto";
import { logSecurityEvent } from "@/lib/audit/security-log";
import { prisma } from "@/lib/prisma";
import type { PermissionLevel } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

// ============================================
// Types
// ============================================

export type SecurityContext = {
	ipAddress: string | null;
	userAgent: string | null;
};

export type AcceptInviteResult = { caseId: string };

type InviteTransactionError =
	| { error: "invalid_token" }
	| { error: "expired"; inviteId: string }
	| { error: "already_used"; inviteId: string }
	| { error: "email_mismatch"; inviteId: string; inviteEmail: string };

type InviteTransactionSuccess = { success: true; caseId: string };

type InviteTransactionResult =
	| InviteTransactionError
	| InviteTransactionSuccess;

// ============================================
// Helpers
// ============================================

/**
 * Generates a secure invite token.
 */
export function generateInviteToken(): string {
	return randomBytes(32).toString("hex");
}

/**
 * Creates a case invite record and returns the token.
 */
export async function createCaseInvite(params: {
	caseId: string;
	email: string;
	permission: PermissionLevel;
	invitedById: string;
}): Promise<{ data: { invite_token: string } } | { error: string }> {
	try {
		const token = generateInviteToken();
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

		await prisma.caseInvite.create({
			data: {
				caseId: params.caseId,
				email: params.email,
				permission: params.permission,
				inviteToken: token,
				inviteExpiresAt: expiresAt,
				invitedById: params.invitedById,
			},
		});

		return { data: { invite_token: token } };
	} catch (error) {
		console.error("Failed to create case invite:", error);
		return { error: "Failed to create invite" };
	}
}

// ============================================
// Accept Invite
// ============================================

/**
 * Accepts a case invite using the token.
 */
export async function acceptInvite(
	userId: string,
	inviteToken: string,
	securityContext: SecurityContext = { ipAddress: null, userAgent: null }
): ServiceResult<AcceptInviteResult> {
	const { ipAddress, userAgent } = securityContext;

	try {
		// Validate user exists first (explicit null check)
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (user === null) {
			logSecurityEvent({
				event: "invite_acceptance_user_not_found",
				severity: "medium",
				metadata: {
					userId,
					inviteToken: `${inviteToken.substring(0, 8)}...`,
					ipAddress,
					userAgent,
				},
			});
			return { error: "User not found" };
		}

		// Atomic transaction for invite acceptance (prevents race conditions)
		const result: InviteTransactionResult = await prisma.$transaction(
			async (tx) => {
				// Find invite with implicit row lock
				const invite = await tx.caseInvite.findUnique({
					where: { inviteToken },
				});

				if (!invite) {
					return { error: "invalid_token" as const };
				}

				if (invite.inviteExpiresAt < new Date()) {
					return { error: "expired" as const, inviteId: invite.id };
				}

				// Double-check not already accepted (race condition guard)
				if (invite.acceptedAt !== null) {
					return { error: "already_used" as const, inviteId: invite.id };
				}

				// Email verification
				if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
					return {
						error: "email_mismatch" as const,
						inviteId: invite.id,
						inviteEmail: invite.email,
					};
				}

				// Check existing permission
				const existingPermission = await tx.casePermission.findUnique({
					where: {
						caseId_userId: { caseId: invite.caseId, userId },
					},
				});

				// Grant permission if not exists
				if (!existingPermission) {
					await tx.casePermission.create({
						data: {
							caseId: invite.caseId,
							userId,
							permission: invite.permission,
							grantedById: invite.invitedById,
						},
					});
				}

				// Mark invite as accepted (atomic with permission grant)
				await tx.caseInvite.update({
					where: { inviteToken },
					data: {
						acceptedAt: new Date(),
						acceptedById: userId,
					},
				});

				return { success: true as const, caseId: invite.caseId };
			}
		);

		// Handle transaction results and log appropriately
		if (!("success" in result)) {
			const errorKey = result.error;

			const errorMap = {
				invalid_token: "Invalid invite",
				expired: "Invite has expired",
				already_used: "Invite has already been used",
				email_mismatch: "Invite was sent to a different email address",
			} as const;

			const eventTypeMap = {
				invalid_token: "invite_acceptance_invalid_token",
				expired: "invite_acceptance_expired",
				already_used: "invite_acceptance_already_used",
				email_mismatch: "invite_acceptance_email_mismatch",
			} as const;

			logSecurityEvent({
				event: eventTypeMap[errorKey],
				severity: "medium",
				metadata: {
					userId,
					inviteToken: `${inviteToken.substring(0, 8)}...`,
					...("inviteId" in result && { inviteId: result.inviteId }),
					...("inviteEmail" in result && { inviteEmail: result.inviteEmail }),
					userEmail: user.email,
					ipAddress,
					userAgent,
				},
			});

			return { error: errorMap[errorKey] };
		}

		// Log successful acceptance
		logSecurityEvent({
			event: "invite_acceptance_completed",
			severity: "low",
			metadata: { userId, caseId: result.caseId, ipAddress, userAgent },
		});

		return { data: { caseId: result.caseId } };
	} catch (error) {
		console.error("Failed to accept invite:", error);

		logSecurityEvent({
			event: "invite_acceptance_failed",
			severity: "high",
			metadata: {
				userId,
				error: error instanceof Error ? error.message : "Unknown error",
				inviteToken: `${inviteToken.substring(0, 8)}...`,
				ipAddress,
				userAgent,
			},
		});

		return { error: "Failed to accept invite" };
	}
}
