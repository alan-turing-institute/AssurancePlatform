import { logSecurityEvent } from "@/lib/audit/security-log";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

export interface RecordSecurityEventParams {
	event: string;
	ipAddress?: string | null;
	metadata?: Record<string, unknown>;
	severity: "low" | "medium" | "high" | "critical";
	userAgent?: string | null;
	userId?: string | null;
}

/**
 * The one shared way to record a security-relevant event: `logSecurityEvent`
 * for structured stdout visibility (`lib/audit/security-log.ts`, Prisma-free
 * by house rule — Prisma is imported only by services and `lib/prisma.ts`)
 * plus a persisted `SecurityAuditLog` row. Originally written inline in
 * `integration-registry-service.ts`'s `writeAuditLog`; lifted out here so
 * every caller shares one pattern instead of each service growing its own
 * copy (`TEA — Persist security audit events`).
 *
 * Contract: this function NEVER throws. By the time a caller reaches this
 * point its own operation has already committed (or is otherwise done), so a
 * failure recording the audit trail must never surface as the calling
 * operation's own failure. If the `SecurityAuditLog` write itself fails,
 * that failure is logged as its own `audit_log_write_failed` event —
 * carrying the event that was meant to be recorded — and swallowed here, not
 * propagated to the caller.
 */
export async function recordSecurityEvent(
	params: RecordSecurityEventParams
): Promise<void> {
	const { event, severity, userId, ipAddress, userAgent, metadata } = params;

	logSecurityEvent({
		event,
		severity,
		metadata: { ...metadata, userId, ipAddress, userAgent },
	});

	try {
		await prisma.securityAuditLog.create({
			data: {
				userId: userId ?? null,
				eventType: event,
				ipAddress: ipAddress ?? null,
				userAgent: userAgent ?? null,
				metadata: (metadata ??
					Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
			},
		});
	} catch (error) {
		logSecurityEvent({
			event: "audit_log_write_failed",
			severity: "high",
			metadata: {
				intendedEventType: event,
				intendedMetadata: metadata,
				userId,
				ipAddress,
				error: error instanceof Error ? error.message : String(error),
			},
		});
	}
}
