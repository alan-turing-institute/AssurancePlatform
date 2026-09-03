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
	log(event, { severity, ...metadata });
}
