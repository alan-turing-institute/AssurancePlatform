import { logger } from "@/lib/logger";

interface SecurityEventParams {
	event: string;
	metadata?: Record<string, unknown>;
	severity: "low" | "medium" | "high" | "critical";
}

const securityLogger = logger.child({ component: "security" });

/**
 * Logs a security-relevant event via the structured logger. `low`/`medium`
 * severity logs at `warn`, `high`/`critical` at `error`; `severity` is kept
 * as a field either way, so a sink or query can select on it directly
 * without depending on which level it was logged at.
 *
 * `severity` is reserved: this function's own argument always wins, and a
 * colliding `metadata.severity` is kept under `caller_severity` rather than
 * dropped. Any other reserved key in `metadata` (`ts`/`level`/`msg`/
 * `component`) flows through to `emit`, which applies the same
 * caller_-namespacing rule — see `lib/logger.ts`.
 */
export function logSecurityEvent({
	event,
	severity,
	metadata,
}: SecurityEventParams): void {
	const log =
		severity === "high" || severity === "critical"
			? securityLogger.error
			: securityLogger.warn;
	const fields: Record<string, unknown> = { ...metadata };
	if ("severity" in fields) {
		fields.caller_severity = fields.severity;
	}
	fields.severity = severity;
	log(event, fields);
}
