interface SecurityEventParams {
	event: string;
	metadata?: Record<string, unknown>;
	severity: "low" | "medium" | "high" | "critical";
}

export function logSecurityEvent({
	event,
	severity,
	metadata,
}: SecurityEventParams): void {
	console.warn(
		`[SECURITY] [${severity.toUpperCase()}] ${event}`,
		metadata ?? ""
	);
}
