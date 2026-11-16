import { createHash, randomBytes } from "node:crypto";
import { identifierFingerprint } from "@/lib/auth/sign-in-identifier";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/services/security-audit-service";
import type { PermissionLevel } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ service: "case-invite-service" });

// ============================================
// Types
// ============================================

export interface SecurityContext {
	ipAddress: string | null;
	userAgent: string | null;
}

export interface AcceptInviteResult {
	caseId: string;
}

type InviteTransactionError =
	| { error: "invalid_token" }
	| { error: "expired"; inviteId: string }
	| { error: "already_used"; inviteId: string }
	| { error: "email_mismatch"; inviteId: string; inviteEmail: string };

interface InviteTransactionSuccess {
	caseId: string;
	success: true;
}

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
 * SHA-256 of an invite token, as stored in `case_invites.invite_token_hash`.
 * The token carries 256 bits of entropy, so a fast unsalted hash is enough; it
 * is only ever compared for an exact match.
 */
export function hashInviteToken(token: string): string {
	return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Creates a case invite record and returns the token.
 */
export async function createCaseInvite(params: {
	caseId: string;
	email: string;
	permission: PermissionLevel;
	invitedById: string;
}): ServiceResult<{ invite_token: string }> {
	try {
		const token = generateInviteToken();
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

		await prisma.caseInvite.create({
			data: {
				caseId: params.caseId,
				email: params.email,
				permission: params.permission,
				inviteTokenHash: hashInviteToken(token),
				inviteExpiresAt: expiresAt,
				invitedById: params.invitedById,
			},
		});

		return { data: { invite_token: token } };
	} catch (error) {
		log.error("Failed to create case invite", { error });
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
	const inviteTokenHash = hashInviteToken(inviteToken);

	try {
		// Validate user exists first (explicit null check)
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (user === null) {
			await recordSecurityEvent({
				event: "invite_acceptance_user_not_found",
				severity: "medium",
				userId,
				ipAddress,
				userAgent,
			});
			return { error: "User not found" };
		}

		// Atomic transaction for invite acceptance (prevents race conditions)
		const result: InviteTransactionResult = await prisma.$transaction(
			async (tx) => {
				// Find invite with implicit row lock
				const invite = await tx.caseInvite.findUnique({
					where: { inviteTokenHash },
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
					where: { id: invite.id },
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

			await recordSecurityEvent({
				event: eventTypeMap[errorKey],
				severity: "medium",
				userId,
				ipAddress,
				userAgent,
				metadata: {
					...("inviteId" in result && { inviteId: result.inviteId }),
					...("inviteEmail" in result && {
						inviteIdentifier: identifierFingerprint(result.inviteEmail),
					}),
					userIdentifier: identifierFingerprint(user.email),
				},
			});

			return { error: errorMap[errorKey] };
		}

		// Log successful acceptance
		await recordSecurityEvent({
			event: "invite_acceptance_completed",
			severity: "low",
			userId,
			ipAddress,
			userAgent,
			metadata: { caseId: result.caseId },
		});

		return { data: { caseId: result.caseId } };
	} catch (error) {
		log.error("Failed to accept invite", { error });

		await recordSecurityEvent({
			event: "invite_acceptance_failed",
			severity: "high",
			userId,
			ipAddress,
			userAgent,
			metadata: {
				error: error instanceof Error ? error.message : "Unknown error",
			},
		});

		return { error: "Failed to accept invite" };
	}
}
