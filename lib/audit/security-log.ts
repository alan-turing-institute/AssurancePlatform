type SecurityEventParams = {
	event: string;
	severity: "low" | "medium" | "high" | "critical";
	metadata?: Record<string, unknown>;
};

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
